const defaultSupabase = require('../config/supabase');
const defaultDuplicateCheckService = require('./ai-duplicate-check.service');

const DEFAULT_DUPLICATE_THRESHOLD = 0.80;

let customSupabase = null;
let customDuplicateCheckService = null;

function getSupabase() {
    return customSupabase || defaultSupabase;
}

function getDuplicateCheckService() {
    return customDuplicateCheckService || defaultDuplicateCheckService;
}

function _setSupabaseClient(mock) {
    customSupabase = mock;
}

function _setDuplicateCheckService(mock) {
    customDuplicateCheckService = mock;
}

function _resetServices() {
    customSupabase = null;
    customDuplicateCheckService = null;
}

/**
 * Điều phối kiểm tra AI Duplicate Detection và cập nhật an toàn vào bảng `questions` theo SRS 5.9.
 *
 * Các nguyên tắc bảo toàn dữ liệu & nghiệp vụ:
 * 1. Đánh giá ngưỡng 0.80 trên điểm gốc (raw_score) trước khi làm tròn.
 * 2. Lưu `ai_similarity_score` với 4 chữ số thập phân, luôn nằm trong đoạn [0, 1].
 * 3. Thành công: `ai_check_status = 'CHECKED'`. Nếu trùng lặp (>= 0.80), giữ `DRAFT`, gắn cảnh báo và `review_state = 'NEEDS_TEACHER'`.
 * 4. Không tự động chuyển `ACTIVE` trong bất kỳ trường hợp nào (việc xuất bản do giáo viên thực hiện riêng).
 * 5. Nếu timeout (SLA 3s): gán `ai_check_status = 'SKIPPED_TIMEOUT'`, giữ `DRAFT`, ghi nhận nguyên nhân vào `ai_audit_metadata`.
 * 6. Kiểm soát xung đột đồng thời (Optimistic Concurrency Control):
 *    - Không ghi kết quả nếu phiên bản câu hỏi đã thay đổi trong quá trình kiểm tra.
 *    - Không ghi đè nếu câu hỏi đã được Human Override hợp lệ (`is_duplicate_overridden = true` hoặc `ai_check_status = 'OVERRIDDEN'`).
 *
 * @param {string} questionId - UUID của câu hỏi.
 * @param {object} [options]
 * @param {number} [options.threshold=0.80]
 * @param {number} [options.timeoutMs=3000]
 * @param {object} [options.client]
 * @param {object} [options.duplicateCheckService]
 * @returns {Promise<object>} Bản ghi câu hỏi sau khi được cập nhật an toàn.
 */
