const crypto = require('node:crypto');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const supabase = require('../config/supabase');
const {hashPassword} = require('./auth.service');

const PRE_START_EXAM_STATUSES = ['DRAFT', 'GENERATED', 'PUBLISHED'];
const VALID_PARTICIPANT_STATUSES = ['REGISTERED', 'IN_PROGRESS', 'COMPLETED'];
const IMPORT_PREVIEW_TTL_MS = 15 * 60 * 1000;
const EXPORT_URL_TTL_MS = 5 * 60 * 1000;

function getSigningSecret() {
    return process.env.JWT_ACCESS_SECRET || 'olms-dev-export-signing-secret';
}

async function cleanupExpiredPreviewsAsync() {
    try {
        await supabase
            .from('participant_import_previews')
            .delete()
            .lt('expires_at', new Date().toISOString());
    } catch (_) {
        // Non-blocking cleanup
    }
}

function formatParticipant(row) {
    return {
        id: row.id,
        exam_id: row.exam_id,
        student_user_id: row.student_user_id,
        student_profile_id: row.student_profile_id,
        student_code: row.student_code,
        full_name_snapshot: row.full_name_snapshot,
        variant_id: row.variant_id ?? null,
        status: row.status,
        attendance_status: row.attendance_status ?? 'NOT_MARKED'
    };
}

function generateRandomPassword(length = 12) {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '@#$%&*!';
    const all = upper + lower + digits + symbols;

    const chars = [
        upper[crypto.randomInt(upper.length)],
        lower[crypto.randomInt(lower.length)],
        digits[crypto.randomInt(digits.length)],
        symbols[crypto.randomInt(symbols.length)]
    ];

    for (let i = chars.length; i < length; i++) {
        chars.push(all[crypto.randomInt(all.length)]);
    }

    for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
}

function sanitizeSlug(value, maxLen) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .slice(0, maxLen);
}

