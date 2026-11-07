require('dotenv').config({quiet: true});

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {generateAccessToken} = require('./src/services/token.service');

const subjectsRoutes = require('./src/routes/subjects.routes');
const chaptersRoutes = require('./src/routes/chapters.routes');
const subjectsService = require('./src/services/subjects.service');
const chaptersService = require('./src/services/chapters.service');
const authService = require('./src/services/auth.service');

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        req.traceId = 'test_trace_chapters';
        next();
    });
    app.use('/api/v1/subjects', subjectsRoutes);
    app.use('/api/v1/chapters', chaptersRoutes);

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
const originalFindChaptersBySubjectId = chaptersService.findChaptersBySubjectId;
const originalFindChapterById = chaptersService.findChapterById;
const originalCreateChapter = chaptersService.createChapter;
const originalUpdateChapter = chaptersService.updateChapter;
const originalCountActiveLessonsByChapterId = chaptersService.countActiveLessonsByChapterId;
const originalSoftDeleteChapter = chaptersService.softDeleteChapter;

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
    chaptersService.findChaptersBySubjectId = originalFindChaptersBySubjectId;
    chaptersService.findChapterById = originalFindChapterById;
    chaptersService.createChapter = originalCreateChapter;
    chaptersService.updateChapter = originalUpdateChapter;
    chaptersService.countActiveLessonsByChapterId = originalCountActiveLessonsByChapterId;
    chaptersService.softDeleteChapter = originalSoftDeleteChapter;
}

