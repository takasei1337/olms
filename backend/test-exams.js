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
const supabase = require('./src/config/supabase');

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

    const originals = {
        findActiveUserById: authService.findActiveUserById,
        listExams: examsService.listExams,
        findExamById: examsService.findExamById,
        createExam: examsService.createExam,
        updateExam: examsService.updateExam,
        deleteExam: examsService.deleteExam,
        replaceMatrix: examsService.replaceMatrix,
        replaceGradingRules: examsService.replaceGradingRules,
        validateMatrix: examsService.validateMatrix,
        supabaseFrom: supabase.from
    };

    t.after(() => {
        Object.assign(authService, { findActiveUserById: originals.findActiveUserById });
        Object.assign(examsService, {
            listExams: originals.listExams,
            findExamById: originals.findExamById,
            createExam: originals.createExam,
            updateExam: originals.updateExam,
            deleteExam: originals.deleteExam,
            replaceMatrix: originals.replaceMatrix,
            replaceGradingRules: originals.replaceGradingRules,
            validateMatrix: originals.validateMatrix
        });
        supabase.from = originals.supabaseFrom;
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
                    total_pages: 1
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
        assert.deepStrictEqual(resList.body.meta, {
            page: 1,
            page_size: 20,
            total_items: 1,
            total_pages: 1
        });
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

        // Teacher 2 cannot view Teacher 1 exam -> 403 (P-02)
        examsService.findExamById = async () => MOCK_EXAM;
        const resForbiddenView = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${teacher2Token}` }
        });
        assert.strictEqual(resForbiddenView.status, 403);
        assert.strictEqual(resForbiddenView.body.code, 'FORBIDDEN');

        // Found for Owner Teacher -> 200
        const resFound = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${teacherToken}` }
        });
        assert.strictEqual(resFound.status, 200);
        assert.strictEqual(resFound.body.data.id, MOCK_EXAM.id);

        // Found for Admin (any exam) -> 200
        const resAdminFound = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assert.strictEqual(resAdminFound.status, 200);
        assert.strictEqual(resAdminFound.body.data.id, MOCK_EXAM.id);
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

    await t.test('7. PUT /exams/:examId/matrix - Validation & Matrix replacement', async () => {
        // Missing rows -> 400
        const resBadBody = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}/matrix`,
            method: 'PUT',
            headers: { Authorization: `Bearer ${teacherToken}` }
        }, { invalid_field: true });
        assert.strictEqual(resBadBody.status, 400);

        // Teacher 2 modifying Teacher 1 matrix -> 403
        examsService.replaceMatrix = async (examId, rows, currentUser) => {
            if (currentUser.id === TEACHER_2.id) {
                const err = new Error('Only the creator or an admin can modify this exam matrix.');
                err.code = 'FORBIDDEN';
                err.status = 403;
                throw err;
            }
            return {};
        };

        const resForbiddenMatrix = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}/matrix`,
            method: 'PUT',
            headers: { Authorization: `Bearer ${teacher2Token}` }
        }, {
            rows: [
                {
                    question_type_id: '55555555-5555-4555-8555-555555555555',
                    difficulty_level: 'EASY',
                    num_questions: 10,
                    score_per_question: 0.25
                }
            ]
        });
        assert.strictEqual(resForbiddenMatrix.status, 403);

        // Creator replaces matrix successfully -> 200
        const resSuccessMatrix = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}/matrix`,
            method: 'PUT',
            headers: { Authorization: `Bearer ${teacherToken}` }
        }, {
            rows: [
                {
                    question_type_id: '55555555-5555-4555-8555-555555555555',
                    difficulty_level: 'EASY',
                    num_questions: 20,
                    score_per_question: 0.25
                },
                {
                    question_type_id: '55555555-5555-4555-8555-555555555555',
                    difficulty_level: 'MEDIUM',
                    num_questions: 20,
                    score_per_question: 0.25
                }
            ]
        });
        assert.strictEqual(resSuccessMatrix.status, 200);
        assert.strictEqual(resSuccessMatrix.body.success, true);
    });

    await t.test('8. PUT /exams/:examId/grading-rules - Policy checks & Replacement', async () => {
        // Missing rules -> 400
        const resBadRules = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}/grading-rules`,
            method: 'PUT',
            headers: { Authorization: `Bearer ${teacherToken}` }
        }, {});
        assert.strictEqual(resBadRules.status, 400);

        // Disallow negative marking -> 422
        examsService.replaceGradingRules = async (examId, rules) => {
            if (rules.some(r => r.allow_negative_marking === true)) {
                const err = new Error('Negative marking is disallowed.');
                err.code = 'NEGATIVE_MARKING_DISALLOWED';
                err.status = 422;
                throw err;
            }
            return {};
        };

        const resNegativeMarking = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}/grading-rules`,
            method: 'PUT',
            headers: { Authorization: `Bearer ${teacherToken}` }
        }, {
            rules: [
                {
                    question_type_id: '55555555-5555-4555-8555-555555555555',
                    scoring_mode: 'EXACT_MATCH',
                    allow_negative_marking: true
                }
            ]
        });
        assert.strictEqual(resNegativeMarking.status, 422);

        // Success -> 200
        const resSuccessRules = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}/grading-rules`,
            method: 'PUT',
            headers: { Authorization: `Bearer ${teacherToken}` }
        }, {
            rules: [
                {
                    question_type_id: '55555555-5555-4555-8555-555555555555',
                    scoring_mode: 'EXACT_MATCH',
                    allow_negative_marking: false
                }
            ]
        });
        assert.strictEqual(resSuccessRules.status, 200);
        assert.strictEqual(resSuccessRules.body.success, true);
    });

    await t.test('9. POST /exams/:examId/matrix/validate - Feasibility & Issue collection', async () => {
        // Insufficient question pool -> valid: false with issues
        examsService.validateMatrix = async (examId) => {
            return {
                valid: false,
                expected_questions: 40,
                matrix_questions: 40,
                expected_score: 10,
                matrix_score: 10,
                issues: [
                    {
                        row_index: 0,
                        code: 'EXAM_QUESTION_POOL_INSUFFICIENT',
                        requested: 20,
                        available: 15,
                        message: 'Thiếu 5 câu hỏi hợp lệ trong ngân hàng.'
                    }
                ]
            };
        };

        const resInvalid = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}/matrix/validate`,
            method: 'POST',
            headers: { Authorization: `Bearer ${teacherToken}` }
        });
        assert.strictEqual(resInvalid.status, 200);
        assert.strictEqual(resInvalid.body.data.valid, false);
        assert.strictEqual(resInvalid.body.data.issues.length, 1);
        assert.strictEqual(resInvalid.body.data.issues[0].code, 'EXAM_QUESTION_POOL_INSUFFICIENT');

        // Fully valid pool -> valid: true with empty issues
        examsService.validateMatrix = async (examId) => {
            return {
                valid: true,
                expected_questions: 40,
                matrix_questions: 40,
                expected_score: 10,
                matrix_score: 10,
                issues: []
            };
        };

        const resValid = await makeRequest(server, {
            path: `/api/v1/exams/${MOCK_EXAM.id}/matrix/validate`,
            method: 'POST',
            headers: { Authorization: `Bearer ${teacherToken}` }
        });
        assert.strictEqual(resValid.status, 200);
        assert.strictEqual(resValid.body.data.valid, true);
        assert.strictEqual(resValid.body.data.issues.length, 0);
    });

    await t.test('10. UUIDv7 support & Strict Matrix replace/validate service logic', async () => {
        // UUIDv7 IDs from Bruno examples must be accepted
        assert.strictEqual(examsService.isValidUUID('0199ac14-a9bc-7001-8000-000000000001'), true);
        assert.strictEqual(examsService.isValidUUID('not-a-uuid'), false);

        const examV7 = {
            ...MOCK_EXAM,
            id: '0199ac14-a9bc-7001-8000-000000000099',
            subject_id: '0199ac14-a9bc-7001-8000-000000000010',
            total_questions: 10,
            total_score: 5
        };

        const recordedQueries = [];
        let insertedMatrixRows = null;

        function createQueryMock(table) {
            const calls = [];
            const record = { table, calls };
            recordedQueries.push(record);

            const execute = () => {
                if (table === 'exams') {
                    return { data: examV7, error: null };
                }
                if (table === 'exam_matrices') {
                    const isDelete = calls.some(c => c[0] === 'delete');
                    const insertCall = calls.find(c => c[0] === 'insert');
                    if (isDelete) return { error: null };
                    if (insertCall) {
                        insertedMatrixRows = insertCall[1];
                        return { error: null };
                    }
                    return {
                        data: [
                            {
                                chapter_id: null,
                                lesson_id: null,
                                question_type_id: '0199ac14-a9bc-7001-8000-000000000020',
                                difficulty_level: 'MEDIUM',
                                num_questions: 10,
                                score_per_question: 0.5,
                                max_questions_per_topic: 2
                            }
                        ],
                        error: null
                    };
                }
                if (table === 'chapters') {
                    return { data: [{ id: '0199ac14-a9bc-7001-8000-000000000030' }], error: null };
                }
                if (table === 'lessons') {
                    return { data: [{ id: '0199ac14-a9bc-7001-8000-000000000040' }], error: null };
                }
                if (table === 'questions') {
                    return { count: 12, error: null };
                }
                return { data: [], error: null };
            };

            const chain = {
                select: (...args) => { calls.push(['select', ...args]); return chain; },
                insert: (...args) => { calls.push(['insert', ...args]); return chain; },
                delete: (...args) => { calls.push(['delete', ...args]); return chain; },
                eq: (...args) => { calls.push(['eq', ...args]); return chain; },
                in: (...args) => { calls.push(['in', ...args]); return chain; },
                is: (...args) => { calls.push(['is', ...args]); return chain; },
                maybeSingle: async () => execute(),
                single: async () => execute(),
                then: (resolve, reject) => Promise.resolve(execute()).then(resolve, reject)
            };
            return chain;
        }

        const prevFrom = supabase.from;
        try {
            supabase.from = (table) => createQueryMock(table);

            // Real replaceMatrix handles max_questions_per_topic (default 2, explicit, null, invalid 0)
            await assert.rejects(
                () => originals.replaceMatrix(examV7.id, [
                    {
                        question_type_id: '0199ac14-a9bc-7001-8000-000000000020',
                        difficulty_level: 'EASY',
                        num_questions: 5,
                        score_per_question: 0.5,
                        max_questions_per_topic: 0
                    }
                ], TEACHER_1),
                (err) => err.code === 'INVALID_MATRIX_DATA' && err.status === 400
            );

            await originals.replaceMatrix(examV7.id, [
                {
                    question_type_id: '0199ac14-a9bc-7001-8000-000000000020',
                    difficulty_level: 'EASY',
                    num_questions: 5,
                    score_per_question: 0.5
                },
                {
                    question_type_id: '0199ac14-a9bc-7001-8000-000000000020',
                    difficulty_level: 'MEDIUM',
                    num_questions: 5,
                    score_per_question: 0.5,
                    max_questions_per_topic: 3
                }
            ], TEACHER_1);

            assert.strictEqual(insertedMatrixRows.length, 2);
            assert.strictEqual(insertedMatrixRows[0].max_questions_per_topic, 2);
            assert.strictEqual(insertedMatrixRows[1].max_questions_per_topic, 3);

            // Real validateMatrix queries question_versions!inner + AI status + subject chapters/lessons fallback
            recordedQueries.length = 0;
            const validation = await originals.validateMatrix(examV7.id, TEACHER_1);
            assert.strictEqual(validation.valid, true);
            assert.strictEqual(validation.matrix_questions, 10);
            assert.strictEqual(validation.matrix_score, 5);

            const qRecord = recordedQueries.find(r => r.table === 'questions');
            assert.ok(qRecord, 'validateMatrix must query questions table');
            assert.ok(qRecord.calls.some(c => c[0] === 'select' && String(c[1]).includes('question_versions!inner')));
            assert.ok(qRecord.calls.some(c => c[0] === 'eq' && c[1] === 'question_versions.type_id'));
            assert.ok(qRecord.calls.some(c => c[0] === 'eq' && c[1] === 'question_versions.difficulty_level' && c[2] === 'MEDIUM'));
            assert.ok(qRecord.calls.some(c => c[0] === 'eq' && c[1] === 'question_versions.is_current' && c[2] === true));
            assert.ok(qRecord.calls.some(c => c[0] === 'in' && c[1] === 'ai_check_status' && c[2].includes('CHECKED') && c[2].includes('OVERRIDDEN')));
            assert.ok(qRecord.calls.some(c => c[0] === 'in' && c[1] === 'lesson_id' && c[2].includes('0199ac14-a9bc-7001-8000-000000000040')));
        } finally {
            supabase.from = prevFrom;
        }
    });
});
