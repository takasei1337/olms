const defaultSupabase = require('../config/supabase');

let customClient = null;

/**
 * Trả về Supabase client được cấu hình (hỗ trợ injection client khi test).
 */
function getClient() {
    return customClient || defaultSupabase;
}

/**
 * Thiết lập mock client cho kiểm thử.
 */
function _setSupabaseClient(mock) {
    customClient = mock;
}

/**
 * Khôi phục client mặc định.
 */
function _resetSupabaseClient() {
    customClient = null;
}

/**
 * Xác định Subject ID từ Lesson ID thông qua quan hệ Lessons -> Chapters -> Subjects.
 * Đồng thời kiểm tra điều kiện chưa bị soft-delete (deleted_at IS NULL).
 *
 * @param {string} lessonId - UUID của lesson.
 * @param {object} [options]
 * @param {object} [options.client] - Supabase client tùy chọn.
 * @returns {Promise<string>} subject_id (UUID).
 */
async function getSubjectIdByLessonId(lessonId, options = {}) {
    if (!lessonId || typeof lessonId !== 'string') {
        const error = new Error('Valid lessonId is required');
        error.code = 'ERR_INVALID_LESSON_ID';
        throw error;
    }

    const supabase = options.client || getClient();

    // 1. Lấy lesson và kiểm tra soft-delete
    const { data: lesson, error: lErr } = await supabase
        .from('lessons')
        .select('id, chapter_id, deleted_at')
        .eq('id', lessonId)
        .is('deleted_at', null)
        .maybeSingle();

    if (lErr) throw lErr;
    if (!lesson) {
        const error = new Error(`Lesson not found or has been deleted: ${lessonId}`);
        error.code = 'ERR_LESSON_NOT_FOUND';
        throw error;
    }

    if (!lesson.chapter_id) {
        const error = new Error(`Lesson ${lessonId} does not belong to any chapter`);
        error.code = 'ERR_LESSON_NO_CHAPTER';
        throw error;
    }

    // 2. Lấy chapter và kiểm tra soft-delete
    const { data: chapter, error: cErr } = await supabase
        .from('chapters')
        .select('id, subject_id, deleted_at')
        .eq('id', lesson.chapter_id)
        .is('deleted_at', null)
        .maybeSingle();

    if (cErr) throw cErr;
    if (!chapter) {
        const error = new Error(`Chapter not found or has been deleted: ${lesson.chapter_id}`);
        error.code = 'ERR_CHAPTER_NOT_FOUND';
        throw error;
    }

    // 3. Kiểm tra subject tồn tại và chưa bị soft-delete
    const { data: subject, error: sErr } = await supabase
        .from('subjects')
        .select('id, deleted_at')
        .eq('id', chapter.subject_id)
        .is('deleted_at', null)
        .maybeSingle();

    if (sErr) throw sErr;
    if (!subject) {
        const error = new Error(`Subject not found or has been deleted: ${chapter.subject_id}`);
        error.code = 'ERR_SUBJECT_NOT_FOUND';
        throw error;
    }

    return subject.id;
}

/**
 * Lấy thông tin cơ bản của một câu hỏi và xác định Subject ID của câu hỏi đó.
 *
 * @param {string} questionId - UUID của câu hỏi.
 * @param {object} [options]
 * @returns {Promise<{ question: object, subjectId: string }>}
 */
async function getSubjectIdByQuestionId(questionId, options = {}) {
    if (!questionId || typeof questionId !== 'string') {
        const error = new Error('Valid questionId is required');
        error.code = 'ERR_INVALID_QUESTION_ID';
        throw error;
    }

    const supabase = options.client || getClient();

    const { data: question, error: qErr } = await supabase
        .from('questions')
        .select('id, lesson_id, type_id, status, deleted_at')
        .eq('id', questionId)
        .is('deleted_at', null)
        .maybeSingle();

    if (qErr) throw qErr;
    if (!question) {
        const error = new Error(`Question not found or has been deleted: ${questionId}`);
        error.code = 'ERR_QUESTION_NOT_FOUND';
        throw error;
    }

    if (!question.lesson_id) {
        const error = new Error(`Question ${questionId} is not assigned to any lesson, cannot infer subject`);
        error.code = 'ERR_QUESTION_NO_LESSON';
        throw error;
    }

    const subjectId = await getSubjectIdByLessonId(question.lesson_id, options);
    return { question, subjectId };
}

/**
 * Lấy tất cả câu hỏi ứng viên hiện có cùng Subject và cùng Question Type để phục vụ AI Duplicate Check.
 *
 * Tiêu chí truy xuất:
 * - Cùng Subject (thông qua Lessons -> Chapters -> Subjects).
 * - Cùng Question Type (`type_id`).
 * - Chưa bị xóa (`questions.deleted_at IS NULL`, `lessons.deleted_at IS NULL`, `chapters.deleted_at IS NULL`).
 * - Loại trừ chính câu hỏi đang kiểm tra (`excludeQuestionId`).
 * - Chỉ lấy phiên bản hiện hành (`question_versions.is_current = true`).
 * - Duyệt phân trang toàn bộ (pagination loop) để đảm bảo không bỏ sót câu hỏi.
 *
 * @param {object} params
 * @param {string} [params.questionId] - UUID của câu hỏi đang kiểm tra (nếu có).
 * @param {string} [params.lessonId] - UUID của lesson (nếu là câu hỏi mới chưa lưu).
 * @param {string} [params.subjectId] - UUID của subject (nếu đã biết sẵn).
 * @param {string} [params.typeId] - UUID của question type.
 * @param {string} [params.excludeQuestionId] - UUID câu hỏi cần loại trừ (mặc định bằng questionId).
 * @param {number} [params.pageSize=100] - Kích thước trang khi duyệt vòng lặp.
 * @param {object} [params.client] - Supabase client tùy chọn.
 * @returns {Promise<Array<object>>} Danh sách câu hỏi ứng viên kèm thông tin phiên bản hiện hành.
 */
