const express = require('express');
const authenticate = require('../middlewares/authenticate');
const requireStudent = require('../middlewares/require-student');
const studentExamService = require('../services/student-exam.service');
const resultsService = require('../services/results.service');
const {UUID_REGEX} = require('../validators/answer-spec.validator');

const router = express.Router();

router.use(authenticate);
router.use(requireStudent);

function setNoStore(res) {
    res.setHeader('Cache-Control', 'private, no-store');
}

function sendError(res, req, status, code, message, data = null) {
    setNoStore(res);
    return res.status(status).json({
        success: false,
        code,
        message,
        data,
        trace_id: req.traceId,
        timestamp: new Date().toISOString()
    });
}

function handleServiceError(err, req, res, next) {
    if (err && err.status && err.code) {
        return sendError(res, req, err.status, err.code, err.message, err.data ?? null);
    }
    return next(err);
}

// 1. GET /api/v1/me/exams - Danh sách kỳ thi được chỉ định cho thí sinh
router.get('/exams', async (req, res, next) => {
    try {
        const exams = await studentExamService.listMyExams(req.currentUser.id);
        setNoStore(res);
        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Assigned exams retrieved successfully.',
            data: exams,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 2. POST /api/v1/me/exams/:examId/session - Bắt đầu hoặc khôi phục phiên thi
router.post('/exams/:examId/session', async (req, res, next) => {
    try {
        const {examId} = req.params;
        if (!UUID_REGEX.test(examId)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid exam ID format.');
        }

        const session = await studentExamService.startOrResumeSession(examId, req.currentUser.id);
        setNoStore(res);
        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam session active.',
            data: session,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 3. GET /api/v1/me/exams/:examId/session - Khôi phục đề, đáp án đã lưu và thời gian server
router.get('/exams/:examId/session', async (req, res, next) => {
    try {
        const {examId} = req.params;
        if (!UUID_REGEX.test(examId)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid exam ID format.');
        }

        const session = await studentExamService.getActiveSession(examId, req.currentUser.id);
        setNoStore(res);
        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam session retrieved successfully.',
            data: session,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 4. PUT /api/v1/me/submissions/:submissionId/answers/:variantQuestionId - Autosave CAS theo từng câu
router.put('/submissions/:submissionId/answers/:variantQuestionId', async (req, res, next) => {
    try {
        const {submissionId, variantQuestionId} = req.params;
        if (!UUID_REGEX.test(submissionId)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid submission ID format.');
        }
        if (!UUID_REGEX.test(variantQuestionId)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid variant question ID format.');
        }

        const ack = await studentExamService.autosaveAnswer(
            submissionId,
            variantQuestionId,
            req.body,
            req.currentUser.id
        );

        setNoStore(res);
        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Answer saved.',
            data: ack,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 5. POST /api/v1/me/submissions/:submissionId/submit - Nộp bài chính thức một lần (idempotent)
router.post('/submissions/:submissionId/submit', async (req, res, next) => {
    try {
        const {submissionId} = req.params;
        if (!UUID_REGEX.test(submissionId)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid submission ID format.');
        }

        const idempotencyKey = req.get('Idempotency-Key');
        if (!idempotencyKey || !UUID_REGEX.test(idempotencyKey.trim())) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Idempotency-Key header is required and must be a valid UUID.');
        }

        const receipt = await studentExamService.submitOnlineSubmission(
            submissionId,
            idempotencyKey.trim(),
            req.currentUser.id
        );

        setNoStore(res);
        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Submission submitted successfully.',
            data: receipt,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 6. GET /api/v1/me/results - Danh sách kết quả các kỳ thi đã tham gia
router.get('/results', async (req, res, next) => {
    try {
        const results = await resultsService.listMyResults(req.currentUser.id);
        setNoStore(res);
        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam results retrieved successfully.',
            data: results,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 7. GET /api/v1/me/results/:examId - Xem kết quả theo mức công bố (P-05)
router.get('/results/:examId', async (req, res, next) => {
    try {
        const {examId} = req.params;
        if (!UUID_REGEX.test(examId)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid exam ID format.');
        }

        const summary = await resultsService.getMyResultForExam(examId, req.currentUser.id);
        setNoStore(res);
        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam result retrieved successfully.',
            data: summary,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 8. GET /api/v1/me/results/:examId/review - Xem chi tiết bài làm theo chính sách P-05
router.get('/results/:examId/review', async (req, res, next) => {
    try {
        const {examId} = req.params;
        if (!UUID_REGEX.test(examId)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid exam ID format.');
        }

        const review = await resultsService.getMyResultReview(examId, req.currentUser.id);
        setNoStore(res);
        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam result review retrieved successfully.',
            data: review,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

module.exports = router;
