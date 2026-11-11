const crypto = require('node:crypto');
const supabase = require('../config/supabase');
const {UUID_REGEX} = require('../validators/answer-spec.validator');

const {requireExamOpened} = require('./exams.service');

const STUDENT_VISIBLE_EXAM_STATUSES = ['PUBLISHED', 'IN_PROGRESS', 'ENDED', 'RESULT_PUBLISHED'];

function indexToDisplayLabel(idx) {
    if (idx < 26) return String.fromCharCode(65 + idx);
    return `O${idx + 1}`;
}

function getOrderedChoices(optionsSnapshot, optionOrder) {
    const choices = Array.isArray(optionsSnapshot?.choices) ? optionsSnapshot.choices : [];
    const byId = new Map(choices.map(c => [String(c.id), c]));
    const ordered = [];
    const seen = new Set();

    if (Array.isArray(optionOrder)) {
        for (const idOrIdx of optionOrder) {
            const key = String(idOrIdx);
            const found = byId.get(key) || (typeof idOrIdx === 'number' ? choices[idOrIdx] : null);
            if (found && !seen.has(found)) {
                ordered.push(found);
                seen.add(found);
            }
        }
    }

    for (const c of choices) {
        if (!seen.has(c)) {
            ordered.push(c);
            seen.add(c);
        }
    }

    return ordered;
}

function getOrderedMatchingPairs(optionsSnapshot, optionOrder) {
    const rightItems = Array.isArray(optionsSnapshot?.right_items) ? optionsSnapshot.right_items : [];
    const leftItems = Array.isArray(optionsSnapshot?.left_items) ? optionsSnapshot.left_items : [];
    const pairs = Array.isArray(optionsSnapshot?.pairs) ? optionsSnapshot.pairs : [];

    // optionOrder for MATCHING stores pair IDs or indexes if shuffled; shuffle right_items deterministically if needed
    if (!Array.isArray(optionOrder) || optionOrder.length === 0 || pairs.length === 0) {
        return {
            left_items: leftItems.map(item => ({id: item.id, label: item.label})),
            right_items: rightItems.map(item => ({id: item.id, label: item.label}))
        };
    }

    const pairRightById = new Map(pairs.map(p => [String(p.id), String(p.right_id)]));
    const rightById = new Map(rightItems.map(r => [String(r.id), r]));
    const orderedRights = [];
    const seen = new Set();

    for (const entry of optionOrder) {
        const rightId = pairRightById.get(String(entry)) || (typeof entry === 'number' ? pairs[entry]?.right_id : null);
        const item = rightId ? rightById.get(String(rightId)) : null;
        if (item && !seen.has(item)) {
            orderedRights.push({id: item.id, label: item.label});
            seen.add(item);
        }
    }
    for (const item of rightItems) {
        if (!seen.has(item)) {
            orderedRights.push({id: item.id, label: item.label});
            seen.add(item);
        }
    }

    return {
        left_items: leftItems.map(item => ({id: item.id, label: item.label})),
        right_items: orderedRights
    };
}

function getOrderedDropdownBlanks(optionsSnapshot, optionOrder) {
    const blanks = Array.isArray(optionsSnapshot?.blanks) ? optionsSnapshot.blanks : [];
    const orderByBlankId = new Map();

    if (Array.isArray(optionOrder)) {
        for (const entry of optionOrder) {
            if (entry && typeof entry === 'object' && entry.blank_id && Array.isArray(entry.choice_order)) {
                orderByBlankId.set(String(entry.blank_id), entry.choice_order.map(String));
            }
        }
    }

    return blanks.map(b => {
        const choices = Array.isArray(b.choices) ? b.choices : [];
        const desiredOrder = orderByBlankId.get(String(b.blank_id));
        if (!desiredOrder || desiredOrder.length === 0) {
            return {
                blank_id: b.blank_id,
                choices: choices.map(ch => ({value_id: ch.value_id, label: ch.label}))
            };
        }

        const byValueId = new Map(choices.map(ch => [String(ch.value_id), ch]));
        const ordered = [];
        const seen = new Set();

        for (const vid of desiredOrder) {
            const found = byValueId.get(vid);
            if (found && !seen.has(found)) {
                ordered.push({value_id: found.value_id, label: found.label});
                seen.add(found);
            }
        }
        for (const ch of choices) {
            if (!seen.has(ch)) {
                ordered.push({value_id: ch.value_id, label: ch.label});
                seen.add(ch);
            }
        }

        return {
            blank_id: b.blank_id,
            choices: ordered
        };
    });
}

