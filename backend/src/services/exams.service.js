const {createHash, createHmac, randomUUID} = require('node:crypto');
const supabase = require('../config/supabase');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_DELIVERY_MODES = ['ONLINE', 'PAPER', 'BOTH'];
const VALID_RESULT_VISIBILITY_MODES = ['HIDDEN', 'SCORE_ONLY', 'SCORE_AND_STATUS', 'FULL_REVIEW'];
const VALID_STATUSES = ['DRAFT', 'GENERATED', 'PUBLISHED', 'IN_PROGRESS', 'ENDED', 'RESULT_PUBLISHED', 'ARCHIVED', 'CANCELLED'];


function requireExamOpened(exam) {
    if (Date.now() < Date.parse(exam.opens_at)) {
        const error = new Error('The exam cannot start before opens_at.');
        error.code = 'EXAM_NOT_OPEN';
        error.status = 409;
        throw error;
    }
}

function isValidUUID(id) {
    return typeof id === 'string' && UUID_REGEX.test(id);
}

async function listExams({ q, subject_id, status, page = 1, pageSize = 20, currentUser }) {
    if (subject_id) {
        if (!isValidUUID(subject_id)) {
            const err = new Error('subject_id must be a valid UUID.');
            err.code = 'INVALID_QUERY';
            err.status = 400;
            throw err;
        }
    }

    if (status) {
        if (!VALID_STATUSES.includes(status)) {
            const err = new Error(`status must be one of: ${VALID_STATUSES.join(', ')}.`);
            err.code = 'INVALID_QUERY';
            err.status = 400;
            throw err;
        }
    }

    let query = supabase
        .from('exams')
        .select(`
            id,
            code,
            name,
            subject_id,
            form_template_id,
            status,
            delivery_mode,
            total_questions,
            duration_minutes,
            opens_at,
            closes_at,
            total_score,
            result_visibility_mode,
            result_published_at,
            created_by,
            created_at,
            updated_at,
            subjects:subject_id (
                id,
                code,
                name
            )
        `, { count: 'exact' })
        .is('deleted_at', null);

    // Enforce P-02 for Teacher: Teachers only list exams they created
    if (currentUser && currentUser.role === 'TEACHER') {
        query = query.eq('created_by', currentUser.id);
    }

    if (subject_id) {
        query = query.eq('subject_id', subject_id);
    }

    if (status) {
        query = query.eq('status', status);
    }

    if (q && q.trim()) {
        const searchTerm = `%${q.trim()}%`;
        query = query.or(`code.ilike.${searchTerm},name.ilike.${searchTerm}`);
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
    const offset = (currentPage - 1) * limit;

    query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const totalItems = count || 0;
    const totalPages = Math.ceil(totalItems / limit);

    return {
        data: data || [],
        pagination: {
            page: currentPage,
            page_size: limit,
            total_items: totalItems,
            total_pages: totalPages
        }
    };
}

async function findExamById(examId) {
    if (!isValidUUID(examId)) return null;

    const { data, error } = await supabase
        .from('exams')
        .select(`
            id,
            code,
            name,
            subject_id,
            form_template_id,
            status,
            delivery_mode,
            total_questions,
            duration_minutes,
            opens_at,
            closes_at,
            total_score,
            result_visibility_mode,
            result_published_at,
            created_by,
            created_at,
            updated_at,
            subjects:subject_id (
                id,
                code,
                name,
                created_by
            )
        `)
        .eq('id', examId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function findExamByCode(code) {
    if (!code) return null;
    const { data, error } = await supabase
        .from('exams')
        .select('id, code, created_by')
        .eq('code', code.trim())
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function countActiveVariantsByExamId(examId) {
    if (!isValidUUID(examId)) return 0;
    const { count, error } = await supabase
        .from('exam_variants')
        .select('*', { count: 'exact', head: true })
        .eq('exam_id', examId)
        .is('deleted_at', null);

    if (error) throw error;
    return count || 0;
}

async function createExam(payload, currentUser) {
    const {
        code,
        name,
        subject_id,
        delivery_mode = 'ONLINE',
        total_questions,
        duration_minutes,
        opens_at,
        closes_at,
        total_score = 10,
        result_visibility_mode = 'HIDDEN',
        form_template_id = null
    } = payload;

    // Required fields check
    if (!code || !code.trim()) {
        const err = new Error('Field "code" is required.');
        err.code = 'INVALID_EXAM_DATA';
        err.status = 400;
        throw err;
    }
    if (!name || !name.trim()) {
        const err = new Error('Field "name" is required.');
        err.code = 'INVALID_EXAM_DATA';
        err.status = 400;
        throw err;
    }
    if (!subject_id || !isValidUUID(subject_id)) {
        const err = new Error('Valid "subject_id" is required.');
        err.code = 'INVALID_EXAM_DATA';
        err.status = 400;
        throw err;
    }
    if (!total_questions || parseInt(total_questions, 10) <= 0) {
        const err = new Error('Field "total_questions" must be an integer greater than 0.');
        err.code = 'INVALID_EXAM_DATA';
        err.status = 400;
        throw err;
    }
    if (!duration_minutes || parseInt(duration_minutes, 10) <= 0) {
        const err = new Error('Field "duration_minutes" must be an integer greater than 0.');
        err.code = 'INVALID_EXAM_DATA';
        err.status = 400;
        throw err;
    }
    if (!opens_at || !closes_at) {
        const err = new Error('Fields "opens_at" and "closes_at" are required.');
        err.code = 'INVALID_EXAM_DATA';
        err.status = 400;
        throw err;
    }

    const openTime = new Date(opens_at);
    const closeTime = new Date(closes_at);
    if (isNaN(openTime.getTime()) || isNaN(closeTime.getTime())) {
        const err = new Error('Fields "opens_at" and "closes_at" must be valid ISO 8601 date-time strings.');
        err.code = 'INVALID_EXAM_DATA';
        err.status = 400;
        throw err;
    }
    if (closeTime <= openTime) {
        const err = new Error('Field "closes_at" must be later than "opens_at".');
        err.code = 'INVALID_EXAM_TIME_RANGE';
        err.status = 422;
        throw err;
    }

    if (!VALID_DELIVERY_MODES.includes(delivery_mode)) {
        const err = new Error(`delivery_mode must be one of: ${VALID_DELIVERY_MODES.join(', ')}.`);
        err.code = 'INVALID_DELIVERY_MODE';
        err.status = 400;
        throw err;
    }

    if (['PAPER', 'BOTH'].includes(delivery_mode) && (!form_template_id || !isValidUUID(form_template_id))) {
        const err = new Error('form_template_id is required when delivery_mode is PAPER or BOTH.');
        err.code = 'FORM_TEMPLATE_REQUIRED';
        err.status = 422;
        throw err;
    }

    if (!VALID_RESULT_VISIBILITY_MODES.includes(result_visibility_mode)) {
        const err = new Error(`result_visibility_mode must be one of: ${VALID_RESULT_VISIBILITY_MODES.join(', ')}.`);
        err.code = 'INVALID_VISIBILITY_MODE';
        err.status = 400;
        throw err;
    }

    const numScore = parseFloat(total_score);
    if (isNaN(numScore) || numScore <= 0) {
        const err = new Error('total_score must be a positive number.');
        err.code = 'INVALID_TOTAL_SCORE';
        err.status = 400;
        throw err;
    }

    // Verify Subject exists
    const { data: subject, error: subErr } = await supabase
        .from('subjects')
        .select('id, code, name, created_by')
        .eq('id', subject_id)
        .is('deleted_at', null)
        .maybeSingle();

    if (subErr) throw subErr;
    if (!subject) {
        const err = new Error(`Subject with ID ${subject_id} not found.`);
        err.code = 'SUBJECT_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    // Verify Unique Code
    const existing = await findExamByCode(code);
    if (existing) {
        const err = new Error(`Exam code "${code.trim()}" is already in use.`);
        err.code = 'EXAM_CODE_CONFLICT';
        err.status = 409;
        throw err;
    }

    const insertPayload = {
        code: code.trim(),
        name: name.trim(),
        subject_id,
        form_template_id: form_template_id || null,
        status: 'DRAFT',
        delivery_mode,
        total_questions: parseInt(total_questions, 10),
        duration_minutes: parseInt(duration_minutes, 10),
        opens_at: openTime.toISOString(),
        closes_at: closeTime.toISOString(),
        total_score: numScore,
        result_visibility_mode,
        created_by: currentUser.id
    };

    const { data, error } = await supabase
        .from('exams')
        .insert(insertPayload)
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            const err = new Error(`Exam code "${code.trim()}" already exists.`);
            err.code = 'EXAM_CODE_CONFLICT';
            err.status = 409;
            throw err;
        }
        throw error;
    }

    return data;
}

async function updateExam(examId, updateData, currentUser) {
    const exam = await findExamById(examId);
    if (!exam) {
        const err = new Error(`Exam with ID ${examId} not found.`);
        err.code = 'EXAM_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    // Enforce P-02 Ownership: only creator or admin
    if (currentUser.role !== 'ADMIN' && exam.created_by !== currentUser.id) {
        const err = new Error('Only the creator or an admin can modify this exam.');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
    }

    // Can only modify if status is DRAFT
    if (exam.status !== 'DRAFT') {
        const err = new Error(`Cannot modify exam in "${exam.status}" status. Only DRAFT exams can be updated.`);
        err.code = 'EXAM_NOT_DRAFT';
        err.status = 409;
        throw err;
    }

    const patchPayload = { updated_at: new Date().toISOString() };

    if (updateData.code !== undefined) {
        if (!updateData.code || !updateData.code.trim()) {
            const err = new Error('Field "code" cannot be empty.');
            err.code = 'INVALID_EXAM_DATA';
            err.status = 400;
            throw err;
        }
        const trimmedCode = updateData.code.trim();
        if (trimmedCode !== exam.code) {
            const existing = await findExamByCode(trimmedCode);
            if (existing && existing.id !== examId) {
                const err = new Error(`Exam code "${trimmedCode}" is already in use.`);
                err.code = 'EXAM_CODE_CONFLICT';
                err.status = 409;
                throw err;
            }
        }
        patchPayload.code = trimmedCode;
    }

    if (updateData.name !== undefined) {
        if (!updateData.name || !updateData.name.trim()) {
            const err = new Error('Field "name" cannot be empty.');
            err.code = 'INVALID_EXAM_DATA';
            err.status = 400;
            throw err;
        }
        patchPayload.name = updateData.name.trim();
    }

    if (updateData.subject_id !== undefined) {
        if (!isValidUUID(updateData.subject_id)) {
            const err = new Error('Valid "subject_id" is required.');
            err.code = 'INVALID_EXAM_DATA';
            err.status = 400;
            throw err;
        }
        const { data: subject, error: subErr } = await supabase
            .from('subjects')
            .select('id')
            .eq('id', updateData.subject_id)
            .is('deleted_at', null)
            .maybeSingle();

        if (subErr) throw subErr;
        if (!subject) {
            const err = new Error(`Subject with ID ${updateData.subject_id} not found.`);
            err.code = 'SUBJECT_NOT_FOUND';
            err.status = 404;
            throw err;
        }
        patchPayload.subject_id = updateData.subject_id;
    }

    if (updateData.delivery_mode !== undefined) {
        if (!VALID_DELIVERY_MODES.includes(updateData.delivery_mode)) {
            const err = new Error(`delivery_mode must be one of: ${VALID_DELIVERY_MODES.join(', ')}.`);
            err.code = 'INVALID_DELIVERY_MODE';
            err.status = 400;
            throw err;
        }
        patchPayload.delivery_mode = updateData.delivery_mode;
    }

    if (updateData.total_questions !== undefined) {
        const total = parseInt(updateData.total_questions, 10);
        if (isNaN(total) || total <= 0) {
            const err = new Error('total_questions must be a positive integer.');
            err.code = 'INVALID_EXAM_DATA';
            err.status = 400;
            throw err;
        }
        patchPayload.total_questions = total;
    }

    if (updateData.duration_minutes !== undefined) {
        const duration = parseInt(updateData.duration_minutes, 10);
        if (isNaN(duration) || duration <= 0) {
            const err = new Error('duration_minutes must be a positive integer.');
            err.code = 'INVALID_EXAM_DATA';
            err.status = 400;
            throw err;
        }
        patchPayload.duration_minutes = duration;
    }

    const openTimeStr = updateData.opens_at !== undefined ? updateData.opens_at : exam.opens_at;
    const closeTimeStr = updateData.closes_at !== undefined ? updateData.closes_at : exam.closes_at;
    if (updateData.opens_at !== undefined || updateData.closes_at !== undefined) {
        const openTime = new Date(openTimeStr);
        const closeTime = new Date(closeTimeStr);
        if (isNaN(openTime.getTime()) || isNaN(closeTime.getTime())) {
            const err = new Error('opens_at and closes_at must be valid ISO 8601 strings.');
            err.code = 'INVALID_EXAM_DATA';
            err.status = 400;
            throw err;
        }
        if (closeTime <= openTime) {
            const err = new Error('closes_at must be later than opens_at.');
            err.code = 'INVALID_EXAM_TIME_RANGE';
            err.status = 422;
            throw err;
        }
        if (updateData.opens_at !== undefined) patchPayload.opens_at = openTime.toISOString();
        if (updateData.closes_at !== undefined) patchPayload.closes_at = closeTime.toISOString();
    }

    if (updateData.total_score !== undefined) {
        const score = parseFloat(updateData.total_score);
        if (isNaN(score) || score <= 0) {
            const err = new Error('total_score must be a positive number.');
            err.code = 'INVALID_TOTAL_SCORE';
            err.status = 400;
            throw err;
        }
        patchPayload.total_score = score;
    }

    if (updateData.result_visibility_mode !== undefined) {
        if (!VALID_RESULT_VISIBILITY_MODES.includes(updateData.result_visibility_mode)) {
            const err = new Error(`result_visibility_mode must be one of: ${VALID_RESULT_VISIBILITY_MODES.join(', ')}.`);
            err.code = 'INVALID_VISIBILITY_MODE';
            err.status = 400;
            throw err;
        }
        patchPayload.result_visibility_mode = updateData.result_visibility_mode;
    }

    if (updateData.form_template_id !== undefined) {
        if (updateData.form_template_id !== null && !isValidUUID(updateData.form_template_id)) {
            const err = new Error('form_template_id must be a valid UUID or null.');
            err.code = 'INVALID_EXAM_DATA';
            err.status = 400;
            throw err;
        }
        patchPayload.form_template_id = updateData.form_template_id;
    }

    const { data, error } = await supabase
        .from('exams')
        .update(patchPayload)
        .eq('id', examId)
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            const err = new Error('Exam code already exists.');
            err.code = 'EXAM_CODE_CONFLICT';
            err.status = 409;
            throw err;
        }
        throw error;
    }

    return data;
}

async function deleteExam(examId, currentUser) {
    const exam = await findExamById(examId);
    if (!exam) {
        const err = new Error(`Exam with ID ${examId} not found.`);
        err.code = 'EXAM_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    // Enforce P-02 Ownership: only creator or admin
    if (currentUser.role !== 'ADMIN' && exam.created_by !== currentUser.id) {
        const err = new Error('Only the creator or an admin can delete this exam.');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
    }

    // Can only delete if status is DRAFT
    if (exam.status !== 'DRAFT') {
        const err = new Error(`Cannot delete exam in "${exam.status}" status. Only DRAFT exams can be deleted.`);
        err.code = 'EXAM_NOT_DRAFT';
        err.status = 409;
        throw err;
    }

    // Check if any variants exist
    const activeVariantsCount = await countActiveVariantsByExamId(examId);
    if (activeVariantsCount > 0) {
        const err = new Error('Cannot delete exam that already has generated variants.');
        err.code = 'EXAM_HAS_VARIANTS';
        err.status = 409;
        throw err;
    }

    const { data, error } = await supabase
        .from('exams')
        .update({
            deleted_at: new Date().toISOString(),
            deleted_by: currentUser.id
        })
        .eq('id', examId)
        .select('id, code, name')
        .single();

    if (error) throw error;
    return data;
}

async function replaceMatrix(examId, rows, currentUser) {
    const exam = await findExamById(examId);
    if (!exam) {
        const err = new Error(`Exam with ID ${examId} not found.`);
        err.code = 'EXAM_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    if (currentUser.role !== 'ADMIN' && exam.created_by !== currentUser.id) {
        const err = new Error('Only the creator or an admin can modify this exam matrix.');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
    }

    if (exam.status !== 'DRAFT') {
        const err = new Error(`Cannot modify matrix of exam in "${exam.status}" status. Only DRAFT exams can be modified.`);
        err.code = 'EXAM_NOT_DRAFT';
        err.status = 409;
        throw err;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
        const err = new Error('Field "rows" must be a non-empty array.');
        err.code = 'INVALID_MATRIX_DATA';
        err.status = 400;
        throw err;
    }

    const VALID_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
    const matrixInserts = [];

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!r || typeof r !== 'object') {
            const err = new Error(`Row ${i} must be an object.`);
            err.code = 'INVALID_MATRIX_DATA';
            err.status = 400;
            throw err;
        }

        if (!r.question_type_id || !isValidUUID(r.question_type_id)) {
            const err = new Error(`Row ${i}: question_type_id must be a valid UUID.`);
            err.code = 'INVALID_MATRIX_DATA';
            err.status = 400;
            throw err;
        }

        if (!VALID_DIFFICULTIES.includes(r.difficulty_level)) {
            const err = new Error(`Row ${i}: difficulty_level must be one of: ${VALID_DIFFICULTIES.join(', ')}.`);
            err.code = 'INVALID_MATRIX_DATA';
            err.status = 400;
            throw err;
        }

        const numQ = parseInt(r.num_questions, 10);
        if (isNaN(numQ) || numQ <= 0) {
            const err = new Error(`Row ${i}: num_questions must be an integer greater than 0.`);
            err.code = 'INVALID_MATRIX_DATA';
            err.status = 400;
            throw err;
        }

        const score = parseFloat(r.score_per_question);
        if (isNaN(score) || score <= 0) {
            const err = new Error(`Row ${i}: score_per_question must be a number greater than 0.`);
            err.code = 'INVALID_MATRIX_DATA';
            err.status = 400;
            throw err;
        }

        if (r.chapter_id && !isValidUUID(r.chapter_id)) {
            const err = new Error(`Row ${i}: chapter_id must be a valid UUID.`);
            err.code = 'INVALID_MATRIX_DATA';
            err.status = 400;
            throw err;
        }

        if (r.lesson_id) {
            if (!isValidUUID(r.lesson_id)) {
                const err = new Error(`Row ${i}: lesson_id must be a valid UUID.`);
                err.code = 'INVALID_MATRIX_DATA';
                err.status = 400;
                throw err;
            }
            if (!r.chapter_id) {
                const err = new Error(`Row ${i}: chapter_id is required when lesson_id is provided.`);
                err.code = 'INVALID_MATRIX_DATA';
                err.status = 422;
                throw err;
            }
        }

        let maxPerTopic = 2;
        if (Object.prototype.hasOwnProperty.call(r, 'max_questions_per_topic')) {
            if (r.max_questions_per_topic === null) {
                maxPerTopic = null;
            } else if (!Number.isInteger(r.max_questions_per_topic) || r.max_questions_per_topic < 1) {
                const err = new Error(`Row ${i}: max_questions_per_topic must be a positive integer or null.`);
                err.code = 'INVALID_MATRIX_DATA';
                err.status = 400;
                throw err;
            } else {
                maxPerTopic = r.max_questions_per_topic;
            }
        }

        matrixInserts.push({
            exam_id: examId,
            chapter_id: r.chapter_id || null,
            lesson_id: r.lesson_id || null,
            question_type_id: r.question_type_id,
            difficulty_level: r.difficulty_level,
            num_questions: numQ,
            score_per_question: score,
            max_questions_per_topic: maxPerTopic
        });
    }

    // Delete existing matrix rows and any stale draft variants so matrix mode starts cleanly
    const { error: delErr } = await supabase
        .from('exam_matrices')
        .delete()
        .eq('exam_id', examId);

    if (delErr) throw delErr;

    await clearDraftVariantsForExam(examId);

    // Insert new matrix rows
    const { error: insErr } = await supabase
        .from('exam_matrices')
        .insert(matrixInserts);

    if (insErr) throw insErr;

    return {};
}

async function replaceGradingRules(examId, rules, currentUser) {
    const exam = await findExamById(examId);
    if (!exam) {
        const err = new Error(`Exam with ID ${examId} not found.`);
        err.code = 'EXAM_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    if (currentUser.role !== 'ADMIN' && exam.created_by !== currentUser.id) {
        const err = new Error('Only the creator or an admin can modify grading rules.');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
    }

    if (exam.status !== 'DRAFT') {
        const err = new Error(`Cannot modify grading rules of exam in "${exam.status}" status.`);
        err.code = 'EXAM_NOT_DRAFT';
        err.status = 409;
        throw err;
    }

    if (!Array.isArray(rules) || rules.length === 0) {
        const err = new Error('Field "rules" must be a non-empty array.');
        err.code = 'INVALID_GRADING_RULES';
        err.status = 400;
        throw err;
    }

    const VALID_SCORING_MODES = ['EXACT_MATCH', 'PARTIAL_CREDIT'];
    const VALID_ROUNDING_RULES = ['ROUND_HALF_UP', 'ROUND_DOWN', 'NONE'];
    const rulesInserts = [];

    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (!rule || typeof rule !== 'object') {
            const err = new Error(`Rule ${i} must be an object.`);
            err.code = 'INVALID_GRADING_RULES';
            err.status = 400;
            throw err;
        }

        if (!rule.question_type_id || !isValidUUID(rule.question_type_id)) {
            const err = new Error(`Rule ${i}: question_type_id must be a valid UUID.`);
            err.code = 'INVALID_GRADING_RULES';
            err.status = 400;
            throw err;
        }

        if (!VALID_SCORING_MODES.includes(rule.scoring_mode)) {
            const err = new Error(`Rule ${i}: scoring_mode must be one of: ${VALID_SCORING_MODES.join(', ')}.`);
            err.code = 'INVALID_GRADING_RULES';
            err.status = 400;
            throw err;
        }

        if (rule.allow_negative_marking === true) {
            const err = new Error(`Rule ${i}: allow_negative_marking cannot be true in current system policy.`);
            err.code = 'NEGATIVE_MARKING_DISALLOWED';
            err.status = 422;
            throw err;
        }

        rulesInserts.push({
            exam_id: examId,
            question_type_id: rule.question_type_id,
            scoring_mode: rule.scoring_mode,
            allow_negative_marking: false,
            penalty_for_wrong: rule.penalty_for_wrong !== undefined ? Boolean(rule.penalty_for_wrong) : true,
            case_sensitive: rule.case_sensitive !== undefined ? Boolean(rule.case_sensitive) : false,
            rounding_precision: rule.rounding_precision !== undefined ? parseInt(rule.rounding_precision, 10) : 2,
            rounding_rule: rule.rounding_rule && VALID_ROUNDING_RULES.includes(rule.rounding_rule) ? rule.rounding_rule : 'ROUND_HALF_UP'
        });
    }

    // Delete existing rules
    const { error: delErr } = await supabase
        .from('exam_grading_rules')
        .delete()
        .eq('exam_id', examId);

    if (delErr) throw delErr;

    // Insert new rules
    const { error: insErr } = await supabase
        .from('exam_grading_rules')
        .insert(rulesInserts);

    if (insErr) throw insErr;

    return {};
}

