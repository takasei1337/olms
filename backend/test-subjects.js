require('dotenv').config({quiet: true});
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-secret-key-12345';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {generateAccessToken} = require('./src/services/token.service');

// Import routers and middleware to test
const subjectsRoutes = require('./src/routes/subjects.routes');
const subjectsService = require('./src/services/subjects.service');
const authService = require('./src/services/auth.service');

// Helper to create test app with subjects route
function createTestApp() {
    const app = express();
    app.use(express.json());
    // Attach mock traceId
    app.use((req, res, next) => {
        req.traceId = 'test_trace_id_123';
        next();
    });
    app.use('/api/v1/subjects', subjectsRoutes);

    // Global error handler like app.js
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

// Generate valid tokens
const adminId = '38a25dbd-d764-4ba6-a4bc-3729e337c0b4';
const teacher1Id = '34b637d7-bba1-4d55-b61e-f59493fdc2e8';
const teacher2Id = '44444444-4444-4444-8444-444444444444';
const studentId = 'f1a8a03e-9d91-4df4-a69c-299b5a259697';

const adminToken = generateAccessToken({id: adminId, role: 'ADMIN'});
const teacher1Token = generateAccessToken({id: teacher1Id, role: 'TEACHER'});
const studentToken = generateAccessToken({id: studentId, role: 'STUDENT'});

// Helper to make request to express app using node's http server
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

// Save original services
const originalFindActiveUserById = authService.findActiveUserById;
const originalFindSubjects = subjectsService.findSubjects;
const originalFindSubjectById = subjectsService.findSubjectById;
const originalCreateSubject = subjectsService.createSubject;
const originalUpdateSubject = subjectsService.updateSubject;
const originalSoftDeleteSubject = subjectsService.softDeleteSubject;

function setupMockUsers() {
    authService.findActiveUserById = async (id) => {
        if (id === adminId) return {id: adminId, role: 'ADMIN', status: 'ACTIVE'};
        if (id === teacher1Id) return {id: teacher1Id, role: 'TEACHER', status: 'ACTIVE'};
        if (id === studentId) return {id: studentId, role: 'STUDENT', status: 'ACTIVE'};
        return null;
    };
}

function restoreAllMocks() {
    authService.findActiveUserById = originalFindActiveUserById;
    subjectsService.findSubjects = originalFindSubjects;
    subjectsService.findSubjectById = originalFindSubjectById;
    subjectsService.createSubject = originalCreateSubject;
    subjectsService.updateSubject = originalUpdateSubject;
    subjectsService.softDeleteSubject = originalSoftDeleteSubject;
}

test('SUBJECTS MODULE UNIT & INTEGRATION TESTS (MOCK)', async (t) => {
    setupMockUsers();
    const app = createTestApp();

    t.after(() => {
        restoreAllMocks();
    });

    await t.test('1. Authentication & RBAC', async () => {
        // Missing token -> 401
        const resNoAuth = await request(app, 'GET', '/api/v1/subjects');
        assert.equal(resNoAuth.status, 401);
        assert.equal(resNoAuth.body.code, 'ACCESS_TOKEN_MISSING');

        // Student role -> 403
        const resStudent = await request(app, 'GET', '/api/v1/subjects', {
            headers: {Authorization: `Bearer ${studentToken}`}
        });
        assert.equal(resStudent.status, 403);
        assert.equal(resStudent.body.code, 'FORBIDDEN');
    });

    await t.test('2. GET /subjects - Query validation & pagination', async () => {
        // Invalid page
        const resInvalidPage = await request(app, 'GET', '/api/v1/subjects?page=-1', {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resInvalidPage.status, 400);
        assert.equal(resInvalidPage.body.code, 'VALIDATION_ERROR');

        // Invalid page_size > 100
        const resInvalidPageSize = await request(app, 'GET', '/api/v1/subjects?page_size=150', {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resInvalidPageSize.status, 400);
        assert.equal(resInvalidPageSize.body.code, 'VALIDATION_ERROR');

        // Success GET with pagination
        subjectsService.findSubjects = async (from, to, q) => {
            assert.equal(from, 0);
            assert.equal(to, 19);
            return {
                subjects: [
                    {id: '0199ac14-a9bc-7001-8000-000000000001', code: 'MATH101', name: 'Toán cao cấp', description: 'Toán giải tích'}
                ],
                total: 1
            };
        };

        const resSuccess = await request(app, 'GET', '/api/v1/subjects?page=1&page_size=20', {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resSuccess.status, 200);
        assert.equal(resSuccess.body.success, true);
        assert.equal(resSuccess.body.data.length, 1);
        assert.equal(resSuccess.body.data[0].code, 'MATH101');
        assert.deepEqual(resSuccess.body.meta, {
            page: 1,
            page_size: 20,
            total_items: 1,
            total_pages: 1
        });
    });

    await t.test('3. POST /subjects - Validation, Creation & Conflict', async () => {
        // Body is array (not object)
        const resBadBody = await request(app, 'POST', '/api/v1/subjects', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: ['invalid', 'array']
        });
        assert.equal(resBadBody.status, 400);
        assert.equal(resBadBody.body.code, 'VALIDATION_ERROR');

        // Unsupported fields
        const resUnsupported = await request(app, 'POST', '/api/v1/subjects', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {code: 'MATH101', name: 'Toan', created_by: 'hacked_id'}
        });
        assert.equal(resUnsupported.status, 400);
        assert.equal(resUnsupported.body.message, 'Request contains unsupported fields.');

        // Missing required fields
        const resMissingName = await request(app, 'POST', '/api/v1/subjects', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {code: 'MATH101'}
        });
        assert.equal(resMissingName.status, 400);
        assert.match(resMissingName.body.message, /name is required/);

        // Code > 20 chars
        const resLongCode = await request(app, 'POST', '/api/v1/subjects', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {code: 'A'.repeat(21), name: 'Toan'}
        });
        assert.equal(resLongCode.status, 400);
        assert.match(resLongCode.body.message, /code must not exceed 20 characters/);

        // Success creation
        subjectsService.createSubject = async ({code, name, description, createdBy}) => {
            assert.equal(code, 'PHYS101');
            assert.equal(name, 'Vật lý đại cương');
            assert.equal(createdBy, teacher1Id);
            return {
                id: '0199ac14-a9bc-7001-8000-000000000002',
                code,
                name,
                description
            };
        };

        const resCreated = await request(app, 'POST', '/api/v1/subjects', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {code: 'PHYS101', name: 'Vật lý đại cương', description: 'Mô tả lý'}
        });
        assert.equal(resCreated.status, 201);
        assert.equal(resCreated.body.success, true);
        assert.equal(resCreated.body.data.id, '0199ac14-a9bc-7001-8000-000000000002');
        assert.equal(resCreated.body.data.code, 'PHYS101');

        // 409 Conflict when unique code violates
        subjectsService.createSubject = async () => {
            const err = new Error('duplicate key');
            err.code = '23505';
            throw err;
        };

        const resConflict = await request(app, 'POST', '/api/v1/subjects', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {code: 'PHYS101', name: 'Vật lý đại cương'}
        });
        assert.equal(resConflict.status, 409);
        assert.equal(resConflict.body.code, 'CONFLICT');
    });

    await t.test('4. PATCH /subjects/:subjectId - UUID, Validation, Ownership (P-02) & Update', async () => {
        // Invalid UUID
        const resInvalidUuid = await request(app, 'PATCH', '/api/v1/subjects/invalid-uuid-123', {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'New Name'}
        });
        assert.equal(resInvalidUuid.status, 400);
        assert.equal(resInvalidUuid.body.code, 'VALIDATION_ERROR');

        const validSubjectId = '0199ac14-a9bc-7001-8000-000000000001';

        // Empty body
        const resEmptyBody = await request(app, 'PATCH', `/api/v1/subjects/${validSubjectId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {}
        });
        assert.equal(resEmptyBody.status, 400);
        assert.equal(resEmptyBody.body.message, 'At least one field is required for update.');

        // Subject not found -> 404
        subjectsService.findSubjectById = async () => null;
        const resNotFound = await request(app, 'PATCH', `/api/v1/subjects/${validSubjectId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'New Name'}
        });
        assert.equal(resNotFound.status, 404);
        assert.equal(resNotFound.body.code, 'SUBJECT_NOT_FOUND');

        // Teacher updates subject created by ANOTHER teacher -> 403 Forbidden
        subjectsService.findSubjectById = async (id) => ({
            id,
            code: 'MATH101',
            name: 'Toán',
            description: null,
            created_by: teacher2Id // not teacher1Id
        });

        const resForbiddenTeacher = await request(app, 'PATCH', `/api/v1/subjects/${validSubjectId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'New Name'}
        });
        assert.equal(resForbiddenTeacher.status, 403);
        assert.equal(resForbiddenTeacher.body.code, 'FORBIDDEN');

        // Teacher updates OWN subject -> 200 Success
        subjectsService.findSubjectById = async (id) => ({
            id,
            code: 'MATH101',
            name: 'Toán',
            description: null,
            created_by: teacher1Id // belongs to teacher 1
        });
        subjectsService.updateSubject = async (id, updates) => ({
            id,
            code: 'MATH101',
            name: updates.name,
            description: null
        });

        const resTeacherOwnSuccess = await request(app, 'PATCH', `/api/v1/subjects/${validSubjectId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`},
            body: {name: 'Toán 1 nâng cao'}
        });
        assert.equal(resTeacherOwnSuccess.status, 200);
        assert.equal(resTeacherOwnSuccess.body.data.name, 'Toán 1 nâng cao');

        // Admin updates ANY subject -> 200 Success
        subjectsService.findSubjectById = async (id) => ({
            id,
            code: 'MATH101',
            name: 'Toán',
            description: null,
            created_by: teacher2Id // not admin
        });

        const resAdminSuccess = await request(app, 'PATCH', `/api/v1/subjects/${validSubjectId}`, {
            headers: {Authorization: `Bearer ${adminToken}`},
            body: {name: 'Admin Edited Name'}
        });
        assert.equal(resAdminSuccess.status, 200);
        assert.equal(resAdminSuccess.body.data.name, 'Admin Edited Name');
    });

    await t.test('5. DELETE /subjects/:subjectId - UUID, Ownership (P-02) & Soft Delete', async () => {
        const validSubjectId = '0199ac14-a9bc-7001-8000-000000000001';

        // Subject not found -> 404
        subjectsService.findSubjectById = async () => null;
        const resNotFound = await request(app, 'DELETE', `/api/v1/subjects/${validSubjectId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resNotFound.status, 404);
        assert.equal(resNotFound.body.code, 'SUBJECT_NOT_FOUND');

        // Teacher deletes someone else's subject -> 403
        subjectsService.findSubjectById = async (id) => ({
            id,
            code: 'MATH101',
            name: 'Toán',
            created_by: teacher2Id
        });
        const resForbiddenTeacher = await request(app, 'DELETE', `/api/v1/subjects/${validSubjectId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resForbiddenTeacher.status, 403);
        assert.equal(resForbiddenTeacher.body.code, 'FORBIDDEN');

        // Teacher deletes OWN subject -> 200, data: {}
        let softDeletedId = null;
        let deletedByActor = null;
        subjectsService.findSubjectById = async (id) => ({
            id,
            code: 'MATH101',
            name: 'Toán',
            created_by: teacher1Id
        });
        subjectsService.softDeleteSubject = async (id, actorId) => {
            softDeletedId = id;
            deletedByActor = actorId;
            return {id};
        };

        const resTeacherSuccess = await request(app, 'DELETE', `/api/v1/subjects/${validSubjectId}`, {
            headers: {Authorization: `Bearer ${teacher1Token}`}
        });
        assert.equal(resTeacherSuccess.status, 200);
        assert.equal(resTeacherSuccess.body.success, true);
        assert.deepEqual(resTeacherSuccess.body.data, {});
        assert.equal(softDeletedId, validSubjectId);
        assert.equal(deletedByActor, teacher1Id);

        // Admin deletes ANY subject -> 200, data: {}
        subjectsService.findSubjectById = async (id) => ({
            id,
            code: 'MATH101',
            name: 'Toán',
            created_by: teacher2Id
        });
        const resAdminSuccess = await request(app, 'DELETE', `/api/v1/subjects/${validSubjectId}`, {
            headers: {Authorization: `Bearer ${adminToken}`}
        });
        assert.equal(resAdminSuccess.status, 200);
        assert.equal(resAdminSuccess.body.success, true);
        assert.deepEqual(resAdminSuccess.body.data, {});
        assert.equal(deletedByActor, adminId);
    });
});
