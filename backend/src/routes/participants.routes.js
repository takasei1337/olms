const express = require('express');
const multer = require('multer');
const authenticate = require('../middlewares/authenticate');
const requireAdminOrTeacher = require('../middlewares/require-admin-or-teacher');
const examsService = require('../services/exams.service');
const participantsService = require('../services/participants.service');

const router = express.Router({mergeParams: true});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {fileSize: 5 * 1024 * 1024}
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function getRequestMeta(req) {
    return {
        ip: req.ip,
        userAgent: req.get('user-agent')
    };
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
        sendError(res, req, 403, 'FORBIDDEN', 'You do not have permission to manage participants for this exam.');
        return null;
    }

    return exam;
}

function handleServiceError(err, req, res, next) {
    if (err && err.status && err.code) {
        return sendError(res, req, err.status, err.code, err.message);
    }
    return next(err);
}

function validateCreateParticipantBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const allowedFields = ['student_code', 'full_name', 'email'];
    const unsupported = Object.keys(body).filter(k => !allowedFields.includes(k));
    if (unsupported.length > 0) {
        return 'Request contains unsupported fields.';
    }

    if (typeof body.student_code !== 'string' || !body.student_code.trim()) {
        return 'student_code is required and must be a non-empty string.';
    }
    if (body.student_code.trim().length > 30) {
        return 'student_code must not exceed 30 characters.';
    }

    if (typeof body.full_name !== 'string' || !body.full_name.trim()) {
        return 'full_name is required and must be a non-empty string.';
    }
    if (body.full_name.trim().length > 150) {
        return 'full_name must not exceed 150 characters.';
    }

    if (Object.prototype.hasOwnProperty.call(body, 'email') && body.email !== null) {
        if (typeof body.email !== 'string') {
            return 'email must be a string or null.';
        }
        const trimmedEmail = body.email.trim();
        if (trimmedEmail.length > 150) {
            return 'email must not exceed 150 characters.';
        }
        if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
            return 'email must be a valid email address.';
        }
    }

    return null;
}

function parseImportUpload(req, res, next) {
    upload.single('file')(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
            return sendError(res, req, 413, 'PAYLOAD_TOO_LARGE', 'Uploaded file exceeds 5MB limit.');
        }
        return sendError(res, req, 400, 'VALIDATION_ERROR', err.message || 'Invalid multipart upload.');
    });
}