async function loadSubjectQuestionPool(subjectId) {
    const { data: chapters, error: chapErr } = await supabase
        .from('chapters')
        .select('id')
        .eq('subject_id', subjectId)
        .is('deleted_at', null);

    if (chapErr) throw chapErr;

    const chapterIds = (chapters || []).map(c => c.id);
    if (chapterIds.length === 0) {
        return { lessonIdsByChapter: new Map(), chapterByLessonId: new Map(), allLessonIds: new Set(), poolQuestions: [] };
    }

    const { data: lessons, error: lesErr } = await supabase
        .from('lessons')
        .select('id, chapter_id')
        .in('chapter_id', chapterIds)
        .is('deleted_at', null);

    if (lesErr) throw lesErr;

    const lessonIdsByChapter = new Map();
    const chapterByLessonId = new Map();
    const allLessonIds = [];
    for (const l of lessons || []) {
        allLessonIds.push(l.id);
        chapterByLessonId.set(l.id, l.chapter_id);
        if (!lessonIdsByChapter.has(l.chapter_id)) {
            lessonIdsByChapter.set(l.chapter_id, new Set());
        }
        lessonIdsByChapter.get(l.chapter_id).add(l.id);
    }

    if (allLessonIds.length === 0) {
        return { lessonIdsByChapter, chapterByLessonId, allLessonIds: new Set(), poolQuestions: [] };
    }

    const { data: poolQuestions, error: qErr } = await supabase
        .from('questions')
        .select(`
            id,
            topic_tag,
            lesson_id,
            question_versions!inner (
                id,
                type_id,
                difficulty_level,
                content,
                media_url,
                options_snapshot,
                is_current
            )
        `)
        .in('lesson_id', allLessonIds)
        .eq('question_versions.is_current', true)
        .eq('status', 'ACTIVE')
        .in('ai_check_status', ['CHECKED', 'OVERRIDDEN'])
        .is('deleted_at', null);

    if (qErr) throw qErr;

    return {
        lessonIdsByChapter,
        chapterByLessonId,
        allLessonIds: new Set(allLessonIds),
        poolQuestions: poolQuestions || []
    };
}