function buildStudentRenderSpec(optionsSnapshot, optionOrder) {
    if (!optionsSnapshot || typeof optionsSnapshot !== 'object') {
        return null;
    }

    switch (optionsSnapshot.kind) {
        case 'SINGLE_CHOICE':
        case 'MULTI_CHOICE': {
            const orderedChoices = getOrderedChoices(optionsSnapshot, optionOrder);
            return {
                schema_version: 1,
                kind: optionsSnapshot.kind,
                choices: orderedChoices.map((c, idx) => ({
                    display_label: indexToDisplayLabel(idx),
                    text: c.text
                }))
            };
        }
        case 'DROPDOWN': {
            return {
                schema_version: 1,
                kind: 'DROPDOWN',
                blanks: getOrderedDropdownBlanks(optionsSnapshot, optionOrder)
            };
        }
        case 'INPUT': {
            return {
                schema_version: 1,
                kind: 'INPUT',
                input_hint: optionsSnapshot.input_hint ?? null
            };
        }
        case 'MATCHING': {
            const {left_items, right_items} = getOrderedMatchingPairs(optionsSnapshot, optionOrder);
            return {
                schema_version: 1,
                kind: 'MATCHING',
                left_items,
                right_items
            };
        }
        default:
            return null;
    }
}

function computeDeadlineIso(startedAtIso, durationMinutes, closesAtIso) {
    const startedMs = new Date(startedAtIso).getTime();
    const durationDeadlineMs = startedMs + Number(durationMinutes) * 60 * 1000;
    const closesMs = new Date(closesAtIso).getTime();
    return new Date(Math.min(durationDeadlineMs, closesMs)).toISOString();
}

function formatExamForStudent(exam) {
    return {
        id: exam.id,
        code: exam.code,
        name: exam.name,
        subject_id: exam.subject_id,
        status: exam.status,
        delivery_mode: exam.delivery_mode,
        total_questions: exam.total_questions,
        duration_minutes: exam.duration_minutes,
        opens_at: exam.opens_at,
        closes_at: exam.closes_at,
        total_score: exam.total_score !== null && exam.total_score !== undefined ? Number(exam.total_score) : null,
        result_visibility_mode: exam.result_visibility_mode,
        created_by: exam.created_by
    };
}

function formatSavedAnswer(row, responseKind) {
    const base = {
        exam_variant_question_id: row.exam_variant_question_id,
        client_sequence: Number(row.client_sequence ?? 0),
        response_kind: responseKind
    };
    if (Array.isArray(row.selected_options)) {
        base.selected_options = row.selected_options;
    }
    if (row.answer_text !== undefined && row.answer_text !== null) {
        base.answer_text = row.answer_text;
    }
    if (row.response_data !== undefined && row.response_data !== null) {
        base.response_data = row.response_data;
    }
    return base;
}

async function listMyExams(studentUserId) {
    const {data, error} = await supabase
        .from('participants')
        .select(`
            id,
            status,
            exams!inner (
                id,
                code,
                name,
                subject_id,
                status,
                delivery_mode,
                total_questions,
                duration_minutes,
                opens_at,
                closes_at,
                total_score,
                result_visibility_mode,
                created_by,
                deleted_at
            )
        `)
        .eq('student_user_id', studentUserId)
        .is('deleted_at', null)
        .is('exams.deleted_at', null)
        .in('exams.status', STUDENT_VISIBLE_EXAM_STATUSES);

    if (error) throw error;

    const exams = (data ?? [])
        .map(row => (Array.isArray(row.exams) ? row.exams[0] : row.exams))
        .filter(Boolean)
        .sort((a, b) => new Date(a.opens_at) - new Date(b.opens_at))
        .map(formatExamForStudent);

    return exams;
}

