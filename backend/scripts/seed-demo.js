const fs = require('node:fs');
const path = require('node:path');
const {createHash, randomBytes} = require('node:crypto');
const dotenv = require('../node_modules/dotenv');
const bcrypt = require('../node_modules/bcrypt');
const {createClient} = require('../node_modules/@supabase/supabase-js');
const {
    DEMO_USERS,
    DEMO_SUBJECTS,
    DEMO_QUESTIONS,
    deterministicUuid,
    assertDatasetIntegrity
} = require('./demo-dataset');

const ROOT = path.resolve(__dirname, '../..');
const BACKEND_ENV_FILE = path.join(ROOT, 'backend/.env');
const MANIFEST_FILE = path.join(__dirname, '.seed-demo.local.json');

function stableHash(value) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function questionHash(q) {
    return stableHash({
        lesson_code: q.lesson_code,
        type_code: q.type_code,
        difficulty_level: q.difficulty_level,
        topic_tag: q.topic_tag,
        content: q.content,
        media_url: q.media_url,
        explanation: q.explanation,
        answer_spec: q.answer_spec
    });
}

function loadManifest() {
    if (!fs.existsSync(MANIFEST_FILE)) {
        return {
            dataset: 'olms-university-demo-v1',
            users: {},
            subjects: {},
            chapters: {},
            lessons: {},
            questions: {},
            credentials_ref: {}
        };
    }
    return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
}

function saveManifest(manifest) {
    manifest.updated_at = new Date().toISOString();
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n');
}

function parseCliArgs(argv) {
    const flags = new Set(argv);
    if (flags.has('--help') || flags.has('-h')) return {mode: 'help'};
    if (flags.has('--validate-only')) return {mode: 'validate-only'};
    if (flags.has('--rollback') || flags.has('--cleanup')) return {mode: 'rollback'};
    if (flags.has('--apply')) return {mode: 'apply'};
    return {mode: 'dry-run'};
}

function printHelp() {
    console.log([
        'OLMS Demo Dataset Seed CLI',
        '',
        'Usage:',
        '  node backend/scripts/seed-demo.js [--dry-run | --apply | --rollback | --validate-only]',
        '',
        'Flags:',
        '  --dry-run        Inspect database state and preview changes without writing (default)',
        '  --apply          Idempotently create or update seed-owned demo records',
        '  --rollback       Soft-delete un-frozen demo subjects/chapters/lessons/questions from local manifest',
        '  --validate-only  Offline dataset & answer_spec validation without database connection',
        '  --help           Show this help text',
        '',
        'Optional env override:',
        '  OLMS_DEMO_PASSWORD  Shared password applied ONLY when creating demo teacher accounts'
    ].join('\n'));
}

function resolveSupabaseEnv() {
    const fileEnv = fs.existsSync(BACKEND_ENV_FILE)
        ? dotenv.parse(fs.readFileSync(BACKEND_ENV_FILE))
        : {};
    const url = process.env.SUPABASE_URL || fileEnv.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env or environment variables.');
    }
    return {url, serviceKey};
}

function createTargetClient() {
    const {url, serviceKey} = resolveSupabaseEnv();
    return {
        targetHost: new URL(url).host,
        db: createClient(url, serviceKey, {
            auth: {persistSession: false, autoRefreshToken: false}
        })
    };
}

async function loadExistingState(db) {
    const [typesRes, usersRes, subjectsRes, chaptersRes, lessonsRes, questionsRes] = await Promise.all([
        db.from('question_types').select('id, code, name').is('deleted_at', null),
        db.from('users').select('id, username, role, status, deleted_at')
            .in('username', DEMO_USERS.map(u => u.username)),
        db.from('subjects').select('id, code, name, description, created_by, deleted_at')
            .in('code', DEMO_SUBJECTS.map(s => s.code)),
        db.from('chapters').select('id, subject_id, code, name, order_no, deleted_at'),
        db.from('lessons').select('id, chapter_id, code, name, order_no, deleted_at'),
        db.from('questions').select('id, lesson_id, type_id, status, topic_tag, created_by, deleted_at, question_versions(id, version_no, content, options_snapshot, explanation, media_url, difficulty_level, is_current, frozen_at)')
            .is('deleted_at', null)
    ]);

    for (const res of [typesRes, usersRes, subjectsRes, chaptersRes, lessonsRes, questionsRes]) {
        if (res.error) throw res.error;
    }

    return {
        typeByCode: new Map((typesRes.data || []).map(t => [t.code, t])),
        usersByUsername: new Map((usersRes.data || []).filter(u => !u.deleted_at).map(u => [u.username, u])),
        subjectsByCode: new Map((subjectsRes.data || []).filter(s => !s.deleted_at).map(s => [s.code, s])),
        chapters: (chaptersRes.data || []).filter(c => !c.deleted_at),
        lessons: (lessonsRes.data || []).filter(l => !l.deleted_at),
        questions: questionsRes.data || []
    };
}