function getPoolCandidatesForRow(row, pool) {
    let allowedLessons = pool.allLessonIds;
    if (row.lesson_id) {
        allowedLessons = pool.allLessonIds.has(row.lesson_id) ? new Set([row.lesson_id]) : new Set();
    } else if (row.chapter_id) {
        allowedLessons = pool.lessonIdsByChapter.get(row.chapter_id) || new Set();
    }

    if (allowedLessons.size === 0) {
        return { scopeEmpty: true, candidates: [] };
    }

    const candidates = pool.poolQuestions.filter(q => {
        if (!allowedLessons.has(q.lesson_id)) return false;
        const v = Array.isArray(q.question_versions) ? q.question_versions[0] : q.question_versions;
        return v && v.type_id === row.question_type_id && v.difficulty_level === row.difficulty_level;
    });

    return { scopeEmpty: false, candidates };
}

function evaluateMatrixValidation(exam, matrixRows, pool) {
    const issues = [];
    let matrixTotalQuestions = 0;
    let matrixTotalScore = 0;

    for (let index = 0; index < matrixRows.length; index++) {
        const row = matrixRows[index];
        matrixTotalQuestions += row.num_questions;
        matrixTotalScore += row.num_questions * parseFloat(row.score_per_question);

        const { scopeEmpty, candidates } = getPoolCandidatesForRow(row, pool);
        if (scopeEmpty) {
            issues.push({
                row_index: index,
                code: 'EXAM_QUESTION_POOL_INSUFFICIENT',
                requested: row.num_questions,
                available: 0,
                message: row.chapter_id
                    ? `Chương chưa có bài học hoặc câu hỏi khả dụng (cần ${row.num_questions} câu).`
                    : `Môn học chưa có chương/bài học hoặc câu hỏi khả dụng (cần ${row.num_questions} câu).`
            });
            continue;
        }

        const available = candidates.length;
        if (available < row.num_questions) {
            issues.push({
                row_index: index,
                code: 'EXAM_QUESTION_POOL_INSUFFICIENT',
                requested: row.num_questions,
                available,
                message: `Thiếu ${row.num_questions - available} câu hỏi hợp lệ trong ngân hàng.`
            });
        }
    }

    if (matrixRows.length === 0) {
        issues.push({
            code: 'EXAM_MATRIX_EMPTY',
            message: 'Kỳ thi chưa thiết lập ma trận đề.'
        });
    }

    if (matrixTotalQuestions !== exam.total_questions) {
        issues.push({
            code: 'EXAM_TOTAL_QUESTIONS_MISMATCH',
            requested: exam.total_questions,
            available: matrixTotalQuestions,
            message: `Tổng số câu trong ma trận (${matrixTotalQuestions}) không khớp với cấu hình kỳ thi (${exam.total_questions}).`
        });
    }

    const roundedMatrixScore = Math.round(matrixTotalScore * 100) / 100;
    const roundedExamScore = Math.round(exam.total_score * 100) / 100;
    if (roundedMatrixScore !== roundedExamScore) {
        issues.push({
            code: 'EXAM_TOTAL_SCORE_MISMATCH',
            requested: exam.total_score,
            available: roundedMatrixScore,
            message: `Tổng điểm trong ma trận (${roundedMatrixScore}) không khớp với cấu hình kỳ thi (${roundedExamScore}).`
        });
    }

    return {
        valid: issues.length === 0,
        expected_questions: exam.total_questions,
        matrix_questions: matrixTotalQuestions,
        expected_score: exam.total_score,
        matrix_score: roundedMatrixScore,
        issues
    };
}

