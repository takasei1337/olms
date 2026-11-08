const supabase = require('../config/supabase');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
            total_pages: totalPages,
            has_next: currentPage < totalPages,
            has_prev: currentPage > 1
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

module.exports = {
    isValidUUID,
    listExams,
    findExamById,
    findExamByCode,
    countActiveVariantsByExamId,
    createExam,
    updateExam,
    deleteExam
};
