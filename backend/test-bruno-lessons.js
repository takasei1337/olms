require('dotenv').config({quiet: true});

const path = require('node:path');
const express = require('express');

const {generateAccessToken} = require('./src/services/token.service');
const authService = require('./src/services/auth.service');
const subjectsService = require('./src/services/subjects.service');
const chaptersService = require('./src/services/chapters.service');
const lessonsService = require('./src/services/lessons.service');

const apiRoutes = require('./src/routes/api.routes');
const requestContext = require('./src/middlewares/request-context');

function setupApp() {
    const app = express();
    app.use(express.json());
    app.use(requestContext);
    app.use('/api/v1', apiRoutes);

    app.use((err, req, res, next) => {
        return res.status(500).json({
            success: false,
            code: 'INTERNAL_SERVER_ERROR',
            message: err.message,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    });

    return app;
}

const teacherId = '34b637d7-bba1-4d55-b61e-f59493fdc2e8';
const teacherToken = generateAccessToken({id: teacherId, role: 'TEACHER'});

const subjectId = '0199ac14-a9bc-7001-8000-000000000001';
const chapterId = '0199ac14-a9bc-7001-8000-000000000010';
let mockLessonDb = [];

authService.findActiveUserById = async (id) => {
    if (id === teacherId) return {id: teacherId, role: 'TEACHER', status: 'ACTIVE'};
    return null;
};

subjectsService.findSubjectById = async (id) => {
    if (id === subjectId) {
        return {id: subjectId, code: 'MATH101', name: 'Toán cao cấp 1', created_by: teacherId};
    }
    return null;
};

chaptersService.findChapterById = async (cId) => {
    if (cId === chapterId) {
        return {id: chapterId, subject_id: subjectId, code: 'CH01', name: 'Chương 1: Giới hạn và Hàm số'};
    }
    return null;
};

lessonsService.findLessonsByChapterId = async (cId) => {
    return mockLessonDb.filter(l => l.chapter_id === cId && !l.deleted_at);
};

lessonsService.findLessonById = async (lId) => {
    return mockLessonDb.find(l => l.id === lId && !l.deleted_at) || null;
};

lessonsService.createLesson = async ({chapterId: cId, code, name, orderNo}) => {
    const lesson = {
        id: '0199ac14-a9bc-7001-8000-000000000100',
        chapter_id: cId,
        code: code || null,
        name,
        order_no: orderNo ?? 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    mockLessonDb.push(lesson);
    return lesson;
};

lessonsService.updateLesson = async (lId, updates) => {
    const lesson = mockLessonDb.find(l => l.id === lId);
    if (!lesson) return null;
    if (updates.name !== undefined) lesson.name = updates.name;
    if (updates.code !== undefined) lesson.code = updates.code;
    if (updates.order_no !== undefined) lesson.order_no = updates.order_no;
    lesson.updated_at = new Date().toISOString();
    return lesson;
};

lessonsService.countActiveQuestionsByLessonId = async (lId) => {
    return 0; // No active questions
};

lessonsService.softDeleteLesson = async (lId, deletedBy) => {
    const lesson = mockLessonDb.find(l => l.id === lId);
    if (lesson) {
        lesson.deleted_at = new Date().toISOString();
        lesson.deleted_by = deletedBy;
    }
    return {id: lId};
};

async function executeBrunoRequest(serverUrl, {name, method, urlPath, body}) {
    const fullUrl = `${serverUrl}${urlPath}`;
    const startTime = Date.now();

    const fetchOptions = {
        method,
        headers: {
            'Authorization': `Bearer ${teacherToken}`,
            ...(body ? {'Content-Type': 'application/json'} : {})
        },
        body: body ? JSON.stringify(body) : undefined
    };

    const res = await fetch(fullUrl, fetchOptions);
    const duration = Date.now() - startTime;
    const resData = await res.json();

    return {
        name,
        method,
        url: urlPath,
        status: res.status,
        duration: `${duration}ms`,
        body: resData
    };
}

async function run() {
    console.log('='.repeat(70));
    console.log('⚡ SIMULATING BRUNO RUNNER: OLMS Backend -> Lessons Collection');
    console.log('='.repeat(70));

    const app = setupApp();
    const server = app.listen(0);
    const port = server.address().port;
    const serverUrl = `http://127.0.0.1:${port}`;

    try {
        const brunoDir = path.resolve(__dirname, '../api-tests/OLMS Backend');
        console.log(`📂 Bruno Collection Path: ${brunoDir}\n`);

        // 1. Create Lesson
        console.log('▶ [1/4] Running: Create Lesson.yml');
        const resCreate = await executeBrunoRequest(serverUrl, {
            name: 'Create Lesson',
            method: 'POST',
            urlPath: `/api/v1/chapters/${chapterId}/lessons`,
            body: {
                code: 'LES01',
                name: 'Bài 1: Giới hạn của dãy số',
                order_no: 1
            }
        });
        console.log(`   Status:   ${resCreate.status} Created (${resCreate.duration})`);
        console.log(`   Response:`, JSON.stringify(resCreate.body, null, 2));
        console.log('');

        // 2. Get Lessons
        console.log('▶ [2/4] Running: Get Lessons.yml');
        const resGet = await executeBrunoRequest(serverUrl, {
            name: 'Get Lessons',
            method: 'GET',
            urlPath: `/api/v1/chapters/${chapterId}/lessons`,
            body: null
        });
        console.log(`   Status:   ${resGet.status} OK (${resGet.duration})`);
        console.log(`   Response:`, JSON.stringify(resGet.body, null, 2));
        console.log('');

        // 3. Update Lesson
        const lessonId = resCreate.body.data.id;
        console.log('▶ [3/4] Running: Update Lesson.yml');
        const resUpdate = await executeBrunoRequest(serverUrl, {
            name: 'Update Lesson',
            method: 'PATCH',
            urlPath: `/api/v1/lessons/${lessonId}`,
            body: {
                name: 'Bài 1: Giới hạn của dãy số và hàm số (Cập nhật)',
                order_no: 1
            }
        });
        console.log(`   Status:   ${resUpdate.status} OK (${resUpdate.duration})`);
        console.log(`   Response:`, JSON.stringify(resUpdate.body, null, 2));
        console.log('');

        // 4. Delete Lesson
        console.log('▶ [4/4] Running: Delete Lesson.yml');
        const resDelete = await executeBrunoRequest(serverUrl, {
            name: 'Delete Lesson',
            method: 'DELETE',
            urlPath: `/api/v1/lessons/${lessonId}`,
            body: null
        });
        console.log(`   Status:   ${resDelete.status} OK (${resDelete.duration})`);
        console.log(`   Response:`, JSON.stringify(resDelete.body, null, 2));
        console.log('');

        console.log('='.repeat(70));
        console.log('✅ ALL 4 BRUNO LESSONS REQUESTS EXECUTED SUCCESSFULLY!');
        console.log('='.repeat(70));
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

run().catch((err) => {
    console.error('❌ Bruno runner simulation failed:', err);
    process.exit(1);
});