async function validateMatrix(examId, currentUser) {
    const exam = await findExamById(examId);
    if (!exam) {
        const err = new Error(`Exam with ID ${examId} not found.`);
        err.code = 'EXAM_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    if (currentUser.role !== 'ADMIN' && exam.created_by !== currentUser.id) {
        const err = new Error('Only the creator or an admin can validate this exam matrix.');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
    }

    const [{ data: rows, error: rowsErr }, pool] = await Promise.all([
        supabase
            .from('exam_matrices')
            .select('*')
            .eq('exam_id', examId)
            .is('deleted_at', null),
        loadSubjectQuestionPool(exam.subject_id)
    ]);

    if (rowsErr) throw rowsErr;

    return evaluateMatrixValidation(exam, rows || [], pool);
}

function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function getOptionOrder(optionsSnapshot, shouldShuffle = false) {
    if (!optionsSnapshot || typeof optionsSnapshot !== 'object') {
        return [];
    }
    if (Array.isArray(optionsSnapshot.choices)) {
        let order = optionsSnapshot.choices.map((c, idx) => c.id || idx);
        if (shouldShuffle && order.length > 1) {
            order = shuffle(order);
        }
        return order;
    }
    if (Array.isArray(optionsSnapshot.pairs)) {
        let order = optionsSnapshot.pairs.map((p, idx) => p.id || idx);
        if (shouldShuffle && order.length > 1) {
            order = shuffle(order);
        }
        return order;
    }
    if (optionsSnapshot.kind === 'DROPDOWN' && Array.isArray(optionsSnapshot.blanks)) {
        return optionsSnapshot.blanks.map(b => {
            const ids = (Array.isArray(b.choices) ? b.choices : []).map(ch => ch.value_id);
            return {
                blank_id: b.blank_id,
                choice_order: shouldShuffle && ids.length > 1 ? shuffle(ids) : ids
            };
        });
    }
    return [];
}

function getQuestionVersion(q) {
    return Array.isArray(q.question_versions) ? q.question_versions[0] : q.question_versions;
}

function getTopicScopeKey(candidate) {
    const topic = (candidate.topic_tag || '').trim();
    if (!topic) return 'UNTAGGED';
    return `${candidate.lesson_id || 'NO_LESSON'}::${topic.toLowerCase()}`;
}

