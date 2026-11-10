require('dotenv').config({quiet: true});

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {generateAccessToken} = require('./src/services/token.service');

const examsRoutes = require('./src/routes/exams.routes');
const pendingRoutes = require('./src/routes/pending.routes');

const examsService = require('./src/services/exams.service');
const subjectsService = require('./src/services/subjects.service');
const authService = require('./src/services/auth.service');

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        req.traceId = 'test_trace_id_exams';
        next();
    });
    app.use('/api/v1/exams', examsRoutes);
    app.use('/api/v1', pendingRoutes);

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
const originalFindSubjectById = subjectsService.findSubjectById;
const originalFindExams = examsService.findExams;
const originalFindExamById = examsService.findExamById;
const originalCreateExam = examsService.createExam;
const originalUpdateExam = examsService.updateExam;
const originalSoftDeleteExam = examsService.softDeleteExam;
const originalReplaceExamMatrix = examsService.replaceExamMatrix;
const originalReplaceExamGradingRules = examsService.replaceExamGradingRules;
const originalValidateExamMatrix = examsService.validateExamMatrix;
const originalFindExamVariants = examsService.findExamVariants;
const originalPublishExam = examsService.publishExam;
const originalGenerateExamVariants = examsService.generateExamVariants;

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
    subjectsService.findSubjectById = originalFindSubjectById;
    examsService.findExams = originalFindExams;
    examsService.findExamById = originalFindExamById;
    examsService.createExam = originalCreateExam;
    examsService.updateExam = originalUpdateExam;
    examsService.softDeleteExam = originalSoftDeleteExam;
    examsService.replaceExamMatrix = originalReplaceExamMatrix;
    examsService.replaceExamGradingRules = originalReplaceExamGradingRules;
    examsService.validateExamMatrix = originalValidateExamMatrix;
    examsService.findExamVariants = originalFindExamVariants;
    examsService.publishExam = originalPublishExam;
    examsService.generateExamVariants = originalGenerateExamVariants;
}