async function findParticipantAndExam(examId, studentUserId) {
    const {data: exam, error: examErr} = await supabase
        .from('exams')
        .select('id, code, name, subject_id, status, delivery_mode, total_questions, duration_minutes, opens_at, closes_at, total_score, result_visibility_mode')
        .eq('id', examId)
        .is('deleted_at', null)
        .maybeSingle();

    if (examErr) throw examErr;
    if (!exam) {
        const err = new Error('Exam not found.');
        err.code = 'EXAM_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    const {data: participant, error: partErr} = await supabase
        .from('participants')
        .select('id, exam_id, student_user_id, variant_id, status, attendance_status')
        .eq('exam_id', examId)
        .eq('student_user_id', studentUserId)
        .is('deleted_at', null)
        .maybeSingle();

    if (partErr) throw partErr;
    if (!participant) {
        const err = new Error('You are not enrolled in this exam.');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
    }

    requireExamOpened(exam);
    return {exam, participant};
}

async function chooseVariantForParticipant(examId) {
    const {data: variants, error} = await supabase
        .from('exam_variants')
        .select('id, variant_code, is_root')
        .eq('exam_id', examId)
        .is('deleted_at', null)
        .order('variant_code', {ascending: true});

    if (error) throw error;
    if (!variants || variants.length === 0) {
        const err = new Error('Exam has no generated variants available.');
        err.code = 'VARIANTS_NOT_GENERATED';
        err.status = 409;
        throw err;
    }

    const nonRoot = variants.filter(v => !v.is_root);
    const pool = nonRoot.length > 0 ? nonRoot : variants;
    return pool[crypto.randomInt(pool.length)];
}

async function buildSessionPayload(exam, submission) {
    const [
        {data: variant, error: varErr},
        {data: evqRows, error: evqErr},
        {data: answerRows, error: ansErr}
    ] = await Promise.all([
        supabase
            .from('exam_variants')
            .select('id, variant_code')
            .eq('id', submission.variant_id)
            .is('deleted_at', null)
            .single(),
        supabase
            .from('exam_variant_questions')
            .select(`
                id,
                position_in_variant,
                option_order,
                question_versions!inner (
                    id,
                    content,
                    media_url,
                    options_snapshot,
                    question_types!inner ( code )
                )
            `)
            .eq('variant_id', submission.variant_id)
            .order('position_in_variant', {ascending: true}),
        supabase
            .from('student_answers')
            .select('exam_variant_question_id, client_sequence, selected_options, answer_text, response_data')
            .eq('submission_id', submission.id)
    ]);

    if (varErr) throw varErr;
    if (evqErr) throw evqErr;
    if (ansErr) throw ansErr;

    const kindByEvqId = new Map();
    const questions = (evqRows ?? []).map(row => {
        const qv = Array.isArray(row.question_versions) ? row.question_versions[0] : row.question_versions;
        const qt = qv && (Array.isArray(qv.question_types) ? qv.question_types[0] : qv.question_types);
        const typeCode = qt?.code || qv?.options_snapshot?.kind || 'SINGLE_CHOICE';
        kindByEvqId.set(row.id, typeCode);

        return {
            exam_variant_question_id: row.id,
            position: row.position_in_variant,
            type_code: typeCode,
            content: qv?.content || '',
            media_url: qv?.media_url ?? null,
            render_spec: buildStudentRenderSpec(qv?.options_snapshot, row.option_order)
        };
    });

    const savedAnswers = (answerRows ?? []).map(row =>
        formatSavedAnswer(row, kindByEvqId.get(row.exam_variant_question_id) || 'SINGLE_CHOICE')
    );

    const serverTimeIso = new Date().toISOString();
    const deadlineIso = computeDeadlineIso(submission.started_at, exam.duration_minutes, exam.closes_at);
    const remainingSeconds = Math.max(0, Math.floor((new Date(deadlineIso).getTime() - Date.now()) / 1000));

    return {
        submission_id: submission.id,
        exam_id: exam.id,
        variant_code: variant.variant_code,
        status: submission.status,
        started_at: submission.started_at,
        deadline_at: deadlineIso,
        server_time: serverTimeIso,
        remaining_seconds: remainingSeconds,
        questions,
        saved_answers: savedAnswers
    };
}

async function startOrResumeSession(examId, studentUserId) {
    const {exam, participant} = await findParticipantAndExam(examId, studentUserId);

    if (!['ONLINE', 'BOTH'].includes(exam.delivery_mode)) {
        const err = new Error('This exam is paper-only and does not support online sessions.');
        err.code = 'INVALID_DELIVERY_MODE';
        err.status = 409;
        throw err;
    }

    const {data: existingSubmission, error: findSubErr} = await supabase
        .from('submissions')
        .select('id, participant_id, exam_id, variant_id, source, started_at, submitted_at, status')
        .eq('participant_id', participant.id)
        .maybeSingle();

    if (findSubErr) throw findSubErr;

    if (existingSubmission) {
        if (existingSubmission.status !== 'IN_PROGRESS') {
            const err = new Error('Your exam session has already been submitted or closed.');
            err.code = 'SUBMISSION_ALREADY_CLOSED';
            err.status = 409;
            throw err;
        }

        if (exam.status !== 'IN_PROGRESS') {
            const err = new Error(`Exam is not currently in progress (status: ${exam.status}).`);
            err.code = 'INVALID_EXAM_STATUS';
            err.status = 409;
            throw err;
        }

        const deadlineIso = computeDeadlineIso(existingSubmission.started_at, exam.duration_minutes, exam.closes_at);
        if (Date.now() >= new Date(deadlineIso).getTime()) {
            const err = new Error('Exam session deadline has expired.');
            err.code = 'SESSION_EXPIRED';
            err.status = 403;
            throw err;
        }

        return await buildSessionPayload(exam, existingSubmission);
    }

    // Creating a brand-new session
    if (exam.status !== 'IN_PROGRESS') {
        const err = new Error(`Exam is not currently in progress (status: ${exam.status}).`);
        err.code = 'INVALID_EXAM_STATUS';
        err.status = 409;
        throw err;
    }

    if (Date.now() >= new Date(exam.closes_at).getTime()) {
        const err = new Error('Exam closing time has already passed.');
        err.code = 'SESSION_EXPIRED';
        err.status = 403;
        throw err;
    }

    let variantId = participant.variant_id;
    if (!variantId) {
        const chosen = await chooseVariantForParticipant(exam.id);
        variantId = chosen.id;

        const {error: assignErr} = await supabase
            .from('participants')
            .update({
                variant_id: variantId,
                attendance_status: 'PRESENT',
                updated_at: new Date().toISOString()
            })
            .eq('id', participant.id)
            .is('deleted_at', null);

        if (assignErr) throw assignErr;
    } else if (participant.attendance_status !== 'PRESENT') {
        await supabase
            .from('participants')
            .update({
                attendance_status: 'PRESENT',
                updated_at: new Date().toISOString()
            })
            .eq('id', participant.id)
            .is('deleted_at', null);
    }

    const {data: createdSub, error: insertSubErr} = await supabase
        .from('submissions')
        .insert({
            id: crypto.randomUUID(),
            participant_id: participant.id,
            exam_id: exam.id,
            variant_id: variantId,
            source: 'ONLINE',
            status: 'IN_PROGRESS'
        })
        .select('id, participant_id, exam_id, variant_id, source, started_at, submitted_at, status')
        .single();

    if (insertSubErr) {
        // Concurrent session start hit uq_submissions_participant -> fetch and resume idempotently
        if (insertSubErr.code === '23505') {
            const {data: concurrentSub, error: refetchErr} = await supabase
                .from('submissions')
                .select('id, participant_id, exam_id, variant_id, source, started_at, submitted_at, status')
                .eq('participant_id', participant.id)
                .single();
            if (refetchErr) throw refetchErr;
            if (concurrentSub.status !== 'IN_PROGRESS') {
                const err = new Error('Your exam session has already been submitted or closed.');
                err.code = 'SUBMISSION_ALREADY_CLOSED';
                err.status = 409;
                throw err;
            }
            return await buildSessionPayload(exam, concurrentSub);
        }
        throw insertSubErr;
    }

    return await buildSessionPayload(exam, createdSub);
}

async function getActiveSession(examId, studentUserId) {
    const {exam, participant} = await findParticipantAndExam(examId, studentUserId);

    const {data: submission, error: subErr} = await supabase
        .from('submissions')
        .select('id, participant_id, exam_id, variant_id, source, started_at, submitted_at, status')
        .eq('participant_id', participant.id)
        .maybeSingle();

    if (subErr) throw subErr;
    if (!submission) {
        const err = new Error('No exam session has been started yet.');
        err.code = 'SESSION_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    if (submission.status !== 'IN_PROGRESS') {
        const err = new Error('Your exam session has already been submitted or closed.');
        err.code = 'SUBMISSION_ALREADY_CLOSED';
        err.status = 409;
        throw err;
    }

    if (exam.status !== 'IN_PROGRESS') {
        const err = new Error(`Exam is not currently in progress (status: ${exam.status}).`);
        err.code = 'INVALID_EXAM_STATUS';
        err.status = 409;
        throw err;
    }

    const deadlineIso = computeDeadlineIso(submission.started_at, exam.duration_minutes, exam.closes_at);
    if (Date.now() >= new Date(deadlineIso).getTime()) {
        const err = new Error('Exam session deadline has expired.');
        err.code = 'SESSION_EXPIRED';
        err.status = 403;
        throw err;
    }

    return await buildSessionPayload(exam, submission);
}

function validateAutosavePayload(body, optionsSnapshot, optionOrder) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return {status: 400, code: 'VALIDATION_ERROR', message: 'Request body must be a JSON object.'};
    }

    const expectedKind = optionsSnapshot?.kind;
    if (typeof body.response_kind !== 'string') {
        return {status: 400, code: 'VALIDATION_ERROR', message: 'response_kind is required.'};
    }
    if (body.response_kind !== expectedKind) {
        return {
            status: 422,
            code: 'UNPROCESSABLE_ENTITY',
            message: `response_kind '${body.response_kind}' does not match question kind '${expectedKind}'.`
        };
    }

    if (!Number.isInteger(body.expected_client_sequence) || body.expected_client_sequence < 0) {
        return {status: 400, code: 'VALIDATION_ERROR', message: 'expected_client_sequence must be an integer >= 0.'};
    }

    if (!Number.isInteger(body.client_sequence) || body.client_sequence !== body.expected_client_sequence + 1) {
        return {
            status: 400,
            code: 'VALIDATION_ERROR',
            message: 'client_sequence must equal expected_client_sequence + 1.'
        };
    }

    if (typeof body.edit_token !== 'string' || !UUID_REGEX.test(body.edit_token)) {
        return {status: 400, code: 'VALIDATION_ERROR', message: 'edit_token is required and must be a valid UUID.'};
    }

    const commonKeys = ['response_kind', 'client_sequence', 'expected_client_sequence', 'edit_token'];

    switch (expectedKind) {
        case 'SINGLE_CHOICE':
        case 'MULTI_CHOICE': {
            const allowed = [...commonKeys, 'selected_options'];
            if (Object.keys(body).some(k => !allowed.includes(k))) {
                return {status: 400, code: 'VALIDATION_ERROR', message: 'Request contains unsupported fields.'};
            }
            if (!Array.isArray(body.selected_options)) {
                return {status: 400, code: 'VALIDATION_ERROR', message: 'selected_options must be an array.'};
            }
            if (expectedKind === 'SINGLE_CHOICE' && body.selected_options.length > 1) {
                return {status: 400, code: 'VALIDATION_ERROR', message: 'SINGLE_CHOICE selected_options may contain at most 1 item.'};
            }
            const unique = new Set(body.selected_options);
            if (unique.size !== body.selected_options.length) {
                return {status: 400, code: 'VALIDATION_ERROR', message: 'selected_options must not contain duplicates.'};
            }

            const orderedChoices = getOrderedChoices(optionsSnapshot, optionOrder);
            const validLabels = new Set(orderedChoices.map((_, idx) => indexToDisplayLabel(idx)));
            for (const opt of body.selected_options) {
                if (typeof opt !== 'string' || !validLabels.has(opt)) {
                    return {
                        status: 422,
                        code: 'UNPROCESSABLE_ENTITY',
                        message: `Unknown option label '${opt}' for this variant question.`
                    };
                }
            }

            return {
                p_selected_options: body.selected_options,
                p_answer_text: null,
                p_response_data: null
            };
        }

        case 'DROPDOWN': {
            const allowed = [...commonKeys, 'response_data'];
            if (Object.keys(body).some(k => !allowed.includes(k))) {
                return {status: 400, code: 'VALIDATION_ERROR', message: 'Request contains unsupported fields.'};
            }
            const rd = body.response_data;
            if (!rd || typeof rd !== 'object' || Array.isArray(rd) || rd.kind !== 'DROPDOWN' || !Array.isArray(rd.selections)) {
                return {status: 400, code: 'VALIDATION_ERROR', message: 'response_data must be a DropdownResponse object.'};
            }
            if (Object.keys(rd).some(k => !['kind', 'selections'].includes(k))) {
                return {status: 400, code: 'VALIDATION_ERROR', message: 'response_data contains unsupported fields.'};
            }

            const blanksMap = new Map();
            for (const b of optionsSnapshot.blanks || []) {
                blanksMap.set(b.blank_id, new Set((b.choices || []).map(c => c.value_id)));
            }

            const seenBlanks = new Set();
            for (const sel of rd.selections) {
                if (!sel || typeof sel !== 'object' || Object.keys(sel).some(k => !['blank_id', 'value_id'].includes(k))) {
                    return {status: 400, code: 'VALIDATION_ERROR', message: 'Invalid selection item in response_data.'};
                }
                const allowedValues = blanksMap.get(sel.blank_id);
                if (!allowedValues) {
                    return {status: 422, code: 'UNPROCESSABLE_ENTITY', message: `Unknown blank_id '${sel.blank_id}'.`};
                }
                if (seenBlanks.has(sel.blank_id)) {
                    return {status: 400, code: 'VALIDATION_ERROR', message: `Duplicate selection for blank_id '${sel.blank_id}'.`};
                }
                seenBlanks.add(sel.blank_id);
                if (!allowedValues.has(sel.value_id)) {
                    return {status: 422, code: 'UNPROCESSABLE_ENTITY', message: `Unknown value_id '${sel.value_id}' for blank '${sel.blank_id}'.`};
                }
            }

            return {
                p_selected_options: null,
                p_answer_text: null,
                p_response_data: rd
            };
        }

        case 'INPUT': {
            const allowed = [...commonKeys, 'answer_text'];
            if (Object.keys(body).some(k => !allowed.includes(k))) {
                return {status: 400, code: 'VALIDATION_ERROR', message: 'Request contains unsupported fields.'};
            }
            if (typeof body.answer_text !== 'string') {
                return {status: 400, code: 'VALIDATION_ERROR', message: 'answer_text must be a string.'};
            }
            return {
                p_selected_options: null,
                p_answer_text: body.answer_text,
                p_response_data: null
            };
        }

        case 'MATCHING': {
            const allowed = [...commonKeys, 'response_data'];
            if (Object.keys(body).some(k => !allowed.includes(k))) {
                return {status: 400, code: 'VALIDATION_ERROR', message: 'Request contains unsupported fields.'};
            }
            const rd = body.response_data;
            if (!rd || typeof rd !== 'object' || Array.isArray(rd) || rd.kind !== 'MATCHING' || !Array.isArray(rd.pairs)) {
                return {status: 400, code: 'VALIDATION_ERROR', message: 'response_data must be a MatchingResponse object.'};
            }
            if (Object.keys(rd).some(k => !['kind', 'pairs'].includes(k))) {
                return {status: 400, code: 'VALIDATION_ERROR', message: 'response_data contains unsupported fields.'};
            }

            const leftIds = new Set((optionsSnapshot.left_items || []).map(i => i.id));
            const rightIds = new Set((optionsSnapshot.right_items || []).map(i => i.id));
            const seenLeft = new Set();

            for (const pair of rd.pairs) {
                if (!pair || typeof pair !== 'object' || Object.keys(pair).some(k => !['left_id', 'right_id'].includes(k))) {
                    return {status: 400, code: 'VALIDATION_ERROR', message: 'Invalid pair item in response_data.'};
                }
                if (!leftIds.has(pair.left_id) || !rightIds.has(pair.right_id)) {
                    return {status: 422, code: 'UNPROCESSABLE_ENTITY', message: 'Unknown left_id or right_id in matching response.'};
                }
                if (seenLeft.has(pair.left_id)) {
                    return {status: 400, code: 'VALIDATION_ERROR', message: `Duplicate left_id '${pair.left_id}' in matching response.`};
                }
                seenLeft.add(pair.left_id);
            }

            return {
                p_selected_options: null,
                p_answer_text: null,
                p_response_data: rd
            };
        }

        default:
            return {status: 422, code: 'UNPROCESSABLE_ENTITY', message: 'Unsupported question type.'};
    }
}