async function applyOrPreview({apply}) {
    const summaryCounts = assertDatasetIntegrity();
    const {targetHost, db} = createTargetClient();
    const manifest = loadManifest();
    const existing = await loadExistingState(db);
    const now = new Date().toISOString();

    for (const code of ['SINGLE_CHOICE', 'MULTI_CHOICE', 'DROPDOWN', 'INPUT', 'MATCHING']) {
        if (!existing.typeByCode.has(code)) {
            throw new Error(`Required question_type '${code}' is missing in database.`);
        }
    }

    const report = {
        mode: apply ? 'apply' : 'dry-run',
        target_host: targetHost,
        dataset_summary: summaryCounts,
        users: {create: 0, reuse: 0, conflict: 0},
        subjects: {create: 0, reuse: 0, conflict: 0},
        chapters: {create: 0, reuse: 0, conflict: 0},
        lessons: {create: 0, reuse: 0, conflict: 0},
        questions: {create: 0, update: 0, unchanged: 0, frozen_skip: 0, modified_skip: 0, conflict: 0},
        conflicts: []
    };

    // 1. Teachers
    const ownerIds = new Map();
    for (const userSpec of DEMO_USERS) {
        const found = existing.usersByUsername.get(userSpec.username);
        if (found) {
            if (found.role !== userSpec.role || found.status !== 'ACTIVE') {
                report.users.conflict++;
                report.conflicts.push(`User ${userSpec.username} exists with unexpected role/status.`);
                continue;
            }
            ownerIds.set(userSpec.key, found.id);
            manifest.users[userSpec.key] = found.id;
            report.users.reuse++;
            continue;
        }

        const plannedId = manifest.users[userSpec.key] || deterministicUuid(`user:${userSpec.key}`);
        report.users.create++;
        ownerIds.set(userSpec.key, plannedId);

        if (apply) {
            const password = process.env.OLMS_DEMO_PASSWORD || `OlmsDemo!${randomBytes(8).toString('hex')}`;
            const passwordHash = await bcrypt.hash(password, 12);
            const {error} = await db.from('users').insert({
                id: plannedId,
                username: userSpec.username,
                password_hash: passwordHash,
                full_name: userSpec.full_name,
                email: userSpec.email,
                role: userSpec.role,
                status: 'ACTIVE',
                created_at: now,
                updated_at: now
            });
            if (error) throw error;
            manifest.users[userSpec.key] = plannedId;
            manifest.credentials_ref[userSpec.username] = {
                id: plannedId,
                initial_password_set_via: process.env.OLMS_DEMO_PASSWORD ? 'env' : 'generated',
                password
            };
        }
    }

    // 2. Subjects, chapters, lessons
    const subjectIdsByCode = new Map();
    const chapterByCode = new Map();
    const lessonByCode = new Map();

    for (const sSpec of DEMO_SUBJECTS) {
        const expectedOwnerId = ownerIds.get(sSpec.owner_key);
        const existingSubject = existing.subjectsByCode.get(sSpec.code);
        let subjectId;

        if (existingSubject) {
            const knownSeedId = manifest.subjects[sSpec.code] || deterministicUuid(`subject:${sSpec.code}`);
            const ownedByDemo = existingSubject.id === knownSeedId || existingSubject.created_by === expectedOwnerId;
            if (!ownedByDemo) {
                report.subjects.conflict++;
                report.conflicts.push(`Subject code '${sSpec.code}' already exists and belongs to a non-seed owner; skipping its hierarchy.`);
                continue;
            }
            subjectId = existingSubject.id;
            manifest.subjects[sSpec.code] = subjectId;
            report.subjects.reuse++;
        } else {
            subjectId = manifest.subjects[sSpec.code] || deterministicUuid(`subject:${sSpec.code}`);
            report.subjects.create++;
            if (apply) {
                const {error} = await db.from('subjects').insert({
                    id: subjectId,
                    code: sSpec.code,
                    name: sSpec.name,
                    description: sSpec.description,
                    created_by: expectedOwnerId,
                    created_at: now,
                    updated_at: now
                });
                if (error) throw error;
                manifest.subjects[sSpec.code] = subjectId;
            }
        }
        subjectIdsByCode.set(sSpec.code, {id: subjectId, ownerId: expectedOwnerId});

        for (const cSpec of sSpec.chapters) {
            const existingChap = existing.chapters.find(c => c.subject_id === subjectId && c.code === cSpec.code);
            let chapterId;
            if (existingChap) {
                chapterId = existingChap.id;
                manifest.chapters[cSpec.code] = chapterId;
                report.chapters.reuse++;
            } else {
                chapterId = manifest.chapters[cSpec.code] || deterministicUuid(`chapter:${cSpec.code}`);
                report.chapters.create++;
                if (apply) {
                    const {error} = await db.from('chapters').insert({
                        id: chapterId,
                        subject_id: subjectId,
                        code: cSpec.code,
                        name: cSpec.name,
                        order_no: cSpec.order_no,
                        created_at: now,
                        updated_at: now
                    });
                    if (error) throw error;
                    manifest.chapters[cSpec.code] = chapterId;
                }
            }
            chapterByCode.set(cSpec.code, chapterId);

            for (const lSpec of cSpec.lessons) {
                const existingLesson = existing.lessons.find(l => l.chapter_id === chapterId && l.code === lSpec.code);
                let lessonId;
                if (existingLesson) {
                    lessonId = existingLesson.id;
                    manifest.lessons[lSpec.code] = lessonId;
                    report.lessons.reuse++;
                } else {
                    lessonId = manifest.lessons[lSpec.code] || deterministicUuid(`lesson:${lSpec.code}`);
                    report.lessons.create++;
                    if (apply) {
                        const {error} = await db.from('lessons').insert({
                            id: lessonId,
                            chapter_id: chapterId,
                            code: lSpec.code,
                            name: lSpec.name,
                            order_no: lSpec.order_no,
                            created_at: now,
                            updated_at: now
                        });
                        if (error) throw error;
                        manifest.lessons[lSpec.code] = lessonId;
                    }
                }
                lessonByCode.set(lSpec.code, {id: lessonId, ownerId: expectedOwnerId});
            }
        }
    }

    // 3. Questions
    const existingQuestionById = new Map(existing.questions.map(q => [q.id, q]));
    for (const qSpec of DEMO_QUESTIONS) {
        const lessonMeta = lessonByCode.get(qSpec.lesson_code);
        if (!lessonMeta) {
            report.questions.conflict++;
            continue;
        }
        const typeRow = existing.typeByCode.get(qSpec.type_code);
        const manifestEntry = manifest.questions[qSpec.key];
        const candidateId = manifestEntry?.id || deterministicUuid(`question:${qSpec.key}`);
        const desiredHash = questionHash(qSpec);

        const existingQ = existingQuestionById.get(candidateId)
            || existing.questions.find(q => q.lesson_id === lessonMeta.id && q.type_id === typeRow.id && q.topic_tag === qSpec.topic_tag && q.created_by === lessonMeta.ownerId);

        if (!existingQ) {
            report.questions.create++;
            if (apply) {
                const versionId = deterministicUuid(`question_version:${qSpec.key}:v1`);
                const {error: qErr} = await db.from('questions').insert({
                    id: candidateId,
                    lesson_id: lessonMeta.id,
                    type_id: typeRow.id,
                    topic_tag: qSpec.topic_tag,
                    status: 'ACTIVE',
                    ai_check_status: 'CHECKED',
                    ai_similarity_score: 0,
                    ai_audit_metadata: {skipped_ai_check: true, mode: 'TOPIC_BASED', seeded: true, checked_at: now},
                    is_duplicate_overridden: false,
                    created_by: lessonMeta.ownerId,
                    created_at: now,
                    updated_at: now
                });
                if (qErr) throw qErr;

                const {error: vErr} = await db.from('question_versions').insert({
                    id: versionId,
                    question_id: candidateId,
                    version_no: 1,
                    type_id: typeRow.id,
                    difficulty_level: qSpec.difficulty_level,
                    content: qSpec.content,
                    media_url: qSpec.media_url,
                    explanation: qSpec.explanation,
                    options_snapshot: qSpec.answer_spec,
                    is_current: true,
                    frozen_at: null,
                    created_by: lessonMeta.ownerId,
                    created_at: now
                });
                if (vErr) throw vErr;

                manifest.questions[qSpec.key] = {
                    id: candidateId,
                    version_id: versionId,
                    hash: desiredHash
                };
            }
            continue;
        }

        const currentVersion = (existingQ.question_versions || []).find(v => v.is_current) || (existingQ.question_versions || [])[0];
        if (!currentVersion) {
            report.questions.conflict++;
            report.conflicts.push(`Question ${qSpec.key} (${existingQ.id}) lacks a current version.`);
            continue;
        }

        if (currentVersion.frozen_at) {
            report.questions.frozen_skip++;
            manifest.questions[qSpec.key] = {
                id: existingQ.id,
                version_id: currentVersion.id,
                hash: manifestEntry?.hash || desiredHash
            };
            continue;
        }

        const liveHash = questionHash({
            lesson_code: qSpec.lesson_code,
            type_code: qSpec.type_code,
            difficulty_level: currentVersion.difficulty_level,
            topic_tag: existingQ.topic_tag,
            content: currentVersion.content,
            media_url: currentVersion.media_url ?? null,
            explanation: currentVersion.explanation ?? null,
            answer_spec: currentVersion.options_snapshot
        });

        if (liveHash === desiredHash) {
            report.questions.unchanged++;
            manifest.questions[qSpec.key] = {
                id: existingQ.id,
                version_id: currentVersion.id,
                hash: desiredHash
            };
            continue;
        }

        if (manifestEntry?.hash && liveHash !== manifestEntry.hash) {
            report.questions.modified_skip++;
            report.conflicts.push(`Question ${qSpec.key} (${existingQ.id}) was modified outside seed; skipping overwrite.`);
            continue;
        }

        report.questions.update++;
        if (apply) {
            const {error: uqErr} = await db.from('questions').update({
                lesson_id: lessonMeta.id,
                type_id: typeRow.id,
                topic_tag: qSpec.topic_tag,
                updated_at: now
            }).eq('id', existingQ.id);
            if (uqErr) throw uqErr;

            const {error: uvErr} = await db.from('question_versions').update({
                type_id: typeRow.id,
                difficulty_level: qSpec.difficulty_level,
                content: qSpec.content,
                media_url: qSpec.media_url,
                explanation: qSpec.explanation,
                options_snapshot: qSpec.answer_spec
            }).eq('id', currentVersion.id);
            if (uvErr) throw uvErr;

            manifest.questions[qSpec.key] = {
                id: existingQ.id,
                version_id: currentVersion.id,
                hash: desiredHash
            };
        }
    }

    if (apply) {
        saveManifest(manifest);
    }

    console.log(JSON.stringify(report, null, 2));
}

