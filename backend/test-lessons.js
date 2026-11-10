require('dotenv').config({quiet: true});
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-secret-key-12345';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {generateAccessToken} = require('./src/services/token.service');

const chaptersRoutes = require('./src/routes/chapters.routes');
const lessonsRoutes = require('./src/routes/lessons.routes');
const subjectsService = require('./src/services/subjects.service');
const chaptersService = require('./src/services/chapters.service');
const lessonsService = require('./src/services/lessons.service');
const authService = require('./src/services/auth.service');

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        req.traceId = 'test_trace_lessons';
        next();
    });
    app.use('/api/v1/chapters', chaptersRoutes);
    app.use('/api/v1/lessons', lessonsRoutes);

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
const teacher2Token = generateAccessToken({id: teacher2Id, role: 'TEACHER'});
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
            body: body !== null ? JSON.stringify(body) : undefined
        };

        const res = await fetch(`http://127.0.0.1:${port}${path}`, fetchOptions);
        let responseBody = null;
        const text = await res.text();
        try {
            responseBody = JSON.parse(text);
        } catch {
            responseBody = text;
        }

        return {
            status: res.status,
            headers: res.headers,
            body: responseBody
        };
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

const originalFindActiveUserById = authService.findActiveUserById;
const originalFindSubjectById = subjectsService.findSubjectById;
const originalFindChapterById = chaptersService.findChapterById;
const originalFindLessonsByChapterId = lessonsService.findLessonsByChapterId;
const originalFindLessonById = lessonsService.findLessonById;
const originalCreateLesson = lessonsService.createLesson;
const originalUpdateLesson = lessonsService.updateLesson;
const originalCountActiveQuestionsByLessonId = lessonsService.countActiveQuestionsByLessonId;
const originalSoftDeleteLesson = lessonsService.softDeleteLesson;

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
    chaptersService.findChapterById = originalFindChapterById;
    lessonsService.findLessonsByChapterId = originalFindLessonsByChapterId;
    lessonsService.findLessonById = originalFindLessonById;
    lessonsService.createLesson = originalCreateLesson;
    lessonsService.updateLesson = originalUpdateLesson;
    lessonsService.countActiveQuestionsByLessonId = originalCountActiveQuestionsByLessonId;
    lessonsService.softDeleteLesson = originalSoftDeleteLesson;
}

