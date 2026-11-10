require('dotenv').config({ quiet: true });

const test = require('node:test');
const assert = require('node:assert/strict');

const aiEmbeddingService = require('./src/services/ai-embedding.service');
const {
    embed,
    cosineSimilarity,
    initModel,
    _setExtractor,
    _resetModel,
    MODEL_NAME,
    EMBEDDING_DIM
} = aiEmbeddingService;

test('AI Embedding Service - Cosine Similarity Unit Tests', async (t) => {
    await t.test('Trường hợp 2 vector đồng nhất phải có độ tương đồng bằng 1.0', () => {
        const v1 = [0.2, 0.5, 0.8, -0.1];
        const v2 = [0.2, 0.5, 0.8, -0.1];
        const sim = cosineSimilarity(v1, v2);
        assert.ok(Math.abs(sim - 1.0) < 1e-6, `Expected ~1.0, got ${sim}`);
    });

    await t.test('Trường hợp 2 vector trực giao (orthogonal) phải có độ tương đồng bằng 0.0', () => {
        const v1 = [1, 0, 0];
        const v2 = [0, 1, 0];
        const sim = cosineSimilarity(v1, v2);
        assert.strictEqual(sim, 0);
    });

    await t.test('Trường hợp 2 vector đối nghịch hướng phải có độ tương đồng bằng -1.0', () => {
        const v1 = [1, 2, 3];
        const v2 = [-1, -2, -3];
        const sim = cosineSimilarity(v1, v2);
        assert.ok(Math.abs(sim - (-1.0)) < 1e-6, `Expected -1.0, got ${sim}`);
    });

    await t.test('Vector có độ dài khác nhau phải ném lỗi ERR_VECTOR_DIMENSION_MISMATCH', () => {
        const v1 = [1, 2, 3];
        const v2 = [1, 2];
        assert.throws(() => {
            cosineSimilarity(v1, v2);
        }, (err) => {
            return err.code === 'ERR_VECTOR_DIMENSION_MISMATCH';
        });
    });

    await t.test('Vector rỗng hoặc không hợp lệ phải ném lỗi ERR_INVALID_VECTOR_INPUT', () => {
        assert.throws(() => {
            cosineSimilarity([], [1, 2]);
        }, (err) => err.code === 'ERR_INVALID_VECTOR_INPUT');

        assert.throws(() => {
            cosineSimilarity(null, [1, 2]);
        }, (err) => err.code === 'ERR_INVALID_VECTOR_INPUT');

        assert.throws(() => {
            cosineSimilarity([1, 2], undefined);
        }, (err) => err.code === 'ERR_INVALID_VECTOR_INPUT');
    });

    await t.test('Vector toàn số 0 (norm = 0) phải trả về 0.0 thay vì NaN', () => {
        const v1 = [0, 0, 0];
        const v2 = [1, 2, 3];
        const sim = cosineSimilarity(v1, v2);
        assert.strictEqual(sim, 0);
    });
});

test('AI Embedding Service - Input Validation Tests', async (t) => {
    await t.test('Truyền chuỗi rỗng phải ném lỗi ERR_INVALID_TEXT_INPUT', async () => {
        await assert.rejects(async () => {
            await embed('');
        }, (err) => {
            return err.code === 'ERR_INVALID_TEXT_INPUT';
        });
    });

    await t.test('Truyền chuỗi chỉ chứa khoảng trắng phải ném lỗi ERR_INVALID_TEXT_INPUT', async () => {
        await assert.rejects(async () => {
            await embed('   \n\t  ');
        }, (err) => {
            return err.code === 'ERR_INVALID_TEXT_INPUT';
        });
    });

    await t.test('Truyền null / undefined / kiểu dữ liệu khác string phải ném lỗi', async () => {
        await assert.rejects(async () => {
            await embed(null);
        }, (err) => err.code === 'ERR_INVALID_TEXT_INPUT');

        await assert.rejects(async () => {
            await embed(undefined);
        }, (err) => err.code === 'ERR_INVALID_TEXT_INPUT');

        await assert.rejects(async () => {
            await embed(12345);
        }, (err) => err.code === 'ERR_INVALID_TEXT_INPUT');
    });
});

