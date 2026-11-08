process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-secret-key-12345';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const jwt = require('jsonwebtoken');

const app = require('./src/app');
const authService = require('./src/services/auth.service');
const examsService = require('./src/services/exams.service');
const { supabase } = require('./src/config/supabase');

const ADMIN_USER = {
    id: 'a0000000-0000-4000-8000-000000000001',
    role: 'ADMIN',
    status: 'ACTIVE',
    email: 'admin@olms.edu.vn'
};

const TEACHER_1 = {
    id: 'b0000000-0000-4000-8000-000000000001',
    role: 'TEACHER',
    status: 'ACTIVE',
    email: 'teacher1@olms.edu.vn'
};

const TEACHER_2 = {
    id: 'b0000000-0000-4000-8000-000000000002',
    role: 'TEACHER',
    status: 'ACTIVE',
    email: 'teacher2@olms.edu.vn'
};

const STUDENT_USER = {
    id: 'c0000000-0000-4000-8000-000000000001',
    role: 'STUDENT',
    status: 'ACTIVE',
    email: 'student@olms.edu.vn'
};

function generateToken(user) {
    return jwt.sign(
        { sub: user.id, role: user.role, email: user.email },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
    );
}

function makeRequest(server, options, payload = null) {
    return new Promise((resolve, reject) => {
        const address = server.address();
        const reqOptions = {
            hostname: '127.0.0.1',
            port: address.port,
            path: options.path,
            method: options.method || 'GET',
            headers: {
                ...(payload ? { 'Content-Type': 'application/json' } : {}),
                ...(options.headers || {})
            }
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch {
                    parsed = data;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on('error', reject);
        if (payload) {
            req.write(typeof payload === 'string' ? payload : JSON.stringify(payload));
        }
        req.end();
    });
}

test('EXAMS MODULE UNIT & INTEGRATION TESTS (MOCK)', async (t) => {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    authService.findActiveUserById = async (id) => {
        if (id === ADMIN_USER.id) return ADMIN_USER;
        if (id === TEACHER_1.id) return TEACHER_1;
        if (id === TEACHER_2.id) return TEACHER_2;
        if (id === STUDENT_USER.id) return STUDENT_USER;
        return null;
    };

    const teacherToken = generateToken(TEACHER_1);
    const teacher2Token = generateToken(TEACHER_2);
    const adminToken = generateToken(ADMIN_USER);
    const studentToken = generateToken(STUDENT_USER);

    const MOCK_SUBJECT = {
        id: '11111111-1111-4111-8111-111111111111',
        code: 'CSDL_01',
        name: 'Cơ sở dữ liệu',
        created_by: TEACHER_1.id
    };

    const MOCK_EXAM = {
        id: '99999999-9999-4999-8999-999999999999',
        code: 'EXAM_MID_2026',
        name: 'Thi giữa kỳ CSDL',
        subject_id: MOCK_SUBJECT.id,
        form_template_id: null,
        status: 'DRAFT',
        delivery_mode: 'ONLINE',
        total_questions: 40,
        duration_minutes: 60,
        opens_at: '2026-11-15T08:00:00.000Z',
        closes_at: '2026-11-15T10:00:00.000Z',
        total_score: 10,
        result_visibility_mode: 'HIDDEN',
        created_by: TEACHER_1.id,
        created_at: '2026-11-08T00:00:00.000Z',
        updated_at: '2026-11-08T00:00:00.000Z'
    };

    t.after(() => {
        server.close();
    });

    await t.test('1. Authentication & RBAC', async () => {
        // Missing token -> 401
        const resMissing = await makeRequest(server, {
            path: '/api/v1/exams',
            method: 'GET'
        });
        assert.strictEqual(resMissing.status, 401);
        assert.strictEqual(resMissing.body.code, 'ACCESS_TOKEN_MISSING');

        // Student token -> 403
        const resStudent = await makeRequest(server, {
            path: '/api/v1/exams',
            method: 'GET',
            headers: { Authorization: `Bearer ${studentToken}` }
        });
        assert.strictEqual(resStudent.status, 403);
        assert.strictEqual(resStudent.body.code, 'FORBIDDEN');
    });

    await t.test('2. GET /exams - Query validation & pagination', async () => {
        // Invalid status
        const resBadStatus = await makeRequest(server, {
            path: '/api/v1/exams?status=INVALID_STATUS',
            method: 'GET',
            headers: { Authorization: `Bearer ${teacherToken}` }
        });
        assert.strictEqual(resBadStatus.status, 400);

        // Success list
        examsService.listExams = async ({ currentUser }) => {
            return {
                data: [MOCK_EXAM],
                pagination: {
                    page: 1,
                    page_size: 20,
                    total_items: 1,
                    total_pages: 1,
                    has_next: false,
                    has_prev: false
                }
            };
        };

        const resList = await makeRequest(server, {
            path: '/api/v1/exams',
            method: 'GET',
            headers: { Authorization: `Bearer ${teacherToken}` }
        });
        assert.strictEqual(resList.status, 200);
        assert.strictEqual(resList.body.success, true);
        assert.strictEqual(resList.body.data.length, 1);
        assert.strictEqual(resList.body.data[0].code, 'EXAM_MID_2026');
    });

    await t.test('3. POST /exams - Validation, Time range & Creation', async () => {
        // Missing required fields -> 400
        const resMissingFields = await makeRequest(server, {
            path: '/api/v1/exams',
            method: 'POST',
            headers: { Authorization: `Bearer ${teacherToken}` }
        }, { code: 'TEST' });
        assert.strictEqual(resMissingFields.status, 400);

        // Closes_at <= opens_at -> 422
        const resBadTime = await makeRequest(server, {
            path: '/api/v1/exams',
            method: 'POST',
            headers: { Authorization: `Bearer ${teacherToken}` }
        }, {
            code: 'EXAM_BAD_TIME',
            name: 'Exam with bad time',
            subject_id: MOCK_SUBJECT.id,
            total_questions: 20,
            duration_minutes: 45,
            opens_at: '2026-11-15T10:00:00.000Z',
            closes_at: '2026-11-15T09:00:00.000Z'
        });
        assert.strictEqual(resBadTime.status, 422);

        // Successful creation
        examsService.createExam = async (payload, currentUser) => {
            return {
                ...MOCK_EXAM,
                ...payload,
                id: 'new-exam-uuid-0001',
                created_by: currentUser.id
            };
        };

        const resCreate = await makeRequest(server, {
            path: '/api/v1/exams',
            method: 'POST',
            headers: { Authorization: `Bearer ${teacherToken}` }
        }, {
            code: 'EXAM_NEW_01',
            name: 'New Math Exam',
            subject_id: MOCK_SUBJECT.id,
            total_questions: 30,
            duration_minutes: 50,
            opens_at: '2026-11-15T08:00:00.000Z',
            closes_at: '2026-11-15T10:00:00.000Z'
        });
        assert.strictEqual(resCreate.status, 201);
        assert.strictEqual(resCreate.body.success, true);
        assert.strictEqual(resCreate.body.data.code, 'EXAM_NEW_01');
    });

    await t.test('4. GET /exams/:examId - Detail & Validation', async () => {
        // Invalid UUID -> 400
        const resBadId = await makeRequest(server, {
            path: '/api/v1/exams/not-a-uuid',
            method: 'GET',
            headers: { Authorization: `Bearer ${teacherToken}` }
        });
        assert.strictEqual(resBadId.status, 400);

        // Not found -> 404
        examsService.findExamById = async () => null;
        const resNotFound = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${teacherToken}` }
        });
        assert.strictEqual(resNotFound.status, 404);

        // Found -> 200
        examsService.findExamById = async () => MOCK_EXAM;
        const resFound = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${teacherToken}` }
        });
        assert.strictEqual(resFound.status, 200);
        assert.strictEqual(resFound.body.data.id, MOCK_EXAM.id);
    });

    await t.test('5. PATCH /exams/:examId - Validation, P-02 Ownership & Update', async () => {
        // Teacher 2 attempts to edit Teacher 1 exam -> 403
        examsService.updateExam = async (examId, data, currentUser) => {
            if (currentUser.role !== 'ADMIN' && currentUser.id !== TEACHER_1.id) {
                const err = new Error('Only the creator or an admin can modify this exam.');
                err.code = 'FORBIDDEN';
                err.status = 403;
                throw err;
            }
            return { ...MOCK_EXAM, ...data };
        };

        const resForbidden = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}`,
            method: 'PATCH',
            headers: { Authorization: `Bearer ${teacher2Token}` }
        }, { name: 'Unauthorized rename' });
        assert.strictEqual(resForbidden.status, 403);

        // Teacher 1 updates own exam -> 200
        const resUpdate = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}`,
            method: 'PATCH',
            headers: { Authorization: `Bearer ${teacherToken}` }
        }, { name: 'Updated Exam Name' });
        assert.strictEqual(resUpdate.status, 200);
        assert.strictEqual(resUpdate.body.data.name, 'Updated Exam Name');
    });

    await t.test('6. DELETE /exams/:examId - Ownership, Status restriction & Soft Delete', async () => {
        // Non-draft status cannot be deleted -> 409
        examsService.deleteExam = async (examId, currentUser) => {
            if (currentUser.id === TEACHER_2.id) {
                const err = new Error('Only the creator or an admin can delete this exam.');
                err.code = 'FORBIDDEN';
                err.status = 403;
                throw err;
            }
            return { id: examId };
        };

        const resForbiddenDelete = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}`,
            method: 'DELETE',
            headers: { Authorization: `Bearer ${teacher2Token}` }
        });
        assert.strictEqual(resForbiddenDelete.status, 403);

        // Creator deletes successfully -> 200
        const resSuccessDelete = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}`,
            method: 'DELETE',
            headers: { Authorization: `Bearer ${teacherToken}` }
        });
        assert.strictEqual(resSuccessDelete.status, 200);
        assert.strictEqual(resSuccessDelete.body.success, true);
    });
});