function selectQuestionsForVariant(
    matrixRows,
    subjectPool,
    exam,
    {
        strictTopicBalance = false,
        preventDuplicateTopic = false,
        selectionSeed,
        variantIndex = 0,
        globalQuestionUsageCount
    }
) {
    const effectiveStrict = Boolean(strictTopicBalance || preventDuplicateTopic);
    const selectedQuestions = [];
    const selectedQuestionObjects = [];
    const usedInVariant = new Set();
    const variantTopicCounts = new Map();

    for (let rowIndex = 0; rowIndex < matrixRows.length; rowIndex++) {
        const row = matrixRows[rowIndex];
        const maxPerTopic = preventDuplicateTopic ? 1 : (row.max_questions_per_topic || 2);
        const { candidates: candidateQuestions } = getPoolCandidatesForRow(row, subjectPool);

        // Allow questions to repeat across different variants, never twice within the same variant
        const availablePool = candidateQuestions.filter(q => !usedInVariant.has(q.id));

        // Prefer least-used questions across prior variants so distinct questions are spread out when available
        const prioritizedPool = availablePool
            .map(question => ({
                question,
                usageCount: globalQuestionUsageCount.get(question.id) || 0,
                priority: createHash('sha256').update(`${selectionSeed}:${variantIndex}:${question.id}`).digest('hex')
            }))
            .sort((a, b) => (a.usageCount - b.usageCount) || a.priority.localeCompare(b.priority))
            .map(entry => entry.question);

        const rowChosen = [];
        const overflowPool = [];

        for (const candidate of prioritizedPool) {
            if (rowChosen.length === row.num_questions) break;

            const topicKey = getTopicScopeKey(candidate);
            const currentTopicCount = variantTopicCounts.get(topicKey) || 0;

            if (topicKey !== 'UNTAGGED' && currentTopicCount >= maxPerTopic) {
                overflowPool.push(candidate);
                continue;
            }

            rowChosen.push(candidate);
            selectedQuestionObjects.push(candidate);
            usedInVariant.add(candidate.id);
            if (topicKey !== 'UNTAGGED') {
                variantTopicCounts.set(topicKey, currentTopicCount + 1);
            }
        }

        if (rowChosen.length < row.num_questions) {
            if (effectiveStrict && overflowPool.length > 0) {
                const err = new Error(`Không đủ câu hỏi khác chủ đề trong mỗi đề (tối đa ${maxPerTopic} câu/chủ đề theo bài) cho dòng ma trận ${rowIndex + 1}.`);
                err.code = 'TOPIC_POOL_INSUFFICIENT';
                err.status = 422;
                throw err;
            }

            if (!effectiveStrict) {
                for (const candidate of overflowPool) {
                    if (rowChosen.length === row.num_questions) break;
                    rowChosen.push(candidate);
                    selectedQuestionObjects.push(candidate);
                    usedInVariant.add(candidate.id);
                    const topicKey = getTopicScopeKey(candidate);
                    if (topicKey !== 'UNTAGGED') {
                        variantTopicCounts.set(topicKey, (variantTopicCounts.get(topicKey) || 0) + 1);
                    }
                }
            }
        }

        if (rowChosen.length < row.num_questions) {
            const err = new Error(`Thiếu câu hỏi khả dụng cho dòng ma trận ${rowIndex + 1}.`);
            err.code = 'EXAM_QUESTION_POOL_INSUFFICIENT';
            err.status = 422;
            throw err;
        }

        const pointPerQ = row.score_per_question !== null && row.score_per_question !== undefined
            ? parseFloat(row.score_per_question)
            : parseFloat((exam.total_score / exam.total_questions).toFixed(2));

        for (const q of rowChosen) {
            const version = getQuestionVersion(q);
            selectedQuestions.push({
                question_id: q.id,
                version_id: version.id,
                options_snapshot: version.options_snapshot,
                score: pointPerQ
            });
            globalQuestionUsageCount.set(q.id, (globalQuestionUsageCount.get(q.id) || 0) + 1);
        }
    }

    return { selectedQuestions, selectedQuestionObjects };
}

async function clearDraftVariantsForExam(examId) {
    const { data: oldVariants, error: findErr } = await supabase
        .from('exam_variants')
        .select('id')
        .eq('exam_id', examId);

    if (findErr) throw findErr;

    if (oldVariants && oldVariants.length > 0) {
        const oldIds = oldVariants.map(v => v.id);
        const { error: delVqErr } = await supabase
            .from('exam_variant_questions')
            .delete()
            .in('variant_id', oldIds);
        if (delVqErr) throw delVqErr;

        const { error: delVarErr } = await supabase
            .from('exam_variants')
            .delete()
            .in('id', oldIds);
        if (delVarErr) throw delVarErr;
    }
}

function formatRootSelectionPayload(exam, variantRow, items) {
    return {
        exam_id: exam.id,
        has_root_variant: true,
        variant_id: variantRow.id,
        variant_code: variantRow.variant_code,
        is_root: true,
        total_questions: exam.total_questions,
        total_score: exam.total_score,
        items
    };
}

/**
 * Create or replace the manual root exam variant (Cách 2: giáo viên tự tạo đề gốc).
 * Synchronizes summary exam_matrices rows so PostgreSQL readiness triggers remain consistent.
 */
async function replaceRootQuestions(examId, { items, variant_code = 'ROOT' } = {}, currentUser) {
    if (!isValidUUID(examId)) {
        const err = new Error('examId must be a valid UUID.');
        err.code = 'INVALID_ID_FORMAT';
        err.status = 400;
        throw err;
    }

    const exam = await findExamById(examId);
    if (!exam) {
        const err = new Error(`Exam with ID ${examId} not found.`);
        err.code = 'EXAM_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    if (currentUser.role !== 'ADMIN' && exam.created_by !== currentUser.id) {
        const err = new Error('Only the creator or an admin can modify root questions for this exam.');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
    }

    if (exam.status !== 'DRAFT') {
        const err = new Error(`Cannot modify root questions of exam in "${exam.status}" status. Only DRAFT exams can be modified.`);
        err.code = 'EXAM_NOT_DRAFT';
        err.status = 409;
        throw err;
    }

    const rawCode = typeof variant_code === 'string' && variant_code.trim() ? variant_code.trim() : 'ROOT';
    const codeStr = rawCode.toUpperCase() === 'ROOT' ? 'ROOT' : rawCode;
    if (codeStr !== 'ROOT' && !/^[0-9]{3,10}$/.test(codeStr)) {
        const err = new Error('variant_code must be "ROOT" or a string containing 3 to 10 digits.');
        err.code = 'INVALID_REQUEST_BODY';
        err.status = 400;
        throw err;
    }

    if (!Array.isArray(items) || items.length === 0) {
        const err = new Error('Field "items" must be a non-empty array of root questions.');
        err.code = 'INVALID_ROOT_QUESTIONS';
        err.status = 400;
        throw err;
    }

    if (items.length !== exam.total_questions) {
        const err = new Error(`Số lượng câu hỏi trong đề gốc (${items.length}) không khớp với total_questions của kỳ thi (${exam.total_questions}).`);
        err.code = 'EXAM_TOTAL_QUESTIONS_MISMATCH';
        err.status = 422;
        throw err;
    }

    const seenQuestionIds = new Set();
    const defaultScore = Math.round((parseFloat(exam.total_score) / exam.total_questions) * 100) / 100;
    const requestedEntries = [];
    let totalItemScore = 0;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || typeof item !== 'object' || !item.question_id || !isValidUUID(item.question_id)) {
            const err = new Error(`Item ${i}: question_id must be a valid UUID.`);
            err.code = 'INVALID_ROOT_QUESTIONS';
            err.status = 400;
            throw err;
        }
        if (seenQuestionIds.has(item.question_id)) {
            const err = new Error(`Duplicate question_id ${item.question_id} in root exam items.`);
            err.code = 'DUPLICATE_ROOT_QUESTION';
            err.status = 422;
            throw err;
        }
        seenQuestionIds.add(item.question_id);

        let itemScore = defaultScore;
        if (item.score !== undefined && item.score !== null) {
            itemScore = parseFloat(item.score);
            if (isNaN(itemScore) || itemScore <= 0) {
                const err = new Error(`Item ${i}: score must be a number greater than 0.`);
                err.code = 'INVALID_ROOT_QUESTIONS';
                err.status = 400;
                throw err;
            }
            itemScore = Math.round(itemScore * 100) / 100;
        }
        totalItemScore += itemScore;
        requestedEntries.push({ question_id: item.question_id, score: itemScore, position: i + 1 });
    }

    const roundedTotalItemScore = Math.round(totalItemScore * 100) / 100;
    const roundedExamScore = Math.round(parseFloat(exam.total_score) * 100) / 100;
    if (roundedTotalItemScore !== roundedExamScore) {
        const err = new Error(`Tổng điểm đề gốc (${roundedTotalItemScore}) không khớp với total_score của kỳ thi (${roundedExamScore}).`);
        err.code = 'EXAM_TOTAL_SCORE_MISMATCH';
        err.status = 422;
        throw err;
    }

    const subjectPool = await loadSubjectQuestionPool(exam.subject_id);
    const poolById = new Map(subjectPool.poolQuestions.map(q => [q.id, q]));

    const invalidIds = requestedEntries
        .filter(entry => !poolById.has(entry.question_id))
        .map(entry => entry.question_id);
    if (invalidIds.length > 0) {
        const err = new Error('Một hoặc nhiều câu hỏi trong đề gốc không tồn tại, không thuộc môn học của kỳ thi, hoặc chưa ACTIVE.');
        err.code = 'INVALID_ROOT_QUESTION';
        err.status = 422;
        err.details = { invalid_question_ids: invalidIds };
        throw err;
    }

    const now = new Date().toISOString();
    const rootVariantId = randomUUID();
    const vqRows = [];
    const responseItems = [];
    const matrixGroupMap = new Map();

    for (const entry of requestedEntries) {
        const q = poolById.get(entry.question_id);
        const version = getQuestionVersion(q);
        const chapterId = subjectPool.chapterByLessonId.get(q.lesson_id) || null;
        const optionOrder = getOptionOrder(version.options_snapshot, false);

        vqRows.push({
            id: randomUUID(),
            variant_id: rootVariantId,
            question_version_id: version.id,
            position_in_variant: entry.position,
            option_order: optionOrder,
            score: entry.score,
            created_at: now
        });

        responseItems.push({
            position: entry.position,
            question_id: q.id,
            question_version_id: version.id,
            type_id: version.type_id,
            difficulty_level: version.difficulty_level,
            lesson_id: q.lesson_id,
            topic_tag: q.topic_tag,
            content: version.content,
            score: entry.score,
            option_order: optionOrder
        });

        const groupKey = `${chapterId || 'NULL'}::${q.lesson_id || 'NULL'}::${version.type_id}::${version.difficulty_level}::${entry.score}`;
        if (!matrixGroupMap.has(groupKey)) {
            matrixGroupMap.set(groupKey, {
                exam_id: examId,
                chapter_id: chapterId,
                lesson_id: q.lesson_id || null,
                question_type_id: version.type_id,
                difficulty_level: version.difficulty_level,
                num_questions: 0,
                score_per_question: entry.score,
                max_questions_per_topic: null
            });
        }
        matrixGroupMap.get(groupKey).num_questions += 1;
    }

    // Clear previous draft variants & replace matrix summary derived from the root exam
    await clearDraftVariantsForExam(examId);

    const { error: delMatErr } = await supabase
        .from('exam_matrices')
        .delete()
        .eq('exam_id', examId);
    if (delMatErr) throw delMatErr;

    const { error: insMatErr } = await supabase
        .from('exam_matrices')
        .insert(Array.from(matrixGroupMap.values()));
    if (insMatErr) throw insMatErr;

    const { error: insVarErr } = await supabase
        .from('exam_variants')
        .insert({
            id: rootVariantId,
            exam_id: examId,
            variant_code: codeStr,
            is_root: true,
            created_at: now,
            updated_at: now
        });
    if (insVarErr) throw insVarErr;

    const { error: insVqErr } = await supabase
        .from('exam_variant_questions')
        .insert(vqRows);
    if (insVqErr) throw insVqErr;

    return formatRootSelectionPayload(exam, { id: rootVariantId, variant_code: codeStr }, responseItems);
}

