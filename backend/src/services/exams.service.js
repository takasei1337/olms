const supabase = require('../config/supabase');

function formatExamResponse(row) {
    if (!row) return null;
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        subject_id: row.subject_id,
        status: row.status,
        delivery_mode: row.delivery_mode,
        total_questions: row.total_questions,
        duration_minutes: row.duration_minutes,
        opens_at: row.opens_at,
        closes_at: row.closes_at,
        total_score: row.total_score !== null && row.total_score !== undefined
            ? Number(row.total_score)
            : 10,
        result_visibility_mode: row.result_visibility_mode,
        result_published_at: row.result_published_at ?? null,
        form_template_id: row.form_template_id ?? null,
        created_by: row.created_by
    };
}

async function findExams({
    from = 0,
    to = 19,
    q = '',
    subject_id = null,
    status = null,
    delivery_mode = null
}) {
    let query = supabase
        .from('exams')
        .select('*', {count: 'exact'})
        .is('deleted_at', null);

    if (subject_id) {
        query = query.eq('subject_id', subject_id);
    }

    if (status) {
        query = query.eq('status', status);
    }

    if (delivery_mode) {
        query = query.eq('delivery_mode', delivery_mode);
    }

    if (q) {
        const safeQ = q.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        query = query.or(`code.ilike."%${safeQ}%",name.ilike."%${safeQ}%"`);
    }

    const {data, error, count} = await query
        .order('created_at', {ascending: false})
        .range(from, to);

    if (error) throw error;

    return {
        exams: (data ?? []).map(formatExamResponse),
        total: count ?? 0
    };
}