test('CHAPTERS MODULE UNIT & INTEGRATION TESTS (MOCK)', async (t) => {
    setupMockUsers();
    const app = createTestApp();

    const sampleSubjectId = '0199ac14-a9bc-7001-8000-000000000001';
    const sampleChapterId = '0199ac14-a9bc-7001-8000-000000000010';

    t.after(() => {
        restoreAllMocks();
    });

    await t.test('1. Authentication & RBAC', async () => {
        // Missing token -> 401
        const resNoAuth = await request(app, 'GET', `/api/v1/subjects/${sampleSubjectId}/chapters`);
        assert.equal(resNoAuth.status, 401);
        assert.equal(resNoAuth.body.code, 'ACCESS_TOKEN_MISSING');

        // Student role -> 403
        const resStudent = await request(app, 'GET', `/api/v1/subjects/${sampleSubjectId}/chapters`, {
            headers: {Authorization: `Bearer ${studentToken}`}
        });
        assert.equal(resStudent.status, 403);
        assert.equal(resStudent.body.code, 'FORBIDDEN');
    });

    await t.test('2. GET /subjects/:subjectId/chapters', async () => {
        // Invalid UUID
        const resInvalidUUID = await request(app, 'GET', '/api/v1/subjects/invalid-uuid/chapters', {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resInvalidUUID.status, 400);
        assert.equal(resInvalidUUID.body.code, 'VALIDATION_ERROR');

        // Subject not found
        subjectsService.findSubjectById = async (id) => null;
        const resSubjectNotFound = await request(app, 'GET', `/api/v1/subjects/${sampleSubjectId}/chapters`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resSubjectNotFound.status, 404);
        assert.equal(resSubjectNotFound.body.code, 'SUBJECT_NOT_FOUND');

        // Success
        subjectsService.findSubjectById = async (id) => ({id: sampleSubjectId, name: 'Toán', created_by: teacher1Id});
        chaptersService.findChaptersBySubjectId = async (id) => [
            {id: sampleChapterId, subject_id: sampleSubjectId, code: 'CH01', name: 'Chương 1: Giải tích', order_no: 1}
        ];

        const resSuccess = await request(app, 'GET', `/api/v1/subjects/${sampleSubjectId}/chapters`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resSuccess.status, 200);
        assert.equal(resSuccess.body.success, true);
        assert.equal(resSuccess.body.data.length, 1);
        assert.equal(resSuccess.body.data[0].code, 'CH01');
    });

    await t.test('3. POST /subjects/:subjectId/chapters - Validation, Ownership (P-02) & Creation', async () => {
        subjectsService.findSubjectById = async (id) => ({id: sampleSubjectId, name: 'Toán', created_by: teacher1Id});

        // Unsupported fields
        const resUnsupported = await request(app, 'POST', `/api/v1/subjects/${sampleSubjectId}/chapters`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'Chương mới', hack: true}
        });
        assert.equal(resUnsupported.status, 400);
        assert.equal(resUnsupported.body.code, 'VALIDATION_ERROR');

        // Missing name
        const resMissingName = await request(app, 'POST', `/api/v1/subjects/${sampleSubjectId}/chapters`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {order_no: 1}
        });
        assert.equal(resMissingName.status, 400);
        assert.equal(resMissingName.body.code, 'VALIDATION_ERROR');

        // Invalid order_no
        const resInvalidOrder = await request(app, 'POST', `/api/v1/subjects/${sampleSubjectId}/chapters`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'Chương mới', order_no: -5}
        });
        assert.equal(resInvalidOrder.status, 400);
        assert.equal(resInvalidOrder.body.code, 'VALIDATION_ERROR');

        // Teacher 2 (not owner) -> 403
        const resNotOwner = await request(app, 'POST', `/api/v1/subjects/${sampleSubjectId}/chapters`, {
            headers: {Authorization: `Bearer ${teacher2Token}`},
            body: {name: 'Chương mới'}
        });
        assert.equal(resNotOwner.status, 403);
        assert.equal(resNotOwner.body.code, 'FORBIDDEN');

        // Duplicate code -> 409
        chaptersService.createChapter = async () => {
            const err = new Error('Duplicate key');
            err.code = '23505';
            throw err;
        };
        const resDuplicate = await request(app, 'POST', `/api/v1/subjects/${sampleSubjectId}/chapters`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {code: 'CH01', name: 'Chương 1'}
        });
        assert.equal(resDuplicate.status, 409);
        assert.equal(resDuplicate.body.code, 'CONFLICT');

        // Success creation by Owner Teacher
        chaptersService.createChapter = async ({subjectId, code, name, orderNo}) => {
            return {
                id: sampleChapterId,
                subject_id: subjectId,
                code,
                name,
                order_no: orderNo ?? 0
            };
        };
        const resSuccess = await request(app, 'POST', `/api/v1/subjects/${sampleSubjectId}/chapters`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {code: 'CH02', name: 'Chương 2: Hình học', order_no: 2}
        });
        assert.equal(resSuccess.status, 201);
        assert.equal(resSuccess.body.data.name, 'Chương 2: Hình học');
        assert.equal(resSuccess.body.data.order_no, 2);

        // Success creation by Admin (even if not owner)
        const resAdminSuccess = await request(app, 'POST', `/api/v1/subjects/${sampleSubjectId}/chapters`, {
            headers: {Authorization: `Bearer ${adminToken}`},
            body: {code: 'CH03', name: 'Chương 3: Đại số'}
        });
        assert.equal(resAdminSuccess.status, 201);
    });

    await t.test('4. PATCH /chapters/:chapterId - Validation, Ownership (P-02) & Update', async () => {
        // Invalid UUID
        const resInvalidUUID = await request(app, 'PATCH', '/api/v1/chapters/invalid-uuid', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'Tên mới'}
        });
        assert.equal(resInvalidUUID.status, 400);
        assert.equal(resInvalidUUID.body.code, 'VALIDATION_ERROR');

        // Empty body
        const resEmptyBody = await request(app, 'PATCH', `/api/v1/chapters/${sampleChapterId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {}
        });
        assert.equal(resEmptyBody.status, 400);
        assert.equal(resEmptyBody.body.code, 'VALIDATION_ERROR');

        // Chapter not found
        chaptersService.findChapterById = async () => null;
        const resNotFound = await request(app, 'PATCH', `/api/v1/chapters/${sampleChapterId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'Chương sửa'}
        });
        assert.equal(resNotFound.status, 404);
        assert.equal(resNotFound.body.code, 'CHAPTER_NOT_FOUND');

        // Chapter found, check owner
        chaptersService.findChapterById = async () => ({
            id: sampleChapterId,
            subject_id: sampleSubjectId,
            name: 'Chương cũ'
        });
        subjectsService.findSubjectById = async () => ({
            id: sampleSubjectId,
            created_by: teacher1Id
        });

        // Teacher 2 not owner -> 403
        const resNotOwner = await request(app, 'PATCH', `/api/v1/chapters/${sampleChapterId}`, {
            headers: {Authorization: `Bearer ${teacher2Token}`},
            body: {name: 'Chương sửa'}
        });
        assert.equal(resNotOwner.status, 403);
        assert.equal(resNotOwner.body.code, 'FORBIDDEN');

        // Duplicate code -> 409
        chaptersService.updateChapter = async () => {
            const err = new Error('Duplicate key');
            err.code = '23505';
            throw err;
        };
        const resDuplicate = await request(app, 'PATCH', `/api/v1/chapters/${sampleChapterId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {code: 'EXISTS'}
        });
        assert.equal(resDuplicate.status, 409);
        assert.equal(resDuplicate.body.code, 'CONFLICT');

        // Success update
        chaptersService.updateChapter = async (id, updates) => ({
            id,
            subject_id: sampleSubjectId,
            code: updates.code,
            name: updates.name || 'Chương cũ',
            order_no: updates.order_no ?? 1
        });
        const resSuccess = await request(app, 'PATCH', `/api/v1/chapters/${sampleChapterId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'Chương 1: Đổi tên', order_no: 5}
        });
        assert.equal(resSuccess.status, 200);
        assert.equal(resSuccess.body.data.name, 'Chương 1: Đổi tên');
        assert.equal(resSuccess.body.data.order_no, 5);
    });

    await t.test('5. DELETE /chapters/:chapterId - Soft Delete & Active Lessons Constraint', async () => {
        chaptersService.findChapterById = async () => ({
            id: sampleChapterId,
            subject_id: sampleSubjectId,
            name: 'Chương 1'
        });
        subjectsService.findSubjectById = async () => ({
            id: sampleSubjectId,
            created_by: teacher1Id
        });

        // Teacher 2 not owner -> 403
        const resNotOwner = await request(app, 'DELETE', `/api/v1/chapters/${sampleChapterId}`, {
            headers: {Authorization: `Bearer ${teacher2Token}`}
        });
        assert.equal(resNotOwner.status, 403);
        assert.equal(resNotOwner.body.code, 'FORBIDDEN');

        // Active lessons exist -> 409
        chaptersService.countActiveLessonsByChapterId = async () => 3;
        const resHasLessons = await request(app, 'DELETE', `/api/v1/chapters/${sampleChapterId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resHasLessons.status, 409);
        assert.equal(resHasLessons.body.code, 'CHAPTER_HAS_LESSONS');

        // Success soft delete (no active lessons)
        chaptersService.countActiveLessonsByChapterId = async () => 0;
        let deleted = false;
        chaptersService.softDeleteChapter = async (id, deletedBy) => {
            assert.equal(id, sampleChapterId);
            assert.equal(deletedBy, teacher1Id);
            deleted = true;
            return {id};
        };

        const resSuccess = await request(app, 'DELETE', `/api/v1/chapters/${sampleChapterId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resSuccess.status, 200);
        assert.equal(resSuccess.body.success, true);
        assert.equal(deleted, true);
    });
});
