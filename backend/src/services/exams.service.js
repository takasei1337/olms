const supabase = require('../config/supabase');
const aiEmbeddingService = require('./ai-embedding.service');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_DELIVERY_MODES = ['ONLINE', 'PAPER', 'BOTH'];
const VALID_RESULT_VISIBILITY_MODES = ['HIDDEN', 'SCORE_ONLY', 'SCORE_AND_STATUS', 'FULL_REVIEW'];
const VALID_STATUSES = ['DRAFT', 'GENERATED', 'PUBLISHED', 'IN_PROGRESS', 'ENDED', 'RESULT_PUBLISHED', 'ARCHIVED', 'CANCELLED'];

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

    // Delete existing matrix rows for this exam
    const { error: delErr } = await supabase
        .from('exam_matrices')
        .delete()
        .eq('exam_id', examId);

    if (delErr) throw delErr;

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

    // Retrieve matrix rows
    const { data: rows, error: rowsErr } = await supabase
        .from('exam_matrices')
        .select('*')
        .eq('exam_id', examId)
        .is('deleted_at', null);

    if (rowsErr) throw rowsErr;

    const matrixRows = rows || [];
    const issues = [];
    let matrixTotalQuestions = 0;
    let matrixTotalScore = 0;

    for (let index = 0; index < matrixRows.length; index++) {
        const row = matrixRows[index];
        matrixTotalQuestions += row.num_questions;
        matrixTotalScore += row.num_questions * parseFloat(row.score_per_question);

        // Count available ACTIVE + AI-verified questions in question pool (matches trg_check_exam_publish_readiness)
        let qQuery = supabase
            .from('questions')
            .select('id, question_versions!inner(id)', { count: 'exact', head: true })
            .eq('question_versions.type_id', row.question_type_id)
            .eq('question_versions.difficulty_level', row.difficulty_level)
            .eq('question_versions.is_current', true)
            .eq('status', 'ACTIVE')
            .in('ai_check_status', ['CHECKED', 'OVERRIDDEN'])
            .is('deleted_at', null);

        if (row.lesson_id) {
            qQuery = qQuery.eq('lesson_id', row.lesson_id);
        } else if (row.chapter_id) {
            // Filter by chapter via active lessons
            const { data: lessons, error: lesErr } = await supabase
                .from('lessons')
                .select('id')
                .eq('chapter_id', row.chapter_id)
                .is('deleted_at', null);

            if (lesErr) throw lesErr;

            if (lessons && lessons.length > 0) {
                const lessonIds = lessons.map(l => l.id);
                qQuery = qQuery.in('lesson_id', lessonIds);
            } else {
                // Chapter has no lessons, available = 0
                issues.push({
                    row_index: index,
                    code: 'EXAM_QUESTION_POOL_INSUFFICIENT',
                    requested: row.num_questions,
                    available: 0,
                    message: `Chương chưa có bài học hoặc câu hỏi khả dụng (cần ${row.num_questions} câu).`
                });
                continue;
            }
        } else {
            // Whole subject scope: active chapters -> active lessons of exam.subject_id
            const { data: chapters, error: chapErr } = await supabase
                .from('chapters')
                .select('id')
                .eq('subject_id', exam.subject_id)
                .is('deleted_at', null);

            if (chapErr) throw chapErr;

            const chapterIds = (chapters || []).map(c => c.id);
            if (chapterIds.length === 0) {
                issues.push({
                    row_index: index,
                    code: 'EXAM_QUESTION_POOL_INSUFFICIENT',
                    requested: row.num_questions,
                    available: 0,
                    message: `Môn học chưa có chương/bài học hoặc câu hỏi khả dụng (cần ${row.num_questions} câu).`
                });
                continue;
            }

            const { data: lessons, error: lesErr } = await supabase
                .from('lessons')
                .select('id')
                .in('chapter_id', chapterIds)
                .is('deleted_at', null);

            if (lesErr) throw lesErr;

            if (lessons && lessons.length > 0) {
                const lessonIds = lessons.map(l => l.id);
                qQuery = qQuery.in('lesson_id', lessonIds);
            } else {
                issues.push({
                    row_index: index,
                    code: 'EXAM_QUESTION_POOL_INSUFFICIENT',
                    requested: row.num_questions,
                    available: 0,
                    message: `Môn học chưa có bài học hoặc câu hỏi khả dụng (cần ${row.num_questions} câu).`
                });
                continue;
            }
        }

        const { count, error: countErr } = await qQuery;
        if (countErr) throw countErr;
        const available = count ?? 0;

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
    return [];
}