test('LESSONS MODULE UNIT & INTEGRATION TESTS (MOCK)', async (t) => {
    setupMockUsers();
    const app = createTestApp();

    const sampleSubjectId = '0199ac14-a9bc-7001-8000-000000000001';
    const sampleChapterId = '0199ac14-a9bc-7001-8000-000000000010';
    const sampleLessonId = '0199ac14-a9bc-7001-8000-000000000100';

    t.after(() => {
        restoreAllMocks();
    });

    await t.test('1. Authentication & RBAC', async () => {
        // Missing token -> 401
        const resNoAuth = await request(app, 'GET', `/api/v1/chapters/${sampleChapterId}/lessons`);
        assert.equal(resNoAuth.status, 401);
        assert.equal(resNoAuth.body.code, 'ACCESS_TOKEN_MISSING');

        // Student role -> 403
        const resStudent = await request(app, 'GET', `/api/v1/chapters/${sampleChapterId}/lessons`, {
            headers: {Authorization: `Bearer ${studentToken}`}
        });
        assert.equal(resStudent.status, 403);
        assert.equal(resStudent.body.code, 'FORBIDDEN');
    });

    await t.test('2. GET /chapters/:chapterId/lessons', async () => {
        // Invalid UUID
        const resInvalidUUID = await request(app, 'GET', '/api/v1/chapters/invalid-uuid/lessons', {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resInvalidUUID.status, 400);
        assert.equal(resInvalidUUID.body.code, 'VALIDATION_ERROR');

        // Chapter not found
        chaptersService.findChapterById = async () => null;
        const resChapterNotFound = await request(app, 'GET', `/api/v1/chapters/${sampleChapterId}/lessons`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resChapterNotFound.status, 404);
        assert.equal(resChapterNotFound.body.code, 'CHAPTER_NOT_FOUND');

        // Success
        chaptersService.findChapterById = async (id) => ({
            id: sampleChapterId,
            subject_id: sampleSubjectId,
            name: 'Chương 1'
        });
        lessonsService.findLessonsByChapterId = async (cId) => [
            {id: sampleLessonId, chapter_id: sampleChapterId, code: 'LES01', name: 'Bài 1: Giới hạn', order_no: 1}
        ];

        const resSuccess = await request(app, 'GET', `/api/v1/chapters/${sampleChapterId}/lessons`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resSuccess.status, 200);
        assert.equal(resSuccess.body.success, true);
        assert.equal(resSuccess.body.data.length, 1);
        assert.equal(resSuccess.body.data[0].code, 'LES01');
    });

    await t.test('3. POST /chapters/:chapterId/lessons - Validation, Ownership (P-02) & Creation', async () => {
        chaptersService.findChapterById = async () => ({
            id: sampleChapterId,
            subject_id: sampleSubjectId,
            name: 'Chương 1'
        });
        subjectsService.findSubjectById = async () => ({
            id: sampleSubjectId,
            created_by: teacher1Id
        });

        // Unsupported fields
        const resUnsupported = await request(app, 'POST', `/api/v1/chapters/${sampleChapterId}/lessons`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'Bài mới', hack: true}
        });
        assert.equal(resUnsupported.status, 400);
        assert.equal(resUnsupported.body.code, 'VALIDATION_ERROR');

        // Missing name
        const resMissingName = await request(app, 'POST', `/api/v1/chapters/${sampleChapterId}/lessons`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {order_no: 1}
        });
        assert.equal(resMissingName.status, 400);
        assert.equal(resMissingName.body.code, 'VALIDATION_ERROR');

        // Teacher 2 (not owner) -> 403
        const resNotOwner = await request(app, 'POST', `/api/v1/chapters/${sampleChapterId}/lessons`, {
            headers: {Authorization: `Bearer ${teacher2Token}`},
            body: {name: 'Bài mới'}
        });
        assert.equal(resNotOwner.status, 403);
        assert.equal(resNotOwner.body.code, 'FORBIDDEN');

        // Duplicate code -> 409
        lessonsService.createLesson = async () => {
            const err = new Error('Duplicate key');
            err.code = '23505';
            throw err;
        };
        const resDuplicate = await request(app, 'POST', `/api/v1/chapters/${sampleChapterId}/lessons`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {code: 'LES01', name: 'Bài 1'}
        });
        assert.equal(resDuplicate.status, 409);
        assert.equal(resDuplicate.body.code, 'CONFLICT');

        // Success creation by Owner Teacher
        lessonsService.createLesson = async ({chapterId, code, name, orderNo}) => ({
            id: sampleLessonId,
            chapter_id: chapterId,
            code,
            name,
            order_no: orderNo ?? 0
        });
        const resSuccess = await request(app, 'POST', `/api/v1/chapters/${sampleChapterId}/lessons`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {code: 'LES02', name: 'Bài 2: Tính liên tục', order_no: 2}
        });
        assert.equal(resSuccess.status, 201);
        assert.equal(resSuccess.body.data.name, 'Bài 2: Tính liên tục');
        assert.equal(resSuccess.body.data.order_no, 2);

        // Success creation by Admin
        const resAdminSuccess = await request(app, 'POST', `/api/v1/chapters/${sampleChapterId}/lessons`, {
            headers: {Authorization: `Bearer ${adminToken}`},
            body: {code: 'LES03', name: 'Bài 3: Đạo hàm'}
        });
        assert.equal(resAdminSuccess.status, 201);
    });

    await t.test('4. PATCH /lessons/:lessonId - Validation, Ownership (P-02) & Update', async () => {
        // Invalid UUID
        const resInvalidUUID = await request(app, 'PATCH', '/api/v1/lessons/invalid-uuid', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'Tên mới'}
        });
        assert.equal(resInvalidUUID.status, 400);
        assert.equal(resInvalidUUID.body.code, 'VALIDATION_ERROR');

        // Empty body
        const resEmptyBody = await request(app, 'PATCH', `/api/v1/lessons/${sampleLessonId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {}
        });
        assert.equal(resEmptyBody.status, 400);
        assert.equal(resEmptyBody.body.code, 'VALIDATION_ERROR');

        // Lesson not found
        lessonsService.findLessonById = async () => null;
        const resNotFound = await request(app, 'PATCH', `/api/v1/lessons/${sampleLessonId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'Sửa tên bài'}
        });
        assert.equal(resNotFound.status, 404);
        assert.equal(resNotFound.body.code, 'LESSON_NOT_FOUND');

        // Lesson found, check owner
        lessonsService.findLessonById = async () => ({
            id: sampleLessonId,
            chapter_id: sampleChapterId,
            name: 'Bài cũ'
        });
        chaptersService.findChapterById = async () => ({
            id: sampleChapterId,
            subject_id: sampleSubjectId
        });
        subjectsService.findSubjectById = async () => ({
            id: sampleSubjectId,
            created_by: teacher1Id
        });

        // Teacher 2 not owner -> 403
        const resNotOwner = await request(app, 'PATCH', `/api/v1/lessons/${sampleLessonId}`, {
            headers: {Authorization: `Bearer ${teacher2Token}`},
            body: {name: 'Sửa tên bài'}
        });
        assert.equal(resNotOwner.status, 403);
        assert.equal(resNotOwner.body.code, 'FORBIDDEN');

        // Duplicate code -> 409
        lessonsService.updateLesson = async () => {
            const err = new Error('Duplicate key');
            err.code = '23505';
            throw err;
        };
        const resDuplicate = await request(app, 'PATCH', `/api/v1/lessons/${sampleLessonId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {code: 'EXISTS'}
        });
        assert.equal(resDuplicate.status, 409);
        assert.equal(resDuplicate.body.code, 'CONFLICT');

        // Success update
        lessonsService.updateLesson = async (id, updates) => ({
            id,
            chapter_id: sampleChapterId,
            code: updates.code,
            name: updates.name || 'Bài cũ',
            order_no: updates.order_no ?? 1
        });
        const resSuccess = await request(app, 'PATCH', `/api/v1/lessons/${sampleLessonId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'Bài 1: Giới hạn dãy số (Cập nhật)', order_no: 3}
        });
        assert.equal(resSuccess.status, 200);
        assert.equal(resSuccess.body.data.name, 'Bài 1: Giới hạn dãy số (Cập nhật)');
        assert.equal(resSuccess.body.data.order_no, 3);
    });

    await t.test('5. DELETE /lessons/:lessonId - Soft Delete & Active Questions Constraint', async () => {
        lessonsService.findLessonById = async () => ({
            id: sampleLessonId,
            chapter_id: sampleChapterId,
            name: 'Bài 1'
        });
        chaptersService.findChapterById = async () => ({
            id: sampleChapterId,
            subject_id: sampleSubjectId
        });
        subjectsService.findSubjectById = async () => ({
            id: sampleSubjectId,
            created_by: teacher1Id
        });

        // Teacher 2 not owner -> 403
        const resNotOwner = await request(app, 'DELETE', `/api/v1/lessons/${sampleLessonId}`, {
            headers: {Authorization: `Bearer ${teacher2Token}`}
        });
        assert.equal(resNotOwner.status, 403);
        assert.equal(resNotOwner.body.code, 'FORBIDDEN');

        // Active questions exist -> 409
        lessonsService.countActiveQuestionsByLessonId = async () => 5;
        const resHasQuestions = await request(app, 'DELETE', `/api/v1/lessons/${sampleLessonId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resHasQuestions.status, 409);
        assert.equal(resHasQuestions.body.code, 'LESSON_HAS_QUESTIONS');

        // Success soft delete (no active questions)
        lessonsService.countActiveQuestionsByLessonId = async () => 0;
        let deleted = false;
        lessonsService.softDeleteLesson = async (id, deletedBy) => {
            assert.equal(id, sampleLessonId);
            assert.equal(deletedBy, teacher1Id);
            deleted = true;
            return {id};
        };

        const resSuccess = await request(app, 'DELETE', `/api/v1/lessons/${sampleLessonId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resSuccess.status, 200);
        assert.equal(resSuccess.body.success, true);
        assert.equal(deleted, true);
    });
});
