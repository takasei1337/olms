const supabase = require('../config/supabase');
const gradingService = require('./grading.service');
const examsService = require('./exams.service');

const VALID_VISIBILITY_MODES = ['HIDDEN', 'SCORE_ONLY', 'SCORE_AND_STATUS', 'FULL_REVIEW'];

function buildStudentResultSummary(exam, submission, grade) {
    const isPublished = ['RESULT_PUBLISHED', 'ARCHIVED'].includes(exam.status) && Boolean(exam.result_published_at);
    const visibility = exam.result_visibility_mode;
    const submissionStatus = submission ? submission.status : 'NOT_STARTED';
    const resultAvailable = isPublished && Boolean(grade) && submission?.status === 'GRADED' && visibility !== 'HIDDEN';

    if (!resultAvailable) {
        return {
            exam_id: exam.id,
            exam_name: exam.name,
            visibility,
            result_published: isPublished,
            result_available: false,
            submission_status: submissionStatus
        };
    }

    return {
        exam_id: exam.id,
        exam_name: exam.name,
        visibility,
        result_published: true,
        result_available: true,
        submission_status: submissionStatus,
        total_score: Number(grade.total_score),
        max_score: Number(exam.total_score)
    };
}

async function buildSubmissionReviewItems(submissionId) {
    const {data: sagRows, error: sagErr} = await supabase
        .from('submission_answer_grades')
        .select(`
            exam_variant_question_id,
            answer_snapshot,
            correct_answer_snapshot,
            grading_status,
            max_score,
            earned_score,
            exam_variant_questions!inner (
                id,
                position_in_variant,
                option_order,
                question_versions!inner (
                    id,
                    content,
                    explanation,
                    options_snapshot
                )
            )
        `)
        .eq('submission_id', submissionId)
        .eq('is_final', true);

    if (sagErr) throw sagErr;

    const items = (sagRows ?? []).map(row => {
        const evq = Array.isArray(row.exam_variant_questions) ? row.exam_variant_questions[0] : row.exam_variant_questions;
        const qv = evq && (Array.isArray(evq.question_versions) ? evq.question_versions[0] : evq.question_versions);

        return {
            position: evq?.position_in_variant ?? 0,
            content: qv?.content || '',
            render_spec: gradingService.buildStudentRenderSpec(qv?.options_snapshot, evq?.option_order),
            student_response: row.answer_snapshot || {},
            correct_answer: row.correct_answer_snapshot || {},
            grading_status: row.grading_status === 'UNGRADED' ? 'BLANK' : row.grading_status,
            earned_score: Number(row.earned_score),
            max_score: Number(row.max_score),
            explanation: qv?.explanation ?? null
        };
    });

    items.sort((a, b) => a.position - b.position);
    return items;
}

async function getExamResultsList(exam, {page = 1, pageSize = 20, status = null, student_code = ''} = {}) {
    await gradingService.gradePendingOnlineSubmissionsForExam(exam.id);

    const {data: participantRows, error: partErr} = await supabase
        .from('participants')
        .select('id, student_code, full_name_snapshot, status')
        .eq('exam_id', exam.id)
        .is('deleted_at', null)
        .order('student_code', {ascending: true});

    if (partErr) throw partErr;

    const {data: submissionRows, error: subErr} = await supabase
        .from('submissions')
        .select('id, participant_id, status, raw_score')
        .eq('exam_id', exam.id);

    if (subErr) throw subErr;

    const submissionByParticipantId = new Map((submissionRows ?? []).map(s => [s.participant_id, s]));
    const submissionIds = (submissionRows ?? []).map(s => s.id);
    const gradeBySubmissionId = new Map();

    if (submissionIds.length > 0) {
        const {data: gradeRows, error: gradeErr} = await supabase
            .from('grades')
            .select('submission_id, total_score')
            .in('submission_id', submissionIds);
        if (gradeErr) throw gradeErr;
        for (const g of gradeRows ?? []) {
            gradeBySubmissionId.set(g.submission_id, g);
        }
    }

    let rows = (participantRows ?? []).map(p => {
        const sub = submissionByParticipantId.get(p.id) || null;
        const grade = sub ? gradeBySubmissionId.get(sub.id) : null;
        const score = grade
            ? Number(grade.total_score)
            : (sub && sub.raw_score !== null && sub.raw_score !== undefined ? Number(sub.raw_score) : null);

        return {
            participant_id: p.id,
            student_code: p.student_code,
            full_name: p.full_name_snapshot,
            submission_id: sub ? sub.id : null,
            status: sub ? sub.status : p.status,
            score
        };
    });

    if (student_code) {
        const needle = student_code.trim().toLowerCase();
        rows = rows.filter(r => r.student_code.toLowerCase().includes(needle));
    }

    if (status) {
        rows = rows.filter(r => r.status === status);
    }

    const total = rows.length;
    const from = (page - 1) * pageSize;
    const paged = rows.slice(from, from + pageSize);

    return {rows: paged, total};
}