async function rollbackDemo() {
    if (!fs.existsSync(MANIFEST_FILE)) {
        console.log(JSON.stringify({mode: 'rollback', status: 'no_manifest', message: 'No local seed manifest found.'}, null, 2));
        return;
    }

    const manifest = loadManifest();
    const {targetHost, db} = createTargetClient();
    const now = new Date().toISOString();
    const summary = {
        mode: 'rollback',
        target_host: targetHost,
        soft_deleted_questions: 0,
        skipped_frozen_questions: 0,
        soft_deleted_lessons: 0,
        soft_deleted_chapters: 0,
        soft_deleted_subjects: 0
    };

    const questionIds = Object.values(manifest.questions || {}).map(item => item.id).filter(Boolean);
    for (const qId of questionIds) {
        const {data: vers, error: vErr} = await db.from('question_versions').select('id, frozen_at').eq('question_id', qId);
        if (vErr) throw vErr;
        const versionIds = (vers || []).map(v => v.id);
        let locked = (vers || []).some(v => Boolean(v.frozen_at));
        if (!locked && versionIds.length > 0) {
            const {count, error: evqErr} = await db.from('exam_variant_questions').select('id', {count: 'exact', head: true}).in('question_version_id', versionIds);
            if (evqErr) throw evqErr;
            if (count && count > 0) locked = true;
        }
        if (locked) {
            summary.skipped_frozen_questions++;
            continue;
        }
        const {error} = await db.from('questions').update({deleted_at: now, updated_at: now}).eq('id', qId).is('deleted_at', null);
        if (error) throw error;
        summary.soft_deleted_questions++;
    }

    if (summary.skipped_frozen_questions === 0) {
        const lessonIds = Object.values(manifest.lessons || {}).filter(Boolean);
        const chapterIds = Object.values(manifest.chapters || {}).filter(Boolean);
        const subjectIds = Object.values(manifest.subjects || {}).filter(Boolean);

        if (lessonIds.length) {
            const {data} = await db.from('lessons').update({deleted_at: now, updated_at: now}).in('id', lessonIds).is('deleted_at', null).select('id');
            summary.soft_deleted_lessons = (data || []).length;
        }
        if (chapterIds.length) {
            const {data} = await db.from('chapters').update({deleted_at: now, updated_at: now}).in('id', chapterIds).is('deleted_at', null).select('id');
            summary.soft_deleted_chapters = (data || []).length;
        }
        if (subjectIds.length) {
            const {data} = await db.from('subjects').update({deleted_at: now, updated_at: now}).in('id', subjectIds).is('deleted_at', null).select('id');
            summary.soft_deleted_subjects = (data || []).length;
        }
    }

    console.log(JSON.stringify(summary, null, 2));
}

async function main() {
    const {mode} = parseCliArgs(process.argv.slice(2));
    if (mode === 'help') {
        printHelp();
        return;
    }
    if (mode === 'validate-only') {
        const counts = assertDatasetIntegrity();
        console.log(JSON.stringify({mode, valid: true, counts}, null, 2));
        return;
    }
    if (mode === 'rollback') {
        await rollbackDemo();
        return;
    }
    await applyOrPreview({apply: mode === 'apply'});
}

if (require.main === module) {
    main().catch(err => {
        console.error(err.message);
        process.exitCode = 1;
    });
}
