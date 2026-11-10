require('dotenv').config({ quiet: true });

const test = require('node:test');
const assert = require('node:assert/strict');

const aiCheckService = require('./src/services/ai-check.service');
const {
    processQuestionAiCheck,
    _setSupabaseClient,
    _setDuplicateCheckService,
    _resetServices
} = aiCheckService;

const TARGET_Q_ID = '11111111-2222-3333-4444-555555555555';

function createMockSupabase({
    initialQuestion,
    latestQuestion = null,
    onUpdate = null
}) {
    let callCount = 0;
    return {
        from(table) {
            if (table === 'questions') {
                return {
                    select() {
                        return {
                            eq(field, value) {
                                return {
                                    is() {
                                        return {
                                            eq() {
                                                return {
                                                    async maybeSingle() {
                                                        callCount++;
                                                        // Lần 1: đọc initialQuestion, Lần 2: đọc latestQuestion
                                                        if (callCount === 1) {
                                                            return { data: initialQuestion, error: null };
                                                        }
                                                        return { data: latestQuestion || initialQuestion, error: null };
                                                    }
                                                };
                                            }
                                        };
                                    }
                                };
                            }
                        };
                    },
                    update(payload) {
                        const updateQuery = {
                            eq() {
                                return updateQuery;
                            },
                            neq() {
                                return updateQuery;
                            },
                            select() {
                                return updateQuery;
                            },
                            async maybeSingle() {
                                if (onUpdate) {
                                    onUpdate(payload);
                                }
                                return {
                                    data: {
                                        ...initialQuestion,
                                        ...payload
                                    },
                                    error: null
                                };
                            },
                            async single() {
                                return this.maybeSingle();
                            }
                        };
                        return updateQuery;
                    }
                };
            }
            throw new Error(`Unexpected table: ${table}`);
        }
    };
}