async function getSubmissionResultDetail(exam, submissionId) {
    let {data: submission, error: subErr} = await supabase
        .from('submissions')
        .select('id, participant_id, exam_id, source, status, raw_score')
        .eq('id', submissionId)
        .eq('exam_id', exam.id)
        .maybeSingle();

    if (subErr) throw subErr;
    if (!submission) {
        const err = new Error('Submission not found in this exam.');
        err.code = 'SUBMISSION_NOT_FOUND';
        err.status = 404;
        throw err;
    }

    if (submission.source === 'ONLINE' && ['SUBMITTED', 'GRADING'].includes(submission.status)) {
        await gradingService.gradeSubmission(submission.id);
        const {data: refreshed, error: refErr} = await supabase
            .from('submissions')
            .select('id, participant_id, exam_id, source, status, raw_score')
            .eq('id', submissionId)
            .single();
        if (refErr) throw refErr;
        submission = refreshed;
    }

    const {data: grade, error: gradeErr} = await supabase
        .from('grades')
        .select('id, total_score, correct_count, wrong_count, blank_count')
        .eq('submission_id', submission.id)
        .maybeSingle();

    if (gradeErr) throw gradeErr;

    const answers = grade ? await buildSubmissionReviewItems(submission.id) : [];

    return {
        summary: {
            exam_id: exam.id,
            exam_name: exam.name,
            visibility: exam.result_visibility_mode,
            result_published: Boolean(exam.result_published_at),
            result_available: Boolean(grade),
            submission_status: submission.status,
            total_score: grade ? Number(grade.total_score) : null,
            max_score: Number(exam.total_score)
        },
        answers
    };
}

async function getExamStatistics(exam) {
    await gradingService.gradePendingOnlineSubmissionsForExam(exam.id);

    const {count: participantCount, error: partCountErr} = await supabase
        .from('participants')
        .select('id', {count: 'exact', head: true})
        .eq('exam_id', exam.id)
        .is('deleted_at', null);

    if (partCountErr) throw partCountErr;

    const {data: submissionRows, error: subErr} = await supabase
        .from('submissions')
        .select('id')
        .eq('exam_id', exam.id)
        .eq('status', 'GRADED');

    if (subErr) throw subErr;

    const submissionIds = (submissionRows ?? []).map(s => s.id);
    let scores = [];

    if (submissionIds.length > 0) {
        const {data: gradeRows, error: gradeErr} = await supabase
            .from('grades')
            .select('total_score')
            .in('submission_id', submissionIds);
        if (gradeErr) throw gradeErr;
        scores = (gradeRows ?? []).map(g => Number(g.total_score));
    }

    const gradedCount = scores.length;
    const averageScore = gradedCount > 0
        ? Number((scores.reduce((sum, s) => sum + s, 0) / gradedCount).toFixed(2))
        : 0;

    const maxScore = Number(exam.total_score || 10);
    const step = maxScore / 5;
    const distribution = [];
    for (let i = 0; i < 5; i++) {
        const min = Number((i * step).toFixed(2));
        const max = Number(((i + 1) * step).toFixed(2));
        const isLast = i === 4;
        const count = scores.filter(s => (isLast ? s >= min && s <= max : s >= min && s < max)).length;
        distribution.push({
            range: `${min}-${max}`,
            min_score: min,
            max_score: max,
            count
        });
    }

    return {
        exam_id: exam.id,
        participant_count: participantCount ?? 0,
        graded_count: gradedCount,
        average_score: averageScore,
        distribution
    };
}