/**
 * Retrieve the current root variant and its ordered questions (if configured).
 */
async function getRootQuestions(examId, currentUser) {
    if (!isValidUUID(examId)) {
        const err = new Error('examId must be a valid UUID.');
        err.code = 'INVALID_ID_FORMAT';
        err.status = 400;
        throw err;
    }

    const exam = await findExamById(examId);
    if (!exam) {
        const err = new Error(`Exam with ID ${examId} not found.`);
        err.code = 'EXAM_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    if (currentUser && currentUser.role === 'TEACHER' && exam.created_by !== currentUser.id) {
        const err = new Error('You do not have permission to view root questions for this exam.');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
    }

    const { data: rootVariant, error: rvErr } = await supabase
        .from('exam_variants')
        .select('id, variant_code, is_root')
        .eq('exam_id', examId)
        .eq('is_root', true)
        .is('deleted_at', null)
        .maybeSingle();

    if (rvErr) throw rvErr;
    if (!rootVariant) {
        return {
            exam_id: exam.id,
            has_root_variant: false,
            variant_id: null,
            variant_code: null,
            is_root: true,
            total_questions: exam.total_questions,
            total_score: exam.total_score,
            items: []
        };
    }

    const { data: vqRows, error: vqErr } = await supabase
        .from('exam_variant_questions')
        .select(`
            position_in_variant,
            question_version_id,
            option_order,
            score,
            question_versions (
                id,
                question_id,
                type_id,
                difficulty_level,
                content,
                media_url,
                options_snapshot,
                questions (
                    id,
                    lesson_id,
                    topic_tag
                )
            )
        `)
        .eq('variant_id', rootVariant.id)
        .order('position_in_variant', { ascending: true });

    if (vqErr) throw vqErr;

    const items = (vqRows || []).map(row => {
        const qv = Array.isArray(row.question_versions) ? row.question_versions[0] : row.question_versions;
        const q = qv && (Array.isArray(qv.questions) ? qv.questions[0] : qv.questions);
        return {
            position: row.position_in_variant,
            question_id: qv?.question_id || q?.id,
            question_version_id: row.question_version_id,
            type_id: qv?.type_id,
            difficulty_level: qv?.difficulty_level,
            lesson_id: q?.lesson_id || null,
            topic_tag: q?.topic_tag || null,
            content: qv?.content || '',
            score: parseFloat(row.score),
            option_order: row.option_order
        };
    });

    return formatRootSelectionPayload(exam, rootVariant, items);
}

/**
 * Draw a single ROOT exam from the exam matrix and save it in DRAFT status
 * so the teacher can inspect/adjust it via GET/PUT root-questions before shuffling variants.
 */
async function generateDraftRootFromMatrix(examId, { strict_topic_balance = false, prevent_duplicate_topic = false } = {}, currentUser) {
    if (!isValidUUID(examId)) {
        const err = new Error('examId must be a valid UUID.');
        err.code = 'INVALID_ID_FORMAT';
        err.status = 400;
        throw err;
    }

    const exam = await findExamById(examId);
    if (!exam) {
        const err = new Error(`Exam with ID ${examId} not found.`);
        err.code = 'EXAM_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    if (currentUser.role !== 'ADMIN' && exam.created_by !== currentUser.id) {
        const err = new Error('Only the creator or an admin can generate root questions for this exam.');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
    }

    if (exam.status !== 'DRAFT') {
        const err = new Error(`Cannot generate draft root for exam in "${exam.status}" status. Only DRAFT exams can be modified.`);
        err.code = 'EXAM_NOT_DRAFT';
        err.status = 409;
        throw err;
    }

    const [{ data: rows, error: rowsErr }, subjectPool] = await Promise.all([
        supabase
            .from('exam_matrices')
            .select('*')
            .eq('exam_id', examId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true }),
        loadSubjectQuestionPool(exam.subject_id)
    ]);

    if (rowsErr) throw rowsErr;
    const matrixRows = rows || [];

    const validation = evaluateMatrixValidation(exam, matrixRows, subjectPool);
    if (!validation.valid) {
        const err = new Error(validation.issues?.[0]?.message || 'Ma trận đề thi không hợp lệ hoặc thiếu câu hỏi.');
        err.code = 'EXAM_MATRIX_INVALID';
        err.status = 422;
        err.details = validation.issues;
        throw err;
    }

    const globalQuestionUsageCount = new Map();
    const rootSelection = selectQuestionsForVariant(matrixRows, subjectPool, exam, {
        strictTopicBalance: Boolean(strict_topic_balance),
        preventDuplicateTopic: Boolean(prevent_duplicate_topic),
        selectionSeed: randomUUID(),
        variantIndex: 0,
        globalQuestionUsageCount
    });

    await clearDraftVariantsForExam(examId);

    const now = new Date().toISOString();
    const rootVariantId = randomUUID();
    const vqRows = rootSelection.selectedQuestions.map((q, idx) => ({
        id: randomUUID(),
        variant_id: rootVariantId,
        question_version_id: q.version_id,
        position_in_variant: idx + 1,
        option_order: getOptionOrder(q.options_snapshot, false),
        score: q.score,
        created_at: now
    }));

    const { error: insVarErr } = await supabase
        .from('exam_variants')
        .insert({
            id: rootVariantId,
            exam_id: examId,
            variant_code: 'ROOT',
            is_root: true,
            created_at: now,
            updated_at: now
        });
    if (insVarErr) throw insVarErr;

    const { error: insVqErr } = await supabase
        .from('exam_variant_questions')
        .insert(vqRows);
    if (insVqErr) throw insVqErr;

    return await getRootQuestions(examId, currentUser);
}