async function processQuestionAiCheck(questionId, options = {}) {
    if (!questionId || typeof questionId !== 'string') {
        const error = new Error('Valid questionId is required');
        error.code = 'ERR_INVALID_QUESTION_ID';
        throw error;
    }

    const supabase = options.client || getSupabase();
    const duplicateCheckService = options.duplicateCheckService || getDuplicateCheckService();
    const threshold = options.threshold !== undefined ? options.threshold : DEFAULT_DUPLICATE_THRESHOLD;

    // 1. Đọc trạng thái và phiên bản câu hỏi ban đầu trước khi bắt đầu kiểm tra AI
    const { data: initialQuestion, error: initErr } = await supabase
        .from('questions')
        .select(`
            id,
            status,
            ai_check_status,
            is_duplicate_overridden,
            ai_audit_metadata,
            updated_at,
            deleted_at,
            question_versions!inner (
                id,
                version_no,
                is_current
            )
        `)
        .eq('id', questionId)
        .is('deleted_at', null)
        .eq('question_versions.is_current', true)
        .maybeSingle();

    if (initErr) {
        const err = new Error(`Failed to query initial question state: ${initErr.message}`);
        err.code = 'ERR_INITIAL_QUESTION_QUERY_FAILED';
        err.cause = initErr;
        throw err;
    }

    if (!initialQuestion) {
        const err = new Error(`Question not found or has been deleted: ${questionId}`);
        err.code = 'ERR_QUESTION_NOT_FOUND';
        throw err;
    }

    // Bảo vệ Override: Nếu câu hỏi đã được giáo viên ghi đè hợp lệ từ trước, không ghi đè lại
    if (initialQuestion.is_duplicate_overridden === true || initialQuestion.ai_check_status === 'OVERRIDDEN') {
        const err = new Error(`Question ${questionId} has already been overridden. AI check cannot overwrite valid override.`);
        err.code = 'ERR_OVERRIDE_PROTECTED';
        throw err;
    }

    const initialVersion = Array.isArray(initialQuestion.question_versions)
        ? initialQuestion.question_versions[0]
        : initialQuestion.question_versions;

    if (!initialVersion) {
        const err = new Error(`Question ${questionId} has no current version`);
        err.code = 'ERR_CURRENT_VERSION_NOT_FOUND';
        throw err;
    }

    const initialVersionId = initialVersion.id;
    const initialVersionNo = initialVersion.version_no;

    // 2. Thực thi kiểm tra trùng lặp AI
    let checkResult = null;
    let isTimeout = false;
    let timeoutError = null;

    try {
        checkResult = await duplicateCheckService.checkDuplicate(questionId, {
            ...options,
            client: supabase,
            threshold
        });
    } catch (err) {
        if (err.code === 'ERR_DUPLICATE_CHECK_TIMEOUT' || err.code === 'ERR_EMBEDDING_TIMEOUT') {
            isTimeout = true;
            timeoutError = err;
        } else {
            // Lỗi nghiệp vụ khác (lỗi DB, model crash, etc.) phải re-throw, không coi là timeout hay thành công
            throw err;
        }
    }

    // 3. Chuẩn bị payload cập nhật dựa trên kết quả kiểm tra
    let updatePayload = null;

    if (isTimeout) {
        // Trường hợp Timeout: gán SKIPPED_TIMEOUT, không có điểm số, giữ DRAFT
        updatePayload = {
            ai_check_status: 'SKIPPED_TIMEOUT',
            ai_similarity_score: null,
            ai_audit_metadata: {
                error: timeoutError.message,
                error_code: timeoutError.code,
                timed_out_at: new Date().toISOString(),
                version_no: initialVersionNo,
                version_id: initialVersionId,
                retry_needed: true
            },
            updated_at: new Date().toISOString()
        };
    } else {
        // Trường hợp Thành công: Đánh giá trên raw_score trước khi làm tròn
        const rawScore = typeof checkResult.raw_score === 'number'
            ? checkResult.raw_score
            : checkResult.similarity_score;

        // Đảm bảo điểm số hợp lệ trong khoảng [0, 1] theo ràng buộc CSDL chk_questions_ai_similarity_score
        const clampedScore = Math.max(0, Math.min(1, rawScore));
        const formattedScore = Number(clampedScore.toFixed(4));
        const isDuplicate = rawScore >= threshold;

        const auditMetadata = {
            model_name: checkResult.model_name,
            similarity_score: formattedScore,
            raw_score: rawScore,
            compared_question_id: checkResult.compared_question_id,
            checked_at: checkResult.checked_at || new Date().toISOString(),
            is_duplicate: isDuplicate,
            threshold: threshold,
            version_no: initialVersionNo,
            version_id: initialVersionId
        };

        if (isDuplicate) {
            auditMetadata.warning = 'POTENTIAL_DUPLICATE';
            auditMetadata.review_state = 'NEEDS_TEACHER';
        }

        updatePayload = {
            ai_check_status: 'CHECKED',
            ai_similarity_score: formattedScore,
            ai_audit_metadata: auditMetadata,
            updated_at: new Date().toISOString()
        };
    }

    // 4. Kiểm tra an toàn trước khi ghi (Concurrency & Override Guard)
    const { data: latestQuestion, error: latestErr } = await supabase
        .from('questions')
        .select(`
            id,
            status,
            ai_check_status,
            is_duplicate_overridden,
            deleted_at,
            question_versions!inner (
                id,
                version_no,
                is_current
            )
        `)
        .eq('id', questionId)
        .is('deleted_at', null)
        .eq('question_versions.is_current', true)
        .maybeSingle();

    if (latestErr) {
        const err = new Error(`Failed to verify question state before updating: ${latestErr.message}`);
        err.code = 'ERR_CONCURRENCY_CHECK_FAILED';
        err.cause = latestErr;
        throw err;
    }

    if (!latestQuestion) {
        const err = new Error(`Question ${questionId} was deleted or not found before saving AI check result`);
        err.code = 'ERR_QUESTION_NOT_FOUND';
        throw err;
    }

    // Guard 1: Đảm bảo không ghi đè kết quả override hợp lệ nếu vừa được cập nhật trong lúc chờ AI
    if (latestQuestion.is_duplicate_overridden === true || latestQuestion.ai_check_status === 'OVERRIDDEN') {
        const err = new Error(`Question ${questionId} has been overridden during check. AI check result cannot overwrite valid override.`);
        err.code = 'ERR_OVERRIDE_PROTECTED';
        throw err;
    }

    // Guard 2: Đảm bảo phiên bản câu hỏi không bị thay đổi trong lúc AI đang kiểm tra
    const latestVersion = Array.isArray(latestQuestion.question_versions)
        ? latestQuestion.question_versions[0]
        : latestQuestion.question_versions;

    if (!latestVersion || latestVersion.id !== initialVersionId || latestVersion.version_no !== initialVersionNo) {
        const err = new Error(`Question version changed during AI check (evaluated v${initialVersionNo}, current is v${latestVersion?.version_no}). AI check result discarded.`);
        err.code = 'ERR_VERSION_MISMATCH_DISCARDED';
        throw err;
    }

    // 5. Thực hiện ghi kết quả an toàn vào database với điều kiện bảo vệ nguyên tử (Atomic Conditional Update)
    let updateQuery = supabase
        .from('questions')
        .update(updatePayload)
        .eq('id', questionId)
        .eq('is_duplicate_overridden', false)
        .neq('ai_check_status', 'OVERRIDDEN');

    if (initialQuestion.updated_at) {
        updateQuery = updateQuery.eq('updated_at', initialQuestion.updated_at);
    }

    const { data: updatedQuestion, error: updateErr } = await updateQuery
        .select()
        .maybeSingle();

    if (updateErr) {
        const err = new Error(`Failed to update AI check result into questions table: ${updateErr.message}`);
        err.code = 'ERR_UPDATE_QUESTION_FAILED';
        err.cause = updateErr;
        throw err;
    }

    if (!updatedQuestion) {
        // Race condition: Truy vấn lại để xác định chính xác nguyên nhân điều kiện không khớp
        const { data: currentQ } = await supabase
            .from('questions')
            .select(`
                id,
                ai_check_status,
                is_duplicate_overridden,
                updated_at,
                question_versions!inner (
                    id,
                    version_no,
                    is_current
                )
            `)
            .eq('id', questionId)
            .is('deleted_at', null)
            .eq('question_versions.is_current', true)
            .maybeSingle();

        if (currentQ) {
            if (currentQ.is_duplicate_overridden === true || currentQ.ai_check_status === 'OVERRIDDEN') {
                const err = new Error(`Question ${questionId} has been overridden concurrently. AI check result cannot overwrite valid override.`);
                err.code = 'ERR_OVERRIDE_PROTECTED';
                throw err;
            }

            const curVersion = Array.isArray(currentQ.question_versions)
                ? currentQ.question_versions[0]
                : currentQ.question_versions;

            if (curVersion && (curVersion.id !== initialVersionId || curVersion.version_no !== initialVersionNo || currentQ.updated_at !== initialQuestion.updated_at)) {
                const err = new Error(`Question version changed concurrently during AI check (evaluated v${initialVersionNo}, current is v${curVersion?.version_no}). AI check result discarded.`);
                err.code = 'ERR_VERSION_MISMATCH_DISCARDED';
                throw err;
            }
        }

        const err = new Error(`Conditional update failed: question was modified or deleted concurrently.`);
        err.code = 'ERR_CONCURRENCY_UPDATE_FAILED';
        throw err;
    }

    return updatedQuestion;
}

module.exports = {
    processQuestionAiCheck,
    runAiDuplicateCheck: processQuestionAiCheck,
    DEFAULT_DUPLICATE_THRESHOLD,
    _setSupabaseClient,
    _setDuplicateCheckService,
    _resetServices
};