async function generateUniqueUsername(studentCode, examCode) {
    const scSlug = sanitizeSlug(studentCode, 20) || 'student';
    const ecSlug = sanitizeSlug(examCode, 14) || 'exam';

    for (let attempt = 0; attempt < 5; attempt++) {
        const suffix = crypto.randomBytes(3).toString('hex');
        const candidate = `sv_${scSlug}_${ecSlug}_${suffix}`.slice(0, 50);

        const {data, error} = await supabase
            .from('users')
            .select('id')
            .eq('username', candidate)
            .is('deleted_at', null)
            .maybeSingle();

        if (error) throw error;
        if (!data) return candidate;
    }

    return `sv_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

async function recordAuditLog({actorUserId, action, entityName, entityId, oldValue = null, newValue = null, requestMeta = {}}) {
    try {
        await supabase
            .from('audit_logs')
            .insert({
                actor_user_id: actorUserId || null,
                action,
                entity_name: entityName,
                entity_id: entityId || null,
                old_value: oldValue,
                new_value: newValue,
                ip_address: requestMeta.ip || null,
                user_agent: requestMeta.userAgent ? String(requestMeta.userAgent).slice(0, 255) : null,
                created_at: new Date().toISOString()
            });
    } catch (_) {
        // Non-blocking audit fallback
    }
}

async function findOrCreateStudentProfile({student_code, full_name, email = null}) {
    const now = new Date().toISOString();
    const {data: existing, error: findErr} = await supabase
        .from('student_profiles')
        .select('id, student_code, full_name, email, deleted_at')
        .eq('student_code', student_code)
        .maybeSingle();

    if (findErr) throw findErr;

    if (existing) {
        if (existing.deleted_at) {
            const {data: restored, error: restoreErr} = await supabase
                .from('student_profiles')
                .update({
                    full_name,
                    email: email ?? existing.email ?? null,
                    deleted_at: null,
                    deleted_by: null,
                    updated_at: now
                })
                .eq('id', existing.id)
                .select('id, student_code, full_name, email')
                .single();
            if (restoreErr) throw restoreErr;
            return restored;
        }

        if (email && !existing.email) {
            await supabase
                .from('student_profiles')
                .update({email, updated_at: now})
                .eq('id', existing.id);
        }

        return existing;
    }

    const {data: created, error: createErr} = await supabase
        .from('student_profiles')
        .insert({
            id: crypto.randomUUID(),
            student_code,
            full_name,
            email: email ?? null,
            created_at: now,
            updated_at: now
        })
        .select('id, student_code, full_name, email')
        .single();

    if (createErr) throw createErr;
    return created;
}

async function createStudentUser({studentCode, examCode, fullName, email = null}) {
    const username = await generateUniqueUsername(studentCode, examCode);
    const initialPassword = generateRandomPassword(12);
    const passwordHash = await hashPassword(initialPassword);
    const now = new Date().toISOString();

    const basePayload = {
        id: crypto.randomUUID(),
        username,
        password_hash: passwordHash,
        full_name: fullName,
        email: email ?? null,
        role: 'STUDENT',
        status: 'ACTIVE',
        created_at: now,
        updated_at: now
    };

    let {data: user, error} = await supabase
        .from('users')
        .insert(basePayload)
        .select('id, username, full_name, email, role, status')
        .single();

    // If email is already claimed by another active user (e.g. student already enrolled in a previous exam),
    // keep email on student_profiles and issue the exam-scoped student account with email = null.
    if (error && error.code === '23505' && String(error.message || '').includes('uq_users_email_active')) {
        ({data: user, error} = await supabase
            .from('users')
            .insert({...basePayload, email: null})
            .select('id, username, full_name, email, role, status')
            .single());
    }

    if (error) throw error;

    return {
        user,
        username,
        initial_password: initialPassword
    };
}

async function listParticipants(examId, {q = '', status = null, page = 1, pageSize = 20} = {}) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('participants')
        .select(
            'id, exam_id, student_user_id, student_profile_id, student_code, full_name_snapshot, variant_id, status, attendance_status',
            {count: 'exact'}
        )
        .eq('exam_id', examId)
        .is('deleted_at', null);

    if (q) {
        const safeQ = q.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        query = query.or(`student_code.ilike."%${safeQ}%",full_name_snapshot.ilike."%${safeQ}%"`);
    }

    if (status) {
        query = query.eq('status', status);
    }

    const {data, error, count} = await query
        .order('created_at', {ascending: true})
        .range(from, to);

    if (error) throw error;

    return {
        participants: (data ?? []).map(formatParticipant),
        total: count ?? 0
    };
}

async function enrollParticipant(exam, {student_code, full_name, email = null}, actorUserId, requestMeta = {}) {
    const normalizedCode = student_code.trim();
    const normalizedName = full_name.trim();
    const normalizedEmail = typeof email === 'string' && email.trim() ? email.trim() : null;

    const profile = await findOrCreateStudentProfile({
        student_code: normalizedCode,
        full_name: normalizedName,
        email: normalizedEmail
    });

    const {data: existingRows, error: existingErr} = await supabase
        .from('participants')
        .select('id, student_user_id, student_profile_id, student_code, full_name_snapshot, deleted_at')
        .eq('exam_id', exam.id)
        .or(`student_code.eq."${normalizedCode.replace(/"/g, '\\"')}",student_profile_id.eq.${profile.id}`);

    if (existingErr) throw existingErr;

    const activeRow = (existingRows ?? []).find(r => !r.deleted_at);
    if (activeRow) {
        const err = new Error(`Student ${normalizedCode} is already enrolled in this exam.`);
        err.code = 'ERR_PARTICIPANT_ALREADY_EXISTS';
        err.status = 409;
        throw err;
    }

    const now = new Date().toISOString();
    const deletedRow = (existingRows ?? []).find(r => r.deleted_at);
    let participantRow = null;
    let studentUserId = null;
    let username = null;
    let initial_password = null;

    if (deletedRow) {
        // Reactivate existing student_user_id with a fresh password (participants identity columns are immutable by DB trigger)
        initial_password = generateRandomPassword(12);
        const passwordHash = await hashPassword(initial_password);

        const reactivatePayload = {
            password_hash: passwordHash,
            full_name: normalizedName,
            email: normalizedEmail,
            status: 'ACTIVE',
            deleted_at: null,
            deleted_by: null,
            updated_at: now
        };

        let {data: reactivatedUser, error: userReactivateErr} = await supabase
            .from('users')
            .update(reactivatePayload)
            .eq('id', deletedRow.student_user_id)
            .select('id, username')
            .single();

        if (userReactivateErr && userReactivateErr.code === '23505' && String(userReactivateErr.message || '').includes('uq_users_email_active')) {
            ({data: reactivatedUser, error: userReactivateErr} = await supabase
                .from('users')
                .update({...reactivatePayload, email: null})
                .eq('id', deletedRow.student_user_id)
                .select('id, username')
                .single());
        }

        if (userReactivateErr) throw userReactivateErr;

        studentUserId = reactivatedUser.id;
        username = reactivatedUser.username;

        const {data: reactivated, error: reactivateErr} = await supabase
            .from('participants')
            .update({
                variant_id: null,
                status: 'REGISTERED',
                attendance_status: 'NOT_MARKED',
                deleted_at: null,
                deleted_by: null,
                updated_at: now
            })
            .eq('id', deletedRow.id)
            .select('id, exam_id, student_user_id, student_profile_id, student_code, full_name_snapshot, variant_id, status, attendance_status')
            .single();

        if (reactivateErr) throw reactivateErr;
        participantRow = reactivated;
    } else {
        const createdAccount = await createStudentUser({
            studentCode: normalizedCode,
            examCode: exam.code,
            fullName: normalizedName,
            email: normalizedEmail
        });
        studentUserId = createdAccount.user.id;
        username = createdAccount.username;
        initial_password = createdAccount.initial_password;

        const {data: inserted, error: insertErr} = await supabase
            .from('participants')
            .insert({
                id: crypto.randomUUID(),
                exam_id: exam.id,
                student_user_id: studentUserId,
                student_profile_id: profile.id,
                student_code: normalizedCode,
                full_name_snapshot: normalizedName,
                variant_id: null,
                status: 'REGISTERED',
                attendance_status: 'NOT_MARKED',
                created_at: now,
                updated_at: now
            })
            .select('id, exam_id, student_user_id, student_profile_id, student_code, full_name_snapshot, variant_id, status, attendance_status')
            .single();

        if (insertErr) throw insertErr;
        participantRow = inserted;
    }

    await recordAuditLog({
        actorUserId,
        action: 'PARTICIPANT_ENROLLED',
        entityName: 'participants',
        entityId: participantRow.id,
        newValue: {
            exam_id: exam.id,
            student_code: normalizedCode,
            student_user_id: studentUserId,
            username
        },
        requestMeta
    });

    return {
        participant: formatParticipant(participantRow),
        username,
        initial_password
    };
}

