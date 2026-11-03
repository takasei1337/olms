require('dotenv').config({quiet: true});

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
const originalFindQuestions = questionsService.findQuestions;
const originalFindQuestionById = questionsService.findQuestionById;
const originalCreateQuestion = questionsService.createQuestion;
const originalUpdateQuestion = questionsService.updateQuestion;
const originalUpdateQuestionStatus = questionsService.updateQuestionStatus;
const originalIsQuestionUsedInExams = questionsService.isQuestionUsedInExams;
const originalSoftDeleteQuestion = questionsService.softDeleteQuestion;

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
    questionsService.findQuestions = originalFindQuestions;
    questionsService.findQuestionById = originalFindQuestionById;
    questionsService.createQuestion = originalCreateQuestion;
    questionsService.updateQuestion = originalUpdateQuestion;
    questionsService.updateQuestionStatus = originalUpdateQuestionStatus;
    questionsService.isQuestionUsedInExams = originalIsQuestionUsedInExams;
    questionsService.softDeleteQuestion = originalSoftDeleteQuestion;
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
        questionsService.findQuestions = async ({from, to, difficulty_level, status}) => {
            assert.equal(from, 0);
            assert.equal(to, 19);
            assert.equal(difficulty_level, 'EASY');
            assert.equal(status, 'DRAFT');
            return {
                questions: [
                    {
                        id: '0199ac14-a9bc-7001-8000-000000000002',
                        type_id: '0199ac14-a9bc-7001-8000-000000000001',
                        status: 'DRAFT',
                        ai_check_status: 'SKIPPED_TIMEOUT',
                        content: '2 + 3 = ?',
                        difficulty_level: 'EASY'
                    }
                ],
                total: 1
            };
        };

        const res = await request(app, 'GET', '/api/v1/questions?page=1&page_size=20&difficulty_level=EASY&status=DRAFT', {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.data.length, 1);
        assert.equal(res.body.data[0].content, '2 + 3 = ?');
        assert.equal(res.body.meta.pagination.page, 1);
        assert.equal(res.body.meta.pagination.total, 1);
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

        // Success creation
        questionsService.createQuestion = async ({content, difficulty_level, type_id, created_by}) => {
            assert.equal(created_by, teacher1Id);
            return {
                id: '0199ac14-a9bc-7001-8000-000000000099',
                type_id,
                status: 'DRAFT',
                ai_check_status: 'SKIPPED_TIMEOUT',
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
});