test('AI Check Service - Coordination & Persistence Unit Tests (SRS 5.9)', async (t) => {
    t.afterEach(() => {
        _resetServices();
    });

    await t.test('1. Điểm số < 0.80: Đánh dấu CHECKED, lưu điểm số & metadata, giữ nguyên DRAFT', async () => {
        const initialQuestion = {
            id: TARGET_Q_ID,
            status: 'DRAFT',
            ai_check_status: 'PENDING',
            is_duplicate_overridden: false,
            deleted_at: null,
            question_versions: [{
                id: 'v-1',
                version_no: 1,
                is_current: true
            }]
        };

        let updatedPayload = null;
        const mockSupabase = createMockSupabase({
            initialQuestion,
            onUpdate: (payload) => {
                updatedPayload = payload;
            }
        });

        _setSupabaseClient(mockSupabase);
        _setDuplicateCheckService({
            async checkDuplicate() {
                return {
                    similarity_score: 0.3542,
                    raw_score: 0.35418,
                    compared_question_id: 'cand-safe',
                    is_duplicate: false,
                    model_name: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
                    checked_at: '2026-11-05T10:00:00.000Z'
                };
            }
        });

        const result = await processQuestionAiCheck(TARGET_Q_ID);

        // Kiểm tra payload ghi vào CSDL
        assert.strictEqual(updatedPayload.ai_check_status, 'CHECKED');
        assert.strictEqual(updatedPayload.ai_similarity_score, 0.3542);
        assert.strictEqual(updatedPayload.ai_audit_metadata.is_duplicate, false);
        assert.strictEqual(updatedPayload.ai_audit_metadata.compared_question_id, 'cand-safe');
        assert.strictEqual(updatedPayload.ai_audit_metadata.version_no, 1);
        assert.strictEqual(updatedPayload.ai_audit_metadata.warning, undefined, 'Không được có cảnh báo trùng');

        // Trạng thái câu hỏi phải giữ nguyên DRAFT, không được tự động chuyển ACTIVE
        assert.strictEqual(result.status, 'DRAFT');
    });

    await t.test('2. Điểm số >= 0.80 (0.852): Đánh dấu CHECKED, lưu cảnh báo POTENTIAL_DUPLICATE & review_state NEEDS_TEACHER', async () => {
        const initialQuestion = {
            id: TARGET_Q_ID,
            status: 'DRAFT',
            ai_check_status: 'PENDING',
            is_duplicate_overridden: false,
            deleted_at: null,
            question_versions: [{
                id: 'v-1',
                version_no: 1,
                is_current: true
            }]
        };

        let updatedPayload = null;
        const mockSupabase = createMockSupabase({
            initialQuestion,
            onUpdate: (payload) => {
                updatedPayload = payload;
            }
        });

        _setSupabaseClient(mockSupabase);
        _setDuplicateCheckService({
            async checkDuplicate() {
                return {
                    similarity_score: 0.8520,
                    raw_score: 0.85203,
                    compared_question_id: 'cand-dup',
                    is_duplicate: true,
                    model_name: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
                    checked_at: '2026-11-05T10:00:00.000Z'
                };
            }
        });

        const result = await processQuestionAiCheck(TARGET_Q_ID);

        assert.strictEqual(updatedPayload.ai_check_status, 'CHECKED');
        assert.strictEqual(updatedPayload.ai_similarity_score, 0.8520);
        assert.strictEqual(updatedPayload.ai_audit_metadata.is_duplicate, true);
        assert.strictEqual(updatedPayload.ai_audit_metadata.warning, 'POTENTIAL_DUPLICATE');
        assert.strictEqual(updatedPayload.ai_audit_metadata.review_state, 'NEEDS_TEACHER');

        // Đảm bảo không tự chuyển ACTIVE và không tự động override
        assert.strictEqual(result.status, 'DRAFT');
        assert.strictEqual(result.is_duplicate_overridden, false);
    });

    await t.test('3. So sánh ngưỡng 0.80 trên điểm gốc (raw_score) trước khi làm tròn', async () => {
        const initialQuestion = {
            id: TARGET_Q_ID,
            status: 'DRAFT',
            ai_check_status: 'PENDING',
            is_duplicate_overridden: false,
            deleted_at: null,
            question_versions: [{
                id: 'v-1',
                version_no: 1,
                is_current: true
            }]
        };

        let updatedPayload = null;
        const mockSupabase = createMockSupabase({
            initialQuestion,
            onUpdate: (payload) => {
                updatedPayload = payload;
            }
        });

        _setSupabaseClient(mockSupabase);
        // raw_score = 0.79996 (làm tròn 4 số là 0.8000, nhưng điểm gốc < 0.80)
        _setDuplicateCheckService({
            async checkDuplicate() {
                return {
                    similarity_score: 0.8000,
                    raw_score: 0.79996,
                    compared_question_id: 'cand-edge',
                    is_duplicate: false,
                    model_name: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
                    checked_at: '2026-11-05T10:00:00.000Z'
                };
            }
        });

        await processQuestionAiCheck(TARGET_Q_ID);

        // Do raw_score 0.79996 < 0.80 nên không bị tính là trùng
        assert.strictEqual(updatedPayload.ai_similarity_score, 0.8000);
        assert.strictEqual(updatedPayload.ai_audit_metadata.is_duplicate, false);
        assert.strictEqual(updatedPayload.ai_audit_metadata.warning, undefined);
    });

    await t.test('4. Xử lý Timeout (3s): Đánh dấu SKIPPED_TIMEOUT, ai_similarity_score = null, giữ DRAFT và ghi lý do vào metadata', async () => {
        const initialQuestion = {
            id: TARGET_Q_ID,
            status: 'DRAFT',
            ai_check_status: 'PENDING',
            is_duplicate_overridden: false,
            deleted_at: null,
            question_versions: [{
                id: 'v-1',
                version_no: 1,
                is_current: true
            }]
        };

        let updatedPayload = null;
        const mockSupabase = createMockSupabase({
            initialQuestion,
            onUpdate: (payload) => {
                updatedPayload = payload;
            }
        });

        _setSupabaseClient(mockSupabase);
        _setDuplicateCheckService({
            async checkDuplicate() {
                const err = new Error('AI Duplicate Check overall execution timed out after 3000ms');
                err.code = 'ERR_DUPLICATE_CHECK_TIMEOUT';
                throw err;
            }
        });

        const result = await processQuestionAiCheck(TARGET_Q_ID);

        assert.strictEqual(updatedPayload.ai_check_status, 'SKIPPED_TIMEOUT');
        assert.strictEqual(updatedPayload.ai_similarity_score, null);
        assert.strictEqual(updatedPayload.ai_audit_metadata.error_code, 'ERR_DUPLICATE_CHECK_TIMEOUT');
        assert.strictEqual(updatedPayload.ai_audit_metadata.retry_needed, true);
        assert.strictEqual(result.status, 'DRAFT');
    });

    await t.test('5. Bảo vệ xung đột phiên bản (Concurrency Guard): Hủy kết quả AI cũ nếu phiên bản câu hỏi đã thay đổi', async () => {
        const initialQuestion = {
            id: TARGET_Q_ID,
            status: 'DRAFT',
            ai_check_status: 'PENDING',
            is_duplicate_overridden: false,
            deleted_at: null,
            question_versions: [{
                id: 'v-1',
                version_no: 1,
                is_current: true
            }]
        };

        // Trong lúc kiểm tra AI, người dùng đã cập nhật câu hỏi sang phiên bản 2
        const latestQuestionAfterEdit = {
            ...initialQuestion,
            question_versions: [{
                id: 'v-2',
                version_no: 2,
                is_current: true
            }]
        };

        let wasUpdated = false;
        const mockSupabase = createMockSupabase({
            initialQuestion,
            latestQuestion: latestQuestionAfterEdit,
            onUpdate: () => {
                wasUpdated = true;
            }
        });

        _setSupabaseClient(mockSupabase);
        _setDuplicateCheckService({
            async checkDuplicate() {
                return {
                    similarity_score: 0.2,
                    raw_score: 0.2,
                    compared_question_id: null,
                    is_duplicate: false,
                    model_name: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
                    checked_at: '2026-11-05T10:00:00.000Z'
                };
            }
        });

        await assert.rejects(async () => {
            await processQuestionAiCheck(TARGET_Q_ID);
        }, (err) => {
            return err.code === 'ERR_VERSION_MISMATCH_DISCARDED';
        });

        assert.strictEqual(wasUpdated, false, 'Không được ghi kết quả kiểm tra của phiên bản cũ vào database');
    });

    await t.test('6. Bảo vệ kết quả Override: Không ghi đè nếu câu hỏi đã được Human Override', async () => {
        // Trường hợp 6a: Đã override từ trước
        const overriddenQuestion = {
            id: TARGET_Q_ID,
            status: 'ACTIVE',
            ai_check_status: 'OVERRIDDEN',
            is_duplicate_overridden: true,
            deleted_at: null,
            question_versions: [{
                id: 'v-1',
                version_no: 1,
                is_current: true
            }]
        };

        let wasUpdated = false;
        const mockSupabase = createMockSupabase({
            initialQuestion: overriddenQuestion,
            onUpdate: () => {
                wasUpdated = true;
            }
        });

        _setSupabaseClient(mockSupabase);
        _setDuplicateCheckService({
            async checkDuplicate() {
                return {
                    similarity_score: 0.9,
                    raw_score: 0.9,
                    is_duplicate: true
                };
            }
        });

        await assert.rejects(async () => {
            await processQuestionAiCheck(TARGET_Q_ID);
        }, (err) => {
            return err.code === 'ERR_OVERRIDE_PROTECTED';
        });

        assert.strictEqual(wasUpdated, false, 'Không được ghi đè câu hỏi đã có Human Override');
    });
});