function normalizeHeaderName(raw) {
    return String(raw || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function resolveColumnIndex(headers, aliases) {
    for (let i = 0; i < headers.length; i++) {
        if (aliases.includes(headers[i])) return i;
    }
    return -1;
}

function parseCsvLine(line, delimiter) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === delimiter && !inQuotes) {
            cells.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    cells.push(current.trim());
    return cells;
}

function parseCsvRows(buffer) {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
    return lines.map(line => parseCsvLine(line, delimiter));
}

async function extractSpreadsheetRows(buffer, originalName = '') {
    const ext = String(originalName).toLowerCase().split('.').pop();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
        const err = new Error('File must be .xlsx, .xls, or .csv.');
        err.code = 'ERR_UNSUPPORTED_IMPORT_FILE';
        err.status = 400;
        throw err;
    }

    if (ext === 'csv') {
        return parseCsvRows(buffer);
    }

    // Legacy binary .xls (OLE2 compound file) starts with D0 CF 11 E0, whereas OOXML .xlsx starts with PK (50 4B)
    if (ext === 'xls' && buffer.length >= 2 && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
        const err = new Error('Legacy binary .xls format is not supported; please save as .xlsx or .csv.');
        err.code = 'ERR_UNSUPPORTED_IMPORT_FILE';
        err.status = 400;
        throw err;
    }

    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) return [];

        const rows = [];
        worksheet.eachRow({includeEmpty: false}, (row) => {
            const values = [];
            for (let col = 1; col <= row.cellCount; col++) {
                const cellVal = row.getCell(col).text ?? row.getCell(col).value ?? '';
                values.push(String(cellVal).trim());
            }
            if (values.some(v => v.length > 0)) {
                rows.push(values);
            }
        });
        return rows;
    } catch (e) {
        const err = new Error('Failed to parse Excel spreadsheet file.');
        err.code = 'ERR_INVALID_IMPORT_FILE';
        err.status = 400;
        err.cause = e;
        throw err;
    }
}