async function generateExamVariants(examId, {
    variant_count,
    variant_code_start,
    generation_mode,
    strict_topic_balance = false,
    prevent_duplicate_topic = false,
    similarity_threshold = 0.7,
    preview_only = false,
    confirmed_review_token
}, currentUser) {
    if (!isValidUUID(examId)) {
        const err = new Error('examId must be a valid UUID.');
        err.code = 'INVALID_ID_FORMAT';
        err.status = 400;
        throw err;
    }

    if (generation_mode !== undefined && !['FROM_MATRIX', 'FROM_ROOT'].includes(generation_mode)) {
        const err = new Error('generation_mode must be either "FROM_MATRIX" or "FROM_ROOT".');
        err.code = 'INVALID_REQUEST_BODY';
        err.status = 400;
        throw err;
    }

    if (typeof strict_topic_balance !== 'boolean' || typeof prevent_duplicate_topic !== 'boolean') {
        const err = new Error('strict_topic_balance and prevent_duplicate_topic must be booleans.');
        err.code = 'INVALID_REQUEST_BODY';
        err.status = 400;
        throw err;
    }

    if (typeof preview_only !== 'boolean' || (confirmed_review_token !== undefined &&
        (typeof confirmed_review_token !== 'string' || !/^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(confirmed_review_token)))) {
        const err = new Error('Invalid preview_only or confirmed_review_token.');
        err.code = 'INVALID_REQUEST_BODY';
        err.status = 400;
        throw err;
    }
    const selectionSeed = confirmed_review_token?.split('.')[0] || randomUUID();

    const count = parseInt(variant_count, 10);
    if (isNaN(count) || count < 1 || count > 100) {
        const err = new Error('variant_count must be an integer between 1 and 100.');
        err.code = 'INVALID_REQUEST_BODY';
        err.status = 400;
        throw err;
    }

    if (typeof variant_code_start !== 'string' || !/^[0-9]{3,10}$/.test(variant_code_start.trim())) {
        const err = new Error('variant_code_start must be a string containing 3 to 10 digits.');
        err.code = 'INVALID_REQUEST_BODY';
        err.status = 400;
        throw err;
    }
    const startCodeStr = variant_code_start.trim();

    const simThreshold = parseFloat(similarity_threshold);
    if (isNaN(simThreshold) || simThreshold < 0 || simThreshold > 1) {
        const err = new Error('similarity_threshold must be a number between 0 and 1.');
        err.code = 'INVALID_REQUEST_BODY';
        err.status = 400;
        throw err;
    }

    const exam = await findExamById(examId);
    if (!exam) {
        const err = new Error('Exam not found.');
        err.code = 'NOT_FOUND';
        err.status = 404;
        throw err;
    }

    // Ownership check (P-02)
    if (currentUser && currentUser.role === 'TEACHER' && exam.created_by !== currentUser.id) {
        const err = new Error('You do not have permission to generate variants for this exam.');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
    }

    // Exam status check: must be DRAFT
    if (exam.status !== 'DRAFT') {
        const err = new Error(`Only DRAFT exams can generate variants. Current status is ${exam.status}.`);
        err.code = 'INVALID_EXAM_STATUS';
        err.status = 409;
        throw err;
    }

    // Fetch matrix rows, grading rules, optional preset draft root variant, and subject question pool in parallel
    const [
        { data: rows, error: rowsErr },
        { data: gradingRules, error: grErr },
        { data: existingRootVariant, error: rvErr },
        subjectPool
    ] = await Promise.all([
        supabase
            .from('exam_matrices')
            .select('*')
            .eq('exam_id', examId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true }),
        supabase
            .from('exam_grading_rules')
            .select('question_type_id')
            .eq('exam_id', examId)
            .is('deleted_at', null),
        supabase
            .from('exam_variants')
            .select('id, variant_code')
            .eq('exam_id', examId)
            .eq('is_root', true)
            .is('deleted_at', null)
            .maybeSingle(),
        loadSubjectQuestionPool(exam.subject_id)
    ]);

    if (rowsErr) throw rowsErr;
    if (grErr) throw grErr;
    if (rvErr) throw rvErr;
    const matrixRows = rows || [];

    const effectiveMode = generation_mode || (existingRootVariant ? 'FROM_ROOT' : 'FROM_MATRIX');
    const coveredTypeIds = new Set((gradingRules || []).map(r => r.question_type_id));
    const globalQuestionUsageCount = new Map();
    let rootSelection;

    if (effectiveMode === 'FROM_ROOT' && existingRootVariant) {
        const { data: rootVqRows, error: rootVqErr } = await supabase
            .from('exam_variant_questions')
            .select('position_in_variant, question_version_id, score')
            .eq('variant_id', existingRootVariant.id)
            .order('position_in_variant', { ascending: true });

        if (rootVqErr) throw rootVqErr;
        const vqList = rootVqRows || [];
        if (vqList.length !== exam.total_questions) {
            const err = new Error(`Đề gốc hiện có ${vqList.length} câu hỏi, không khớp với total_questions (${exam.total_questions}).`);
            err.code = 'EXAM_TOTAL_QUESTIONS_MISMATCH';
            err.status = 422;
            throw err;
        }

        const poolByVersionId = new Map();
        for (const q of subjectPool.poolQuestions) {
            const v = getQuestionVersion(q);
            if (v) poolByVersionId.set(v.id, q);
        }

        const selectedQuestions = [];
        const selectedQuestionObjects = [];
        const rootTypeIds = new Set();

        for (const row of vqList) {
            const q = poolByVersionId.get(row.question_version_id);
            if (!q) {
                const err = new Error(`Câu hỏi trong đề gốc (version ${row.question_version_id}) không còn ở trạng thái ACTIVE/CHECKED.`);
                err.code = 'INVALID_ROOT_QUESTION';
                err.status = 422;
                throw err;
            }
            const version = getQuestionVersion(q);
            rootTypeIds.add(version.type_id);
            selectedQuestionObjects.push(q);
            selectedQuestions.push({
                question_id: q.id,
                version_id: version.id,
                options_snapshot: version.options_snapshot,
                score: parseFloat(row.score)
            });
            globalQuestionUsageCount.set(q.id, 1);
        }

        const missingRootTypes = Array.from(rootTypeIds).filter(typeId => !coveredTypeIds.has(typeId));
        if (missingRootTypes.length > 0) {
            const err = new Error('Kỳ thi chưa thiết lập quy tắc chấm điểm (grading rules) cho tất cả dạng câu hỏi trong đề gốc.');
            err.code = 'GRADING_RULES_MISSING';
            err.status = 422;
            throw err;
        }

        rootSelection = { selectedQuestions, selectedQuestionObjects };
    } else {
        const validation = evaluateMatrixValidation(exam, matrixRows, subjectPool);
        if (!validation.valid) {
            const err = new Error(validation.issues?.[0]?.message || 'Ma trận đề thi không hợp lệ hoặc thiếu câu hỏi.');
            err.code = 'EXAM_MATRIX_INVALID';
            err.status = 422;
            err.details = validation.issues;
            throw err;
        }

        // Ensure grading rules exist for all matrix question types (required by DB trigger olms_validate_variant_membership)
        const missingTypes = matrixRows.filter(r => !coveredTypeIds.has(r.question_type_id));
        if (missingTypes.length > 0) {
            const err = new Error('Kỳ thi chưa thiết lập quy tắc chấm điểm (grading rules) cho tất cả dạng câu hỏi trong ma trận.');
            err.code = 'GRADING_RULES_MISSING';
            err.status = 422;
            throw err;
        }

        rootSelection = selectQuestionsForVariant(matrixRows, subjectPool, exam, {
            strictTopicBalance: strict_topic_balance,
            preventDuplicateTopic: prevent_duplicate_topic,
            selectionSeed,
            variantIndex: 0,
            globalQuestionUsageCount
        });
    }

    const questions = rootSelection.selectedQuestionObjects.map(question => {
        const version = getQuestionVersion(question);
        return {
            question_id: question.id,
            version_id: version.id,
            content: version.content,
            media_url: version.media_url,
            answer_spec: version.options_snapshot,
            embedding_unavailable: false
        };
    });

    if (preview_only || confirmed_review_token) {
        const signature = createHmac('sha256', process.env.JWT_ACCESS_SECRET)
            .update(JSON.stringify([selectionSeed, examId, currentUser.id, simThreshold, questions]))
            .digest('hex');
        const reviewToken = selectionSeed + '.' + signature;
        const review = {
            exam_id: examId,
            generation_mode: effectiveMode,
            variant_code: 'ROOT',
            is_root: true,
            review_required: false,
            message: 'Đã kiểm tra xong đề gốc (ROOT) theo cấu hình sinh đề.',
            questions,
            review_token: reviewToken
        };
        if (preview_only) return review;
        if (reviewToken !== confirmed_review_token) {
            const err = new Error('Danh sách câu hỏi hoặc kết quả kiểm tra đã thay đổi. Hãy xem lại trước khi tạo đề.');
            err.status = 409;
            err.code = 'EXAM_PREVIEW_CHANGED';
            err.details = review;
            throw err;
        }
    }

    const baseCodeNum = parseInt(startCodeStr, 10);
    const codeLength = startCodeStr.length;

    await clearDraftVariantsForExam(examId);

    const now = new Date().toISOString();
    const createdVariants = [];
    const variantsToInsert = [];
    const variantQuestionsToInsert = [];
    const versionIdsToFreeze = new Set();

    // Generate Root variant (variant_code: 'ROOT', is_root: true) + count numbered variants (101, 102, ...):
    // - FROM_ROOT: keep the exact question set from rootSelection and shuffle question & option order for numbered variants
    // - FROM_MATRIX: select per-variant pool questions (respecting prevent_duplicate_topic, reusing when needed)
    for (let vIdx = 0; vIdx <= count; vIdx++) {
        const isRoot = vIdx === 0;
        const variantSelection = (isRoot || effectiveMode === 'FROM_ROOT')
            ? rootSelection
            : selectQuestionsForVariant(matrixRows, subjectPool, exam, {
                strictTopicBalance: strict_topic_balance,
                preventDuplicateTopic: prevent_duplicate_topic,
                selectionSeed,
                variantIndex: vIdx,
                globalQuestionUsageCount
            });

        const variantId = randomUUID();
        const variantCode = isRoot
            ? 'ROOT'
            : String(baseCodeNum + (vIdx - 1)).padStart(codeLength, '0');

        variantsToInsert.push({
            id: variantId,
            exam_id: examId,
            variant_code: variantCode,
            is_root: isRoot,
            created_at: now,
            updated_at: now
        });

        // Questions order: canonical order for root, shuffled for numbered variants
        const currentQuestions = isRoot
            ? variantSelection.selectedQuestions
            : shuffle([...variantSelection.selectedQuestions]);

        for (let qIdx = 0; qIdx < currentQuestions.length; qIdx++) {
            const q = currentQuestions[qIdx];
            versionIdsToFreeze.add(q.version_id);
            const optionOrder = getOptionOrder(q.options_snapshot, !isRoot);

            variantQuestionsToInsert.push({
                id: randomUUID(),
                variant_id: variantId,
                question_version_id: q.version_id,
                position_in_variant: qIdx + 1,
                option_order: optionOrder,
                score: q.score,
                created_at: now
            });
        }

        createdVariants.push({
            id: variantId,
            variant_code: variantCode,
            is_root: isRoot,
            questions_count: currentQuestions.length
        });
    }

    // Step 1: Insert variants
    const { error: insVarErr } = await supabase
        .from('exam_variants')
        .insert(variantsToInsert);
    if (insVarErr) throw insVarErr;

    // Step 2: Insert variant questions
    const { error: insVqErr } = await supabase
        .from('exam_variant_questions')
        .insert(variantQuestionsToInsert);
    if (insVqErr) throw insVqErr;

    // Step 3: Freeze question versions
    if (versionIdsToFreeze.size > 0) {
        await supabase
            .from('question_versions')
            .update({ frozen_at: now })
            .in('id', Array.from(versionIdsToFreeze));
    }

    // Step 4: Transition exam status from DRAFT -> GENERATED
    const { error: examUpdateErr } = await supabase
        .from('exams')
        .update({
            status: 'GENERATED',
            updated_at: now
        })
        .eq('id', examId);
    if (examUpdateErr) throw examUpdateErr;

    return {
        exam_id: examId,
        generation_mode: effectiveMode,
        status: 'GENERATED',
        root_variant: createdVariants[0],
        variants: createdVariants,
        generated_at: now
    };
}

