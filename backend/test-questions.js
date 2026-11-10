require('dotenv').config({quiet: true});
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-secret-key-12345';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {generateAccessToken} = require('./src/services/token.service');
const {validateAnswerSpec} = require('./src/validators/answer-spec.validator');

const questionTypesRoutes = require('./src/routes/question-types.routes');
const questionsRoutes = require('./src/routes/questions.routes');

const questionTypesService = require('./src/services/question-types.service');
const questionsService = require('./src/services/questions.service');
const authService = require('./src/services/auth.service');
const aiCheckService = require('./src/services/ai-check.service');
const supabase = require('./src/config/supabase');

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        req.traceId = 'test_trace_id_q';
        next();
    });
    app.use('/api/v1/question-types', questionTypesRoutes);
    app.use('/api/v1/questions', questionsRoutes);

    app.use((err, req, res, next) => {
        return res.status(err.status || 500).json({
            success: false,
            code: 'INTERNAL_SERVER_ERROR',
            message: err.message,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    });

    return app;
}

const adminId = '38a25dbd-d764-4ba6-a4bc-3729e337c0b4';
const teacher1Id = '34b637d7-bba1-4d55-b61e-f59493fdc2e8';
const teacher2Id = '44444444-4444-4444-8444-444444444444';
const studentId = 'f1a8a03e-9d91-4df4-a69c-299b5a259697';

const adminToken = generateAccessToken({id: adminId, role: 'ADMIN'});
const teacher1Token = generateAccessToken({id: teacher1Id, role: 'TEACHER'});
const studentToken = generateAccessToken({id: studentId, role: 'STUDENT'});

async function request(app, method, path, {headers = {}, body = null} = {}) {
    const server = app.listen(0);
    const port = server.address().port;

    try {
        const fetchOptions = {
            method,
            headers: {
                ...headers,
                ...(body !== null ? {'Content-Type': 'application/json'} : {})
            },
            ...(body !== null ? {body: JSON.stringify(body)} : {})
        };

        const res = await fetch(`http://localhost:${port}${path}`, fetchOptions);
        const data = await res.json();
        return {status: res.status, body: data};
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

const originalFindActiveUserById = authService.findActiveUserById;
const originalFindQuestionTypes = questionTypesService.findQuestionTypes;
const originalFindQuestionTypeById = questionTypesService.findQuestionTypeById;
const originalFindQuestionTypeByCode = questionTypesService.findQuestionTypeByCode;
const originalCreateQuestionType = questionTypesService.createQuestionType;
const originalUpdateQuestionType = questionTypesService.updateQuestionType;
const originalIsQuestionTypeInUse = questionTypesService.isQuestionTypeInUse;
const originalSoftDeleteQuestionType = questionTypesService.softDeleteQuestionType;
const originalFindQuestions = questionsService.findQuestions;
const originalFindQuestionById = questionsService.findQuestionById;
const originalCreateQuestion = questionsService.createQuestion;
const originalUpdateQuestion = questionsService.updateQuestion;
const originalOverrideQuestionAi = questionsService.overrideQuestionAi;
const originalCloneQuestion = questionsService.cloneQuestion;
const originalFindQuestionVersions = questionsService.findQuestionVersions;
const originalUpdateQuestionStatus = questionsService.updateQuestionStatus;
const originalIsQuestionUsedInExams = questionsService.isQuestionUsedInExams;
const originalSoftDeleteQuestion = questionsService.softDeleteQuestion;
const originalRecheckQuestionAi = questionsService.recheckQuestionAi;
const originalProcessQuestionAiCheck = aiCheckService.processQuestionAiCheck;
const originalSupabaseFrom = supabase.from;

function setupMockUsers() {
    authService.findActiveUserById = async (id) => {
        if (id === adminId) return {id: adminId, role: 'ADMIN', status: 'ACTIVE'};
        if (id === teacher1Id) return {id: teacher1Id, role: 'TEACHER', status: 'ACTIVE'};
        if (id === teacher2Id) return {id: teacher2Id, role: 'TEACHER', status: 'ACTIVE'};
        if (id === studentId) return {id: studentId, role: 'STUDENT', status: 'ACTIVE'};
        return null;
    };
}

function restoreAllMocks() {
    authService.findActiveUserById = originalFindActiveUserById;
    questionTypesService.findQuestionTypes = originalFindQuestionTypes;
    questionTypesService.findQuestionTypeById = originalFindQuestionTypeById;
    questionTypesService.findQuestionTypeByCode = originalFindQuestionTypeByCode;
    questionTypesService.createQuestionType = originalCreateQuestionType;
    questionTypesService.updateQuestionType = originalUpdateQuestionType;
    questionTypesService.isQuestionTypeInUse = originalIsQuestionTypeInUse;
    questionTypesService.softDeleteQuestionType = originalSoftDeleteQuestionType;
    questionsService.findQuestions = originalFindQuestions;
    questionsService.findQuestionById = originalFindQuestionById;
    questionsService.createQuestion = originalCreateQuestion;
    questionsService.updateQuestion = originalUpdateQuestion;
    questionsService.overrideQuestionAi = originalOverrideQuestionAi;
    questionsService.cloneQuestion = originalCloneQuestion;
    questionsService.findQuestionVersions = originalFindQuestionVersions;
    questionsService.updateQuestionStatus = originalUpdateQuestionStatus;
    questionsService.isQuestionUsedInExams = originalIsQuestionUsedInExams;
    questionsService.softDeleteQuestion = originalSoftDeleteQuestion;
    questionsService.recheckQuestionAi = originalRecheckQuestionAi;
    aiCheckService.processQuestionAiCheck = originalProcessQuestionAiCheck;
    supabase.from = originalSupabaseFrom;
}

test('QUESTIONS & QUESTION TYPES MODULE TESTS (MOCK)', async (t) => {
    setupMockUsers();
    const app = createTestApp();

    t.after(() => {
        restoreAllMocks();
    });

    await t.test('1. AnswerSpec Semantic Validator for 5 Canonical Kinds', () => {
        // SINGLE_CHOICE valid
        const scValid = {
            schema_version: 1,
            kind: 'SINGLE_CHOICE',
            choices: [
                {id: '0199ac14-a9bc-7001-8000-000000000101', text: '4', order_no: 1, is_correct: false},
                {id: '0199ac14-a9bc-7001-8000-000000000102', text: '5', order_no: 2, is_correct: true}
            ]
        };
        assert.equal(validateAnswerSpec(scValid, 'SINGLE_CHOICE'), null);

        // SINGLE_CHOICE invalid (no correct answer)
        const scNoCorrect = {
            schema_version: 1,
            kind: 'SINGLE_CHOICE',
            choices: [
                {id: '0199ac14-a9bc-7001-8000-000000000101', text: '4', order_no: 1, is_correct: false},
                {id: '0199ac14-a9bc-7001-8000-000000000102', text: '5', order_no: 2, is_correct: false}
            ]
        };
        assert.match(validateAnswerSpec(scNoCorrect, 'SINGLE_CHOICE'), /exactly 1 correct/);

        // MULTI_CHOICE valid
        const mcValid = {
            schema_version: 1,
            kind: 'MULTI_CHOICE',
            choices: [
                {id: '0199ac14-a9bc-7001-8000-000000000101', text: 'A', order_no: 1, is_correct: true},
                {id: '0199ac14-a9bc-7001-8000-000000000102', text: 'B', order_no: 2, is_correct: true}
            ]
        };
        assert.equal(validateAnswerSpec(mcValid, 'MULTI_CHOICE'), null);

        // DROPDOWN valid with placeholder
        const ddValid = {
            schema_version: 1,
            kind: 'DROPDOWN',
            blanks: [
                {
                    blank_id: 'b1',
                    choices: [
                        {value_id: 'x1', label: 'Hà Nội'},
                        {value_id: 'x2', label: 'Huế'}
                    ],
                    correct_value_id: 'x1'
                }
            ]
        };
        assert.equal(validateAnswerSpec(ddValid, 'DROPDOWN', 'Thủ đô nước ta là {{b1}}.'), null);
        assert.match(validateAnswerSpec(ddValid, 'DROPDOWN', 'Không có placeholder.'), /placeholder '\{\{b1\}\}'/);

        // INPUT valid
        const inputValid = {
            schema_version: 1,
            kind: 'INPUT',
            equivalent_answers: ['0.5', '1/2', '0,5']
        };
        assert.equal(validateAnswerSpec(inputValid, 'INPUT'), null);

        // MATCHING valid
        const matchingValid = {
            schema_version: 1,
            kind: 'MATCHING',
            left_items: [{id: 'l1', label: 'Hà Nội'}],
            right_items: [{id: 'r1', label: 'Thủ đô'}],
            pairs: [{left_id: 'l1', right_id: 'r1'}]
        };
        assert.equal(validateAnswerSpec(matchingValid, 'MATCHING'), null);

        // Mismatched type code
        assert.match(validateAnswerSpec(inputValid, 'SINGLE_CHOICE'), /does not match question_type code/);
    });

    await t.test('2. GET /question-types - Auth, RBAC & Retrieval', async () => {
        // Missing token -> 401
        const resNoAuth = await request(app, 'GET', '/api/v1/question-types');
        assert.equal(resNoAuth.status, 401);

        // Student -> 403
        const resStudent = await request(app, 'GET', '/api/v1/question-types', {
            headers: {Authorization: `Bearer ${studentToken}`}
        });
        assert.equal(resStudent.status, 403);

        // Teacher success
        questionTypesService.findQuestionTypes = async () => [
            {id: '0199ac14-a9bc-7001-8000-000000000001', code: 'SINGLE_CHOICE', name: 'Trắc nghiệm đơn', description: null}
        ];

        const resTeacher = await request(app, 'GET', '/api/v1/question-types', {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resTeacher.status, 200);
        assert.equal(resTeacher.body.success, true);
        assert.equal(resTeacher.body.data.length, 1);
        assert.equal(resTeacher.body.data[0].code, 'SINGLE_CHOICE');
    });

    await t.test('3. GET /questions - Filter, Search & Pagination', async () => {
        questionsService.findQuestions = async ({from, to, difficulty_level, status, topic_tag}) => {
            assert.equal(from, 0);
            assert.equal(to, 19);
            assert.equal(difficulty_level, 'EASY');
            assert.equal(status, 'DRAFT');
            assert.equal(topic_tag, 'dao_ham');
            return {
                questions: [
                    {
                        id: '0199ac14-a9bc-7001-8000-000000000002',
                        type_id: '0199ac14-a9bc-7001-8000-000000000001',
                        status: 'DRAFT',
                        ai_check_status: 'SKIPPED_TIMEOUT',
                        topic_tag: 'dao_ham',
                        content: '2 + 3 = ?',
                        difficulty_level: 'EASY'
                    }
                ],
                total: 1
            };
        };

        const res = await request(app, 'GET', '/api/v1/questions?page=1&page_size=20&difficulty_level=EASY&status=DRAFT&topic_tag=dao_ham', {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.data.length, 1);
        assert.equal(res.body.data[0].content, '2 + 3 = ?');
        assert.equal(res.body.data[0].topic_tag, 'dao_ham');
        assert.deepEqual(res.body.meta, {
            page: 1,
            page_size: 20,
            total_items: 1,
            total_pages: 1
        });
    });

    await t.test('4. POST /questions - Validation, AnswerSpec matching, & Creation', async () => {
        const typeId = '0199ac14-a9bc-7001-8000-000000000001';
        questionTypesService.findQuestionTypeById = async (id) => {
            if (id === typeId) return {id: typeId, code: 'SINGLE_CHOICE', name: 'Trắc nghiệm đơn'};
            return null;
        };

        // Missing required fields
        const resMissing = await request(app, 'POST', '/api/v1/questions', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {content: 'Missing fields'}
        });
        assert.equal(resMissing.status, 400);
        assert.match(resMissing.body.message, /type_id is required/);

        // Invalid topic_tag > 100 chars
        const resLongTopic = await request(app, 'POST', '/api/v1/questions', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {
                type_id: typeId,
                difficulty_level: 'EASY',
                topic_tag: 'x'.repeat(101),
                content: 'Test topic length',
                answer_spec: {
                    schema_version: 1,
                    kind: 'SINGLE_CHOICE',
                    choices: [
                        {id: '0199ac14-a9bc-7001-8000-000000000101', text: '5', order_no: 1, is_correct: true},
                        {id: '0199ac14-a9bc-7001-8000-000000000102', text: '6', order_no: 2, is_correct: false}
                    ]
                }
            }
        });
        assert.equal(resLongTopic.status, 400);
        assert.match(resLongTopic.body.message, /topic_tag must not exceed 100/);

        // Mismatched answer_spec kind vs question_type
        const resMismatch = await request(app, 'POST', '/api/v1/questions', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {
                type_id: typeId,
                difficulty_level: 'EASY',
                content: 'Test content',
                answer_spec: {
                    schema_version: 1,
                    kind: 'INPUT',
                    equivalent_answers: ['abc']
                }
            }
        });
        assert.equal(resMismatch.status, 400);
        assert.match(resMismatch.body.message, /does not match question_type code/);

        // Success creation with topic_tag
        questionsService.createQuestion = async ({content, difficulty_level, type_id, topic_tag, created_by}) => {
            assert.equal(created_by, teacher1Id);
            assert.equal(topic_tag, 'toan_co_ban');
            return {
                id: '0199ac14-a9bc-7001-8000-000000000099',
                type_id,
                status: 'DRAFT',
                ai_check_status: 'SKIPPED_TIMEOUT',
                topic_tag,
                content,
                difficulty_level,
                current_version_no: 1,
                created_by
            };
        };

        const resCreated = await request(app, 'POST', '/api/v1/questions', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {
                type_id: typeId,
                difficulty_level: 'EASY',
                topic_tag: '  toan_co_ban  ',
                content: 'Kết quả 2 + 3 là?',
                answer_spec: {
                    schema_version: 1,
                    kind: 'SINGLE_CHOICE',
                    choices: [
                        {id: '0199ac14-a9bc-7001-8000-000000000101', text: '5', order_no: 1, is_correct: true},
                        {id: '0199ac14-a9bc-7001-8000-000000000102', text: '6', order_no: 2, is_correct: false}
                    ]
                }
            }
        });

        assert.equal(resCreated.status, 201);
        assert.equal(resCreated.body.success, true);
        assert.equal(resCreated.body.data.id, '0199ac14-a9bc-7001-8000-000000000099');
        assert.equal(resCreated.body.data.status, 'DRAFT');
        assert.equal(resCreated.body.data.ai_check_status, 'SKIPPED_TIMEOUT');
        assert.equal(resCreated.body.data.topic_tag, 'toan_co_ban');
    });

    await t.test('5. GET /questions/:questionId - Detail & 404', async () => {
        const validId = '0199ac14-a9bc-7001-8000-000000000099';

        // 404 when not found
        questionsService.findQuestionById = async () => null;
        const resNotFound = await request(app, 'GET', `/api/v1/questions/${validId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resNotFound.status, 404);
        assert.equal(resNotFound.body.code, 'QUESTION_NOT_FOUND');

        // 200 Success
        questionsService.findQuestionById = async (id) => ({
            id,
            type_id: '0199ac14-a9bc-7001-8000-000000000001',
            status: 'ACTIVE',
            ai_check_status: 'CHECKED',
            content: 'Câu hỏi chi tiết',
            difficulty_level: 'MEDIUM',
            current_version_no: 1,
            created_by: teacher1Id
        });

        const resSuccess = await request(app, 'GET', `/api/v1/questions/${validId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resSuccess.status, 200);
        assert.equal(resSuccess.body.data.content, 'Câu hỏi chi tiết');
    });

    await t.test('6. PATCH /questions/:questionId - Ownership & Versioning', async () => {
        const questionId = '0199ac14-a9bc-7001-8000-000000000099';

        // Forbidden when teacher edits question belonging to teacher2
        questionsService.findQuestionById = async (id) => ({
            id,
            created_by: teacher2Id, // different teacher
            type_id: '0199ac14-a9bc-7001-8000-000000000001',
            content: 'Old',
            _rawVersion: {id: 'v1', version_no: 1, frozen_at: null}
        });

        const resForbidden = await request(app, 'PATCH', `/api/v1/questions/${questionId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {content: 'New'}
        });
        assert.equal(resForbidden.status, 403);
        assert.equal(resForbidden.body.code, 'FORBIDDEN');

        // Teacher edits own question (frozen -> new version created)
        questionsService.findQuestionById = async (id) => ({
            id,
            created_by: teacher1Id,
            type_id: '0199ac14-a9bc-7001-8000-000000000001',
            content: 'Frozen content',
            _rawVersion: {id: 'v1', version_no: 1, frozen_at: '2026-10-15T00:00:00Z'}
        });

        questionsService.updateQuestion = async (id, updates, existing, userId) => {
            return {
                id,
                content: updates.content,
                current_version_no: 2, // bumped version because old was frozen
                status: 'DRAFT',
                created_by: teacher1Id
            };
        };

        const resPatch = await request(app, 'PATCH', `/api/v1/questions/${questionId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {content: 'Updated content'}
        });
        assert.equal(resPatch.status, 200);
        assert.equal(resPatch.body.data.current_version_no, 2);
    });

    await t.test('7. PATCH /questions/:questionId/status - Status transitions', async () => {
        const questionId = '0199ac14-a9bc-7001-8000-000000000099';

        questionsService.findQuestionById = async (id) => ({
            id,
            created_by: teacher1Id,
            status: 'DRAFT'
        });

        questionsService.updateQuestionStatus = async (id, status) => ({
            id,
            status,
            created_by: teacher1Id
        });

        // Invalid status
        const resInvalid = await request(app, 'PATCH', `/api/v1/questions/${questionId}/status`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {status: 'INVALID_STATUS'}
        });
        assert.equal(resInvalid.status, 400);

        // Success transition
        const resSuccess = await request(app, 'PATCH', `/api/v1/questions/${questionId}/status`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {status: 'ACTIVE'}
        });
        assert.equal(resSuccess.status, 200);
        assert.equal(resSuccess.body.data.status, 'ACTIVE');
    });

    await t.test('8. DELETE /questions/:questionId - Conflict on Exam use & Soft delete', async () => {
        const questionId = '0199ac14-a9bc-7001-8000-000000000099';

        questionsService.findQuestionById = async (id) => ({
            id,
            created_by: teacher1Id
        });

        // 409 Conflict if used in exams
        questionsService.isQuestionUsedInExams = async () => true;
        const resConflict = await request(app, 'DELETE', `/api/v1/questions/${questionId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resConflict.status, 409);
        assert.equal(resConflict.body.code, 'CONFLICT');

        // 200 Success soft delete
        questionsService.isQuestionUsedInExams = async () => false;
        let deletedActor = null;
        questionsService.softDeleteQuestion = async (id, actorId) => {
            deletedActor = actorId;
            return {id};
        };

        const resDelete = await request(app, 'DELETE', `/api/v1/questions/${questionId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resDelete.status, 200);
        assert.deepEqual(resDelete.body.data, {});
        assert.equal(deletedActor, teacher1Id);
    });

    await t.test('9. POST /questions/:questionId/ai-recheck - Authentication, RBAC, Validation & Concurrency', async () => {
        const questionId = '3efc4efc-a19b-4135-9cd9-bad26ca09101';

        // 401 Unauthorized khi thiếu Token
        const resNoAuth = await request(app, 'POST', `/api/v1/questions/${questionId}/ai-recheck`);
        assert.equal(resNoAuth.status, 401);

        // 403 Forbidden khi Student cố gọi endpoint
        const resStudent = await request(app, 'POST', `/api/v1/questions/${questionId}/ai-recheck`, {
            headers: {Authorization: `Bearer ${studentToken}`}
        });
        assert.equal(resStudent.status, 403);
        assert.equal(resStudent.body.code, 'FORBIDDEN');

        // 400 Bad Request khi questionId không đúng định dạng UUID
        const resInvalidUuid = await request(app, 'POST', '/api/v1/questions/invalid-uuid/ai-recheck', {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resInvalidUuid.status, 400);
        assert.equal(resInvalidUuid.body.code, 'VALIDATION_ERROR');

        // 404 Not Found khi câu hỏi không tồn tại
        questionsService.findQuestionById = async () => null;
        const resNotFound = await request(app, 'POST', `/api/v1/questions/${questionId}/ai-recheck`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resNotFound.status, 404);
        assert.equal(resNotFound.body.code, 'QUESTION_NOT_FOUND');

        // 403 Forbidden khi Giáo viên khác không sở hữu câu hỏi
        questionsService.findQuestionById = async (id) => ({
            id,
            status: 'DRAFT',
            ai_check_status: 'PENDING',
            is_duplicate_overridden: false,
            created_by: teacher2Id
        });
        const resForbiddenTeacher = await request(app, 'POST', `/api/v1/questions/${questionId}/ai-recheck`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resForbiddenTeacher.status, 403);
        assert.equal(resForbiddenTeacher.body.code, 'FORBIDDEN');

        // 409 Conflict khi câu hỏi không ở trạng thái DRAFT (ví dụ ACTIVE)
        questionsService.findQuestionById = async (id) => ({
            id,
            status: 'ACTIVE',
            ai_check_status: 'PENDING',
            is_duplicate_overridden: false,
            created_by: teacher1Id
        });
        const resNotDraft = await request(app, 'POST', `/api/v1/questions/${questionId}/ai-recheck`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resNotDraft.status, 409);
        assert.equal(resNotDraft.body.code, 'CONFLICT');
        assert.ok(resNotDraft.body.message.includes('DRAFT'));

        // 409 Conflict khi câu hỏi đã được AI Override
        questionsService.findQuestionById = async (id) => ({
            id,
            status: 'DRAFT',
            ai_check_status: 'OVERRIDDEN',
            is_duplicate_overridden: true,
            created_by: teacher1Id
        });
        const resOverridden = await request(app, 'POST', `/api/v1/questions/${questionId}/ai-recheck`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resOverridden.status, 409);
        assert.equal(resOverridden.body.code, 'CONFLICT');
        assert.ok(resOverridden.body.message.includes('overridden'));

        // 409 Conflict khi gặp lỗi Concurrency phiên bản bị thay đổi
        questionsService.findQuestionById = async (id) => ({
            id,
            status: 'DRAFT',
            ai_check_status: 'PENDING',
            is_duplicate_overridden: false,
            created_by: teacher1Id
        });
        questionsService.recheckQuestionAi = async () => {
            const err = new Error('Question version changed concurrently');
            err.code = 'ERR_VERSION_MISMATCH_DISCARDED';
            throw err;
        };
        const resVersionMismatch = await request(app, 'POST', `/api/v1/questions/${questionId}/ai-recheck`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resVersionMismatch.status, 409);
        assert.equal(resVersionMismatch.body.code, 'CONFLICT');
        assert.ok(resVersionMismatch.body.message.includes('version was updated'));

        // 200 Success - Điểm số an toàn (< 0.80)
        questionsService.recheckQuestionAi = async (id) => ({
            id,
            status: 'DRAFT',
            ai_check_status: 'CHECKED',
            ai_similarity_score: 0.1500,
            ai_review_state: null,
            is_duplicate: false,
            duplicate_warning: null,
            created_by: teacher1Id
        });
        const resSuccessSafe = await request(app, 'POST', `/api/v1/questions/${questionId}/ai-recheck`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resSuccessSafe.status, 200);
        assert.equal(resSuccessSafe.body.code, 'SUCCESS');
        assert.equal(resSuccessSafe.body.data.ai_check_status, 'CHECKED');
        assert.equal(resSuccessSafe.body.data.ai_similarity_score, 0.1500);

        // 200 Success - Cảnh báo trùng (>= 0.80)
        questionsService.recheckQuestionAi = async (id) => ({
            id,
            status: 'DRAFT',
            ai_check_status: 'CHECKED',
            ai_similarity_score: 0.8800,
            ai_review_state: 'NEEDS_TEACHER',
            is_duplicate: true,
            duplicate_warning: 'POTENTIAL_DUPLICATE',
            created_by: teacher1Id
        });
        const resSuccessDup = await request(app, 'POST', `/api/v1/questions/${questionId}/ai-recheck`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resSuccessDup.status, 200);
        assert.equal(resSuccessDup.body.code, 'SUCCESS');
        assert.equal(resSuccessDup.body.data.ai_check_status, 'CHECKED');
        assert.equal(resSuccessDup.body.data.ai_similarity_score, 0.8800);
        assert.equal(resSuccessDup.body.data.is_duplicate, true);
        assert.equal(resSuccessDup.body.data.duplicate_warning, 'POTENTIAL_DUPLICATE');

        // 200 Success - Timeout (SKIPPED_TIMEOUT)
        questionsService.recheckQuestionAi = async (id) => ({
            id,
            status: 'DRAFT',
            ai_check_status: 'SKIPPED_TIMEOUT',
            ai_similarity_score: null,
            ai_review_state: null,
            is_duplicate: false,
            duplicate_warning: null,
            created_by: teacher1Id
        });
        const resTimeout = await request(app, 'POST', `/api/v1/questions/${questionId}/ai-recheck`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resTimeout.status, 200);
        assert.equal(resTimeout.body.code, 'SUCCESS');
        assert.equal(resTimeout.body.data.ai_check_status, 'SKIPPED_TIMEOUT');
        assert.equal(resTimeout.body.data.ai_similarity_score, null);
        assert.ok(resTimeout.body.message.includes('timed out'));

        // Admin có thể recheck câu hỏi của bất kỳ giáo viên nào
        const resAdmin = await request(app, 'POST', `/api/v1/questions/${questionId}/ai-recheck`, {
            headers: {Authorization: `Bearer ${adminToken}`}
        });
        assert.equal(resAdmin.status, 200);
    });

    await t.test('10. POST/PATCH/DELETE /question-types - Admin RBAC, Validation & CRUD', async () => {
        const typeId = '0199ac14-a9bc-7001-8000-000000000077';

        // Teacher cannot create question type (403)
        const resTeacherCreate = await request(app, 'POST', '/api/v1/question-types', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {code: 'TRUE_FALSE', name: 'Đúng / Sai'}
        });
        assert.equal(resTeacherCreate.status, 403);

        // Duplicate code conflict (409)
        questionTypesService.findQuestionTypeByCode = async (code) =>
            code === 'SINGLE_CHOICE' ? {id: typeId, code} : null;

        const resConflict = await request(app, 'POST', '/api/v1/question-types', {
            headers: {Authorization: `Bearer ${adminToken}`},
            body: {code: 'single_choice', name: 'Trắc nghiệm đơn'}
        });
        assert.equal(resConflict.status, 409);

        // Admin creates successfully (201)
        questionTypesService.createQuestionType = async ({code, name, description}) => ({
            id: typeId,
            code,
            name,
            description
        });
        const resCreate = await request(app, 'POST', '/api/v1/question-types', {
            headers: {Authorization: `Bearer ${adminToken}`},
            body: {code: 'true_false', name: 'Đúng / Sai', description: 'Câu hỏi 2 lựa chọn'}
        });
        assert.equal(resCreate.status, 201);
        assert.equal(resCreate.body.data.code, 'TRUE_FALSE');

        // Admin updates successfully (200)
        questionTypesService.findQuestionTypeById = async (id) =>
            id === typeId ? {id: typeId, code: 'TRUE_FALSE', name: 'Đúng / Sai', description: null} : null;
        questionTypesService.updateQuestionType = async (id, updates) => ({
            id,
            code: 'TRUE_FALSE',
            name: updates.name,
            description: null
        });
        const resPatch = await request(app, 'PATCH', `/api/v1/question-types/${typeId}`, {
            headers: {Authorization: `Bearer ${adminToken}`},
            body: {name: 'Đúng hoặc Sai'}
        });
        assert.equal(resPatch.status, 200);
        assert.equal(resPatch.body.data.name, 'Đúng hoặc Sai');

        // Delete conflict when in use (409)
        questionTypesService.isQuestionTypeInUse = async () => true;
        const resDeleteInUse = await request(app, 'DELETE', `/api/v1/question-types/${typeId}`, {
            headers: {Authorization: `Bearer ${adminToken}`}
        });
        assert.equal(resDeleteInUse.status, 409);

        // Delete success (200)
        questionTypesService.isQuestionTypeInUse = async () => false;
        let deletedByActor = null;
        questionTypesService.softDeleteQuestionType = async (id, actor) => {
            deletedByActor = actor;
            return {id};
        };
        const resDeleteOk = await request(app, 'DELETE', `/api/v1/question-types/${typeId}`, {
            headers: {Authorization: `Bearer ${adminToken}`}
        });
        assert.equal(resDeleteOk.status, 200);
        assert.equal(deletedByActor, adminId);
    });

    await t.test('11. POST /questions/:questionId/ai-override & Duplicate Status Guard', async () => {
        const questionId = '0199ac14-a9bc-7001-8000-000000000088';

        // Blank reason -> 400
        const resBadReason = await request(app, 'POST', `/api/v1/questions/${questionId}/ai-override`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {reason: '   '}
        });
        assert.equal(resBadReason.status, 400);

        // Non-owner teacher -> 403
        questionsService.findQuestionById = async (id) => ({
            id,
            created_by: teacher2Id,
            status: 'DRAFT',
            ai_check_status: 'CHECKED',
            ai_similarity_score: 0.91,
            is_duplicate_overridden: false
        });
        const resForbidden = await request(app, 'POST', `/api/v1/questions/${questionId}/ai-override`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {reason: 'Khác bối cảnh bài học'}
        });
        assert.equal(resForbidden.status, 403);

        // Un-overridden duplicate cannot be activated via PATCH /status -> 409
        questionsService.findQuestionById = async (id) => ({
            id,
            created_by: teacher1Id,
            status: 'DRAFT',
            ai_check_status: 'CHECKED',
            ai_similarity_score: 0.91,
            is_duplicate_overridden: false
        });
        const resBlockedActivate = await request(app, 'PATCH', `/api/v1/questions/${questionId}/status`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {status: 'ACTIVE'}
        });
        assert.equal(resBlockedActivate.status, 409);

        // Already overridden -> 409
        questionsService.findQuestionById = async (id) => ({
            id,
            created_by: teacher1Id,
            status: 'DRAFT',
            ai_check_status: 'OVERRIDDEN',
            is_duplicate_overridden: true
        });
        const resAlreadyOverridden = await request(app, 'POST', `/api/v1/questions/${questionId}/ai-override`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {reason: 'Lý do khác'}
        });
        assert.equal(resAlreadyOverridden.status, 409);

        // Success override -> 200
        questionsService.findQuestionById = async (id) => ({
            id,
            created_by: teacher1Id,
            status: 'DRAFT',
            ai_check_status: 'CHECKED',
            ai_similarity_score: 0.91,
            is_duplicate_overridden: false,
            ai_audit_metadata: {is_duplicate: true}
        });
        questionsService.overrideQuestionAi = async (id, {reason, overriddenBy}) => {
            assert.equal(overriddenBy, teacher1Id);
            assert.equal(reason, 'Dạng bài khác tham số');
            return {
                id,
                created_by: teacher1Id,
                status: 'DRAFT',
                ai_check_status: 'OVERRIDDEN',
                is_duplicate_overridden: true
            };
        };
        const resOk = await request(app, 'POST', `/api/v1/questions/${questionId}/ai-override`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {reason: 'Dạng bài khác tham số'}
        });
        assert.equal(resOk.status, 200);
        assert.equal(resOk.body.data.ai_check_status, 'OVERRIDDEN');
        assert.equal(resOk.body.data.is_duplicate_overridden, true);
    });

    await t.test('12. POST /questions/:questionId/clone & GET /questions/:questionId/versions', async () => {
        const questionId = '0199ac14-a9bc-7001-8000-000000000066';
        const clonedId = '0199ac14-a9bc-7001-8000-000000000067';

        // Clone: non-owner teacher -> 403
        questionsService.findQuestionById = async (id) => ({
            id,
            created_by: teacher2Id,
            type_id: '0199ac14-a9bc-7001-8000-000000000001',
            difficulty_level: 'MEDIUM',
            content: 'Original question',
            answer_spec: {schema_version: 1, kind: 'INPUT', equivalent_answers: ['42']}
        });
        const resCloneForbidden = await request(app, 'POST', `/api/v1/questions/${questionId}/clone`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resCloneForbidden.status, 403);

        // Clone: owner -> 201 DRAFT copy
        questionsService.findQuestionById = async (id) => ({
            id,
            created_by: teacher1Id,
            type_id: '0199ac14-a9bc-7001-8000-000000000001',
            difficulty_level: 'MEDIUM',
            content: 'Original question',
            answer_spec: {schema_version: 1, kind: 'INPUT', equivalent_answers: ['42']}
        });
        questionsService.cloneQuestion = async (existing, actorId) => {
            assert.equal(existing.id, questionId);
            assert.equal(actorId, teacher1Id);
            return {
                id: clonedId,
                status: 'DRAFT',
                ai_check_status: 'CHECKED',
                current_version_no: 1,
                content: existing.content,
                created_by: actorId
            };
        };
        const resCloneOk = await request(app, 'POST', `/api/v1/questions/${questionId}/clone`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resCloneOk.status, 201);
        assert.equal(resCloneOk.body.data.id, clonedId);
        assert.equal(resCloneOk.body.data.status, 'DRAFT');

        // Versions: invalid UUID -> 400
        const resBadVerId = await request(app, 'GET', '/api/v1/questions/not-a-uuid/versions', {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resBadVerId.status, 400);

        // Versions: 200 list
        questionsService.findQuestionVersions = async () => [
            {id: 'v1', question_id: questionId, version_no: 1, frozen_at: '2026-10-15T00:00:00Z', is_current: false, answer_spec: {kind: 'INPUT'}},
            {id: 'v2', question_id: questionId, version_no: 2, frozen_at: null, is_current: true, answer_spec: {kind: 'INPUT'}}
        ];
        const resVersions = await request(app, 'GET', `/api/v1/questions/${questionId}/versions`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resVersions.status, 200);
        assert.equal(resVersions.body.data.length, 2);
        assert.equal(resVersions.body.data[1].is_current, true);
    });

    await t.test('13. Service Integration: createQuestion & updateQuestion invoke AI Duplicate Check', async () => {
        restoreAllMocks();
        setupMockUsers();

        let storedQuestion = null;
        let storedVersion = null;
        let aiCalls = 0;

        supabase.from = (table) => {
            if (table === 'questions') {
                return {
                    insert(payload) {
                        storedQuestion = {...payload};
                        return {select: () => ({single: async () => ({data: storedQuestion, error: null})})};
                    },
                    update(payload) {
                        storedQuestion = {...storedQuestion, ...payload};
                        return {
                            eq() { return this; },
                            neq() { return this; },
                            is() { return Promise.resolve({data: storedQuestion, error: null}); },
                            then(resolve) { return Promise.resolve({data: storedQuestion, error: null}).then(resolve); }
                        };
                    },
                    select() {
                        return {
                            eq() { return this; },
                            is() { return this; },
                            maybeSingle: async () => ({
                                data: storedQuestion ? {...storedQuestion, question_versions: [storedVersion]} : null,
                                error: null
                            })
                        };
                    }
                };
            }
            if (table === 'question_versions') {
                return {
                    insert(payload) {
                        storedVersion = {...payload};
                        return {select: () => ({single: async () => ({data: storedVersion, error: null})})};
                    },
                    update(payload) {
                        storedVersion = {...storedVersion, ...payload};
                        return {eq: async () => ({data: storedVersion, error: null})};
                    }
                };
            }
            if (table === 'exam_variant_questions') {
                return {
                    select() {
                        return {eq: async () => ({count: 0, error: null})};
                    }
                };
            }
            throw new Error(`Unexpected table: ${table}`);
        };

        // Case A: Safe score (<0.80) + requested_status=ACTIVE -> auto-activates to ACTIVE
        aiCheckService.processQuestionAiCheck = async (qId) => {
            aiCalls++;
            storedQuestion.ai_check_status = 'CHECKED';
            storedQuestion.ai_similarity_score = 0.25;
            storedQuestion.ai_audit_metadata = {is_duplicate: false};
            return storedQuestion;
        };

        const createdSafe = await questionsService.createQuestion({
            type_id: '0199ac14-a9bc-7001-8000-000000000001',
            difficulty_level: 'EASY',
            content: 'Thủ đô của Việt Nam là gì?',
            requested_status: 'ACTIVE',
            answer_spec: {schema_version: 1, kind: 'INPUT', equivalent_answers: ['Hà Nội']},
            created_by: teacher1Id
        });
        assert.equal(aiCalls, 1);
        assert.equal(createdSafe.ai_check_status, 'CHECKED');
        assert.equal(createdSafe.status, 'ACTIVE');

        // Case B: Update content -> triggers re-check, duplicate >= 0.80 forces DRAFT
        aiCheckService.processQuestionAiCheck = async () => {
            aiCalls++;
            storedQuestion.ai_check_status = 'CHECKED';
            storedQuestion.ai_similarity_score = 0.91;
            storedQuestion.ai_audit_metadata = {is_duplicate: true, warning: 'POTENTIAL_DUPLICATE'};
            return storedQuestion;
        };

        const updatedDup = await questionsService.updateQuestion(
            storedQuestion.id,
            {content: 'Thành phố nào là thủ đô Việt Nam?', requested_status: 'ACTIVE'},
            {...storedQuestion, content: storedVersion.content, _rawVersion: storedVersion},
            teacher1Id
        );
        assert.equal(aiCalls, 2);
        assert.equal(updatedDup.ai_check_status, 'CHECKED');
        assert.equal(updatedDup.status, 'DRAFT');
        assert.equal(updatedDup.ai_review_state, 'NEEDS_TEACHER');

        // Case C: AI throws unexpected error -> fallback to SKIPPED_TIMEOUT & DRAFT
        aiCheckService.processQuestionAiCheck = async () => {
            throw new Error('ONNX runtime error');
        };
        const createdFallback = await questionsService.createQuestion({
            type_id: '0199ac14-a9bc-7001-8000-000000000001',
            difficulty_level: 'EASY',
            content: 'Câu hỏi khi AI gặp sự cố',
            requested_status: 'ACTIVE',
            answer_spec: {schema_version: 1, kind: 'INPUT', equivalent_answers: ['OK']},
            created_by: teacher1Id
        });
        assert.equal(createdFallback.ai_check_status, 'SKIPPED_TIMEOUT');
        assert.equal(createdFallback.status, 'DRAFT');
    });
});