async function previewParticipantImport(exam, file, actorUserId) {
    const rawRows = await extractSpreadsheetRows(file.buffer, file.originalname);
    if (rawRows.length < 2) {
        const err = new Error('Import file must contain a header row and at least one data row.');
        err.code = 'ERR_INVALID_IMPORT_FILE';
        err.status = 400;
        throw err;
    }

    const normalizedHeaders = rawRows[0].map(normalizeHeaderName);
    const codeIdx = resolveColumnIndex(normalizedHeaders, ['student_code', 'mssv', 'ma_sv', 'ma_sinh_vien', 'code']);
    const nameIdx = resolveColumnIndex(normalizedHeaders, ['full_name', 'fullname', 'ho_ten', 'ho_va_ten', 'name']);
    const emailIdx = resolveColumnIndex(normalizedHeaders, ['email', 'e_mail']);

    if (codeIdx === -1 || nameIdx === -1) {
        const err = new Error('Import file must include student_code and full_name columns.');
        err.code = 'ERR_INVALID_IMPORT_HEADERS';
        err.status = 400;
        throw err;
    }

    const {data: existingParticipants, error: existingErr} = await supabase
        .from('participants')
        .select('student_code')
        .eq('exam_id', exam.id)
        .is('deleted_at', null);

    if (existingErr) throw existingErr;

    const existingCodes = new Set((existingParticipants ?? []).map(p => String(p.student_code).trim().toLowerCase()));
    const seenInFile = new Set();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    let validCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    const previewRows = [];
    const internalRows = [];

    for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        const rowNo = i + 1;
        const studentCode = String(row[codeIdx] ?? '').trim();
        const fullName = String(row[nameIdx] ?? '').trim();
        const email = emailIdx !== -1 ? String(row[emailIdx] ?? '').trim() : '';

        let valid = true;
        let isDuplicate = false;
        let warning = null;

        if (!studentCode) {
            valid = false;
            warning = 'student_code is required.';
        } else if (studentCode.length > 30) {
            valid = false;
            warning = 'student_code exceeds 30 characters.';
        } else if (!fullName) {
            valid = false;
            warning = 'full_name is required.';
        } else if (fullName.length > 150) {
            valid = false;
            warning = 'full_name exceeds 150 characters.';
        } else if (email && !emailRegex.test(email)) {
            valid = false;
            warning = 'Invalid email format.';
        } else {
            const lowerCode = studentCode.toLowerCase();
            if (seenInFile.has(lowerCode)) {
                valid = false;
                isDuplicate = true;
                warning = 'Duplicate student_code in import file.';
            } else if (existingCodes.has(lowerCode)) {
                valid = false;
                isDuplicate = true;
                warning = 'Student is already enrolled in this exam.';
            }
            seenInFile.add(lowerCode);
        }

        if (valid) {
            validCount++;
        } else if (isDuplicate) {
            duplicateCount++;
        } else {
            invalidCount++;
        }

        previewRows.push({
            row_no: rowNo,
            student_code: studentCode,
            full_name: fullName,
            valid,
            warning
        });

        internalRows.push({
            row_no: rowNo,
            student_code: studentCode,
            full_name: fullName,
            email: email || null,
            valid,
            isDuplicate
        });
    }

    const importToken = crypto.randomUUID();
    const expiresAtIso = new Date(Date.now() + IMPORT_PREVIEW_TTL_MS).toISOString();

    const {error: prevInsErr} = await supabase
        .from('participant_import_previews')
        .insert({
            id: importToken,
            exam_id: exam.id,
            actor_user_id: actorUserId,
            rows: internalRows,
            status: 'PENDING',
            expires_at: expiresAtIso
        });

    if (prevInsErr) throw prevInsErr;
    cleanupExpiredPreviewsAsync();

    return {
        import_token: importToken,
        valid_count: validCount,
        duplicate_count: duplicateCount,
        invalid_count: invalidCount,
        rows: previewRows
    };
}

