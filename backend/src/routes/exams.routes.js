const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const requireAdminOrTeacher = require('../middlewares/require-admin-or-teacher');
const examsService = require('../services/exams.service');

router.use(authenticate);
router.use(requireAdminOrTeacher);

function validateCreateExamInput(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const allowedFields = [
        'code',
        'name',
        'subject_id',
        'delivery_mode',
        'total_questions',
        'duration_minutes',
        'opens_at',
        'closes_at',
        'total_score',
        'result_visibility_mode',
        'form_template_id'
    ];
    const unsupportedFields = Object.keys(body).filter(field => !allowedFields.includes(field));
    if (unsupportedFields.length > 0) {
        return 'Request contains unsupported fields.';
    }

    if (typeof body.code !== 'string' || !body.code.trim()) {
        return 'code is required and must be a non-empty string.';
    }
    if (body.code.trim().length > 30) {
        return 'code must not exceed 30 characters.';
    }

    if (typeof body.name !== 'string' || !body.name.trim()) {
        return 'name is required and must be a non-empty string.';
    }
    if (body.name.trim().length > 200) {
        return 'name must not exceed 200 characters.';
    }

    if (!body.subject_id || !examsService.isValidUUID(body.subject_id)) {
        return 'subject_id is required and must be a valid UUID.';
    }

    if (body.total_questions === undefined || parseInt(body.total_questions, 10) <= 0) {
        return 'total_questions must be an integer greater than 0.';
    }

    if (body.duration_minutes === undefined || parseInt(body.duration_minutes, 10) <= 0) {
        return 'duration_minutes must be an integer greater than 0.';
    }

    if (!body.opens_at || typeof body.opens_at !== 'string') {
        return 'opens_at is required and must be an ISO 8601 date string.';
    }

    if (!body.closes_at || typeof body.closes_at !== 'string') {
        return 'closes_at is required and must be an ISO 8601 date string.';
    }

    const openDate = new Date(body.opens_at);
    const closeDate = new Date(body.closes_at);
    if (isNaN(openDate.getTime()) || isNaN(closeDate.getTime())) {
        return 'opens_at and closes_at must be valid date-time strings.';
    }
    if (closeDate <= openDate) {
        return 'closes_at must be later than opens_at.';
    }

    if (body.delivery_mode !== undefined) {
        if (!['ONLINE', 'PAPER', 'BOTH'].includes(body.delivery_mode)) {
            return 'delivery_mode must be one of: ONLINE, PAPER, BOTH.';
        }
        if (['PAPER', 'BOTH'].includes(body.delivery_mode)) {
            if (!body.form_template_id || !examsService.isValidUUID(body.form_template_id)) {
                return 'form_template_id is required and must be a valid UUID when delivery_mode is PAPER or BOTH.';
            }
        }
    }

    if (body.total_score !== undefined) {
        const score = parseFloat(body.total_score);
        if (isNaN(score) || score <= 0) {
            return 'total_score must be a positive number.';
        }
    }

    if (body.result_visibility_mode !== undefined) {
        if (!['HIDDEN', 'SCORE_ONLY', 'SCORE_AND_STATUS', 'FULL_REVIEW'].includes(body.result_visibility_mode)) {
            return 'result_visibility_mode must be one of: HIDDEN, SCORE_ONLY, SCORE_AND_STATUS, FULL_REVIEW.';
        }
    }

    return null;
}