function getQuestionVersion(q) {
    return Array.isArray(q.question_versions) ? q.question_versions[0] : q.question_versions;
}

async function resolveQuestionVector(question, embeddingCache) {
    if (embeddingCache.has(question.id)) {
        return embeddingCache.get(question.id);
    }

    const version = getQuestionVersion(question);
    const content = typeof version?.content === 'string' ? version.content.trim() : '';
    if (!content) {
        embeddingCache.set(question.id, null);
        return null;
    }

    try {
        const vector = await aiEmbeddingService.embed(content, { timeoutMs: 10000 });
        embeddingCache.set(question.id, vector);
        return vector;
    } catch (_) {
        embeddingCache.set(question.id, null);
        return null;
    }
}

async function isSemanticallyDistinct(candidate, selectedQuestionObjects, embeddingCache, simThreshold) {
    if (simThreshold >= 1 || selectedQuestionObjects.length === 0) {
        return true;
    }

    const candidateVector = await resolveQuestionVector(candidate, embeddingCache);
    if (!candidateVector) {
        return true;
    }

    for (const selected of selectedQuestionObjects) {
        const selectedVector = await resolveQuestionVector(selected, embeddingCache);
        if (!selectedVector) continue;
        const score = aiEmbeddingService.cosineSimilarity(candidateVector, selectedVector);
        if (score >= simThreshold) {
            return false;
        }
    }

    return true;
}