async function commitParticipantImport(exam, importToken, actorUserId, requestMeta = {}) {
    cleanupExpiredPreviewsAsync();

    const {data: preview, error: findPrevErr} = await supabase
        .from('participant_import_previews')
        .select('id, exam_id, actor_user_id, rows, status, expires_at')
        .eq('id', importToken)
        .maybeSingle();

    if (findPrevErr) throw findPrevErr;

    if (!preview || preview.exam_id !== exam.id || Date.now() >= new Date(preview.expires_at).getTime()) {
        const err = new Error('Invalid or expired import_token.');
        err.code = 'INVALID_IMPORT_TOKEN';
        err.status = 400;
        throw err;
    }

    if (preview.actor_user_id !== actorUserId) {
        const err = new Error('You do not have permission to commit this import preview.');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
    }

    if (preview.status !== 'PENDING') {
        const err = new Error('This import_token has already been committed.');
        err.code = 'CONFLICT';
        err.status = 409;
        throw err;
    }

    const {data: claimed, error: claimErr} = await supabase
        .from('participant_import_previews')
        .update({status: 'COMMITTING'})
        .eq('id', importToken)
        .eq('exam_id', exam.id)
        .eq('status', 'PENDING')
        .select('id')
        .maybeSingle();

    if (claimErr) throw claimErr;
    if (!claimed) {
        const err = new Error('This import_token has already been committed.');
        err.code = 'CONFLICT';
        err.status = 409;
        throw err;
    }

    let createdCount = 0;
    let skippedDuplicateCount = 0;
    let invalidCount = 0;

    try {
        const validRows = [];
        for (const row of preview.rows || []) {
            if (!row.valid) {
                if (row.isDuplicate) skippedDuplicateCount++;
                else invalidCount++;
                continue;
            }
            validRows.push({
                student_code: row.student_code.trim(),
                full_name: row.full_name.trim(),
                email: typeof row.email === 'string' && row.email.trim() ? row.email.trim() : null
            });
        }

        if (validRows.length > 0) {
            const codes = [...new Set(validRows.map(r => r.student_code))];
            const now = new Date().toISOString();

            const [{data: existingProfiles, error: profErr}, {data: existingParts, error: partErr}] = await Promise.all([
                supabase
                    .from('student_profiles')
                    .select('id, student_code, email, deleted_at')
                    .in('student_code', codes),
                supabase
                    .from('participants')
                    .select('id, student_code, student_profile_id, deleted_at')
                    .eq('exam_id', exam.id)
                    .in('student_code', codes)
            ]);

            if (profErr) throw profErr;
            if (partErr) throw partErr;

            const profileByCode = new Map((existingProfiles ?? []).map(p => [String(p.student_code).toLowerCase(), p]));
            const partByCode = new Map();
            for (const p of existingParts ?? []) {
                const key = String(p.student_code).toLowerCase();
                const prev = partByCode.get(key);
                if (!prev || !p.deleted_at) partByCode.set(key, p);
            }

            // Reactivate any soft-deleted profiles in batch; insert missing profiles in batch
            const toRestoreProfiles = [];
            const toCreateProfiles = [];
            for (const r of validRows) {
                const key = r.student_code.toLowerCase();
                const existingPart = partByCode.get(key);
                if (existingPart && !existingPart.deleted_at) continue;

                const prof = profileByCode.get(key);
                if (!prof) {
                    const newProf = {
                        id: crypto.randomUUID(),
                        student_code: r.student_code,
                        full_name: r.full_name,
                        email: r.email,
                        created_at: now,
                        updated_at: now
                    };
                    profileByCode.set(key, newProf);
                    toCreateProfiles.push(newProf);
                } else if (prof.deleted_at) {
                    toRestoreProfiles.push(prof.id);
                    prof.deleted_at = null;
                }
            }

            if (toRestoreProfiles.length > 0) {
                const {error: resProfErr} = await supabase
                    .from('student_profiles')
                    .update({deleted_at: null, deleted_by: null, updated_at: now})
                    .in('id', toRestoreProfiles);
                if (resProfErr) throw resProfErr;
            }

            if (toCreateProfiles.length > 0) {
                const {error: insProfErr} = await supabase.from('student_profiles').insert(toCreateProfiles);
                if (insProfErr) throw insProfErr;
            }

            const batchNewRows = [];
            const reactivateRows = [];
            const seenBatchCodes = new Set();

            for (const r of validRows) {
                const key = r.student_code.toLowerCase();
                if (seenBatchCodes.has(key)) {
                    skippedDuplicateCount++;
                    continue;
                }
                seenBatchCodes.add(key);

                const existingPart = partByCode.get(key);
                if (existingPart && !existingPart.deleted_at) {
                    skippedDuplicateCount++;
                    continue;
                }
                if (existingPart && existingPart.deleted_at) {
                    reactivateRows.push(r);
                } else {
                    batchNewRows.push({...r, profile: profileByCode.get(key)});
                }
            }

            // Re-enrolling previously soft-deleted participants uses existing single-row reactivation path
            for (const r of reactivateRows) {
                await enrollParticipant(exam, r, actorUserId, requestMeta);
                createdCount++;
            }

            if (batchNewRows.length > 0) {
                const ecSlug = sanitizeSlug(exam.code, 14) || 'exam';
                const candidateUsernames = batchNewRows.map(r => {
                    const scSlug = sanitizeSlug(r.student_code, 20) || 'student';
                    return `sv_${scSlug}_${ecSlug}_${crypto.randomBytes(4).toString('hex')}`.slice(0, 50);
                });

                const {data: collidedUsers, error: colErr} = await supabase
                    .from('users')
                    .select('username')
                    .in('username', candidateUsernames)
                    .is('deleted_at', null);
                if (colErr) throw colErr;

                const usedUsernames = new Set((collidedUsers ?? []).map(u => u.username));
                const passwords = batchNewRows.map(() => generateRandomPassword(12));

                // Hash passwords concurrently across libuv threadpool in bounded chunks of 8
                const passwordHashes = new Array(batchNewRows.length);
                for (let start = 0; start < passwords.length; start += 8) {
                    const chunk = passwords.slice(start, start + 8);
                    const hashedChunk = await Promise.all(chunk.map(pw => hashPassword(pw)));
                    for (let j = 0; j < hashedChunk.length; j++) {
                        passwordHashes[start + j] = hashedChunk[j];
                    }
                }

                const userRecords = batchNewRows.map((r, i) => {
                    let uname = candidateUsernames[i];
                    if (usedUsernames.has(uname)) {
                        uname = `sv_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
                    }
                    usedUsernames.add(uname);
                    return {
                        id: crypto.randomUUID(),
                        username: uname,
                        password_hash: passwordHashes[i],
                        full_name: r.full_name,
                        email: r.email,
                        role: 'STUDENT',
                        status: 'ACTIVE',
                        created_at: now,
                        updated_at: now
                    };
                });

                // Deduplicate active emails inside the batch too
                const batchEmails = userRecords.map(u => u.email).filter(Boolean);
                let takenEmails = new Set();
                if (batchEmails.length > 0) {
                    const {data: existingEmailUsers, error: emErr} = await supabase
                        .from('users')
                        .select('email')
                        .in('email', batchEmails)
                        .is('deleted_at', null);
                    if (emErr) throw emErr;
                    takenEmails = new Set((existingEmailUsers ?? []).map(u => String(u.email).toLowerCase()));
                }

                const seenEmailInBatch = new Set();
                for (const u of userRecords) {
                    if (!u.email) continue;
                    const emLower = u.email.toLowerCase();
                    if (takenEmails.has(emLower) || seenEmailInBatch.has(emLower)) {
                        u.email = null;
                    } else {
                        seenEmailInBatch.add(emLower);
                    }
                }

                const {error: insUsersErr} = await supabase.from('users').insert(userRecords);
                if (insUsersErr) throw insUsersErr;

                const participantRecords = batchNewRows.map((r, i) => ({
                    id: crypto.randomUUID(),
                    exam_id: exam.id,
                    student_user_id: userRecords[i].id,
                    student_profile_id: r.profile.id,
                    student_code: r.student_code,
                    full_name_snapshot: r.full_name,
                    variant_id: null,
                    seat_no: null,
                    status: 'REGISTERED',
                    attendance_status: 'NOT_MARKED',
                    created_at: now,
                    updated_at: now
                }));

                const {error: insPartsErr} = await supabase.from('participants').insert(participantRecords);
                if (insPartsErr) throw insPartsErr;

                const auditRows = participantRecords.map((p, i) => ({
                    actor_user_id: actorUserId || null,
                    action: 'PARTICIPANT_ENROLLED',
                    entity_name: 'participants',
                    entity_id: p.id,
                    new_value: {
                        exam_id: exam.id,
                        student_code: p.student_code,
                        student_user_id: p.student_user_id,
                        username: userRecords[i].username
                    },
                    ip_address: requestMeta.ip || null,
                    user_agent: requestMeta.userAgent ? String(requestMeta.userAgent).slice(0, 255) : null,
                    created_at: now
                }));

                try {
                    await supabase.from('audit_logs').insert(auditRows);
                } catch (_) {
                    // Non-blocking audit fallback
                }
                createdCount += participantRecords.length;
            }
        }
    } catch (err) {
        await supabase
            .from('participant_import_previews')
            .update({status: 'PENDING'})
            .eq('id', importToken)
            .eq('status', 'COMMITTING');
        throw err;
    }

    await supabase
        .from('participant_import_previews')
        .update({status: 'COMMITTED', committed_at: new Date().toISOString()})
        .eq('id', importToken);

    await recordAuditLog({
        actorUserId,
        action: 'PARTICIPANTS_IMPORT_COMMITTED',
        entityName: 'exams',
        entityId: exam.id,
        newValue: {
            created_count: createdCount,
            skipped_duplicate_count: skippedDuplicateCount,
            invalid_count: invalidCount
        },
        requestMeta
    });

    return {
        created_count: createdCount,
        skipped_duplicate_count: skippedDuplicateCount,
        invalid_count: invalidCount
    };
}

async function findParticipantById(examId, participantId) {
    const {data, error} = await supabase
        .from('participants')
        .select('id, exam_id, student_user_id, student_profile_id, student_code, full_name_snapshot, variant_id, seat_no, status, attendance_status')
        .eq('id', participantId)
        .eq('exam_id', examId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function removeParticipant(exam, participantId, deletedBy, requestMeta = {}) {
    if (!PRE_START_EXAM_STATUSES.includes(exam.status)) {
        const err = new Error(`Cannot remove participant when exam is in ${exam.status} status.`);
        err.code = 'INVALID_EXAM_STATUS';
        err.status = 409;
        throw err;
    }

    const participant = await findParticipantById(exam.id, participantId);
    if (!participant) {
        const err = new Error('Participant not found in this exam.');
        err.code = 'PARTICIPANT_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    if (participant.status !== 'REGISTERED') {
        const err = new Error('Cannot remove participant who has already started or completed the exam.');
        err.code = 'CONFLICT';
        err.status = 409;
        throw err;
    }

    const {count: submissionCount, error: subErr} = await supabase
        .from('submissions')
        .select('id', {count: 'exact', head: true})
        .eq('participant_id', participantId);

    if (subErr) throw subErr;
    if (submissionCount && submissionCount > 0) {
        const err = new Error('Cannot remove participant with existing submissions.');
        err.code = 'CONFLICT';
        err.status = 409;
        throw err;
    }

    const now = new Date().toISOString();
    const {error: delErr} = await supabase
        .from('participants')
        .update({
            deleted_at: now,
            deleted_by: deletedBy,
            updated_at: now
        })
        .eq('id', participantId)
        .eq('exam_id', exam.id)
        .is('deleted_at', null);

    if (delErr) throw delErr;

    await supabase
        .from('users')
        .update({
            status: 'INACTIVE',
            deleted_at: now,
            deleted_by: deletedBy,
            updated_at: now
        })
        .eq('id', participant.student_user_id)
        .is('deleted_at', null);

    await recordAuditLog({
        actorUserId: deletedBy,
        action: 'PARTICIPANT_REMOVED',
        entityName: 'participants',
        entityId: participantId,
        oldValue: {
            exam_id: exam.id,
            student_code: participant.student_code,
            student_user_id: participant.student_user_id
        },
        requestMeta
    });
}

function signExportPayload(payload) {
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = crypto
        .createHmac('sha256', getSigningSecret())
        .update(encoded)
        .digest('base64url');
    return `${encoded}.${sig}`;
}

function verifyExportToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
        return null;
    }
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;

    const expectedSig = crypto
        .createHmac('sha256', getSigningSecret())
        .update(encoded)
        .digest('base64url');

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
        if (!payload || typeof payload.exp !== 'number' || payload.exp <= Date.now()) {
            return null;
        }
        return payload;
    } catch (_) {
        return null;
    }
}

async function createCredentialsExportLink(exam, format, actorUserId, baseUrl, requestMeta = {}) {
    const expiresAtMs = Date.now() + EXPORT_URL_TTL_MS;
    const expiresAt = new Date(expiresAtMs).toISOString();
    const ext = format === 'PDF' ? 'pdf' : 'xlsx';
    const safeExamCode = sanitizeSlug(exam.code, 20) || 'exam';
    const fileName = `credentials_${safeExamCode}.${ext}`;

    const token = signExportPayload({
        exam_id: exam.id,
        format,
        actor_id: actorUserId,
        exp: expiresAtMs
    });

    const downloadUrl = `${baseUrl}/api/v1/exams/${exam.id}/participants/credentials/download?token=${encodeURIComponent(token)}`;

    await recordAuditLog({
        actorUserId,
        action: 'PARTICIPANTS_CREDENTIALS_EXPORTED',
        entityName: 'exams',
        entityId: exam.id,
        newValue: {
            format,
            file_name: fileName,
            expires_at: expiresAt
        },
        requestMeta
    });

    return {
        download_url: downloadUrl,
        expires_at: expiresAt,
        file_name: fileName
    };
}

async function buildCredentialsExportFile(examId, token) {
    const payload = verifyExportToken(token);
    if (!payload || payload.exam_id !== examId) {
        const err = new Error('Invalid or expired download token.');
        err.code = 'INVALID_DOWNLOAD_TOKEN';
        err.status = 401;
        throw err;
    }

    const {data: rows, error} = await supabase
        .from('participants')
        .select(`
            student_code,
            full_name_snapshot,
            seat_no,
            status,
            users!fk_participants_student_user_id ( username ),
            exam_variants ( variant_code )
        `)
        .eq('exam_id', examId)
        .is('deleted_at', null)
        .order('student_code', {ascending: true});

    if (error) throw error;

    // P-01: NEVER include password or password_hash
    const records = (rows ?? []).map(r => {
        const userObj = Array.isArray(r.users) ? r.users[0] : r.users;
        const variantObj = Array.isArray(r.exam_variants) ? r.exam_variants[0] : r.exam_variants;
        return {
            username: userObj?.username ?? '',
            student_code: r.student_code,
            full_name: r.full_name_snapshot,
            seat_no: r.seat_no ?? '',
            variant_code: variantObj?.variant_code ?? '',
            status: r.status
        };
    });

    if (payload.format === 'PDF') {
        const buffer = await new Promise((resolve, reject) => {
            const doc = new PDFDocument({margin: 40, size: 'A4'});
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            doc.fontSize(14).text('OLMS Exam Participant Credentials (No Passwords)', {align: 'left'});
            doc.moveDown(0.5);
            doc.fontSize(10).text(`Exam ID: ${examId}`);
            doc.text(`Generated at: ${new Date().toISOString()}`);
            doc.moveDown(1);

            doc.fontSize(9).text('username | student_code | full_name | seat_no | variant_code | status');
            doc.moveDown(0.3);
            for (const rec of records) {
                doc.text(`${rec.username} | ${rec.student_code} | ${rec.full_name} | ${rec.seat_no || '-'} | ${rec.variant_code || '-'} | ${rec.status}`);
            }
            doc.end();
        });

        return {
            buffer,
            contentType: 'application/pdf',
            fileName: 'credentials.pdf'
        };
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Credentials');
    sheet.columns = [
        {header: 'username', key: 'username', width: 32},
        {header: 'student_code', key: 'student_code', width: 18},
        {header: 'full_name', key: 'full_name', width: 28},
        {header: 'seat_no', key: 'seat_no', width: 12},
        {header: 'variant_code', key: 'variant_code', width: 15},
        {header: 'status', key: 'status', width: 15}
    ];
    for (const rec of records) {
        sheet.addRow(rec);
    }
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    return {
        buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        fileName: 'credentials.xlsx'
    };
}

async function resetParticipantCredentials(exam, participantId, reason, actorUserId, requestMeta = {}) {
    if (!PRE_START_EXAM_STATUSES.includes(exam.status)) {
        const err = new Error(`Cannot reset participant credentials when exam is in ${exam.status} status.`);
        err.code = 'INVALID_EXAM_STATUS';
        err.status = 409;
        throw err;
    }

    const participant = await findParticipantById(exam.id, participantId);
    if (!participant) {
        const err = new Error('Participant not found in this exam.');
        err.code = 'PARTICIPANT_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    const {data: user, error: userFindErr} = await supabase
        .from('users')
        .select('id, username')
        .eq('id', participant.student_user_id)
        .is('deleted_at', null)
        .maybeSingle();

    if (userFindErr) throw userFindErr;
    if (!user) {
        const err = new Error('Student user account not found.');
        err.code = 'USER_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    const newPassword = generateRandomPassword(12);
    const passwordHash = await hashPassword(newPassword);
    const now = new Date().toISOString();

    const {error: updateUserErr} = await supabase
        .from('users')
        .update({
            password_hash: passwordHash,
            updated_at: now
        })
        .eq('id', user.id)
        .is('deleted_at', null);

    if (updateUserErr) throw updateUserErr;

    await supabase
        .from('refresh_tokens')
        .update({revoked_at: now})
        .eq('user_id', user.id)
        .is('revoked_at', null);

    await recordAuditLog({
        actorUserId,
        action: 'PARTICIPANT_CREDENTIAL_RESET',
        entityName: 'participants',
        entityId: participantId,
        newValue: {
            exam_id: exam.id,
            student_user_id: user.id,
            username: user.username,
            reason: reason.trim()
        },
        requestMeta
    });

    return {
        participant: formatParticipant(participant),
        username: user.username,
        initial_password: newPassword
    };
}

module.exports = {
    PRE_START_EXAM_STATUSES,
    VALID_PARTICIPANT_STATUSES,
    listParticipants,
    enrollParticipant,
    previewParticipantImport,
    commitParticipantImport,
    findParticipantById,
    removeParticipant,
    createCredentialsExportLink,
    buildCredentialsExportFile,
    resetParticipantCredentials,
    formatParticipant
};
