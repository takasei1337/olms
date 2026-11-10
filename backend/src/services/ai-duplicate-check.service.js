const defaultSupabase = require('../config/supabase');
const defaultEmbeddingService = require('./ai-embedding.service');
const defaultCandidateService = require('./ai-candidate.service');

const DEFAULT_DUPLICATE_THRESHOLD = 0.80;
const DEFAULT_TIMEOUT_MS = 3000;

let customSupabase = null;
let customEmbeddingService = null;
let customCandidateService = null;

function getSupabase() {
    return customSupabase || defaultSupabase;
}

function getEmbeddingService() {
    return customEmbeddingService || defaultEmbeddingService;
}

function getCandidateService() {
    return customCandidateService || defaultCandidateService;
}

function _setSupabaseClient(mock) {
    customSupabase = mock;
}

function _setEmbeddingService(mock) {
    customEmbeddingService = mock;
}

function _setCandidateService(mock) {
    customCandidateService = mock;
}

function _resetServices() {
    customSupabase = null;
    customEmbeddingService = null;
    customCandidateService = null;
}

/**
 * Kiểm tra trùng lặp ngữ nghĩa cho một câu hỏi theo SRS 5.9.
 *
 * Quy trình:
 * 1. Đọc nội dung phiên bản hiện hành (`is_current = true`) của câu hỏi mục tiêu.
 * 2. Xác định Subject và Question Type, truy xuất các câu hỏi ứng viên hợp lệ qua `ai-candidate.service`.
 * 3. Tạo embedding và tính Cosine Similarity giữa câu hỏi mục tiêu và từng ứng viên.
 * 4. Tìm câu hỏi có điểm tương đồng cao nhất.
 * 5. Trả về kết quả đánh giá (không can thiệp ghi dữ liệu vào database).
 *
 * @param {string} questionId - UUID của câu hỏi cần kiểm tra.
 * @param {object} [options]
 * @param {number} [options.threshold=0.80] - Ngưỡng phát hiện trùng lặp (mặc định 0.80).
 * @param {number} [options.timeoutMs=3000] - Thời gian chờ tối đa (mặc định 3000ms theo SLA).
 * @param {object} [options.client] - Supabase client tùy chọn.
 * @param {object} [options.embeddingService] - Embedding service tùy chọn.
 * @param {object} [options.candidateService] - Candidate service tùy chọn.
 * @returns {Promise<{
 *   similarity_score: number,
 *   compared_question_id: string|null,
 *   is_duplicate: boolean,
 *   model_name: string,
 *   checked_at: string
 * }>}
 */
async function checkDuplicate(questionId, options = {}) {
    if (!questionId || typeof questionId !== 'string') {
        const error = new Error('Valid questionId is required');
        error.code = 'ERR_INVALID_QUESTION_ID';
        throw error;
    }

    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const threshold = options.threshold !== undefined ? options.threshold : DEFAULT_DUPLICATE_THRESHOLD;
    const supabase = options.client || getSupabase();
    const embeddingService = options.embeddingService || getEmbeddingService();
    const candidateService = options.candidateService || getCandidateService();

    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const err = new Error(`AI Duplicate Check overall execution timed out after ${timeoutMs}ms`);
            err.code = 'ERR_DUPLICATE_CHECK_TIMEOUT';
            reject(err);
        }, timeoutMs);
    });

    const executionPromise = (async () => {
        // 1. Đọc nội dung phiên bản hiện hành của câu hỏi
        const { data: question, error: qErr } = await supabase
            .from('questions')
            .select(`
                id,
                lesson_id,
                type_id,
                status,
                deleted_at,
                question_versions!inner (
                    id,
                    version_no,
                    type_id,
                    content,
                    is_current
                )
            `)
            .eq('id', questionId)
            .is('deleted_at', null)
            .eq('question_versions.is_current', true)
            .maybeSingle();

        if (qErr) {
            const err = new Error(`Failed to fetch target question: ${qErr.message}`);
            err.code = 'ERR_TARGET_QUESTION_QUERY_FAILED';
            err.cause = qErr;
            throw err;
        }

        if (!question) {
            const err = new Error(`Question not found or has been deleted: ${questionId}`);
            err.code = 'ERR_QUESTION_NOT_FOUND';
            throw err;
        }

        const version = Array.isArray(question.question_versions)
            ? question.question_versions[0]
            : question.question_versions;

        if (!version || !version.content || typeof version.content !== 'string' || !version.content.trim()) {
            const err = new Error(`Current version of question ${questionId} has invalid or empty content`);
            err.code = 'ERR_INVALID_QUESTION_CONTENT';
            throw err;
        }

        const targetContent = version.content.trim();

        // 2. Truy xuất các câu hỏi ứng viên hợp lệ cùng Subject và Question Type
        const candidates = await candidateService.getCandidateQuestions({
            questionId,
            lessonId: question.lesson_id,
            typeId: question.type_id,
            excludeQuestionId: questionId,
            client: supabase
        });

        // 3. Nếu không có ứng viên, trả kết quả không trùng với score = 0
        if (!candidates || candidates.length === 0) {
            return {
                similarity_score: 0.0,
                raw_score: 0.0,
                compared_question_id: null,
                is_duplicate: false,
                model_name: embeddingService.MODEL_NAME,
                checked_at: new Date().toISOString()
            };
        }

        // 4. Tạo embedding cho câu hỏi mục tiêu
        const targetVector = await embeddingService.embed(targetContent);

        // 5. Tạo embedding cho các ứng viên và tính Cosine Similarity để tìm điểm cao nhất
        let maxScore = -1;
        let bestCandidateId = null;

        for (const candidate of candidates) {
            if (!candidate.content || typeof candidate.content !== 'string' || !candidate.content.trim()) {
                continue;
            }

            const candidateVector = await embeddingService.embed(candidate.content.trim());
            const score = embeddingService.cosineSimilarity(targetVector, candidateVector);

            if (score > maxScore) {
                maxScore = score;
                bestCandidateId = candidate.id;
            }
        }

        if (maxScore < 0) {
            return {
                similarity_score: 0.0,
                raw_score: 0.0,
                compared_question_id: null,
                is_duplicate: false,
                model_name: embeddingService.MODEL_NAME,
                checked_at: new Date().toISOString()
            };
        }

        const rawScore = Math.max(0, Math.min(1, maxScore));
        const finalScore = Number(rawScore.toFixed(4));
        const isDuplicate = rawScore >= threshold;

        return {
            similarity_score: finalScore,
            raw_score: rawScore,
            compared_question_id: bestCandidateId,
            is_duplicate: isDuplicate,
            model_name: embeddingService.MODEL_NAME,
            checked_at: new Date().toISOString()
        };
    })();

    try {
        return await Promise.race([executionPromise, timeoutPromise]);
    } catch (err) {
        if (err.code === 'ERR_EMBEDDING_TIMEOUT') {
            const timeoutError = new Error(`AI Duplicate Check timed out during embedding: ${err.message}`);
            timeoutError.code = 'ERR_DUPLICATE_CHECK_TIMEOUT';
            timeoutError.cause = err;
            throw timeoutError;
        }
        throw err;
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}

module.exports = {
    checkDuplicate,
    DEFAULT_DUPLICATE_THRESHOLD,
    DEFAULT_TIMEOUT_MS,
    _setSupabaseClient,
    _setEmbeddingService,
    _setCandidateService,
    _resetServices
};