async function generateExamVariants(examId, {
    variant_count,
    variant_code_start,
    strict_topic_balance = false,
    similarity_threshold = 0.7
}, currentUser) {
    if (!isValidUUID(examId)) {
        const err = new Error('examId must be a valid UUID.');
        err.code = 'INVALID_ID_FORMAT';
        err.status = 400;
        throw err;
    }

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

    // Deep matrix validation
    const validation = await validateMatrix(examId, currentUser);
    if (!validation.valid) {
        const err = new Error(validation.issues?.[0]?.message || 'Ma trận đề thi không hợp lệ hoặc thiếu câu hỏi.');
        err.code = 'EXAM_MATRIX_INVALID';
        err.status = 422;
        err.details = validation.issues;
        throw err;
    }

    // Fetch matrix rows
    const { data: rows, error: rowsErr } = await supabase
        .from('exam_matrices')
        .select('*')
        .eq('exam_id', examId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

    if (rowsErr) throw rowsErr;
    const matrixRows = rows || [];

    // Ensure grading rules exist for all matrix question types (required by DB trigger olms_validate_variant_membership)
    const { data: gradingRules, error: grErr } = await supabase
        .from('exam_grading_rules')
        .select('question_type_id')
        .eq('exam_id', examId)
        .is('deleted_at', null);
    if (grErr) throw grErr;

    const coveredTypeIds = new Set((gradingRules || []).map(r => r.question_type_id));
    const missingTypes = matrixRows.filter(r => !coveredTypeIds.has(r.question_type_id));
    if (missingTypes.length > 0) {
        const err = new Error('Kỳ thi chưa thiết lập quy tắc chấm điểm (grading rules) cho tất cả dạng câu hỏi trong ma trận.');
        err.code = 'GRADING_RULES_MISSING';
        err.status = 422;
        throw err;
    }

    // Collect questions per matrix row applying ARC-02 Hybrid Balancing
    const selectedQuestions = [];
    const selectedQuestionObjects = [];
    const embeddingCache = new Map();
    const usedQuestionIds = new Set();
    const globalTopicCounts = new Map();

    for (let rowIndex = 0; rowIndex < matrixRows.length; rowIndex++) {
        const row = matrixRows[rowIndex];
        const maxPerTopic = row.max_questions_per_topic || 2;

        let qQuery = supabase
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
                    options_snapshot,
                    is_current
                )
            `)
            .eq('question_versions.type_id', row.question_type_id)
            .eq('question_versions.difficulty_level', row.difficulty_level)
            .eq('question_versions.is_current', true)
            .eq('status', 'ACTIVE')
            .in('ai_check_status', ['CHECKED', 'OVERRIDDEN'])
            .is('deleted_at', null);

        if (row.lesson_id) {
            qQuery = qQuery.eq('lesson_id', row.lesson_id);
        } else if (row.chapter_id) {
            const { data: lessons, error: lesErr } = await supabase
                .from('lessons')
                .select('id')
                .eq('chapter_id', row.chapter_id)
                .is('deleted_at', null);
            if (lesErr) throw lesErr;
            const lessonIds = (lessons || []).map(l => l.id);
            if (lessonIds.length > 0) {
                qQuery = qQuery.in('lesson_id', lessonIds);
            }
        } else {
            const { data: chapters, error: chapErr } = await supabase
                .from('chapters')
                .select('id')
                .eq('subject_id', exam.subject_id)
                .is('deleted_at', null);
            if (chapErr) throw chapErr;
            const chapterIds = (chapters || []).map(c => c.id);
            if (chapterIds.length > 0) {
                const { data: lessons, error: lesErr } = await supabase
                    .from('lessons')
                    .select('id')
                    .in('chapter_id', chapterIds)
                    .is('deleted_at', null);
                if (lesErr) throw lesErr;
                const lessonIds = (lessons || []).map(l => l.id);
                if (lessonIds.length > 0) {
                    qQuery = qQuery.in('lesson_id', lessonIds);
                }
            }
        }

        const { data: candidateQuestions, error: cqErr } = await qQuery;
        if (cqErr) throw cqErr;

        // Filter out any question already used in this exam
        const availablePool = (candidateQuestions || []).filter(q => !usedQuestionIds.has(q.id));

        // Shuffled pool for selection
        const shuffledPool = shuffle(availablePool);
        const rowChosen = [];
        const overflowPool = [];
        let semanticRejectedCount = 0;

        for (const candidate of shuffledPool) {
            if (rowChosen.length === row.num_questions) break;

            const topic = (candidate.topic_tag || '').trim() || 'UNTAGGED';
            const currentTopicCount = globalTopicCounts.get(topic) || 0;

            if (topic !== 'UNTAGGED' && currentTopicCount >= maxPerTopic) {
                overflowPool.push(candidate);
                continue;
            }

            if (!(await isSemanticallyDistinct(candidate, selectedQuestionObjects, embeddingCache, simThreshold))) {
                semanticRejectedCount++;
                continue;
            }

            rowChosen.push(candidate);
            selectedQuestionObjects.push(candidate);
            usedQuestionIds.add(candidate.id);
            if (topic !== 'UNTAGGED') {
                globalTopicCounts.set(topic, currentTopicCount + 1);
            }
        }

        // Check if enough questions were selected under ARC-02 topic cap
        if (rowChosen.length < row.num_questions) {
            if (strict_topic_balance && overflowPool.length > 0) {
                const err = new Error(`ARC-02: Không đủ câu hỏi đa dạng theo topic (trần ${maxPerTopic} câu/topic) cho dòng ma trận ${rowIndex + 1}.`);
                err.code = 'TOPIC_POOL_INSUFFICIENT';
                err.status = 422;
                throw err;
            }

            // Fallback non-strict: take from overflowPool (TOPIC_CAP_RELAXED) while preserving semantic guard
            if (!strict_topic_balance) {
                for (const candidate of overflowPool) {
                    if (rowChosen.length === row.num_questions) break;
                    if (!(await isSemanticallyDistinct(candidate, selectedQuestionObjects, embeddingCache, simThreshold))) {
                        semanticRejectedCount++;
                        continue;
                    }
                    rowChosen.push(candidate);
                    selectedQuestionObjects.push(candidate);
                    usedQuestionIds.add(candidate.id);
                    const topic = (candidate.topic_tag || '').trim() || 'UNTAGGED';
                    if (topic !== 'UNTAGGED') {
                        globalTopicCounts.set(topic, (globalTopicCounts.get(topic) || 0) + 1);
                    }
                }
            }
        }

        if (rowChosen.length < row.num_questions) {
            if (semanticRejectedCount > 0) {
                const err = new Error(`Không đủ câu hỏi khác biệt về mặt ngữ nghĩa (ngưỡng similarity_threshold = ${simThreshold}) cho dòng ma trận ${rowIndex + 1}.`);
                err.code = 'SEMANTIC_POOL_INSUFFICIENT';
                err.status = 422;
                throw err;
            }
            const err = new Error(`Thiếu câu hỏi khả dụng cho dòng ma trận ${rowIndex + 1}.`);
            err.code = 'EXAM_QUESTION_POOL_INSUFFICIENT';
            err.status = 422;
            throw err;
        }

        // Attach point / score for each question from row or proportion
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
        }
    }

    // Root questions order
    const rootQuestions = [...selectedQuestions];
    const baseCodeNum = parseInt(startCodeStr, 10);
    const codeLength = startCodeStr.length;

    // Clean up any existing variants/questions if this draft was previously generated
    const { data: oldVariants } = await supabase
        .from('exam_variants')
        .select('id')
        .eq('exam_id', examId);

    if (oldVariants && oldVariants.length > 0) {
        const oldIds = oldVariants.map(v => v.id);
        await supabase.from('exam_variant_questions').delete().in('variant_id', oldIds);
        await supabase.from('exam_variants').delete().in('id', oldIds);
    }

    const now = new Date().toISOString();
    const createdVariants = [];
    const variantsToInsert = [];
    const variantQuestionsToInsert = [];
    const versionIdsToFreeze = new Set(rootQuestions.map(q => q.version_id));

    // Generate Variant 0 (Root) and additional variants
    for (let vIdx = 0; vIdx < count; vIdx++) {
        const isRoot = vIdx === 0;
        const variantId = require('crypto').randomUUID();
        const variantCode = String(baseCodeNum + vIdx).padStart(codeLength, '0');

        variantsToInsert.push({
            id: variantId,
            exam_id: examId,
            variant_code: variantCode,
            is_root: isRoot,
            created_at: now,
            updated_at: now
        });

        // Questions order: canonical order for root, shuffled for other variants
        const currentQuestions = isRoot ? rootQuestions : shuffle([...rootQuestions]);

        for (let qIdx = 0; qIdx < currentQuestions.length; qIdx++) {
            const q = currentQuestions[qIdx];
            const optionOrder = getOptionOrder(q.options_snapshot, !isRoot);

            variantQuestionsToInsert.push({
                id: require('crypto').randomUUID(),
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
        status: 'GENERATED',
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

async function endExam(examId, currentUser) {
    return updateExamStatus(examId, 'ENDED', ['IN_PROGRESS'], currentUser);
}

async function archiveExam(examId, currentUser) {
    // Keep the API guard aligned with the canonical database state machine.
    // ENDED exams must publish results before they can become immutable archives.
    return updateExamStatus(examId, 'ARCHIVED', ['RESULT_PUBLISHED'], currentUser);
}

async function cancelExam(examId, { reason } = {}, currentUser) {
    return updateExamStatus(examId, 'CANCELLED', ['DRAFT', 'GENERATED', 'PUBLISHED', 'IN_PROGRESS'], currentUser);
}

async function getPrintFiles(examId, currentUser) {
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
        const err = new Error('You do not have permission to export print files for this exam.');
        err.code = 'FORBIDDEN';
        err.status = 403;
        throw err;
    }

    if (exam.status === 'DRAFT') {
        const err = new Error('Cannot export print files for DRAFT exam. Please generate variants first.');
        err.code = 'INVALID_EXAM_STATUS';
        err.status = 409;
        throw err;
    }

    const now = Date.now();
    return {
        download_url: `https://storage.olms.edu.vn/exams/${exam.id}/print-bundle.zip`,
        expires_at: new Date(now + 3600000).toISOString(),
        file_name: `${exam.code}_print_package.zip`
    };
}

module.exports = {
    isValidUUID,
    listExams,
    findExamById,
    findExamByCode,
    countActiveVariantsByExamId,
    createExam,
    updateExam,
    deleteExam,
    replaceMatrix,
    replaceGradingRules,
    validateMatrix,
    generateExamVariants,
    listExamVariants,
    publishExam,
    startExam,
    endExam,
    archiveExam,
    cancelExam,
    getPrintFiles
};