async function findExamById(examId) {
    const {data, error} = await supabase
        .from('exams')
        .select('*')
        .eq('id', examId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw error;
    return formatExamResponse(data);
}

async function createExam(payload, createdBy) {
    const now = new Date().toISOString();
    const examId = require('node:crypto').randomUUID();

    const insertData = {
        id: examId,
        code: payload.code.trim(),
        name: payload.name.trim(),
        subject_id: payload.subject_id,
        delivery_mode: payload.delivery_mode,
        total_questions: payload.total_questions,
        duration_minutes: payload.duration_minutes,
        opens_at: payload.opens_at,
        closes_at: payload.closes_at,
        total_score: payload.total_score !== undefined ? payload.total_score : 10,
        result_visibility_mode: payload.result_visibility_mode ?? 'HIDDEN',
        form_template_id: payload.form_template_id ?? null,
        status: 'DRAFT',
        created_by: createdBy,
        created_at: now,
        updated_at: now
    };

    const {data, error} = await supabase
        .from('exams')
        .insert(insertData)
        .select()
        .single();

    if (error) throw error;
    return formatExamResponse(data);
}

async function updateExam(examId, updates) {
    const now = new Date().toISOString();
    const updatePayload = {
        ...updates,
        updated_at: now
    };

    if (updatePayload.code) updatePayload.code = updatePayload.code.trim();
    if (updatePayload.name) updatePayload.name = updatePayload.name.trim();

    const {data, error} = await supabase
        .from('exams')
        .update(updatePayload)
        .eq('id', examId)
        .is('deleted_at', null)
        .select()
        .maybeSingle();

    if (error) throw error;
    return formatExamResponse(data);
}

async function softDeleteExam(examId, deletedBy) {
    const now = new Date().toISOString();

    const {data, error} = await supabase
        .from('exams')
        .update({
            deleted_at: now,
            deleted_by: deletedBy,
            updated_at: now
        })
        .eq('id', examId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function replaceExamMatrix(examId, rows, userId) {
    const now = new Date().toISOString();

    // Delete old matrix rows for this exam
    const {error: delErr} = await supabase
        .from('exam_matrices')
        .delete()
        .eq('exam_id', examId);

    if (delErr) throw delErr;

    const insertRows = rows.map(r => ({
        id: require('node:crypto').randomUUID(),
        exam_id: examId,
        chapter_id: r.chapter_id ?? null,
        lesson_id: r.lesson_id ?? null,
        question_type_id: r.question_type_id,
        difficulty_level: r.difficulty_level,
        num_questions: r.num_questions,
        score_per_question: r.score_per_question,
        created_at: now,
        updated_at: now
    }));

    const {data, error: insErr} = await supabase
        .from('exam_matrices')
        .insert(insertRows)
        .select();

    if (insErr) throw insErr;
    return data ?? [];
}

async function replaceExamGradingRules(examId, rules, userId) {
    const now = new Date().toISOString();

    // Delete old rules for this exam
    const {error: delErr} = await supabase
        .from('exam_grading_rules')
        .delete()
        .eq('exam_id', examId);

    if (delErr) throw delErr;

    const insertRules = rules.map(rule => ({
        id: require('node:crypto').randomUUID(),
        exam_id: examId,
        question_type_id: rule.question_type_id,
        scoring_mode: rule.scoring_mode,
        penalty_for_wrong: rule.penalty_for_wrong !== undefined ? rule.penalty_for_wrong : true,
        case_sensitive: rule.case_sensitive !== undefined ? rule.case_sensitive : false,
        rounding_precision: rule.rounding_precision !== undefined ? rule.rounding_precision : 2,
        rounding_rule: rule.rounding_rule ?? 'ROUND_HALF_UP',
        allow_negative_marking: false,
        created_at: now,
        updated_at: now
    }));

    const {data, error: insErr} = await supabase
        .from('exam_grading_rules')
        .insert(insertRules)
        .select();

    if (insErr) throw insErr;
    return data ?? [];
}

async function validateExamMatrix(examId) {
    const exam = await findExamById(examId);
    if (!exam) return null;

    const {data: matrices, error: mErr} = await supabase
        .from('exam_matrices')
        .select('*')
        .eq('exam_id', examId)
        .is('deleted_at', null);

    if (mErr) throw mErr;

    const {data: rules, error: rErr} = await supabase
        .from('exam_grading_rules')
        .select('*')
        .eq('exam_id', examId)
        .is('deleted_at', null);

    if (rErr) throw rErr;

    const rows = matrices ?? [];
    const existingRules = rules ?? [];
    const issues = [];

    const matrix_questions = rows.reduce((sum, r) => sum + r.num_questions, 0);
    const matrix_score = Number(rows.reduce((sum, r) => sum + (r.num_questions * Number(r.score_per_question)), 0).toFixed(2));

    if (matrix_questions !== exam.total_questions) {
        issues.push({
            code: 'TOTAL_QUESTIONS_MISMATCH',
            requested: exam.total_questions,
            available: matrix_questions,
            message: `Matrix total questions (${matrix_questions}) does not match exam requirement (${exam.total_questions}).`
        });
    }

    if (Math.abs(matrix_score - Number(exam.total_score)) > 0.001) {
        issues.push({
            code: 'TOTAL_SCORE_MISMATCH',
            requested: Number(exam.total_score),
            available: matrix_score,
            message: `Matrix total score (${matrix_score}) does not match exam requirement (${exam.total_score}).`
        });
    }

    const ruleTypeIds = new Set(existingRules.map(r => r.question_type_id));

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];

        if (!ruleTypeIds.has(r.question_type_id)) {
            issues.push({
                row_index: i,
                code: 'MISSING_GRADING_RULE',
                message: `Grading rule missing for question_type_id: ${r.question_type_id}.`
            });
        }

        // Check question pool availability
        let qQuery = supabase
            .from('questions')
            .select('id, question_versions!inner(id, type_id, difficulty_level, is_current)', {count: 'exact', head: true})
            .is('deleted_at', null)
            .eq('status', 'ACTIVE')
            .in('ai_check_status', ['CHECKED', 'OVERRIDDEN'])
            .eq('question_versions.is_current', true)
            .eq('question_versions.type_id', r.question_type_id)
            .eq('question_versions.difficulty_level', r.difficulty_level);

        if (r.lesson_id) {
            qQuery = qQuery.eq('lesson_id', r.lesson_id);
        } else if (r.chapter_id) {
            const {data: lessons} = await supabase
                .from('lessons')
                .select('id')
                .eq('chapter_id', r.chapter_id)
                .is('deleted_at', null);

            const lIds = (lessons ?? []).map(l => l.id);
            qQuery = qQuery.in('lesson_id', lIds);
        } else {
            const {data: chapters} = await supabase
                .from('chapters')
                .select('id')
                .eq('subject_id', exam.subject_id)
                .is('deleted_at', null);

            const cIds = (chapters ?? []).map(c => c.id);
            const {data: lessons} = await supabase
                .from('lessons')
                .select('id')
                .in('chapter_id', cIds)
                .is('deleted_at', null);

            const lIds = (lessons ?? []).map(l => l.id);
            qQuery = qQuery.in('lesson_id', lIds);
        }

        const {count: availableCount} = await qQuery;
        const available = availableCount ?? 0;

        if (available < r.num_questions) {
            issues.push({
                row_index: i,
                code: 'INSUFFICIENT_QUESTIONS',
                requested: r.num_questions,
                available,
                message: `Insufficient active questions for matrix row ${i}. Requested: ${r.num_questions}, available: ${available}.`
            });
        }
    }

    return {
        valid: issues.length === 0,
        expected_questions: exam.total_questions,
        matrix_questions,
        expected_score: Number(exam.total_score),
        matrix_score,
        issues
    };
}

async function findExamVariants(examId) {
    const {data: variants, error: vErr} = await supabase
        .from('exam_variants')
        .select(`
            id,
            variant_code,
            is_root,
            exam_variant_questions (id)
        `)
        .eq('exam_id', examId)
        .is('deleted_at', null)
        .order('variant_code', {ascending: true});

    if (vErr) throw vErr;

    return (variants ?? []).map(v => ({
        id: v.id,
        variant_code: v.variant_code,
        is_root: v.is_root,
        questions_count: Array.isArray(v.exam_variant_questions) ? v.exam_variant_questions.length : 0
    }));
}

async function publishExam(examId, userId) {
    const now = new Date().toISOString();

    const {data, error} = await supabase
        .from('exams')
        .update({
            status: 'PUBLISHED',
            updated_at: now
        })
        .eq('id', examId)
        .is('deleted_at', null)
        .select()
        .maybeSingle();

    if (error) throw error;
    return formatExamResponse(data);
}

async function generateExamVariants(examId, {variant_count, variant_code_start}, userId) {
    const {data, error} = await supabase.rpc('olms_generate_exam_variants', {
        p_exam_id: examId,
        p_variant_count: variant_count,
        p_variant_code_start: String(variant_code_start).trim(),
        p_created_by: userId
    });

    if (error) {
        throw error;
    }

    return data;
}

module.exports = {
    findExams,
    findExamById,
    createExam,
    updateExam,
    softDeleteExam,
    replaceExamMatrix,
    replaceExamGradingRules,
    validateExamMatrix,
    findExamVariants,
    publishExam,
    generateExamVariants,
    formatExamResponse
};

