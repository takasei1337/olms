/**
 * Security Audit & Vulnerability Verification Test Suite
 * Based on Cloudflare Security Audit Skill & OWASP API Security Top 10:
 * - API1: Broken Object Level Authorization (BOLA / IDOR / P-02)
 * - API2: Broken Authentication (JWT signature, format, expiration)
 * - API4: Unrestricted Resource Consumption (Payload Limit DoS)
 * - API5: Broken Function Level Authorization (BFLA / RBAC Escalation)
 * - Security Misconfiguration (Hardening headers, CSP, nosniff, framing)
 */

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'security-audit-secret-key-test-12345';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';

const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('./src/app');

// Mock services
const authService = require('./src/services/auth.service');
const subjectsService = require('./src/services/subjects.service');
const chaptersService = require('./src/services/chapters.service');
const lessonsService = require('./src/services/lessons.service');
const questionsService = require('./src/services/questions.service');

// Test Identities
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

function generateTestToken(user, secret = process.env.JWT_ACCESS_SECRET, expiresIn = '15m') {
    return jwt.sign(
        {
            sub: user.id,
            role: user.role,
            email: user.email,
        },
        secret,
        { expiresIn }
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

async function runSecurityAudit() {
    console.log('--- Starting OLMS Security Audit & Hardening Test Suite ---\n');

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    // Setup Mock User Resolver for Auth Middlewares
    authService.findActiveUserById = async (id) => {
        if (id === ADMIN_USER.id) return ADMIN_USER;
        if (id === TEACHER_1.id) return TEACHER_1;
        if (id === TEACHER_2.id) return TEACHER_2;
        if (id === STUDENT_USER.id) return STUDENT_USER;
        return null;
    };

    let passed = 0;
    let total = 0;

    function testPassed(title) {
        passed++;
        total++;
        console.log(`  [PASS] ${title}`);
    }

    try {
        // ==========================================
        // 1. Security Headers & Information Leakage
        // ==========================================
        console.log('1. Auditing Security Headers & Info Leakage:');
        {
            const res = await makeRequest(server, { path: '/health', method: 'GET' });
            assert.strictEqual(res.headers['x-content-type-options'], 'nosniff', 'Missing nosniff');
            assert.strictEqual(res.headers['x-frame-options'], 'DENY', 'Missing DENY frame-options');
            assert(res.headers['content-security-policy'].includes("frame-ancestors 'none'"), 'Weak CSP');
            assert(res.headers['strict-transport-security'].includes('max-age=31536000'), 'Missing HSTS');
            assert.strictEqual(res.headers['x-powered-by'], undefined, 'Leaking X-Powered-By');
            testPassed('Response contains OWASP hardening headers and hides server tech');
        }

        // ==========================================
        // 2. DoS Protection & Payload Limiting
        // ==========================================
        console.log('\n2. Auditing Payload Limits & Malformed Input:');
        {
            // 2.1 Payload Too Large (> 1MB)
            const hugePayload = { data: 'A'.repeat(1024 * 1024 * 1.2) };
            const resHuge = await makeRequest(server, {
                path: '/api/v1/auth/login',
                method: 'POST'
            }, hugePayload);

            assert.strictEqual(resHuge.status, 413, 'Expected 413 Payload Too Large');
            assert.strictEqual(resHuge.body.code, 'PAYLOAD_TOO_LARGE');
            testPassed('Denies payload exceeding 1MB with 413 PAYLOAD_TOO_LARGE');

            // 2.2 Malformed JSON
            const resMalformed = await makeRequest(server, {
                path: '/api/v1/auth/login',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, '{"invalid_json": true,');

            assert.strictEqual(resMalformed.status, 400, 'Expected 400 for malformed JSON');
            assert.strictEqual(resMalformed.body.code, 'INVALID_JSON_PAYLOAD');
            testPassed('Catches malformed JSON gracefully with standard error envelope');
        }

        // ==========================================
        // 3. Authentication & JWT Integrity
        // ==========================================
        console.log('\n3. Auditing Authentication Boundaries:');
        {
            // 3.1 Missing Token
            const resMissing = await makeRequest(server, {
                path: '/api/v1/subjects',
                method: 'POST'
            }, { code: 'SUB_01', name: 'Subject 1' });
            assert.strictEqual(resMissing.status, 401);
            assert.strictEqual(resMissing.body.code, 'ACCESS_TOKEN_MISSING');
            testPassed('Blocks requests with missing authorization token');

            // 3.2 Invalid Bearer Format
            const resBadFormat = await makeRequest(server, {
                path: '/api/v1/subjects',
                method: 'POST',
                headers: { Authorization: 'Basic dXNlcjpwYXNz' }
            }, { code: 'SUB_01', name: 'Subject 1' });
            assert.strictEqual(resBadFormat.status, 401);
            assert.strictEqual(resBadFormat.body.code, 'INVALID_ACCESS_TOKEN');
            testPassed('Enforces Bearer scheme on Authorization header');

            // 3.3 Forged / Invalid Signature
            const fakeToken = generateTestToken(TEACHER_1, 'wrong-secret-key-hacker');
            const resForged = await makeRequest(server, {
                path: '/api/v1/subjects',
                method: 'POST',
                headers: { Authorization: `Bearer ${fakeToken}` }
            }, { code: 'SUB_01', name: 'Subject 1' });
            assert.strictEqual(resForged.status, 401);
            assert.strictEqual(resForged.body.code, 'INVALID_ACCESS_TOKEN');
            testPassed('Rejects JWT with forged signature');

            // 3.4 Expired Token
            const expiredToken = generateTestToken(TEACHER_1, process.env.JWT_ACCESS_SECRET, '-1s');
            const resExpired = await makeRequest(server, {
                path: '/api/v1/subjects',
                method: 'POST',
                headers: { Authorization: `Bearer ${expiredToken}` }
            }, { code: 'SUB_01', name: 'Subject 1' });
            assert.strictEqual(resExpired.status, 401);
            assert.strictEqual(resExpired.body.code, 'INVALID_ACCESS_TOKEN');
            testPassed('Rejects expired JWT token');
        }

        // ==========================================
        // 4. Broken Function Level Authorization (RBAC)
        // ==========================================
        console.log('\n4. Auditing RBAC Privilege Escalation:');
        {
            const studentToken = generateTestToken(STUDENT_USER);

            // 4.1 Student attempting Admin action (User management)
            const resStudentUser = await makeRequest(server, {
                path: '/api/v1/users',
                method: 'GET',
                headers: { Authorization: `Bearer ${studentToken}` }
            });
            assert.strictEqual(resStudentUser.status, 403);
            assert.strictEqual(resStudentUser.body.code, 'FORBIDDEN');
            testPassed('Blocks STUDENT from accessing Admin-only user management');

            // 4.2 Student attempting Teacher action (Create Subject)
            const resStudentSubject = await makeRequest(server, {
                path: '/api/v1/subjects',
                method: 'POST',
                headers: { Authorization: `Bearer ${studentToken}` }
            }, { code: 'MATH101', name: 'Mathematics' });
            assert.strictEqual(resStudentSubject.status, 403);
            assert.strictEqual(resStudentSubject.body.code, 'FORBIDDEN');
            testPassed('Blocks STUDENT from creating Subjects');

            // 4.3 Student attempting Teacher action (Create Chapter)
            const resStudentChapter = await makeRequest(server, {
                path: '/api/v1/subjects/550e8400-e29b-41d4-a716-446655440000/chapters',
                method: 'POST',
                headers: { Authorization: `Bearer ${studentToken}` }
            }, { code: 'CH01', name: 'Chapter 1' });
            assert.strictEqual(resStudentChapter.status, 403);
            assert.strictEqual(resStudentChapter.body.code, 'FORBIDDEN');
            testPassed('Blocks STUDENT from creating Chapters');
        }

        // ==========================================
        // 5. Insecure Direct Object Reference (IDOR / P-02)
        // ==========================================
        console.log('\n5. Auditing IDOR & P-02 Resource Ownership:');
        {
            const teacher1Token = generateTestToken(TEACHER_1);
            const teacher2Token = generateTestToken(TEACHER_2);
            const adminToken = generateTestToken(ADMIN_USER);

            const SUBJECT_T1 = {
                id: '11111111-1111-4111-8111-111111111111',
                code: 'T1_SUB',
                name: 'Teacher 1 Subject',
                created_by: TEACHER_1.id
            };

            const CHAPTER_T1 = {
                id: '22222222-2222-4222-8222-222222222222',
                subject_id: SUBJECT_T1.id,
                code: 'T1_CH',
                name: 'Teacher 1 Chapter',
                subjects: { created_by: TEACHER_1.id }
            };

            const LESSON_T1 = {
                id: '33333333-3333-4333-8333-333333333333',
                chapter_id: CHAPTER_T1.id,
                code: 'T1_LES',
                name: 'Teacher 1 Lesson',
                chapters: {
                    subjects: { created_by: TEACHER_1.id }
                }
            };

            const QUESTION_T1 = {
                id: '44444444-4444-4444-8444-444444444444',
                lesson_id: LESSON_T1.id,
                code: 'T1_Q',
                created_by: TEACHER_1.id
            };

            // Setup service mocks for ownership checks
            subjectsService.findSubjectById = async (id) => (id === SUBJECT_T1.id ? SUBJECT_T1 : null);
            subjectsService.updateSubject = async (id, data) => ({ ...SUBJECT_T1, ...data });
            subjectsService.deleteSubject = async (id) => ({ ...SUBJECT_T1 });

            chaptersService.findChapterById = async (id) => (id === CHAPTER_T1.id ? CHAPTER_T1 : null);
            chaptersService.updateChapter = async (id, data) => ({ ...CHAPTER_T1, ...data });
            chaptersService.countActiveLessonsByChapterId = async () => 0;
            chaptersService.deleteChapter = async (id) => ({ ...CHAPTER_T1 });

            lessonsService.findLessonById = async (id) => (id === LESSON_T1.id ? LESSON_T1 : null);
            lessonsService.updateLesson = async (id, data) => ({ ...LESSON_T1, ...data });
            lessonsService.countActiveQuestionsByLessonId = async () => 0;
            lessonsService.deleteLesson = async (id) => ({ ...LESSON_T1 });

            questionsService.findQuestionById = async (id) => (id === QUESTION_T1.id ? QUESTION_T1 : null);
            questionsService.updateQuestion = async (id, data) => ({ ...QUESTION_T1, ...data });

            // 5.1 Teacher 2 modifies Teacher 1 Subject -> 403
            const resSubIdor = await makeRequest(server, {
                path: `/api/v1/subjects/${SUBJECT_T1.id}`,
                method: 'PATCH',
                headers: { Authorization: `Bearer ${teacher2Token}` }
            }, { name: 'Hacked Subject Name' });
            assert.strictEqual(resSubIdor.status, 403);
            assert.strictEqual(resSubIdor.body.code, 'FORBIDDEN');
            testPassed('Prevents Teacher B from updating Teacher A subject (Subject IDOR)');

            // 5.2 Teacher 2 creates Chapter in Teacher 1 Subject -> 403
            const resChCreateIdor = await makeRequest(server, {
                path: `/api/v1/subjects/${SUBJECT_T1.id}/chapters`,
                method: 'POST',
                headers: { Authorization: `Bearer ${teacher2Token}` }
            }, { code: 'CH_HACK', name: 'Illegal Chapter' });
            assert.strictEqual(resChCreateIdor.status, 403);
            assert.strictEqual(resChCreateIdor.body.code, 'FORBIDDEN');
            testPassed('Prevents Teacher B from adding chapters to Teacher A subject');

            // 5.3 Teacher 2 modifies Teacher 1 Chapter -> 403
            const resChPatchIdor = await makeRequest(server, {
                path: `/api/v1/chapters/${CHAPTER_T1.id}`,
                method: 'PATCH',
                headers: { Authorization: `Bearer ${teacher2Token}` }
            }, { name: 'Hacked Chapter' });
            assert.strictEqual(resChPatchIdor.status, 403);
            assert.strictEqual(resChPatchIdor.body.code, 'FORBIDDEN');
            testPassed('Prevents Teacher B from updating Teacher A chapter (Chapter IDOR)');

            // 5.4 Teacher 2 creates Lesson in Teacher 1 Chapter -> 403
            const resLesCreateIdor = await makeRequest(server, {
                path: `/api/v1/chapters/${CHAPTER_T1.id}/lessons`,
                method: 'POST',
                headers: { Authorization: `Bearer ${teacher2Token}` }
            }, { code: 'LES_HACK', name: 'Illegal Lesson' });
            assert.strictEqual(resLesCreateIdor.status, 403);
            assert.strictEqual(resLesCreateIdor.body.code, 'FORBIDDEN');
            testPassed('Prevents Teacher B from adding lessons to Teacher A chapter');

            // 5.5 Teacher 2 modifies Teacher 1 Lesson -> 403
            const resLesPatchIdor = await makeRequest(server, {
                path: `/api/v1/lessons/${LESSON_T1.id}`,
                method: 'PATCH',
                headers: { Authorization: `Bearer ${teacher2Token}` }
            }, { name: 'Hacked Lesson' });
            assert.strictEqual(resLesPatchIdor.status, 403);
            assert.strictEqual(resLesPatchIdor.body.code, 'FORBIDDEN');
            testPassed('Prevents Teacher B from updating Teacher A lesson (Lesson IDOR)');

            // 5.6 Teacher 2 modifies Teacher 1 Question -> 403
            const resQuesPatchIdor = await makeRequest(server, {
                path: `/api/v1/questions/${QUESTION_T1.id}`,
                method: 'PATCH',
                headers: { Authorization: `Bearer ${teacher2Token}` }
            }, { content: 'Hacked Question Content' });
            assert.strictEqual(resQuesPatchIdor.status, 403);
            assert.strictEqual(resQuesPatchIdor.body.code, 'FORBIDDEN');
            testPassed('Prevents Teacher B from updating Teacher A question (Question IDOR)');

            // 5.7 Admin bypasses ownership checks lawfully
            const resAdminEdit = await makeRequest(server, {
                path: `/api/v1/subjects/${SUBJECT_T1.id}`,
                method: 'PATCH',
                headers: { Authorization: `Bearer ${adminToken}` }
            }, { name: 'Admin Lawful Update' });
            assert.strictEqual(resAdminEdit.status, 200);
            assert.strictEqual(resAdminEdit.body.success, true);
            testPassed('Allows ADMIN to manage Teacher resources lawfully');
        }

        console.log(`\nAll Security Audit checks passed: ${passed}/${total} assertions successful.`);
    } finally {
        server.close();
    }
}

runSecurityAudit().catch((err) => {
    console.error('Security Audit Failure:', err);
    process.exit(1);
});