async function resolveOwnedSubmission(submissionId, studentUserId) {
    const {data: submission, error} = await supabase
        .from('submissions')
        .select(`
            id,
            participant_id,
            exam_id,
            variant_id,
            source,
            started_at,
            submitted_at,
            status,
            participants!inner (
                id,
                student_user_id,
                deleted_at,
                exams!inner (opens_at)
            )
        `)
        .eq('id', submissionId)
        .maybeSingle();

    if (error) throw error;
    if (!submission) {
        const err = new Error('Submission not found.');
        err.code = 'SUBMISSION_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    const participant = Array.isArray(submission.participants) ? submission.participants[0] : submission.participants;
    if (!participant || participant.deleted_at || participant.student_user_id !== studentUserId) {
        const err = new Error('You do not have permission to access this submission.');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
    }

    requireExamOpened(Array.isArray(participant.exams) ? participant.exams[0] : participant.exams);
    return submission;
}

async function autosaveAnswer(submissionId, variantQuestionId, body, studentUserId) {
    const submission = await resolveOwnedSubmission(submissionId, studentUserId);

    if (submission.source !== 'ONLINE') {
        const err = new Error('Autosave is only supported for online submissions.');
        err.code = 'SUBMISSION_NOT_ONLINE';
        err.status = 409;
        throw err;
    }

    const {data: evq, error: evqErr} = await supabase
        .from('exam_variant_questions')
        .select(`
            id,
            variant_id,
            option_order,
            question_versions!inner (
                options_snapshot
            )
        `)
        .eq('id', variantQuestionId)
        .maybeSingle();

    if (evqErr) throw evqErr;
    if (!evq || evq.variant_id !== submission.variant_id) {
        const err = new Error('Variant question not found in assigned exam variant.');
        err.code = 'VARIANT_QUESTION_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    const qv = Array.isArray(evq.question_versions) ? evq.question_versions[0] : evq.question_versions;
    const optionsSnapshot = qv?.options_snapshot;
    const validated = validateAutosavePayload(body, optionsSnapshot, evq.option_order);

    if (validated.status) {
        const err = new Error(validated.message);
        err.code = validated.code;
        err.status = validated.status;
        throw err;
    }

    const {data: rpcRows, error: rpcErr} = await supabase.rpc('olms_autosave_online_cas', {
        p_submission: submissionId,
        p_evq: variantQuestionId,
        p_expected_sequence: body.expected_client_sequence,
        p_edit_token: body.edit_token,
        p_selected_options: validated.p_selected_options,
        p_answer_text: validated.p_answer_text,
        p_response_data: validated.p_response_data
    });

    if (rpcErr) {
        const msg = String(rpcErr.message || '');

        if (msg.includes('SESSION_EXPIRED')) {
            const err = new Error('Exam session deadline has expired.');
            err.code = 'SESSION_EXPIRED';
            err.status = 403;
            throw err;
        }

        if (msg.includes('SUBMISSION_LOCKED')) {
            const err = new Error('Submission has already been submitted or locked.');
            err.code = 'SUBMISSION_LOCKED';
            err.status = 409;
            throw err;
        }

        if (msg.includes('ANSWER_REVISION_CONFLICT') || msg.includes('EDIT_TOKEN_REUSED_DIFFERENT_PAYLOAD')) {
            const code = msg.includes('EDIT_TOKEN_REUSED_DIFFERENT_PAYLOAD')
                ? 'EDIT_TOKEN_REUSED_DIFFERENT_PAYLOAD'
                : 'ANSWER_REVISION_CONFLICT';

            const {data: currentAnswer} = await supabase
                .from('student_answers')
                .select('exam_variant_question_id, client_sequence, selected_options, answer_text, response_data')
                .eq('submission_id', submissionId)
                .eq('exam_variant_question_id', variantQuestionId)
                .maybeSingle();

            const currentSeq = currentAnswer ? Number(currentAnswer.client_sequence) : 0;
            const serverAnswer = currentAnswer
                ? formatSavedAnswer(currentAnswer, optionsSnapshot.kind)
                : {
                    exam_variant_question_id: variantQuestionId,
                    client_sequence: 0,
                    response_kind: optionsSnapshot.kind,
                    selected_options: [],
                    answer_text: null,
                    response_data: null
                };

            const err = new Error(
                code === 'EDIT_TOKEN_REUSED_DIFFERENT_PAYLOAD'
                    ? 'edit_token was already committed with a different payload.'
                    : 'Answer revision conflict: answer was updated in another tab or device.'
            );
            err.code = code;
            err.status = 409;
            err.data = {
                current_sequence: currentSeq,
                server_time: new Date().toISOString(),
                server_answer: serverAnswer,
                can_retry: submission.status === 'IN_PROGRESS'
            };
            throw err;
        }

        if (msg.includes('AUTOSAVE_INVALID_REVISION_OR_TOKEN')) {
            const err = new Error('Invalid revision sequence or edit_token.');
            err.code = 'VALIDATION_ERROR';
            err.status = 400;
            throw err;
        }

        if (msg.includes('ANSWER_NOT_IN_ASSIGNED_VARIANT')) {
            const err = new Error('Variant question does not belong to assigned variant.');
            err.code = 'VARIANT_QUESTION_NOT_FOUND';
            err.status = 404;
            throw err;
        }

        throw rpcErr;
    }

    const ack = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    return {
        submission_id: submissionId,
        exam_variant_question_id: variantQuestionId,
        accepted_sequence: Number(ack.accepted_sequence),
        saved_at: ack.saved_at,
        edit_token: body.edit_token,
        server_time: new Date().toISOString(),
        was_retry: Boolean(ack.was_retry)
    };
}

async function submitOnlineSubmission(submissionId, idempotencyKey, studentUserId) {
    await resolveOwnedSubmission(submissionId, studentUserId);

    const {error: rpcErr} = await supabase.rpc('olms_submit_online', {
        p_submission: submissionId,
        p_token: idempotencyKey
    });

    if (rpcErr) {
        const msg = String(rpcErr.message || '');

        if (msg.includes('SESSION_EXPIRED')) {
            // P-04: at/after deadline, server force-closes using already committed answers
            const {error: forceErr} = await supabase.rpc('olms_force_submit_expired_online', {
                p_submission: submissionId
            });
            if (forceErr) throw forceErr;
        } else if (msg.includes('conflicting submit token')) {
            const err = new Error('Submission was already submitted with a different Idempotency-Key.');
            err.code = 'CONFLICTING_SUBMIT_TOKEN';
            err.status = 409;
            throw err;
        } else if (rpcErr.code === '23505' && msg.includes('uq_submissions_submit_token')) {
            const err = new Error('Idempotency-Key was already used by another submission.');
            err.code = 'CONFLICTING_SUBMIT_TOKEN';
            err.status = 409;
            throw err;
        } else if (msg.includes('submission already closed')) {
            const err = new Error('Submission has already been closed.');
            err.code = 'SUBMISSION_ALREADY_CLOSED';
            err.status = 409;
            throw err;
        } else if (msg.includes('online submission missing')) {
            const err = new Error('Online submission not found.');
            err.code = 'SUBMISSION_NOT_FOUND';
            err.status = 404;
            throw err;
        } else {
            throw rpcErr;
        }
    }

    const {data: updatedSub, error: fetchErr} = await supabase
        .from('submissions')
        .select(`
            id,
            exam_id,
            status,
            submitted_at,
            participants!inner ( status )
        `)
        .eq('id', submissionId)
        .single();

    if (fetchErr) throw fetchErr;

    const {data: examRow, error: examFetchErr} = await supabase
        .from('exams')
        .select('result_visibility_mode')
        .eq('id', updatedSub.exam_id)
        .maybeSingle();

    if (examFetchErr) throw examFetchErr;

    const partObj = Array.isArray(updatedSub.participants) ? updatedSub.participants[0] : updatedSub.participants;

    // Trigger asynchronous grading in background without altering synchronous SUBMITTED ack
    setImmediate(() => {
        try {
            const gradingService = require('./grading.service');
            gradingService.gradeSubmission(submissionId).catch(() => {});
        } catch (_) {
            // Ignored: grading will also be ensured on publish/results read
        }
    });

    return {
        submission_id: updatedSub.id,
        submission_status: updatedSub.status,
        participant_status: partObj?.status || 'COMPLETED',
        submitted_at: updatedSub.submitted_at,
        grade_available: false,
        visibility: examRow?.result_visibility_mode || 'HIDDEN',
        score: null
    };
}

module.exports = {
    listMyExams,
    startOrResumeSession,
    getActiveSession,
    autosaveAnswer,
    submitOnlineSubmission,
    buildStudentRenderSpec,
    indexToDisplayLabel,
    getOrderedChoices
};
