const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const EMBEDDING_DIM = 384;
const DEFAULT_TIMEOUT_MS = 3000;

let pipelinePromise = null;
let customExtractor = null;

/**
 * Khởi tạo hoặc lấy instance model extractor duy nhất (Singleton).
 * Model được tải từ ONNX Runtime cục bộ, tái sử dụng giữa các request.
 *
 * @returns {Promise<Function>} pipeline extractor instance
 */
async function getExtractor() {
    if (customExtractor) {
        return customExtractor;
    }

    if (!pipelinePromise) {
        pipelinePromise = (async () => {
            const { pipeline, env } = await import('@xenova/transformers');
            // Cấu hình môi trường local cho Xenova transformers
            env.allowRemoteModels = true;
            env.allowLocalModels = true;

            const extractor = await pipeline('feature-extraction', MODEL_NAME, {
                quantized: true
            });
            return extractor;
        })().catch((err) => {
            // Reset promise để lần gọi sau có thể thử lại nếu khởi tạo thất bại
            pipelinePromise = null;
            const error = new Error(`Failed to initialize embedding model (${MODEL_NAME}): ${err.message}`);
            error.code = 'ERR_MODEL_INIT_FAILED';
            error.cause = err;
            throw error;
        });
    }

    return pipelinePromise;
}

/**
 * Chủ động khởi tạo và làm ấm model (pre-warm) trước khi phục vụ request.
 */
async function initModel() {
    return getExtractor();
}

/**
 * Tạo vector embedding từ văn bản đầu vào.
 *
 * @param {string} text - Văn bản cần trích xuất vector embedding.
 * @param {object} [options] - Cấu hình tùy chọn.
 * @param {number} [options.timeoutMs=3000] - Thời gian chờ tối đa (ms).
 * @returns {Promise<number[]>} Mảng vector số thực có độ dài 384.
 */
async function embed(text, options = {}) {
    if (typeof text !== 'string' || text.trim().length === 0) {
        const error = new Error('Text for embedding cannot be empty or non-string');
        error.code = 'ERR_INVALID_TEXT_INPUT';
        throw error;
    }

    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const cleanedText = text.trim();

    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const error = new Error(`Embedding generation timed out after ${timeoutMs}ms`);
            error.code = 'ERR_EMBEDDING_TIMEOUT';
            reject(error);
        }, timeoutMs);
    });

    try {
        const runEmbedding = async () => {
            const extractor = await getExtractor();
            const output = await extractor(cleanedText, {
                pooling: 'mean',
                normalize: true
            });

            if (!output || !output.data) {
                const error = new Error('Model produced empty or invalid output');
                error.code = 'ERR_INVALID_MODEL_OUTPUT';
                throw error;
            }

            // Chuyển Float32Array sang mảng JavaScript chuẩn
            return Array.from(output.data);
        };

        const vector = await Promise.race([runEmbedding(), timeoutPromise]);
        return vector;
    } catch (err) {
        if (err.code === 'ERR_EMBEDDING_TIMEOUT' || err.code === 'ERR_INVALID_TEXT_INPUT') {
            throw err;
        }

        const wrappedError = new Error(`Failed to generate embedding: ${err.message}`);
        wrappedError.code = err.code || 'ERR_EMBEDDING_FAILED';
        wrappedError.cause = err;
        throw wrappedError;
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}

/**
 * Tính Cosine Similarity giữa 2 vector số học.
 * Công thức: (A . B) / (||A|| * ||B||)
 *
 * @param {number[]|Float32Array} vectorA
 * @param {number[]|Float32Array} vectorB
 * @returns {number} Điểm tương đồng trong đoạn [-1.0, 1.0] (thường [0.0, 1.0] cho text).
 */
function cosineSimilarity(vectorA, vectorB) {
    if (!vectorA || !vectorB) {
        const error = new Error('Both vectorA and vectorB are required');
        error.code = 'ERR_INVALID_VECTOR_INPUT';
        throw error;
    }

    const lenA = vectorA.length;
    const lenB = vectorB.length;

    if (typeof lenA !== 'number' || typeof lenB !== 'number' || lenA === 0 || lenB === 0) {
        const error = new Error('Vectors must be non-empty arrays');
        error.code = 'ERR_INVALID_VECTOR_INPUT';
        throw error;
    }

    if (lenA !== lenB) {
        const error = new Error(`Vector dimension mismatch: vectorA has ${lenA}, vectorB has ${lenB}`);
        error.code = 'ERR_VECTOR_DIMENSION_MISMATCH';
        throw error;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < lenA; i++) {
        const a = vectorA[i];
        const b = vectorB[i];
        dotProduct += a * b;
        normA += a * a;
        normB += b * b;
    }

    if (normA === 0 || normB === 0) {
        return 0;
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

    // Giới hạn giá trị trong khoảng [-1.0, 1.0] để tránh sai số số thực dấu phẩy động
    return Math.max(-1, Math.min(1, similarity));
}

/**
 * Hỗ trợ testing: thiết lập extractor giả lập.
 */
function _setExtractor(mock) {
    customExtractor = mock;
}

/**
 * Hỗ trợ testing: reset trạng thái singleton của extractor.
 */
function _resetModel() {
    pipelinePromise = null;
    customExtractor = null;
}

module.exports = {
    embed,
    cosineSimilarity,
    initModel,
    getExtractor,
    _setExtractor,
    _resetModel,
    MODEL_NAME,
    EMBEDDING_DIM,
    DEFAULT_TIMEOUT_MS
};

