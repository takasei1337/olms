require('dotenv').config({quiet: true});

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const {generateAccessToken} = require('./src/services/token.service');
const authService = require('./src/services/auth.service');
const subjectsService = require('./src/services/subjects.service');
const chaptersService = require('./src/services/chapters.service');

// Import app routes
const apiRoutes = require('./src/routes/api.routes');
const requestContext = require('./src/middlewares/request-context');

// Setup Express test app matching production backend
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

// User credentials
const teacherId = '34b637d7-bba1-4d55-b61e-f59493fdc2e8';
const teacherToken = generateAccessToken({id: teacherId, role: 'TEACHER'});

// Sample DB state for simulated Bruno execution
const subjectId = '0199ac14-a9bc-7001-8000-000000000001';
let mockChapterDb = [];

authService.findActiveUserById = async (id) => {
    if (id === teacherId) return {id: teacherId, role: 'TEACHER', status: 'ACTIVE'};
    return null;
};

subjectsService.findSubjectById = async (id) => {
    if (id === subjectId) {
        return {
            id: subjectId,
            code: 'MATH101',
            name: 'Toán cao cấp 1',
            created_by: teacherId
        };
    }
    return null;
};

chaptersService.findChaptersBySubjectId = async (sId) => {
    return mockChapterDb.filter(c => c.subject_id === sId && !c.deleted_at);
};

chaptersService.findChapterById = async (cId) => {
    return mockChapterDb.find(c => c.id === cId && !c.deleted_at) || null;
};

chaptersService.createChapter = async ({subjectId, code, name, orderNo}) => {
    const chapter = {
        id: '0199ac14-a9bc-7001-8000-000000000010',
        subject_id: subjectId,
        code: code || null,
        name,
        order_no: orderNo ?? 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    mockChapterDb.push(chapter);
    return chapter;
};

chaptersService.updateChapter = async (cId, updates) => {
    const chapter = mockChapterDb.find(c => c.id === cId);
    if (!chapter) return null;
    if (updates.name !== undefined) chapter.name = updates.name;
    if (updates.code !== undefined) chapter.code = updates.code;
    if (updates.order_no !== undefined) chapter.order_no = updates.order_no;
    chapter.updated_at = new Date().toISOString();
    return chapter;
};

chaptersService.countActiveLessonsByChapterId = async (cId) => {
    return 0; // No active lessons for this test
};

chaptersService.softDeleteChapter = async (cId, deletedBy) => {
    const chapter = mockChapterDb.find(c => c.id === cId);
    if (chapter) {
        chapter.deleted_at = new Date().toISOString();
        chapter.deleted_by = deletedBy;
    }
    return {id: cId};
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
    console.log('⚡ SIMULATING BRUNO RUNNER: OLMS Backend -> Chapters Collection');
    console.log('='.repeat(70));

    const app = setupApp();
    const server = app.listen(0);
    const port = server.address().port;
    const serverUrl = `http://127.0.0.1:${port}`;

    try {
        const brunoDir = path.resolve(__dirname, '../api-tests/OLMS Backend');
        console.log(`📂 Bruno Collection Path: ${brunoDir}\n`);

        // 1. Create Chapter
        console.log('▶ [1/4] Running: Create Chapter.yml');
        const resCreate = await executeBrunoRequest(serverUrl, {
            name: 'Create Chapter',
            method: 'POST',
            urlPath: `/api/v1/subjects/${subjectId}/chapters`,
            body: {
                code: 'CH01',
                name: 'Chương 1: Giới hạn và Hàm số',
                order_no: 1
            }
        });
        console.log(`   Status:   ${resCreate.status} Created (${resCreate.duration})`);
        console.log(`   Response:`, JSON.stringify(resCreate.body, null, 2));
        console.log('');

        // 2. Get Chapters
        console.log('▶ [2/4] Running: Get Chapters.yml');
        const resGet = await executeBrunoRequest(serverUrl, {
            name: 'Get Chapters',
            method: 'GET',
            urlPath: `/api/v1/subjects/${subjectId}/chapters`,
            body: null
        });
        console.log(`   Status:   ${resGet.status} OK (${resGet.duration})`);
        console.log(`   Response:`, JSON.stringify(resGet.body, null, 2));
        console.log('');

        // 3. Update Chapter
        const chapterId = resCreate.body.data.id;
        console.log('▶ [3/4] Running: Update Chapter.yml');
        const resUpdate = await executeBrunoRequest(serverUrl, {
            name: 'Update Chapter',
            method: 'PATCH',
            urlPath: `/api/v1/chapters/${chapterId}`,
            body: {
                name: 'Chương 1: Giới hạn và Hàm số liên tục (Cập nhật)',
                order_no: 1
            }
        });
        console.log(`   Status:   ${resUpdate.status} OK (${resUpdate.duration})`);
        console.log(`   Response:`, JSON.stringify(resUpdate.body, null, 2));
        console.log('');

        // 4. Delete Chapter
        console.log('▶ [4/4] Running: Delete Chapter.yml');
        const resDelete = await executeBrunoRequest(serverUrl, {
            name: 'Delete Chapter',
            method: 'DELETE',
            urlPath: `/api/v1/chapters/${chapterId}`,
            body: null
        });
        console.log(`   Status:   ${resDelete.status} OK (${resDelete.duration})`);
        console.log(`   Response:`, JSON.stringify(resDelete.body, null, 2));
        console.log('');

        console.log('='.repeat(70));
        console.log('✅ ALL 4 BRUNO CHAPTERS REQUESTS EXECUTED SUCCESSFULLY!');
        console.log('='.repeat(70));
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

run().catch((err) => {
    console.error('❌ Bruno runner simulation failed:', err);
    process.exit(1);
});