async function publishExamResults(exam, {result_visibility_mode} = {}, currentUser) {
    if (exam.status !== 'ENDED') {
        const err = new Error(`Results can only be published when exam status is ENDED (current: ${exam.status}).`);
        err.code = 'INVALID_EXAM_STATUS';
        err.status = 409;
        throw err;
    }

    // Attempt to force-close any expired IN_PROGRESS online submissions
    const {data: openOnlineSubs, error: openErr} = await supabase
        .from('submissions')
        .select('id')
        .eq('exam_id', exam.id)
        .eq('source', 'ONLINE')
        .eq('status', 'IN_PROGRESS');

    if (openErr) throw openErr;
    for (const sub of openOnlineSubs ?? []) {
        try {
            await supabase.rpc('olms_force_submit_expired_online', {p_submission: sub.id});
        } catch (_) {
            // If exam was ended manually before deadline, remaining IN_PROGRESS cannot be force-closed by expired RPC
        }
    }

    await gradingService.gradePendingOnlineSubmissionsForExam(exam.id, {gradedBy: currentUser.id});

    // Verify no active ungraded submissions remain
    const {data: ungradedSubs, error: ungradedErr} = await supabase
        .from('submissions')
        .select('id, status')
        .eq('exam_id', exam.id)
        .in('status', ['IN_PROGRESS', 'SUBMITTED', 'GRADING', 'FLAGGED']);

    if (ungradedErr) throw ungradedErr;
    if (ungradedSubs && ungradedSubs.length > 0) {
        const err = new Error('Cannot publish results while some submissions are not yet graded or are flagged.');
        err.code = 'SUBMISSIONS_NOT_GRADED';
        err.status = 409;
        throw err;
    }

    const now = new Date().toISOString();
    const targetMode = result_visibility_mode || exam.result_visibility_mode;

    const {error: updErr} = await supabase
        .from('exams')
        .update({
            status: 'RESULT_PUBLISHED',
            result_visibility_mode: targetMode,
            result_published_at: now,
            result_published_by: currentUser.id,
            updated_at: now
        })
        .eq('id', exam.id);

    if (updErr) throw updErr;

    return await examsService.findExamById(exam.id);
}

async function changeResultVisibility(exam, {result_visibility_mode, reason}, currentUser, requestMeta = {}) {
    if (exam.status !== 'RESULT_PUBLISHED') {
        const err = new Error(`Visibility mode can only be changed when exam status is RESULT_PUBLISHED (current: ${exam.status}).`);
        err.code = 'INVALID_EXAM_STATUS';
        err.status = 409;
        throw err;
    }

    const now = new Date().toISOString();
    const {error: updErr} = await supabase
        .from('exams')
        .update({
            result_visibility_mode,
            updated_at: now
        })
        .eq('id', exam.id);

    if (updErr) throw updErr;

    try {
        await supabase
            .from('audit_logs')
            .insert({
                actor_user_id: currentUser.id,
                action: 'RESULT_VISIBILITY_CHANGED',
                entity_name: 'exams',
                entity_id: exam.id,
                old_value: {result_visibility_mode: exam.result_visibility_mode},
                new_value: {result_visibility_mode, reason: reason.trim()},
                ip_address: requestMeta.ip || null,
                user_agent: requestMeta.userAgent ? String(requestMeta.userAgent).slice(0, 255) : null,
                created_at: now
            });
    } catch (_) {
        // Non-blocking audit fallback
    }

    return await examsService.findExamById(exam.id);
}

