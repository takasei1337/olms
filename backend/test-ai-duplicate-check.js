require('dotenv').config({ quiet: true });

const test = require('node:test');
const assert = require('node:assert/strict');

const aiDuplicateCheckService = require('./src/services/ai-duplicate-check.service');
const {
    checkDuplicate,
    DEFAULT_DUPLICATE_THRESHOLD,
    _setSupabaseClient,
    _setEmbeddingService,
    _setCandidateService,
    _resetServices
} = aiDuplicateCheckService;

const TARGET_Q_ID = 'aaaaaaaa-1111-1111-1111-111111111111';
const LESSON_ID   = 'bbbbbbbb-2222-2222-2222-222222222222';
const TYPE_ID     = 'cccccccc-3333-3333-3333-333333333333';

function createMockSupabaseForTarget({
    question = {
        id: TARGET_Q_ID,
        lesson_id: LESSON_ID,
        type_id: TYPE_ID,
        status: 'DRAFT',
        deleted_at: null,
        question_versions: [{
            id: 'qv-target-1',
            version_no: 1,
            type_id: TYPE_ID,
            content: 'Nội dung câu hỏi mục tiêu kiểm tra trùng lặp',
            is_current: true
        }]
    },
    error = null
} = {}) {
    return {
        from(table) {
            return {
                select() {
                    return {
                        eq() {
                            return {
                                is() {
                                    return {
                                        eq() {
                                            return {
                                                async maybeSingle() {
                                                    return { data: question, error };
                                                }
                                            };
                                        }
                                    };
                                }
                            };
                        }
                    };
                }
            };
        }
    };
}