test('AI Embedding Service - Model Execution & Vietnamese Semantics', async (t) => {
    // Đảm bảo không dùng mock cho phần kiểm tra thực tế
    _resetModel();

    await t.test('Khởi tạo model thành công và trả về đúng extractor', async () => {
        const extractor = await initModel();
        assert.strictEqual(typeof extractor, 'function');
    });

    await t.test('Tạo vector embedding cho câu tiếng Việt: kích thước 384, số thực hợp lệ', async () => {
        const text = 'Thủ đô của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam là thành phố nào?';
        const vector = await embed(text);

        assert.ok(Array.isArray(vector), 'Vector phải là một mảng JavaScript');
        assert.strictEqual(vector.length, EMBEDDING_DIM, `Kích thước vector phải bằng ${EMBEDDING_DIM}`);
        assert.strictEqual(vector.length, 384);

        // Kiểm tra tất cả phần tử là số thực hữu hạn (không NaN, không Infinity)
        for (let i = 0; i < vector.length; i++) {
            assert.strictEqual(typeof vector[i], 'number');
            assert.ok(!Number.isNaN(vector[i]), `Phần tử tại vị trí ${i} không được là NaN`);
            assert.ok(Number.isFinite(vector[i]), `Phần tử tại vị trí ${i} phải là số hữu hạn`);
        }

        // Kiểm tra độ dài chuẩn L2 norm xấp xỉ 1.0 (do normalize: true)
        const l2Norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        assert.ok(Math.abs(l2Norm - 1.0) < 0.01, `L2 norm phải xấp xỉ 1.0, thực tế: ${l2Norm}`);
    });

    await t.test('Đo độ tương đồng ngữ nghĩa tiếng Việt: 2 câu tương đương có similarity >= 0.80', async () => {
        const text1 = 'Thủ đô của Việt Nam là Hà Nội.';
        const text2 = 'Hà Nội là thủ đô của nước CHXHCN Việt Nam.';

        const vec1 = await embed(text1);
        const vec2 = await embed(text2);

        const score = cosineSimilarity(vec1, vec2);
        assert.ok(score >= 0.80, `Hai câu cùng ngữ nghĩa phải có similarity >= 0.80, thực tế: ${score.toFixed(4)}`);
    });

    await t.test('Đo độ tương đồng ngữ nghĩa tiếng Việt: 2 câu khác chủ đề có similarity < 0.30', async () => {
        const text1 = 'Thủ đô của Việt Nam là Hà Nội.';
        const text2 = 'Định lý Pytago trong tam giác vuông phát biểu bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông.';

        const vec1 = await embed(text1);
        const vec2 = await embed(text2);

        const score = cosineSimilarity(vec1, vec2);
        assert.ok(score < 0.30, `Hai câu khác chủ đề phải có similarity < 0.30, thực tế: ${score.toFixed(4)}`);
    });
});

test('AI Embedding Service - Error Handling & Timeout Tests', async (t) => {
    t.afterEach(() => {
        _resetModel();
    });

    await t.test('Quá thời gian timeout phải ném lỗi ERR_EMBEDDING_TIMEOUT', async () => {
        // Giả lập extractor phản hồi chậm hơn timeoutMs
        _setExtractor(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return { data: new Float32Array(384) };
        });

        await assert.rejects(async () => {
            await embed('Kiểm tra timeout', { timeoutMs: 20 });
        }, (err) => {
            return err.code === 'ERR_EMBEDDING_TIMEOUT' && err.message.includes('timed out');
        });
    });

    await t.test('Model trả về output dị dạng/thiếu data phải ném ERR_INVALID_MODEL_OUTPUT', async () => {
        _setExtractor(async () => {
            return { invalidKey: 123 };
        });

        await assert.rejects(async () => {
            await embed('Kiểm tra output dị dạng');
        }, (err) => {
            return err.code === 'ERR_INVALID_MODEL_OUTPUT';
        });
    });

    await t.test('Model phát sinh exception nội bộ phải bọc thành ERR_EMBEDDING_FAILED', async () => {
        _setExtractor(async () => {
            throw new Error('ONNX runtime native crash simulation');
        });

        await assert.rejects(async () => {
            await embed('Kiểm tra lỗi model');
        }, (err) => {
            return err.code === 'ERR_EMBEDDING_FAILED' && err.message.includes('ONNX runtime native crash');
        });
    });
});