test('EXAMS MODULE UNIT & INTEGRATION TESTS (MOCK)', async (t) => {
    setupMockUsers();
    const app = createTestApp();

    t.after(() => {
        restoreAllMocks();
    });

    const validSubjectId = '0199ac14-a9bc-7001-8000-000000000001';
    const validExamId = '0199ac14-a9bc-7001-8000-000000000004';
    const validQuestionTypeId = '0199ac14-a9bc-7001-8000-000000000010';

    await t.test('1. Authentication & RBAC', async () => {
        // Missing token -> 401
        const resNoAuth = await request(app, 'GET', '/api/v1/exams');
        assert.equal(resNoAuth.status, 401);

        // Student -> 403
        const resStudent = await request(app, 'GET', '/api/v1/exams', {
            headers: {Authorization: `Bearer ${studentToken}`}
        });
        assert.equal(resStudent.status, 403);
    });

    await t.test('2. GET /exams - Query validation & pagination', async () => {
        examsService.findExams = async ({from, to, status, delivery_mode}) => {
            assert.equal(from, 0);
            assert.equal(to, 19);
            assert.equal(status, 'DRAFT');
            assert.equal(delivery_mode, 'ONLINE');
            return {
                exams: [
                    {
                        id: validExamId,
                        code: 'CSDL_GK_2026',
                        name: 'Giữa kỳ CSDL',
                        status: 'DRAFT',
                        delivery_mode: 'ONLINE',
                        total_questions: 40,
                        duration_minutes: 60,
                        total_score: 10
                    }
                ],
                total: 1
            };
        };

        const res = await request(app, 'GET', '/api/v1/exams?page=1&page_size=20&status=DRAFT&delivery_mode=ONLINE', {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.data.length, 1);
        assert.equal(res.body.data[0].code, 'CSDL_GK_2026');
        assert.equal(res.body.meta.pagination.page, 1);
        assert.equal(res.body.meta.pagination.total, 1);
    });

    await t.test('3. POST /exams - Validation, Subject check, & Creation', async () => {
        // Validation error: closes_at <= opens_at
        const resTimeErr = await request(app, 'POST', '/api/v1/exams', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {
                code: 'EXAM01',
                name: 'Kỳ thi thử',
                subject_id: validSubjectId,
                delivery_mode: 'ONLINE',
                total_questions: 10,
                duration_minutes: 15,
                opens_at: '2026-10-15T10:00:00Z',
                closes_at: '2026-10-15T09:00:00Z' // before opens_at!
            }
        });
        assert.equal(resTimeErr.status, 400);
        assert.match(resTimeErr.body.message, /closes_at must be strictly after opens_at/);

        // Subject not found
        subjectsService.findSubjectById = async () => null;
        const resSubNotFound = await request(app, 'POST', '/api/v1/exams', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {
                code: 'EXAM01',
                name: 'Kỳ thi thử',
                subject_id: validSubjectId,
                delivery_mode: 'ONLINE',
                total_questions: 10,
                duration_minutes: 15,
                opens_at: '2026-10-15T10:00:00Z',
                closes_at: '2026-10-15T12:00:00Z'
            }
        });
        assert.equal(resSubNotFound.status, 400);
        assert.match(resSubNotFound.body.message, /Subject not found/);

        // Success creation
        subjectsService.findSubjectById = async (id) => ({id, name: 'CSDL'});
        examsService.createExam = async (payload, createdBy) => {
            assert.equal(createdBy, teacher1Id);
            return {
                id: validExamId,
                ...payload,
                status: 'DRAFT',
                created_by: createdBy
            };
        };

        const resCreated = await request(app, 'POST', '/api/v1/exams', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {
                code: 'EXAM01',
                name: 'Kỳ thi thử',
                subject_id: validSubjectId,
                delivery_mode: 'ONLINE',
                total_questions: 10,
                duration_minutes: 15,
                opens_at: '2026-10-15T10:00:00Z',
                closes_at: '2026-10-15T12:00:00Z'
            }
        });
        assert.equal(resCreated.status, 201);
        assert.equal(resCreated.body.success, true);
        assert.equal(resCreated.body.data.id, validExamId);
        assert.equal(resCreated.body.data.status, 'DRAFT');

        // Conflict code 409
        examsService.createExam = async () => {
            const err = new Error('duplicate key');
            err.code = '23505';
            throw err;
        };
        const resConflict = await request(app, 'POST', '/api/v1/exams', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {
                code: 'EXAM01',
                name: 'Kỳ thi thử',
                subject_id: validSubjectId,
                delivery_mode: 'ONLINE',
                total_questions: 10,
                duration_minutes: 15,
                opens_at: '2026-10-15T10:00:00Z',
                closes_at: '2026-10-15T12:00:00Z'
            }
        });
        assert.equal(resConflict.status, 409);
        assert.equal(resConflict.body.code, 'CONFLICT');
    });

    await t.test('4. GET /exams/:examId - Detail & 404', async () => {
        // 404
        examsService.findExamById = async () => null;
        const resNotFound = await request(app, 'GET', `/api/v1/exams/${validExamId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resNotFound.status, 404);

        // 200
        examsService.findExamById = async (id) => ({
            id,
            code: 'EXAM01',
            name: 'Kỳ thi 01',
            status: 'DRAFT',
            total_questions: 20
        });
        const resSuccess = await request(app, 'GET', `/api/v1/exams/${validExamId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resSuccess.status, 200);
        assert.equal(resSuccess.body.data.code, 'EXAM01');
    });

    await t.test('5. PATCH /exams/:examId - Ownership, Status restriction & Update', async () => {
        // 403 when teacher edits another teacher's exam
        examsService.findExamById = async (id) => ({
            id,
            created_by: teacher2Id,
            status: 'DRAFT'
        });
        const resForbidden = await request(app, 'PATCH', `/api/v1/exams/${validExamId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'Updated Name'}
        });
        assert.equal(resForbidden.status, 403);

        // 409 when exam is not in DRAFT
        examsService.findExamById = async (id) => ({
            id,
            created_by: teacher1Id,
            status: 'PUBLISHED' // not DRAFT!
        });
        const resConflict = await request(app, 'PATCH', `/api/v1/exams/${validExamId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'Updated Name'}
        });
        assert.equal(resConflict.status, 409);
        assert.match(resConflict.body.message, /Cannot modify exam configuration after leaving DRAFT/);

        // 200 Success in DRAFT
        examsService.findExamById = async (id) => ({
            id,
            created_by: teacher1Id,
            status: 'DRAFT',
            opens_at: '2026-10-15T10:00:00Z',
            closes_at: '2026-10-15T12:00:00Z'
        });
        examsService.updateExam = async (id, updates) => ({
            id,
            ...updates,
            status: 'DRAFT'
        });
        const resSuccess = await request(app, 'PATCH', `/api/v1/exams/${validExamId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'Updated Exam Name'}
        });
        assert.equal(resSuccess.status, 200);
        assert.equal(resSuccess.body.data.name, 'Updated Exam Name');
    });

    await t.test('6. DELETE /exams/:examId - Status restriction & Soft delete', async () => {
        // 409 when not DRAFT
        examsService.findExamById = async (id) => ({
            id,
            created_by: teacher1Id,
            status: 'GENERATED'
        });
        const resConflict = await request(app, 'DELETE', `/api/v1/exams/${validExamId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resConflict.status, 409);

        // 200 Success
        examsService.findExamById = async (id) => ({
            id,
            created_by: teacher1Id,
            status: 'DRAFT'
        });
        examsService.softDeleteExam = async (id, deletedBy) => {
            assert.equal(deletedBy, teacher1Id);
            return {id};
        };
        const resDelete = await request(app, 'DELETE', `/api/v1/exams/${validExamId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resDelete.status, 200);
        assert.deepEqual(resDelete.body.data, {});
    });

    await t.test('7. PUT /exams/:examId/matrix - Matrix replace', async () => {
        examsService.findExamById = async (id) => ({
            id,
            created_by: teacher1Id,
            status: 'DRAFT'
        });

        examsService.replaceExamMatrix = async (id, rows) => rows;

        const res = await request(app, 'PUT', `/api/v1/exams/${validExamId}/matrix`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {
                rows: [
                    {
                        question_type_id: validQuestionTypeId,
                        difficulty_level: 'EASY',
                        num_questions: 10,
                        score_per_question: 0.5
                    }
                ]
            }
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.data.rows.length, 1);
    });

    await t.test('8. PUT /exams/:examId/grading-rules - Rules replace', async () => {
        examsService.findExamById = async (id) => ({
            id,
            created_by: teacher1Id,
            status: 'DRAFT'
        });

        examsService.replaceExamGradingRules = async (id, rules) => rules;

        const res = await request(app, 'PUT', `/api/v1/exams/${validExamId}/grading-rules`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {
                rules: [
                    {
                        question_type_id: validQuestionTypeId,
                        scoring_mode: 'EXACT_MATCH',
                        penalty_for_wrong: false,
                        case_sensitive: false
                    }
                ]
            }
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.data.rules.length, 1);
    });

    await t.test('9. POST /exams/:examId/matrix/validate - Validation calculation & issues', async () => {
        examsService.findExamById = async (id) => ({
            id,
            code: 'EXAM01',
            total_questions: 40,
            total_score: 10
        });

        // Mock validate result with mismatch
        examsService.validateExamMatrix = async () => ({
            valid: false,
            expected_questions: 40,
            matrix_questions: 30, // mismatch
            expected_score: 10,
            matrix_score: 7.5,
            issues: [
                {
                    code: 'TOTAL_QUESTIONS_MISMATCH',
                    requested: 40,
                    available: 30,
                    message: 'Matrix total questions does not match'
                }
            ]
        });

        const res = await request(app, 'POST', `/api/v1/exams/${validExamId}/matrix/validate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.data.valid, false);
        assert.equal(res.body.data.issues.length, 1);
    });

    await t.test('10. GET /exams/:examId/variants - Retrieve variants', async () => {
        examsService.findExamById = async (id) => ({id});
        examsService.findExamVariants = async (id) => [
            {id: 'v1', variant_code: '101', is_root: true, questions_count: 40},
            {id: 'v2', variant_code: '102', is_root: false, questions_count: 40}
        ];

        const res = await request(app, 'GET', `/api/v1/exams/${validExamId}/variants`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.data.length, 2);
        assert.equal(res.body.data[0].variant_code, '101');
    });

    await t.test('11. POST /exams/:examId/publish - Decision P-08 transition', async () => {
        // 409 Conflict if exam is still DRAFT (must be GENERATED first)
        examsService.findExamById = async (id) => ({
            id,
            created_by: teacher1Id,
            status: 'DRAFT'
        });
        const resDraftConflict = await request(app, 'POST', `/api/v1/exams/${validExamId}/publish`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resDraftConflict.status, 409);
        assert.match(resDraftConflict.body.message, /must be in GENERATED status before publishing/);

        // 200 Success when status is GENERATED
        examsService.findExamById = async (id) => ({
            id,
            created_by: teacher1Id,
            status: 'GENERATED'
        });
        examsService.publishExam = async (id) => ({
            id,
            status: 'PUBLISHED'
        });
        const resSuccess = await request(app, 'POST', `/api/v1/exams/${validExamId}/publish`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resSuccess.status, 200);
        assert.equal(resSuccess.body.data.status, 'PUBLISHED');
    });

    await t.test('12. POST /exams/:examId/generate - Atomic Variant Generation', async (t2) => {
        // 12.1. Validation & UUID errors
        const resInvalidUUID = await request(app, 'POST', '/api/v1/exams/not-a-uuid/generate', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {variant_count: 1, variant_code_start: '101'}
        });
        assert.equal(resInvalidUUID.status, 400);
        assert.equal(resInvalidUUID.body.code, 'VALIDATION_ERROR');

        // Missing fields
        const resMissing = await request(app, 'POST', `/api/v1/exams/${validExamId}/generate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {}
        });
        assert.equal(resMissing.status, 400);
        assert.match(resMissing.body.message, /variant_count is required/);

        // Invalid variant_count (< 1)
        const resInvalidCount = await request(app, 'POST', `/api/v1/exams/${validExamId}/generate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {variant_count: 0, variant_code_start: '101'}
        });
        assert.equal(resInvalidCount.status, 400);
        assert.match(resInvalidCount.body.message, /variant_count must be an integer/);

        // Invalid variant_count (> 100)
        const resTooMany = await request(app, 'POST', `/api/v1/exams/${validExamId}/generate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {variant_count: 101, variant_code_start: '101'}
        });
        assert.equal(resTooMany.status, 400);
        assert.match(resTooMany.body.message, /cannot exceed 100/);

        // Invalid variant_code_start (not 3-10 digits)
        const resInvalidCode = await request(app, 'POST', `/api/v1/exams/${validExamId}/generate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {variant_count: 1, variant_code_start: '12'}
        });
        assert.equal(resInvalidCode.status, 400);
        assert.match(resInvalidCode.body.message, /between 3 and 10 digits/);

        // Variant code overflow (> 10 digits when adding variant_count)
        const resOverflow = await request(app, 'POST', `/api/v1/exams/${validExamId}/generate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {variant_count: 5, variant_code_start: '9999999998'}
        });
        assert.equal(resOverflow.status, 400);
        assert.match(resOverflow.body.message, /exceed the maximum length of 10 digits/);

        // Unsupported fields
        const resExtra = await request(app, 'POST', `/api/v1/exams/${validExamId}/generate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {variant_count: 1, variant_code_start: '101', extra_param: true}
        });
        assert.equal(resExtra.status, 400);
        assert.match(resExtra.body.message, /unsupported fields/);

        // 12.2. 404 Exam Not Found
        examsService.findExamById = async () => null;
        const resNotFound = await request(app, 'POST', `/api/v1/exams/${validExamId}/generate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {variant_count: 1, variant_code_start: '101'}
        });
        assert.equal(resNotFound.status, 404);
        assert.equal(resNotFound.body.code, 'EXAM_NOT_FOUND');

        // 12.3. 403 Forbidden - Ownership check (Teacher 1 cannot generate Teacher 2's exam)
        examsService.findExamById = async (id) => ({
            id,
            created_by: teacher2Id,
            status: 'DRAFT'
        });
        const resForbidden = await request(app, 'POST', `/api/v1/exams/${validExamId}/generate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {variant_count: 1, variant_code_start: '101'}
        });
        assert.equal(resForbidden.status, 403);
        assert.equal(resForbidden.body.code, 'FORBIDDEN');

        // 12.4. 409 Conflict - Exam not in DRAFT status
        examsService.findExamById = async (id) => ({
            id,
            created_by: teacher1Id,
            status: 'GENERATED'
        });
        const resNotDraft = await request(app, 'POST', `/api/v1/exams/${validExamId}/generate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {variant_count: 1, variant_code_start: '101'}
        });
        assert.equal(resNotDraft.status, 409);
        assert.match(resNotDraft.body.message, /must be in DRAFT status/);

        // 12.5. 422 Unprocessable Entity - Rollback on matrix / pool failure
        examsService.findExamById = async (id) => ({
            id,
            created_by: teacher1Id,
            status: 'DRAFT'
        });
        examsService.generateExamVariants = async () => {
            const err = new Error('INSUFFICIENT_QUESTIONS: Matrix row requires 10 questions, but only 4 available in question bank');
            err.code = 'P0010';
            throw err;
        };
        const resInsufficient = await request(app, 'POST', `/api/v1/exams/${validExamId}/generate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {variant_count: 2, variant_code_start: '101'}
        });
        assert.equal(resInsufficient.status, 422);
        assert.equal(resInsufficient.body.code, 'UNPROCESSABLE_ENTITY');
        assert.match(resInsufficient.body.message, /INSUFFICIENT_QUESTIONS/);

        // 12.5b. 422 Unprocessable Entity - Invalid Matrix Chapter not belonging to exam subject
        examsService.generateExamVariants = async () => {
            const err = new Error('INVALID_MATRIX_CHAPTER: Matrix row references a chapter that does not belong to the exam subject or is deleted');
            err.code = 'P0011';
            throw err;
        };
        const resInvalidChapter = await request(app, 'POST', `/api/v1/exams/${validExamId}/generate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {variant_count: 2, variant_code_start: '101'}
        });
        assert.equal(resInvalidChapter.status, 422);
        assert.equal(resInvalidChapter.body.code, 'UNPROCESSABLE_ENTITY');
        assert.match(resInvalidChapter.body.message, /INVALID_MATRIX_CHAPTER/);

        // 12.6. 409 Conflict - Concurrent call / already generated / variant code collision
        examsService.generateExamVariants = async () => {
            const err = new Error('VARIANTS_ALREADY_EXIST: Exam already has generated variants');
            err.code = 'P0008';
            throw err;
        };
        const resConcurrent = await request(app, 'POST', `/api/v1/exams/${validExamId}/generate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {variant_count: 1, variant_code_start: '101'}
        });
        assert.equal(resConcurrent.status, 409);
        assert.equal(resConcurrent.body.code, 'CONFLICT');
        assert.match(resConcurrent.body.message, /VARIANTS_ALREADY_EXIST/);

        // 12.7. 201 Success - Generates Root Variant and Candidate Variants
        examsService.generateExamVariants = async (examId, {variant_count, variant_code_start}) => {
            const startNum = parseInt(variant_code_start, 10);
            const variants = [];
            for (let i = 0; i < variant_count; i++) {
                variants.push({
                    id: `0199ac14-a9bc-7001-8000-00000000000${i + 1}`,
                    variant_code: String(startNum + i),
                    is_root: i === 0,
                    questions_count: 10
                });
            }
            return {
                exam_id: examId,
                status: 'GENERATED',
                variants,
                generated_at: new Date().toISOString()
            };
        };

        const resSuccess = await request(app, 'POST', `/api/v1/exams/${validExamId}/generate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {variant_count: 2, variant_code_start: '101'}
        });
        assert.equal(resSuccess.status, 201);
        assert.equal(resSuccess.body.success, true);
        assert.equal(resSuccess.body.data.status, 'GENERATED');
        assert.equal(resSuccess.body.data.variants.length, 2);
        assert.equal(resSuccess.body.data.variants[0].variant_code, '101');
        assert.equal(resSuccess.body.data.variants[0].is_root, true);
        assert.equal(resSuccess.body.data.variants[1].variant_code, '102');
        assert.equal(resSuccess.body.data.variants[1].is_root, false);

        // 12.8. Exact variant code logic tests:
        // Rule: Root code is ALWAYS exactly variant_code_start.
        // Rule: "999" + count 2 -> "999", "1000" (no truncation, expands to 4 chars)
        // Rule: "009" + count 2 -> "009", "010" (maintains 3-digit padding)
        function generateCodeSequence(startCode, count) {
            const startNum = BigInt(startCode);
            const codeLen = startCode.length;
            const codes = [startCode];
            for (let i = 2; i <= count; i++) {
                const currNum = startNum + BigInt(i - 1);
                const currStr = currNum.toString();
                codes.push(currStr.length < codeLen ? currStr.padStart(codeLen, '0') : currStr);
            }
            return codes;
        }

        assert.deepEqual(generateCodeSequence('999', 2), ['999', '1000']);
        assert.deepEqual(generateCodeSequence('009', 2), ['009', '010']);
        assert.deepEqual(generateCodeSequence('101', 3), ['101', '102', '103']);

        examsService.generateExamVariants = async (examId, {variant_count, variant_code_start}) => {
            const codes = generateCodeSequence(variant_code_start, variant_count);
            return {
                exam_id: examId,
                status: 'GENERATED',
                variants: codes.map((c, i) => ({
                    id: `0199ac14-a9bc-7001-8000-00000000000${i + 1}`,
                    variant_code: c,
                    is_root: i === 0,
                    questions_count: 10
                })),
                generated_at: new Date().toISOString()
            };
        };

        const res999 = await request(app, 'POST', `/api/v1/exams/${validExamId}/generate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {variant_count: 2, variant_code_start: '999'}
        });
        assert.equal(res999.status, 201);
        assert.equal(res999.body.data.variants[0].variant_code, '999');
        assert.equal(res999.body.data.variants[1].variant_code, '1000');

        const res009 = await request(app, 'POST', `/api/v1/exams/${validExamId}/generate`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {variant_count: 2, variant_code_start: '009'}
        });
        assert.equal(res009.status, 201);
        assert.equal(res009.body.data.variants[0].variant_code, '009');
        assert.equal(res009.body.data.variants[1].variant_code, '010');
    });
});