async function getCandidateQuestions({
    questionId = null,
    lessonId = null,
    subjectId = null,
    typeId = null,
    excludeQuestionId = null,
    pageSize = 100,
    client = null
} = {}) {
    const supabase = client || getClient();

    let resolvedSubjectId = subjectId;
    let resolvedTypeId = typeId;
    let resolvedExcludeId = excludeQuestionId;

    // 1. Xác định ngữ cảnh từ questionId nếu có
    if (questionId) {
        if (!resolvedExcludeId) {
            resolvedExcludeId = questionId;
        }

        if (!resolvedSubjectId || !resolvedTypeId) {
            const { question, subjectId: inferredSubjectId } = await getSubjectIdByQuestionId(questionId, { client: supabase });
            if (!resolvedTypeId) {
                resolvedTypeId = question.type_id;
            }
            if (!resolvedSubjectId) {
                resolvedSubjectId = inferredSubjectId;
            }
        }
    } else if (!resolvedSubjectId) {
        if (!lessonId) {
            const error = new Error('Subject context could not be determined: provide questionId, lessonId, or subjectId');
            error.code = 'ERR_MISSING_SUBJECT_CONTEXT';
            throw error;
        }
        resolvedSubjectId = await getSubjectIdByLessonId(lessonId, { client: supabase });
    }

    if (!resolvedTypeId) {
        const error = new Error('typeId is required to query candidate questions of matching type');
        error.code = 'ERR_MISSING_TYPE_CONTEXT';
        throw error;
    }

    // 2. Lấy danh sách các chapters chưa bị soft-delete của subject
    const { data: chapters, error: cErr } = await supabase
        .from('chapters')
        .select('id')
        .eq('subject_id', resolvedSubjectId)
        .is('deleted_at', null);

    if (cErr) throw cErr;
    if (!chapters || chapters.length === 0) {
        return [];
    }
    const chapterIds = chapters.map(c => c.id);

    // 3. Lấy danh sách các lessons chưa bị soft-delete của các chapters trên
    const { data: lessons, error: lErr } = await supabase
        .from('lessons')
        .select('id')
        .in('chapter_id', chapterIds)
        .is('deleted_at', null);

    if (lErr) throw lErr;
    if (!lessons || lessons.length === 0) {
        return [];
    }
    const lessonIds = lessons.map(l => l.id);

    // 4. Duyệt toàn bộ câu hỏi (Pagination loop để không bỏ sót bản ghi)
    let from = 0;
    let hasMore = true;
    const candidates = [];
    const limitPerPage = Math.max(1, pageSize);

    while (hasMore) {
        const to = from + limitPerPage - 1;

        let query = supabase
            .from('questions')
            .select(`
                id,
                lesson_id,
                type_id,
                status,
                ai_check_status,
                ai_similarity_score,
                created_at,
                updated_at,
                question_versions!inner (
                    id,
                    version_no,
                    type_id,
                    difficulty_level,
                    content,
                    media_url,
                    explanation,
                    options_snapshot,
                    is_current
                )
            `, { count: 'exact' })
            .is('deleted_at', null)
            .in('lesson_id', lessonIds)
            .eq('type_id', resolvedTypeId)
            .eq('question_versions.is_current', true)
            .order('id', { ascending: true })
            .range(from, to);

        if (resolvedExcludeId) {
            query = query.neq('id', resolvedExcludeId);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            break;
        }

        for (const row of data) {
            const version = Array.isArray(row.question_versions)
                ? row.question_versions[0]
                : row.question_versions;

            candidates.push({
                id: row.id,
                lesson_id: row.lesson_id,
                type_id: row.type_id,
                status: row.status,
                ai_check_status: row.ai_check_status,
                ai_similarity_score: row.ai_similarity_score !== null && row.ai_similarity_score !== undefined
                    ? Number(row.ai_similarity_score)
                    : null,
                version_id: version ? version.id : null,
                version_no: version ? version.version_no : 1,
                difficulty_level: version ? version.difficulty_level : null,
                content: version ? version.content : '',
                media_url: version ? version.media_url ?? null : null,
                explanation: version ? version.explanation ?? null : null,
                options_snapshot: version ? version.options_snapshot : null
            });
        }

        if (data.length < limitPerPage || (count !== null && candidates.length >= count)) {
            hasMore = false;
        } else {
            from += limitPerPage;
        }
    }

    return candidates;
}

module.exports = {
    getSubjectIdByLessonId,
    getSubjectIdByQuestionId,
    getCandidateQuestions,
    _setSupabaseClient,
    _resetSupabaseClient
};

