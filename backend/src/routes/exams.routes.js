const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const requireAdminOrTeacher = require('../middlewares/require-admin-or-teacher');
const examsService = require('../services/exams.service');
const subjectsService = require('../services/subjects.service');
const {
    UUID_REGEX,
    VALID_EXAM_STATUSES,
    VALID_DELIVERY_MODES,
    validateCreateExamBody,
    validatePatchExamBody,
    validateMatrixReplaceBody,
    validateGradingRulesReplaceBody,
    validateGenerateExamBody
} = require('../validators/exams.validator');

router.use(authenticate);
router.use(requireAdminOrTeacher);

// 1. GET /api/v1/exams - Danh sách kỳ thi
router.get('/', async (req, res, next) => {
    try {
        const {
            q = '',
            subject_id,
            status,
            delivery_mode,
            page: rawPage = 1,
            page_size: rawPageSize = 20
        } = req.query;

        if (subject_id && !UUID_REGEX.test(subject_id)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid subject_id format.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (status && !VALID_EXAM_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: `status must be one of: ${VALID_EXAM_STATUSES.join(', ')}.`,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (delivery_mode && !VALID_DELIVERY_MODES.includes(delivery_mode)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: `delivery_mode must be one of: ${VALID_DELIVERY_MODES.join(', ')}.`,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const page = Number(rawPage);
        const pageSize = Number(rawPageSize);

        if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'page must be a positive integer and page_size must be an integer between 1 and 100.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const {exams, total} = await examsService.findExams({
            from,
            to,
            q: String(q).trim(),
            subject_id,
            status,
            delivery_mode
        });

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exams retrieved successfully.',
            data: exams,
            meta: {
                pagination: {
                    page,
                    page_size: pageSize,
                    total,
                    total_pages: Math.ceil(total / pageSize)
                }
            },
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// 2. POST /api/v1/exams - Tạo kỳ thi
router.post('/', async (req, res, next) => {
    try {
        const validationError = validateCreateExamBody(req.body);
        if (validationError) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: validationError,
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Verify subject_id exists and active
        const subject = await subjectsService.findSubjectById(req.body.subject_id);
        if (!subject) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Subject not found or has been deleted.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const createdExam = await examsService.createExam(req.body, req.currentUser.id);

        return res.status(201).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam created successfully.',
            data: createdExam,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                code: 'CONFLICT',
                message: 'Exam with this code already exists.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// 3. GET /api/v1/exams/:examId - Chi tiết kỳ thi
router.get('/:examId', async (req, res, next) => {
    try {
        const {examId} = req.params;

        if (!UUID_REGEX.test(examId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid exam ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const exam = await examsService.findExamById(examId);
        if (!exam) {
            return res.status(404).json({
                success: false,
                code: 'EXAM_NOT_FOUND',
                message: 'Exam not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam retrieved successfully.',
            data: exam,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// 4. PATCH /api/v1/exams/:examId - Cập nhật cấu hình kỳ thi
router.patch('/:examId', async (req, res, next) => {
    try {
        const {examId} = req.params;

        if (!UUID_REGEX.test(examId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid exam ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const validationError = validatePatchExamBody(req.body);
        if (validationError) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: validationError,
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const existingExam = await examsService.findExamById(examId);
        if (!existingExam) {
            return res.status(404).json({
                success: false,
                code: 'EXAM_NOT_FOUND',
                message: 'Exam not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Ownership check
        if (req.currentUser.role === 'TEACHER' && existingExam.created_by !== req.currentUser.id) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to update this exam.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Must be in DRAFT to edit configuration
        if (existingExam.status !== 'DRAFT') {
            return res.status(409).json({
                success: false,
                code: 'CONFLICT',
                message: `Cannot modify exam configuration after leaving DRAFT status (current status: ${existingExam.status}).`,
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Check subject_id if changing
        if (req.body.subject_id && req.body.subject_id !== existingExam.subject_id) {
            const subject = await subjectsService.findSubjectById(req.body.subject_id);
            if (!subject) {
                return res.status(400).json({
                    success: false,
                    code: 'VALIDATION_ERROR',
                    message: 'Subject not found or has been deleted.',
                    data: null,
                    trace_id: req.traceId,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Check time range logic with existing dates
        const finalOpensAt = req.body.opens_at || existingExam.opens_at;
        const finalClosesAt = req.body.closes_at || existingExam.closes_at;
        if (new Date(finalClosesAt) <= new Date(finalOpensAt)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'closes_at must be strictly after opens_at.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const updatedExam = await examsService.updateExam(examId, req.body);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam updated successfully.',
            data: updatedExam,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                code: 'CONFLICT',
                message: 'Exam with this code already exists.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// 5. DELETE /api/v1/exams/:examId - Xóa mềm kỳ thi
router.delete('/:examId', async (req, res, next) => {
    try {
        const {examId} = req.params;

        if (!UUID_REGEX.test(examId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid exam ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const existingExam = await examsService.findExamById(examId);
        if (!existingExam) {
            return res.status(404).json({
                success: false,
                code: 'EXAM_NOT_FOUND',
                message: 'Exam not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Ownership check
        if (req.currentUser.role === 'TEACHER' && existingExam.created_by !== req.currentUser.id) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to delete this exam.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Must be in DRAFT to delete
        if (existingExam.status !== 'DRAFT') {
            return res.status(409).json({
                success: false,
                code: 'CONFLICT',
                message: `Cannot delete exam that is not in DRAFT status (current status: ${existingExam.status}).`,
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        await examsService.softDeleteExam(examId, req.currentUser.id);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam deleted successfully.',
            data: {},
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// 6. PUT /api/v1/exams/:examId/matrix - Thay thế ma trận đề
router.put('/:examId/matrix', async (req, res, next) => {
    try {
        const {examId} = req.params;

        if (!UUID_REGEX.test(examId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid exam ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const validationError = validateMatrixReplaceBody(req.body);
        if (validationError) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: validationError,
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const existingExam = await examsService.findExamById(examId);
        if (!existingExam) {
            return res.status(404).json({
                success: false,
                code: 'EXAM_NOT_FOUND',
                message: 'Exam not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (req.currentUser.role === 'TEACHER' && existingExam.created_by !== req.currentUser.id) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to update matrix for this exam.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (existingExam.status !== 'DRAFT') {
            return res.status(409).json({
                success: false,
                code: 'CONFLICT',
                message: `Cannot replace matrix when exam is not in DRAFT status (current status: ${existingExam.status}).`,
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const replacedRows = await examsService.replaceExamMatrix(examId, req.body.rows, req.currentUser.id);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam matrix updated successfully.',
            data: {rows: replacedRows},
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// 7. PUT /api/v1/exams/:examId/grading-rules - Thay thế quy tắc chấm điểm
router.put('/:examId/grading-rules', async (req, res, next) => {
    try {
        const {examId} = req.params;

        if (!UUID_REGEX.test(examId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid exam ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const validationError = validateGradingRulesReplaceBody(req.body);
        if (validationError) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: validationError,
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const existingExam = await examsService.findExamById(examId);
        if (!existingExam) {
            return res.status(404).json({
                success: false,
                code: 'EXAM_NOT_FOUND',
                message: 'Exam not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (req.currentUser.role === 'TEACHER' && existingExam.created_by !== req.currentUser.id) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to update grading rules for this exam.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (existingExam.status !== 'DRAFT') {
            return res.status(409).json({
                success: false,
                code: 'CONFLICT',
                message: `Cannot replace grading rules when exam is not in DRAFT status (current status: ${existingExam.status}).`,
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const replacedRules = await examsService.replaceExamGradingRules(examId, req.body.rules, req.currentUser.id);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam grading rules updated successfully.',
            data: {rules: replacedRules},
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// 8. POST /api/v1/exams/:examId/matrix/validate - Kiểm tra ma trận đề
router.post('/:examId/matrix/validate', async (req, res, next) => {
    try {
        const {examId} = req.params;

        if (!UUID_REGEX.test(examId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid exam ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const existingExam = await examsService.findExamById(examId);
        if (!existingExam) {
            return res.status(404).json({
                success: false,
                code: 'EXAM_NOT_FOUND',
                message: 'Exam not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const validationResult = await examsService.validateExamMatrix(examId);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam matrix validation completed.',
            data: validationResult,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// 9. POST /api/v1/exams/:examId/generate - Sinh đề thi và mã đề
router.post('/:examId/generate', async (req, res, next) => {
    try {
        const {examId} = req.params;

        if (!UUID_REGEX.test(examId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid exam ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const validationError = validateGenerateExamBody(req.body);
        if (validationError) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: validationError,
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const existingExam = await examsService.findExamById(examId);
        if (!existingExam) {
            return res.status(404).json({
                success: false,
                code: 'EXAM_NOT_FOUND',
                message: 'Exam not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Ownership check: TEACHER can only generate their own exams
        if (req.currentUser.role === 'TEACHER' && existingExam.created_by !== req.currentUser.id) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to generate variants for this exam.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Status check: Must be in DRAFT status
        if (existingExam.status !== 'DRAFT') {
            return res.status(409).json({
                success: false,
                code: 'CONFLICT',
                message: `Exam must be in DRAFT status to generate variants (current status: ${existingExam.status}).`,
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const result = await examsService.generateExamVariants(
            examId,
            {
                variant_count: req.body.variant_count,
                variant_code_start: String(req.body.variant_code_start).trim()
            },
            req.currentUser.id
        );

        return res.status(201).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam variants generated successfully.',
            data: result,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        const msg = error.message || '';
        if (msg.includes('VARIANT_CODE_OVERFLOW')) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: msg,
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (msg.includes('EXAM_NOT_FOUND')) {
            return res.status(404).json({
                success: false,
                code: 'EXAM_NOT_FOUND',
                message: 'Exam not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (
            msg.includes('EXAM_NOT_IN_DRAFT') ||
            msg.includes('VARIANTS_ALREADY_EXIST') ||
            msg.includes('VARIANT_CODE_CONFLICT') ||
            error.code === '23505' ||
            error.code === 'P0003' ||
            error.code === 'P0008' ||
            error.code === 'P0009'
        ) {
            return res.status(409).json({
                success: false,
                code: 'CONFLICT',
                message: msg || 'Exam generation conflict or exam not in DRAFT status.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (
            msg.includes('TOTAL_QUESTIONS_MISMATCH') ||
            msg.includes('TOTAL_SCORE_MISMATCH') ||
            msg.includes('MISSING_GRADING_RULE') ||
            msg.includes('INSUFFICIENT_QUESTIONS') ||
            msg.includes('MATRIX_EMPTY') ||
            msg.includes('INVALID_MATRIX_CHAPTER') ||
            msg.includes('INVALID_MATRIX_LESSON') ||
            msg.includes('QUESTION_SELECTION_MISMATCH') ||
            error.code === 'P0004' ||
            error.code === 'P0005' ||
            error.code === 'P0006' ||
            error.code === 'P0007' ||
            error.code === 'P0010' ||
            error.code === 'P0011' ||
            error.code === 'P0012'
        ) {
            return res.status(422).json({
                success: false,
                code: 'UNPROCESSABLE_ENTITY',
                message: msg,
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        next(error);
    }
});

// 10. GET /api/v1/exams/:examId/variants - Liệt kê mã đề
router.get('/:examId/variants', async (req, res, next) => {
    try {
        const {examId} = req.params;

        if (!UUID_REGEX.test(examId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid exam ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const existingExam = await examsService.findExamById(examId);
        if (!existingExam) {
            return res.status(404).json({
                success: false,
                code: 'EXAM_NOT_FOUND',
                message: 'Exam not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const variants = await examsService.findExamVariants(examId);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam variants retrieved successfully.',
            data: variants,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// 10. POST /api/v1/exams/:examId/publish - Phát hành kỳ thi
router.post('/:examId/publish', async (req, res, next) => {
    try {
        const {examId} = req.params;

        if (!UUID_REGEX.test(examId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid exam ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const existingExam = await examsService.findExamById(examId);
        if (!existingExam) {
            return res.status(404).json({
                success: false,
                code: 'EXAM_NOT_FOUND',
                message: 'Exam not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Ownership check
        if (req.currentUser.role === 'TEACHER' && existingExam.created_by !== req.currentUser.id) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to publish this exam.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Decision P-08 & Trigger constraint: must be GENERATED before PUBLISHED
        if (existingExam.status !== 'GENERATED') {
            return res.status(409).json({
                success: false,
                code: 'CONFLICT',
                message: `Exam must be in GENERATED status before publishing (current status: ${existingExam.status}).`,
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const publishedExam = await examsService.publishExam(examId, req.currentUser.id);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Exam published successfully.',
            data: publishedExam,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;