async function listMyResults(studentUserId) {
    const {data: partRows, error: partErr} = await supabase
        .from('participants')
        .select(`
            id,
            exam_id,
            exams!inner (
                id,
                name,
                status,
                total_score,
                result_visibility_mode,
                result_published_at,
                deleted_at
            )
        `)
        .eq('student_user_id', studentUserId)
        .is('deleted_at', null)
        .is('exams.deleted_at', null)
        .in('exams.status', ['IN_PROGRESS', 'ENDED', 'RESULT_PUBLISHED', 'ARCHIVED']);

    if (partErr) throw partErr;

    const participants = partRows ?? [];
    if (participants.length === 0) return [];

    const participantIds = participants.map(p => p.id);
    const {data: subRows, error: subErr} = await supabase
        .from('submissions')
        .select('id, participant_id, status')
        .in('participant_id', participantIds);

    if (subErr) throw subErr;
    const subByPartId = new Map((subRows ?? []).map(s => [s.participant_id, s]));

    const subIds = (subRows ?? []).map(s => s.id);
    const gradeBySubId = new Map();
    if (subIds.length > 0) {
        const {data: gradeRows, error: gradeErr} = await supabase
            .from('grades')
            .select('submission_id, total_score')
            .in('submission_id', subIds);
        if (gradeErr) throw gradeErr;
        for (const g of gradeRows ?? []) {
            gradeBySubId.set(g.submission_id, g);
        }
    }

    return participants.map(p => {
        const examObj = Array.isArray(p.exams) ? p.exams[0] : p.exams;
        const sub = subByPartId.get(p.id) || null;
        const grade = sub ? gradeBySubId.get(sub.id) : null;
        return buildStudentResultSummary(examObj, sub, grade);
    });
}

async function findStudentExamParticipation(examId, studentUserId) {
    const {data: exam, error: examErr} = await supabase
        .from('exams')
        .select('id, name, status, total_score, result_visibility_mode, result_published_at')
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
        .select('id, student_user_id')
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

    const {data: submission, error: subErr} = await supabase
        .from('submissions')
        .select('id, status')
        .eq('participant_id', participant.id)
        .maybeSingle();

    if (subErr) throw subErr;

    let grade = null;
    if (submission) {
        const {data: gradeRow, error: gradeErr} = await supabase
            .from('grades')
            .select('id, total_score')
            .eq('submission_id', submission.id)
            .maybeSingle();
        if (gradeErr) throw gradeErr;
        grade = gradeRow;
    }

    return {exam, participant, submission, grade};
}

async function getMyResultForExam(examId, studentUserId) {
    const {exam, submission, grade} = await findStudentExamParticipation(examId, studentUserId);
    return buildStudentResultSummary(exam, submission, grade);
}

async function getMyResultReview(examId, studentUserId) {
    const {exam, submission, grade} = await findStudentExamParticipation(examId, studentUserId);

    const isPublished = ['RESULT_PUBLISHED', 'ARCHIVED'].includes(exam.status) && Boolean(exam.result_published_at);
    if (!isPublished || !submission || submission.status !== 'GRADED' || !grade) {
        const err = new Error('Results have not been published or graded yet.');
        err.code = 'RESULT_NOT_READY';
        err.status = 409;
        throw err;
    }

    if (exam.result_visibility_mode === 'HIDDEN') {
        const err = new Error('Exam results are hidden by policy.');
        err.code = 'RESULT_HIDDEN';
        err.status = 403;
        throw err;
    }

    if (exam.result_visibility_mode === 'SCORE_ONLY') {
        const err = new Error('Question-level review is not allowed under SCORE_ONLY policy.');
        err.code = 'REVIEW_NOT_ALLOWED';
        err.status = 403;
        throw err;
    }

    const summary = buildStudentResultSummary(exam, submission, grade);
    const items = await buildSubmissionReviewItems(submission.id);

    if (exam.result_visibility_mode === 'SCORE_AND_STATUS') {
        return {
            summary,
            answers: items.map(item => ({
                position: item.position,
                grading_status: item.grading_status
            }))
        };
    }

    return {
        summary,
        answers: items
    };
}

module.exports = {
    VALID_VISIBILITY_MODES,
    getExamResultsList,
    getSubmissionResultDetail,
    getExamStatistics,
    publishExamResults,
    changeResultVisibility,
    listMyResults,
    getMyResultForExam,
    getMyResultReview
};