function validatePatchExamInput(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const allowedFields = [
        'code',
        'name',
        'subject_id',
        'delivery_mode',
        'total_questions',
        'duration_minutes',
        'opens_at',
        'closes_at',
        'total_score',
        'result_visibility_mode',
        'form_template_id'
    ];
    const unsupportedFields = Object.keys(body).filter(field => !allowedFields.includes(field));
    if (unsupportedFields.length > 0) {
        return 'Request contains unsupported fields.';
    }

    if (Object.keys(body).length === 0) {
        return 'At least one field is required for update.';
    }

    if (Object.prototype.hasOwnProperty.call(body, 'code')) {
        if (typeof body.code !== 'string' || !body.code.trim()) {
            return 'code must be a non-empty string.';
        }
        if (body.code.trim().length > 30) {
            return 'code must not exceed 30 characters.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
            return 'name must be a non-empty string.';
        }
        if (body.name.trim().length > 200) {
            return 'name must not exceed 200 characters.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'subject_id')) {
        if (!examsService.isValidUUID(body.subject_id)) {
            return 'subject_id must be a valid UUID.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'total_questions')) {
        const total = parseInt(body.total_questions, 10);
        if (isNaN(total) || total <= 0) {
            return 'total_questions must be an integer greater than 0.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'duration_minutes')) {
        const dur = parseInt(body.duration_minutes, 10);
        if (isNaN(dur) || dur <= 0) {
            return 'duration_minutes must be an integer greater than 0.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'delivery_mode')) {
        if (!['ONLINE', 'PAPER', 'BOTH'].includes(body.delivery_mode)) {
            return 'delivery_mode must be one of: ONLINE, PAPER, BOTH.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'total_score')) {
        const score = parseFloat(body.total_score);
        if (isNaN(score) || score <= 0) {
            return 'total_score must be a positive number.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'result_visibility_mode')) {
        if (!['HIDDEN', 'SCORE_ONLY', 'SCORE_AND_STATUS', 'FULL_REVIEW'].includes(body.result_visibility_mode)) {
            return 'result_visibility_mode must be one of: HIDDEN, SCORE_ONLY, SCORE_AND_STATUS, FULL_REVIEW.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'form_template_id')) {
        if (body.form_template_id !== null && !examsService.isValidUUID(body.form_template_id)) {
            return 'form_template_id must be a valid UUID or null.';
        }
    }

    return null;
}

// GET /exams - List exams
router.get('/', async (req, res, next) => {
    try {
        const { q, subject_id, status, page, page_size } = req.query;

        const result = await examsService.listExams({
            q,
            subject_id,
            status,
            page,
            pageSize: page_size,
            currentUser: req.currentUser
        });

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: result.data,
            meta: result.pagination,
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                code: error.code || 'BAD_REQUEST',
                message: error.message,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// POST /exams - Create new exam in DRAFT status
router.post('/', async (req, res, next) => {
    try {
        const validationError = validateCreateExamInput(req.body);
        if (validationError) {
            const isRangeError = validationError.includes('closes_at must be later than opens_at') ||
                validationError.includes('form_template_id is required');
            return res.status(isRangeError ? 422 : 400).json({
                success: false,
                code: isRangeError ? 'UNPROCESSABLE_ENTITY' : 'INVALID_REQUEST_BODY',
                message: validationError,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const newExam = await examsService.createExam(req.body, req.currentUser);

        return res.status(201).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: newExam,
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                code: error.code || 'BAD_REQUEST',
                message: error.message,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// GET /exams/:examId - Get exam details
router.get('/:examId', async (req, res, next) => {
    try {
        const { examId } = req.params;
        if (!examsService.isValidUUID(examId)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_ID_FORMAT',
                message: 'examId must be a valid UUID.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const exam = await examsService.findExamById(examId);
        if (!exam) {
            return res.status(404).json({
                success: false,
                code: 'EXAM_NOT_FOUND',
                message: `Exam with ID ${examId} not found.`,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Enforce P-02 Ownership: TEACHER can only view their own exam; ADMIN can view any
        if (req.currentUser.role === 'TEACHER' && exam.created_by !== req.currentUser.id) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to view this exam.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: exam,
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        next(error);
    }
});

// PATCH /exams/:examId - Update DRAFT exam
router.patch('/:examId', async (req, res, next) => {
    try {
        const { examId } = req.params;
        if (!examsService.isValidUUID(examId)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_ID_FORMAT',
                message: 'examId must be a valid UUID.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const validationError = validatePatchExamInput(req.body);
        if (validationError) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_REQUEST_BODY',
                message: validationError,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const updatedExam = await examsService.updateExam(examId, req.body, req.currentUser);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: updatedExam,
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                code: error.code || 'BAD_REQUEST',
                message: error.message,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// DELETE /exams/:examId - Soft delete DRAFT exam
router.delete('/:examId', async (req, res, next) => {
    try {
        const { examId } = req.params;
        if (!examsService.isValidUUID(examId)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_ID_FORMAT',
                message: 'examId must be a valid UUID.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        await examsService.deleteExam(examId, req.currentUser);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: {},
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                code: error.code || 'BAD_REQUEST',
                message: error.message,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// PUT /exams/:examId/matrix - Replace entire DRAFT exam matrix
router.put('/:examId/matrix', async (req, res, next) => {
    try {
        const { examId } = req.params;
        if (!examsService.isValidUUID(examId)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_ID_FORMAT',
                message: 'examId must be a valid UUID.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (!req.body || !Array.isArray(req.body.rows)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_REQUEST_BODY',
                message: 'Field "rows" must be an array of matrix rows.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        await examsService.replaceMatrix(examId, req.body.rows, req.currentUser);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: {},
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                code: error.code || 'BAD_REQUEST',
                message: error.message,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// PUT /exams/:examId/grading-rules - Replace DRAFT grading rules
router.put('/:examId/grading-rules', async (req, res, next) => {
    try {
        const { examId } = req.params;
        if (!examsService.isValidUUID(examId)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_ID_FORMAT',
                message: 'examId must be a valid UUID.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (!req.body || !Array.isArray(req.body.rules)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_REQUEST_BODY',
                message: 'Field "rules" must be an array of grading rules.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        await examsService.replaceGradingRules(examId, req.body.rules, req.currentUser);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: {},
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                code: error.code || 'BAD_REQUEST',
                message: error.message,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// POST /exams/:examId/matrix/validate - Deep validate matrix feasibility against active question bank
router.post('/:examId/matrix/validate', async (req, res, next) => {
    try {
        const { examId } = req.params;
        if (!examsService.isValidUUID(examId)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_ID_FORMAT',
                message: 'examId must be a valid UUID.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const validationResult = await examsService.validateMatrix(examId, req.currentUser);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: validationResult,
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                code: error.code || 'BAD_REQUEST',
                message: error.message,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// POST /exams/:examId/generate - Sinh đề gốc + mã đề, đóng băng transaction
router.post('/:examId/generate', async (req, res, next) => {
    try {
        const { examId } = req.params;
        const {
            variant_count,
            variant_code_start,
            strict_topic_balance,
            similarity_threshold
        } = req.body || {};

        const result = await examsService.generateExamVariants(examId, {
            variant_count,
            variant_code_start,
            strict_topic_balance,
            similarity_threshold
        }, req.currentUser);

        return res.status(201).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: result,
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                code: error.code || 'BAD_REQUEST',
                message: error.message,
                details: error.details,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// GET /exams/:examId/variants - Liệt kê mã đề để in/đối chiếu
router.get('/:examId/variants', async (req, res, next) => {
    try {
        const { examId } = req.params;
        const variants = await examsService.listExamVariants(examId, req.currentUser);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: variants,
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                code: error.code || 'BAD_REQUEST',
                message: error.message,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// POST /exams/:examId/publish - Phát hành đề và mở cấp phát tài khoản
router.post('/:examId/publish', async (req, res, next) => {
    try {
        const { examId } = req.params;
        const updated = await examsService.publishExam(examId, req.currentUser);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: updated,
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                code: error.code || 'BAD_REQUEST',
                message: error.message,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// POST /exams/:examId/start - Đánh dấu bắt đầu kỳ thi
router.post('/:examId/start', async (req, res, next) => {
    try {
        const { examId } = req.params;
        const updated = await examsService.startExam(examId, req.currentUser);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: updated,
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                code: error.code || 'BAD_REQUEST',
                message: error.message,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// POST /exams/:examId/end - Kết thúc kỳ thi, thu bài chưa nộp
router.post('/:examId/end', async (req, res, next) => {
    try {
        const { examId } = req.params;
        const updated = await examsService.endExam(examId, req.currentUser);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: updated,
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                code: error.code || 'BAD_REQUEST',
                message: error.message,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// POST /exams/:examId/archive - Đóng băng kỳ thi vào lưu trữ
router.post('/:examId/archive', async (req, res, next) => {
    try {
        const { examId } = req.params;
        const updated = await examsService.archiveExam(examId, req.currentUser);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: updated,
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                code: error.code || 'BAD_REQUEST',
                message: error.message,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// POST /exams/:examId/cancel - Hủy kỳ thi trước giờ diễn ra
router.post('/:examId/cancel', async (req, res, next) => {
    try {
        const { examId } = req.params;
        const { reason } = req.body || {};
        const updated = await examsService.cancelExam(examId, { reason }, req.currentUser);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: updated,
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                code: error.code || 'BAD_REQUEST',
                message: error.message,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// POST /exams/:examId/print-files - Tạo link tải PDF đề/phiếu giấy
router.post('/:examId/print-files', async (req, res, next) => {
    try {
        const { examId } = req.params;
        const result = await examsService.getPrintFiles(examId, req.currentUser);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Thành công',
            data: result,
            timestamp: new Date().toISOString(),
            trace_id: req.traceId
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                code: error.code || 'BAD_REQUEST',
                message: error.message,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

module.exports = router;