async function listExamVariants(examId, currentUser) {
    if (!isValidUUID(examId)) {
        const err = new Error('examId must be a valid UUID.');
        err.code = 'INVALID_ID_FORMAT';
        err.status = 400;
        throw err;
    }

    const exam = await findExamById(examId);
    if (!exam) {
        const err = new Error('Exam not found.');
        err.code = 'NOT_FOUND';
        err.status = 404;
        throw err;
    }

    if (currentUser && currentUser.role === 'TEACHER' && exam.created_by !== currentUser.id) {
        const err = new Error('You do not have permission to view variants of this exam.');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
    }

    const { data: variants, error } = await supabase
        .from('exam_variants')
        .select(`
            id,
            variant_code,
            is_root,
            exam_variant_questions (
                id
            )
        `)
        .eq('exam_id', examId)
        .is('deleted_at', null)
        .order('is_root', { ascending: false })
        .order('variant_code', { ascending: true });

    if (error) throw error;

    return (variants || []).map(v => ({
        id: v.id,
        variant_code: v.variant_code,
        is_root: v.is_root,
        questions_count: Array.isArray(v.exam_variant_questions) ? v.exam_variant_questions.length : 0
    }));
}

async function updateExamStatus(examId, targetStatus, allowedFromStatuses, currentUser, extraUpdates = {}) {
    if (!isValidUUID(examId)) {
        const err = new Error('examId must be a valid UUID.');
        err.code = 'INVALID_ID_FORMAT';
        err.status = 400;
        throw err;
    }

    const exam = await findExamById(examId);
    if (!exam) {
        const err = new Error('Exam not found.');
        err.code = 'NOT_FOUND';
        err.status = 404;
        throw err;
    }

    if (currentUser && currentUser.role === 'TEACHER' && exam.created_by !== currentUser.id) {
        const err = new Error('You do not have permission to update this exam status.');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
    }

    if (!allowedFromStatuses.includes(exam.status)) {
        const err = new Error(`Cannot transition exam to ${targetStatus} from current status '${exam.status}'. Allowed statuses: ${allowedFromStatuses.join(', ')}.`);
        err.code = 'INVALID_EXAM_STATUS';
        err.status = 409;
        throw err;
    }

    if (targetStatus === 'IN_PROGRESS') requireExamOpened(exam);

    const now = new Date().toISOString();
    const updates = {
        status: targetStatus,
        updated_at: now,
        ...extraUpdates
    };

    const { data: updated, error } = await supabase
        .from('exams')
        .update(updates)
        .eq('id', examId)
        .select(`
            id,
            code,
            name,
            subject_id,
            form_template_id,
            status,
            delivery_mode,
            total_questions,
            duration_minutes,
            opens_at,
            closes_at,
            total_score,
            result_visibility_mode,
            result_published_at,
            created_by,
            created_at,
            updated_at
        `)
        .single();

    if (error) throw error;
    return updated;
}

async function publishExam(examId, currentUser) {
    return updateExamStatus(examId, 'PUBLISHED', ['GENERATED'], currentUser);
}

async function startExam(examId, currentUser) {
    return updateExamStatus(examId, 'IN_PROGRESS', ['PUBLISHED'], currentUser);
}

async function archiveExam(examId, currentUser) {
    // Keep the API guard aligned with the canonical database state machine.
    // ENDED exams must publish results before they can become immutable archives.
    return updateExamStatus(examId, 'ARCHIVED', ['RESULT_PUBLISHED'], currentUser);
}

async function cancelExam(examId, { reason } = {}, currentUser) {
    return updateExamStatus(examId, 'CANCELLED', ['DRAFT', 'GENERATED', 'PUBLISHED', 'IN_PROGRESS'], currentUser);
}

module.exports = {
    requireExamOpened,
    isValidUUID,
    listExams,
    findExamById,
    findExamByCode,
    countActiveVariantsByExamId,
    createExam,
    updateExam,
    deleteExam,
    replaceMatrix,
    replaceRootQuestions,
    getRootQuestions,
    generateDraftRootFromMatrix,
    replaceGradingRules,
    validateMatrix,
    generateExamVariants,
    listExamVariants,
    publishExam,
    startExam,
    archiveExam,
    cancelExam
};
