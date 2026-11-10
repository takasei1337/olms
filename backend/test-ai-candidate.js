require('dotenv').config({ quiet: true });

const test = require('node:test');
const assert = require('node:assert/strict');

const aiCandidateService = require('./src/services/ai-candidate.service');
const {
    getSubjectIdByLessonId,
    getSubjectIdByQuestionId,
    getCandidateQuestions,
    _setSupabaseClient,
    _resetSupabaseClient
} = aiCandidateService;

// Tạo dữ liệu mẫu mock quan hệ Subjects -> Chapters -> Lessons -> Questions -> Question Versions
const SUBJECT_A = '11111111-1111-1111-1111-111111111111';
const SUBJECT_B = '22222222-2222-2222-2222-222222222222';

const CHAPTER_A1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
const CHAPTER_A2 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
const CHAPTER_B1 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';

const LESSON_A1 = 'cccccccc-cccc-cccc-cccc-ccccccccccc1';
const LESSON_A2 = 'cccccccc-cccc-cccc-cccc-ccccccccccc2';
const LESSON_B1 = 'dddddddd-dddd-dddd-dddd-ddddddddddd1';

const TYPE_SINGLE = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1';
const TYPE_MULTI  = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2';

function buildMockSupabase(db) {
    return {
        from(table) {
            let selectedFields = null;
            let countMode = null;
            const filters = [];
            let orderConfig = null;
            let rangeConfig = null;

            const queryBuilder = {
                select(fields, opts) {
                    selectedFields = fields;
                    if (opts && opts.count) {
                        countMode = opts.count;
                    }
                    return queryBuilder;
                },
                eq(field, value) {
                    filters.push({ type: 'eq', field, value });
                    return queryBuilder;
                },
                neq(field, value) {
                    filters.push({ type: 'neq', field, value });
                    return queryBuilder;
                },
                in(field, values) {
                    filters.push({ type: 'in', field, values });
                    return queryBuilder;
                },
                is(field, value) {
                    filters.push({ type: 'is', field, value });
                    return queryBuilder;
                },
                order(field, opts) {
                    orderConfig = { field, opts };
                    return queryBuilder;
                },
                range(from, to) {
                    rangeConfig = { from, to };
                    return queryBuilder;
                },
                async maybeSingle() {
                    const result = await this.then ? await this : await execute();
                    return {
                        data: result.data && result.data.length > 0 ? result.data[0] : null,
                        error: result.error
                    };
                },
                then(resolve, reject) {
                    try {
                        const result = execute();
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                }
            };

            function execute() {
                const tableRows = db[table] || [];
                let filtered = tableRows.filter(row => {
                    for (const f of filters) {
                        if (f.type === 'eq') {
                            if (f.field.includes('.')) {
                                // Nested relation filter (ví dụ: question_versions.is_current)
                                const [rel, prop] = f.field.split('.');
                                const nested = Array.isArray(row[rel]) ? row[rel][0] : row[rel];
                                if (!nested || nested[prop] !== f.value) return false;
                            } else {
                                if (row[f.field] !== f.value) return false;
                            }
                        } else if (f.type === 'neq') {
                            if (row[f.field] === f.value) return false;
                        } else if (f.type === 'in') {
                            if (!f.values.includes(row[f.field])) return false;
                        } else if (f.type === 'is') {
                            if (f.value === null) {
                                if (row[f.field] !== null && row[f.field] !== undefined) return false;
                            } else {
                                if (row[f.field] !== f.value) return false;
                            }
                        }
                    }
                    return true;
                });

                const totalCount = filtered.length;

                if (orderConfig) {
                    filtered.sort((a, b) => {
                        const f = orderConfig.field;
                        if (a[f] < b[f]) return orderConfig.opts?.ascending === false ? 1 : -1;
                        if (a[f] > b[f]) return orderConfig.opts?.ascending === false ? -1 : 1;
                        return 0;
                    });
                }

                if (rangeConfig) {
                    filtered = filtered.slice(rangeConfig.from, rangeConfig.to + 1);
                }

                return {
                    data: filtered,
                    count: countMode ? totalCount : null,
                    error: null
                };
            }

            return queryBuilder;
        }
    };
}

test('AI Candidate Service - Subject Resolution Unit Tests', async (t) => {
    t.afterEach(() => {
        _resetSupabaseClient();
    });

    await t.test('getSubjectIdByLessonId: Quan hệ chuẩn Lessons -> Chapters -> Subjects trả về đúng subject_id', async () => {
        const mockDb = {
            lessons: [{ id: LESSON_A1, chapter_id: CHAPTER_A1, deleted_at: null }],
            chapters: [{ id: CHAPTER_A1, subject_id: SUBJECT_A, deleted_at: null }],
            subjects: [{ id: SUBJECT_A, deleted_at: null }]
        };
        _setSupabaseClient(buildMockSupabase(mockDb));

        const subjectId = await getSubjectIdByLessonId(LESSON_A1);
        assert.strictEqual(subjectId, SUBJECT_A);
    });

    await t.test('getSubjectIdByLessonId: Lesson bị soft-delete ném ERR_LESSON_NOT_FOUND', async () => {
        const mockDb = {
            lessons: [{ id: LESSON_A1, chapter_id: CHAPTER_A1, deleted_at: '2026-01-01T00:00:00Z' }],
            chapters: [{ id: CHAPTER_A1, subject_id: SUBJECT_A, deleted_at: null }],
            subjects: [{ id: SUBJECT_A, deleted_at: null }]
        };
        _setSupabaseClient(buildMockSupabase(mockDb));

        await assert.rejects(async () => {
            await getSubjectIdByLessonId(LESSON_A1);
        }, (err) => err.code === 'ERR_LESSON_NOT_FOUND');
    });

    await t.test('getSubjectIdByLessonId: Chapter bị soft-delete ném ERR_CHAPTER_NOT_FOUND', async () => {
        const mockDb = {
            lessons: [{ id: LESSON_A1, chapter_id: CHAPTER_A1, deleted_at: null }],
            chapters: [{ id: CHAPTER_A1, subject_id: SUBJECT_A, deleted_at: '2026-01-01T00:00:00Z' }],
            subjects: [{ id: SUBJECT_A, deleted_at: null }]
        };
        _setSupabaseClient(buildMockSupabase(mockDb));

        await assert.rejects(async () => {
            await getSubjectIdByLessonId(LESSON_A1);
        }, (err) => err.code === 'ERR_CHAPTER_NOT_FOUND');
    });

    await t.test('getSubjectIdByLessonId: Subject bị soft-delete ném ERR_SUBJECT_NOT_FOUND', async () => {
        const mockDb = {
            lessons: [{ id: LESSON_A1, chapter_id: CHAPTER_A1, deleted_at: null }],
            chapters: [{ id: CHAPTER_A1, subject_id: SUBJECT_A, deleted_at: null }],
            subjects: [{ id: SUBJECT_A, deleted_at: '2026-01-01T00:00:00Z' }]
        };
        _setSupabaseClient(buildMockSupabase(mockDb));

        await assert.rejects(async () => {
            await getSubjectIdByLessonId(LESSON_A1);
        }, (err) => err.code === 'ERR_SUBJECT_NOT_FOUND');
    });

    await t.test('getSubjectIdByQuestionId: Lấy subject từ câu hỏi thành công', async () => {
        const mockDb = {
            questions: [{ id: 'q-1', lesson_id: LESSON_A1, type_id: TYPE_SINGLE, deleted_at: null }],
            lessons: [{ id: LESSON_A1, chapter_id: CHAPTER_A1, deleted_at: null }],
            chapters: [{ id: CHAPTER_A1, subject_id: SUBJECT_A, deleted_at: null }],
            subjects: [{ id: SUBJECT_A, deleted_at: null }]
        };
        _setSupabaseClient(buildMockSupabase(mockDb));

        const res = await getSubjectIdByQuestionId('q-1');
        assert.strictEqual(res.subjectId, SUBJECT_A);
        assert.strictEqual(res.question.type_id, TYPE_SINGLE);
    });

    await t.test('getSubjectIdByQuestionId: Câu hỏi không có lesson_id ném ERR_QUESTION_NO_LESSON', async () => {
        const mockDb = {
            questions: [{ id: 'q-orphan', lesson_id: null, type_id: TYPE_SINGLE, deleted_at: null }]
        };
        _setSupabaseClient(buildMockSupabase(mockDb));

        await assert.rejects(async () => {
            await getSubjectIdByQuestionId('q-orphan');
        }, (err) => err.code === 'ERR_QUESTION_NO_LESSON');
    });
});

test('AI Candidate Service - getCandidateQuestions Filtering & Pagination Unit Tests', async (t) => {
    t.afterEach(() => {
        _resetSupabaseClient();
    });

    // Thiết lập cơ sở dữ liệu giả lập phong phú
    const baseDb = {
        subjects: [
            { id: SUBJECT_A, deleted_at: null },
            { id: SUBJECT_B, deleted_at: null }
        ],
        chapters: [
            { id: CHAPTER_A1, subject_id: SUBJECT_A, deleted_at: null },
            { id: CHAPTER_A2, subject_id: SUBJECT_A, deleted_at: null },
            { id: CHAPTER_B1, subject_id: SUBJECT_B, deleted_at: null }
        ],
        lessons: [
            { id: LESSON_A1, chapter_id: CHAPTER_A1, deleted_at: null },
            { id: LESSON_A2, chapter_id: CHAPTER_A2, deleted_at: null },
            { id: LESSON_B1, chapter_id: CHAPTER_B1, deleted_at: null }
        ],
        questions: [
            // Câu đang kiểm tra thuộc Subject A, Lesson A1, Type SINGLE
            {
                id: 'q-target',
                lesson_id: LESSON_A1,
                type_id: TYPE_SINGLE,
                status: 'DRAFT',
                ai_check_status: 'PENDING',
                ai_similarity_score: null,
                deleted_at: null,
                question_versions: [{
                    id: 'qv-target',
                    version_no: 1,
                    type_id: TYPE_SINGLE,
                    difficulty_level: 'MEDIUM',
                    content: 'Target question content',
                    is_current: true
                }]
            },
            // Câu 1: Cùng Subject A, cùng Type SINGLE -> HỢP LỆ
            {
                id: 'q-match-1',
                lesson_id: LESSON_A1,
                type_id: TYPE_SINGLE,
                status: 'ACTIVE',
                ai_check_status: 'CHECKED',
                ai_similarity_score: 0.12,
                deleted_at: null,
                question_versions: [{
                    id: 'qv-m1',
                    version_no: 1,
                    type_id: TYPE_SINGLE,
                    difficulty_level: 'EASY',
                    content: 'Match 1 content',
                    is_current: true
                }]
            },
            // Câu 2: Cùng Subject A (Lesson A2), cùng Type SINGLE -> HỢP LỆ
            {
                id: 'q-match-2',
                lesson_id: LESSON_A2,
                type_id: TYPE_SINGLE,
                status: 'ACTIVE',
                ai_check_status: 'CHECKED',
                ai_similarity_score: 0.25,
                deleted_at: null,
                question_versions: [{
                    id: 'qv-m2',
                    version_no: 2,
                    type_id: TYPE_SINGLE,
                    difficulty_level: 'HARD',
                    content: 'Match 2 content',
                    is_current: true
                }]
            },
            // Câu 3: Cùng Subject A, NHƯNG KHÁC Question Type (MULTI) -> LOẠI TRỪ
            {
                id: 'q-diff-type',
                lesson_id: LESSON_A1,
                type_id: TYPE_MULTI,
                status: 'ACTIVE',
                ai_check_status: 'CHECKED',
                ai_similarity_score: null,
                deleted_at: null,
                question_versions: [{
                    id: 'qv-diff-type',
                    version_no: 1,
                    type_id: TYPE_MULTI,
                    difficulty_level: 'MEDIUM',
                    content: 'Different type question',
                    is_current: true
                }]
            },
            // Câu 4: KHÁC Subject (thuộc Subject B) -> LOẠI TRỪ
            {
                id: 'q-diff-subject',
                lesson_id: LESSON_B1,
                type_id: TYPE_SINGLE,
                status: 'ACTIVE',
                ai_check_status: 'CHECKED',
                ai_similarity_score: null,
                deleted_at: null,
                question_versions: [{
                    id: 'qv-diff-sub',
                    version_no: 1,
                    type_id: TYPE_SINGLE,
                    difficulty_level: 'EASY',
                    content: 'Different subject question',
                    is_current: true
                }]
            },
            // Câu 5: Cùng Subject A, cùng Type SINGLE, NHƯNG ĐÃ BỊ SOFT-DELETE -> LOẠI TRỪ
            {
                id: 'q-deleted',
                lesson_id: LESSON_A1,
                type_id: TYPE_SINGLE,
                status: 'ACTIVE',
                ai_check_status: 'CHECKED',
                ai_similarity_score: null,
                deleted_at: '2026-02-01T10:00:00Z',
                question_versions: [{
                    id: 'qv-del',
                    version_no: 1,
                    type_id: TYPE_SINGLE,
                    difficulty_level: 'EASY',
                    content: 'Deleted question content',
                    is_current: true
                }]
            }
        ]
    };

    await t.test('Chỉ lấy câu hỏi cùng Subject, cùng Question Type, chưa xóa và loại trừ chính nó', async () => {
        _setSupabaseClient(buildMockSupabase(baseDb));

        const candidates = await getCandidateQuestions({
            questionId: 'q-target'
        });

        assert.strictEqual(candidates.length, 2, 'Phải có chính xác 2 câu ứng viên hợp lệ');

        const ids = candidates.map(c => c.id);
        assert.ok(ids.includes('q-match-1'), 'Phải chứa q-match-1');
        assert.ok(ids.includes('q-match-2'), 'Phải chứa q-match-2');

        // Kiểm tra loại trừ
        assert.ok(!ids.includes('q-target'), 'Không được chứa chính câu hỏi đang kiểm tra');
        assert.ok(!ids.includes('q-diff-type'), 'Không được chứa câu khác question type');
        assert.ok(!ids.includes('q-diff-subject'), 'Không được chứa câu thuộc môn học khác');
        assert.ok(!ids.includes('q-deleted'), 'Không được chứa câu hỏi đã soft-delete');

        // Kiểm tra dữ liệu phiên bản hiện hành
        const c1 = candidates.find(c => c.id === 'q-match-1');
        assert.strictEqual(c1.content, 'Match 1 content');
        assert.strictEqual(c1.version_no, 1);
        assert.strictEqual(c1.difficulty_level, 'EASY');
    });

    await t.test('Tìm theo lessonId và typeId cho câu hỏi mới (chưa có questionId)', async () => {
        _setSupabaseClient(buildMockSupabase(baseDb));

        const candidates = await getCandidateQuestions({
            lessonId: LESSON_A1,
            typeId: TYPE_SINGLE
        });

        // Lúc này q-target chưa bị loại trừ (do không truyền excludeQuestionId)
        // Nên sẽ có q-target, q-match-1, q-match-2
        assert.strictEqual(candidates.length, 3);
        const ids = candidates.map(c => c.id);
        assert.ok(ids.includes('q-target'));
        assert.ok(ids.includes('q-match-1'));
        assert.ok(ids.includes('q-match-2'));
    });

    await t.test('Xử lý duyệt phân trang nhiều trang (Pagination loop không bỏ sót bản ghi)', async () => {
        // Tạo 7 câu hỏi ứng viên cùng Subject A và cùng Type SINGLE
        const manyQuestions = [];
        for (let i = 1; i <= 7; i++) {
            manyQuestions.push({
                id: `q-bulk-${String(i).padStart(2, '0')}`,
                lesson_id: LESSON_A1,
                type_id: TYPE_SINGLE,
                status: 'ACTIVE',
                ai_check_status: 'CHECKED',
                ai_similarity_score: null,
                deleted_at: null,
                question_versions: [{
                    id: `qv-bulk-${i}`,
                    version_no: 1,
                    type_id: TYPE_SINGLE,
                    difficulty_level: 'MEDIUM',
                    content: `Bulk Question Content ${i}`,
                    is_current: true
                }]
            });
        }

        const paginationDb = {
            subjects: [{ id: SUBJECT_A, deleted_at: null }],
            chapters: [{ id: CHAPTER_A1, subject_id: SUBJECT_A, deleted_at: null }],
            lessons: [{ id: LESSON_A1, chapter_id: CHAPTER_A1, deleted_at: null }],
            questions: manyQuestions
        };

        _setSupabaseClient(buildMockSupabase(paginationDb));

        // Đặt pageSize = 2 (sẽ duyệt qua 4 trang: 2 + 2 + 2 + 1 = 7)
        const candidates = await getCandidateQuestions({
            subjectId: SUBJECT_A,
            typeId: TYPE_SINGLE,
            pageSize: 2
        });

        assert.strictEqual(candidates.length, 7, 'Phải lấy đủ 7 câu qua nhiều trang duyệt');
        assert.strictEqual(candidates[0].id, 'q-bulk-01');
        assert.strictEqual(candidates[6].id, 'q-bulk-07');
    });

    await t.test('Subject không có chapter nào trả về mảng rỗng []', async () => {
        const emptyDb = {
            subjects: [{ id: SUBJECT_A, deleted_at: null }],
            chapters: [],
            lessons: [],
            questions: []
        };
        _setSupabaseClient(buildMockSupabase(emptyDb));

        const candidates = await getCandidateQuestions({
            subjectId: SUBJECT_A,
            typeId: TYPE_SINGLE
        });

        assert.deepStrictEqual(candidates, []);
    });
});

