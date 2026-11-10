const express = require('express');
const authenticate = require('../middlewares/authenticate');
const requireAdminOrTeacher = require('../middlewares/require-admin-or-teacher');
const examsService = require('../services/exams.service');
const resultsService = require('../services/results.service');

const router = express.Router({mergeParams: true});
const guard = [authenticate, requireAdminOrTeacher];

const PUBLISH_VISIBILITY_MODES = ['SCORE_ONLY', 'SCORE_AND_STATUS', 'FULL_REVIEW'];

function sendError(res, req, status, code, message) {
    return res.status(status).json({
        success: false,
        code,
        message,
        data: null,
        trace_id: req.traceId,
        timestamp: new Date().toISOString()
    });
}

function handleServiceError(err, req, res, next) {
    if (err && err.status && err.code) {
        return sendError(res, req, err.status, err.code, err.message);
    }
    return next(err);
}

async function resolveOwnedExam(req, res) {
    const {examId} = req.params;
    if (!examsService.isValidUUID(examId)) {
        sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid exam ID format.');
        return null;
    }

    const exam = await examsService.findExamById(examId);
    if (!exam) {
        sendError(res, req, 404, 'EXAM_NOT_FOUND', 'Exam not found.');
        return null;
    }

    if (req.currentUser.role === 'TEACHER' && exam.created_by !== req.currentUser.id) {
        sendError(res, req, 403, 'FORBIDDEN', 'You do not have permission to access results for this exam.');
        return null;
    }

    return exam;
}

// 1. GET /api/v1/exams/:examId/results
router.get('/results', ...guard, async (req, res, next) => {
    try {
        const exam = await resolveOwnedExam(req, res);
        if (!exam) return;

        const {
            page: rawPage = 1,
            page_size: rawPageSize = 20,
            status = null,
            student_code = ''
        } = req.query;

        const page = Number(rawPage);
        const pageSize = Number(rawPageSize);
        if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
            return sendError(
                res,
                req,
                400,
                'VALIDATION_ERROR',
                'page must be a positive integer and page_size must be an integer between 1 and 100.'
            );
        }

        const {rows, total} = await resultsService.getExamResultsList(exam, {
            page,
            pageSize,
            status: status ? String(status).trim() : null,
            student_code: String(student_code).trim()
        });

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam results retrieved successfully.',
            data: rows,
            meta: {
                page,
                page_size: pageSize,
                total_items: total,
                total_pages: Math.ceil(total / pageSize)
            },
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 2. POST /api/v1/exams/:examId/results/publish
router.post('/results/publish', ...guard, async (req, res, next) => {
    try {
        const exam = await resolveOwnedExam(req, res);
        if (!exam) return;

        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
        }

        const unsupported = Object.keys(req.body).filter(k => k !== 'result_visibility_mode');
        if (unsupported.length > 0) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Request contains unsupported fields.');
        }

        if (!PUBLISH_VISIBILITY_MODES.includes(req.body.result_visibility_mode)) {
            return sendError(
                res,
                req,
                400,
                'VALIDATION_ERROR',
                `result_visibility_mode is required and must be one of: ${PUBLISH_VISIBILITY_MODES.join(', ')}.`
            );
        }

        const updatedExam = await resultsService.publishExamResults(
            exam,
            {result_visibility_mode: req.body.result_visibility_mode},
            req.currentUser
        );

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam results published successfully.',
            data: updatedExam,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 3. POST /api/v1/exams/:examId/results/visibility
router.post('/results/visibility', ...guard, async (req, res, next) => {
    try {
        const exam = await resolveOwnedExam(req, res);
        if (!exam) return;

        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
        }

        const allowed = ['result_visibility_mode', 'reason'];
        const unsupported = Object.keys(req.body).filter(k => !allowed.includes(k));
        if (unsupported.length > 0) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Request contains unsupported fields.');
        }

        if (!resultsService.VALID_VISIBILITY_MODES.includes(req.body.result_visibility_mode)) {
            return sendError(
                res,
                req,
                400,
                'VALIDATION_ERROR',
                `result_visibility_mode is required and must be one of: ${resultsService.VALID_VISIBILITY_MODES.join(', ')}.`
            );
        }

        const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
        if (reason.length < 5 || reason.length > 500) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'reason is required and must be between 5 and 500 characters.');
        }

        const updatedExam = await resultsService.changeResultVisibility(
            exam,
            {result_visibility_mode: req.body.result_visibility_mode, reason},
            req.currentUser,
            {ip: req.ip, userAgent: req.get('user-agent')}
        );

        res.setHeader('Cache-Control', 'private, no-store');
        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam result visibility updated successfully.',
            data: updatedExam,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 4. GET /api/v1/exams/:examId/results/:submissionId
router.get('/results/:submissionId', ...guard, async (req, res, next) => {
    try {
        const exam = await resolveOwnedExam(req, res);
        if (!exam) return;

        const {submissionId} = req.params;
        if (!examsService.isValidUUID(submissionId)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid submission ID format.');
        }

        const detail = await resultsService.getSubmissionResultDetail(exam, submissionId);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Submission result detail retrieved successfully.',
            data: detail,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 5. GET /api/v1/exams/:examId/statistics
router.get('/statistics', ...guard, async (req, res, next) => {
    try {
        const exam = await resolveOwnedExam(req, res);
        if (!exam) return;

        const stats = await resultsService.getExamStatistics(exam);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam statistics retrieved successfully.',
            data: stats,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

module.exports = router;