// Signed short-lived download endpoint (P-01: no passwords/hashes, private/no-store)
router.get('/credentials/download', async (req, res, next) => {
    try {
        const {examId} = req.params;
        if (!examsService.isValidUUID(examId)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid exam ID format.');
        }

        const token = req.query.token;
        const {buffer, contentType, fileName} = await participantsService.buildCredentialsExportFile(examId, token);

        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.status(200).send(buffer);
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

router.use(authenticate);
router.use(requireAdminOrTeacher);

// 1. GET /api/v1/exams/:examId/participants
router.get('/', async (req, res, next) => {
    try {
        const exam = await resolveOwnedExam(req, res);
        if (!exam) return;

        const {
            q = '',
            status,
            page: rawPage = 1,
            page_size: rawPageSize = 20
        } = req.query;

        if (status && !participantsService.VALID_PARTICIPANT_STATUSES.includes(status)) {
            return sendError(
                res,
                req,
                400,
                'VALIDATION_ERROR',
                `status must be one of: ${participantsService.VALID_PARTICIPANT_STATUSES.join(', ')}.`
            );
        }

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

        const {participants, total} = await participantsService.listParticipants(exam.id, {
            q: String(q).trim(),
            status: status || null,
            page,
            pageSize
        });

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Participants retrieved successfully.',
            data: participants,
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

// 2. POST /api/v1/exams/:examId/participants
router.post('/', async (req, res, next) => {
    try {
        const exam = await resolveOwnedExam(req, res);
        if (!exam) return;

        if (!participantsService.PRE_START_EXAM_STATUSES.includes(exam.status)) {
            return sendError(
                res,
                req,
                409,
                'INVALID_EXAM_STATUS',
                `Cannot enroll participants when exam is in ${exam.status} status.`
            );
        }

        const validationError = validateCreateParticipantBody(req.body);
        if (validationError) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', validationError);
        }

        const result = await participantsService.enrollParticipant(
            exam,
            req.body,
            req.currentUser.id,
            getRequestMeta(req)
        );

        res.setHeader('Cache-Control', 'private, no-store');
        return res.status(201).json({
            success: true,
            code: 'SUCCESS',
            message: 'Participant enrolled and credentials issued successfully.',
            data: result,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 3. POST /api/v1/exams/:examId/participants/import/preview
router.post('/import/preview', parseImportUpload, async (req, res, next) => {
    try {
        const exam = await resolveOwnedExam(req, res);
        if (!exam) return;

        if (!participantsService.PRE_START_EXAM_STATUSES.includes(exam.status)) {
            return sendError(
                res,
                req,
                409,
                'INVALID_EXAM_STATUS',
                `Cannot import participants when exam is in ${exam.status} status.`
            );
        }

        if (!req.file) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'file is required in multipart/form-data.');
        }

        const preview = await participantsService.previewParticipantImport(
            exam,
            req.file,
            req.currentUser.id
        );

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Participant import preview generated successfully.',
            data: preview,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 4. POST /api/v1/exams/:examId/participants/import/commit
router.post('/import/commit', async (req, res, next) => {
    try {
        const exam = await resolveOwnedExam(req, res);
        if (!exam) return;

        if (!participantsService.PRE_START_EXAM_STATUSES.includes(exam.status)) {
            return sendError(
                res,
                req,
                409,
                'INVALID_EXAM_STATUS',
                `Cannot commit participant import when exam is in ${exam.status} status.`
            );
        }

        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
        }

        const unsupported = Object.keys(req.body).filter(k => k !== 'import_token');
        if (unsupported.length > 0) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Request contains unsupported fields.');
        }

        if (typeof req.body.import_token !== 'string' || !req.body.import_token.trim()) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'import_token is required and must be a non-empty string.');
        }

        const summary = await participantsService.commitParticipantImport(
            exam,
            req.body.import_token.trim(),
            req.currentUser.id,
            getRequestMeta(req)
        );

        return res.status(201).json({
            success: true,
            code: 'SUCCESS',
            message: 'Participants imported successfully.',
            data: summary,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 5. DELETE /api/v1/exams/:examId/participants/:participantId
router.delete('/:participantId', async (req, res, next) => {
    try {
        const exam = await resolveOwnedExam(req, res);
        if (!exam) return;

        const {participantId} = req.params;
        if (!examsService.isValidUUID(participantId)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid participant ID format.');
        }

        await participantsService.removeParticipant(
            exam,
            participantId,
            req.currentUser.id,
            getRequestMeta(req)
        );

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Participant removed successfully.',
            data: {},
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 6. POST /api/v1/exams/:examId/participants/credentials/export
router.post('/credentials/export', async (req, res, next) => {
    try {
        const exam = await resolveOwnedExam(req, res);
        if (!exam) return;

        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
        }

        const unsupported = Object.keys(req.body).filter(k => k !== 'format');
        if (unsupported.length > 0) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Request contains unsupported fields.');
        }

        if (!['XLSX', 'PDF'].includes(req.body.format)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'format is required and must be XLSX or PDF.');
        }

        const host = req.get('host') || 'localhost:3000';
        const baseUrl = `${req.protocol}://${host}`;
        const link = await participantsService.createCredentialsExportLink(
            exam,
            req.body.format,
            req.currentUser.id,
            baseUrl,
            getRequestMeta(req)
        );

        res.setHeader('Cache-Control', 'private, no-store');
        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Credentials export link generated successfully.',
            data: link,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

// 7. POST /api/v1/exams/:examId/participants/:participantId/credentials/reset
router.post('/:participantId/credentials/reset', async (req, res, next) => {
    try {
        const exam = await resolveOwnedExam(req, res);
        if (!exam) return;

        const {participantId} = req.params;
        if (!examsService.isValidUUID(participantId)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid participant ID format.');
        }

        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
        }

        const unsupported = Object.keys(req.body).filter(k => k !== 'reason');
        if (unsupported.length > 0) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Request contains unsupported fields.');
        }

        if (typeof req.body.reason !== 'string' || !req.body.reason.trim()) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'reason is required and must be a non-empty string.');
        }

        const issued = await participantsService.resetParticipantCredentials(
            exam,
            participantId,
            req.body.reason,
            req.currentUser.id,
            getRequestMeta(req)
        );

        res.setHeader('Cache-Control', 'private, no-store');
        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Participant credentials reset successfully.',
            data: issued,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return handleServiceError(error, req, res, next);
    }
});

module.exports = router;