test('AI Duplicate Check Service - Unit Tests (SRS 5.9)', async (t) => {
    t.afterEach(() => {
        _resetServices();
    });

    await t.test('1. Không có ứng viên: Trả về kết quả không trùng lặp, score = 0.0, compared_id = null', async () => {
        _setSupabaseClient(createMockSupabaseForTarget());
        _setCandidateService({
            async getCandidateQuestions() {
                return [];
            }
        });
        _setEmbeddingService({
            MODEL_NAME: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
            async embed() {
                throw new Error('Should not call embed when candidate list is empty');
            }
        });

        const result = await checkDuplicate(TARGET_Q_ID);

        assert.strictEqual(result.similarity_score, 0.0);
        assert.strictEqual(result.compared_question_id, null);
        assert.strictEqual(result.is_duplicate, false);
        assert.strictEqual(result.model_name, 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
        assert.ok(result.checked_at, 'Phải có checked_at timestamp');
        assert.ok(!Number.isNaN(Date.parse(result.checked_at)), 'checked_at phải là ISO string hợp lệ');
    });

    await t.test('2. Score dưới 0.80 (0.75): is_duplicate = false', async () => {
        _setSupabaseClient(createMockSupabaseForTarget());
        _setCandidateService({
            async getCandidateQuestions() {
                return [
                    { id: 'cand-1', content: 'Ứng viên nội dung khác biệt vừa phải' }
                ];
            }
        });
        _setEmbeddingService({
            MODEL_NAME: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
            async embed(text) {
                return [0.1, 0.2, 0.3];
            },
            cosineSimilarity() {
                return 0.7500;
            }
        });

        const result = await checkDuplicate(TARGET_Q_ID);

        assert.strictEqual(result.similarity_score, 0.75);
        assert.strictEqual(result.compared_question_id, 'cand-1');
        assert.strictEqual(result.is_duplicate, false, 'Score 0.75 < 0.80 phải có is_duplicate = false');
    });

    await t.test('3. Score bằng chính xác 0.80: is_duplicate = true (Ngưỡng mặc định >= 0.80)', async () => {
        _setSupabaseClient(createMockSupabaseForTarget());
        _setCandidateService({
            async getCandidateQuestions() {
                return [
                    { id: 'cand-exact-80', content: 'Ứng viên chạm đúng ngưỡng 0.80' }
                ];
            }
        });
        _setEmbeddingService({
            MODEL_NAME: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
            async embed() {
                return [0.5, 0.5];
            },
            cosineSimilarity() {
                return 0.8000;
            }
        });

        const result = await checkDuplicate(TARGET_Q_ID);

        assert.strictEqual(result.similarity_score, 0.8);
        assert.strictEqual(result.compared_question_id, 'cand-exact-80');
        assert.strictEqual(result.is_duplicate, true, 'Score 0.80 == 0.80 phải có is_duplicate = true');
    });

    await t.test('4. Score trên 0.80 (0.925): is_duplicate = true (Cảnh báo trùng)', async () => {
        _setSupabaseClient(createMockSupabaseForTarget());
        _setCandidateService({
            async getCandidateQuestions() {
                return [
                    { id: 'cand-high-dup', content: 'Ứng viên gần như trùng hoàn toàn' }
                ];
            }
        });
        _setEmbeddingService({
            MODEL_NAME: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
            async embed() {
                return [0.8, 0.9];
            },
            cosineSimilarity() {
                return 0.9250;
            }
        });

        const result = await checkDuplicate(TARGET_Q_ID);

        assert.strictEqual(result.similarity_score, 0.925);
        assert.strictEqual(result.compared_question_id, 'cand-high-dup');
        assert.strictEqual(result.is_duplicate, true);
    });

    await t.test('5. Nhiều ứng viên: Phải chọn ứng viên có similarity_score cao nhất', async () => {
        _setSupabaseClient(createMockSupabaseForTarget());
        _setCandidateService({
            async getCandidateQuestions() {
                return [
                    { id: 'cand-low', content: 'Nội dung ứng viên 1' },
                    { id: 'cand-highest', content: 'Nội dung ứng viên 2 trùng nhất' },
                    { id: 'cand-mid', content: 'Nội dung ứng viên 3' }
                ];
            }
        });

        const scoreMap = {
            'Nội dung ứng viên 1': 0.4500,
            'Nội dung ứng viên 2 trùng nhất': 0.8845,
            'Nội dung ứng viên 3': 0.7920
        };

        _setEmbeddingService({
            MODEL_NAME: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
            async embed(text) {
                return [text.length];
            },
            cosineSimilarity(targetVec, candVec) {
                for (const [content, sc] of Object.entries(scoreMap)) {
                    if (candVec[0] === content.length) return sc;
                }
                return 0;
            }
        });

        const result = await checkDuplicate(TARGET_Q_ID);

        assert.strictEqual(result.similarity_score, 0.8845);
        assert.strictEqual(result.compared_question_id, 'cand-highest');
        assert.strictEqual(result.is_duplicate, true);
    });

    await t.test('6. Xử lý Timeout: Thao tác vượt quá timeoutMs ném lỗi ERR_DUPLICATE_CHECK_TIMEOUT', async () => {
        _setSupabaseClient(createMockSupabaseForTarget());
        _setCandidateService({
            async getCandidateQuestions() {
                // Giả lập truy vấn hoặc xử lý trễ hơn timeout
                await new Promise((resolve) => setTimeout(resolve, 80));
                return [{ id: 'cand-slow', content: 'Chậm' }];
            }
        });
        _setEmbeddingService({
            MODEL_NAME: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
            async embed() {
                return [1];
            },
            cosineSimilarity() {
                return 0.5;
            }
        });

        await assert.rejects(async () => {
            await checkDuplicate(TARGET_Q_ID, { timeoutMs: 20 });
        }, (err) => {
            return err.code === 'ERR_DUPLICATE_CHECK_TIMEOUT';
        });
    });

    await t.test('7. Lỗi truy vấn Database: Ném lỗi, KHÔNG xem lỗi là kiểm tra thành công', async () => {
        _setSupabaseClient(createMockSupabaseForTarget({
            error: { message: 'Database connection failed' }
        }));

        await assert.rejects(async () => {
            await checkDuplicate(TARGET_Q_ID);
        }, (err) => {
            return err.code === 'ERR_TARGET_QUESTION_QUERY_FAILED' && err.message.includes('Database connection failed');
        });
    });

    await t.test('8. Lỗi Embedding model: Ném lỗi, KHÔNG nuốt lỗi', async () => {
        _setSupabaseClient(createMockSupabaseForTarget());
        _setCandidateService({
            async getCandidateQuestions() {
                return [{ id: 'cand-1', content: 'Có ứng viên' }];
            }
        });
        _setEmbeddingService({
            MODEL_NAME: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
            async embed() {
                const err = new Error('ONNX model memory out of bounds');
                err.code = 'ERR_EMBEDDING_FAILED';
                throw err;
            },
            cosineSimilarity() {
                return 0;
            }
        });

        await assert.rejects(async () => {
            await checkDuplicate(TARGET_Q_ID);
        }, (err) => {
            return err.code === 'ERR_EMBEDDING_FAILED';
        });
    });

    await t.test('9. Câu hỏi mục tiêu không tồn tại ném ERR_QUESTION_NOT_FOUND', async () => {
        _setSupabaseClient(createMockSupabaseForTarget({
            question: null
        }));

        await assert.rejects(async () => {
            await checkDuplicate('non-existent-id');
        }, (err) => {
            return err.code === 'ERR_QUESTION_NOT_FOUND';
        });
    });

    await t.test('10. Nội dung câu hỏi rỗng ném ERR_INVALID_QUESTION_CONTENT', async () => {
        _setSupabaseClient(createMockSupabaseForTarget({
            question: {
                id: TARGET_Q_ID,
                lesson_id: LESSON_ID,
                type_id: TYPE_ID,
                status: 'DRAFT',
                deleted_at: null,
                question_versions: [{
                    id: 'qv-empty',
                    content: '   \n  ',
                    is_current: true
                }]
            }
        }));

        await assert.rejects(async () => {
            await checkDuplicate(TARGET_Q_ID);
        }, (err) => {
            return err.code === 'ERR_INVALID_QUESTION_CONTENT';
        });
    });
});

