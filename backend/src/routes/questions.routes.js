const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const requireAdminOrTeacher = require('../middlewares/require-admin-or-teacher');
const questionsService = require('../services/questions.service');
const questionTypesService = require('../services/question-types.service');
const {validateAnswerSpec, UUID_REGEX} = require('../validators/answer-spec.validator');

router.use(authenticate);
router.use(requireAdminOrTeacher);

const VALID_STATUSES = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'];
const VALID_DIFFICULTY_LEVELS = ['EASY', 'MEDIUM', 'HARD'];

function validateCreateQuestionBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const allowedFields = [
        'lesson_id',
        'type_id',
        'difficulty_level',
        'content',
        'media_url',
        'explanation',
        'requested_status',
        'answer_spec'
    ];

    const unsupported = Object.keys(body).filter(k => !allowedFields.includes(k));
    if (unsupported.length > 0) {
        return 'Request contains unsupported fields.';
    }

    if (Object.prototype.hasOwnProperty.call(body, 'lesson_id') && body.lesson_id !== null) {
        if (typeof body.lesson_id !== 'string' || !UUID_REGEX.test(body.lesson_id)) {
            return 'lesson_id must be a valid UUID or null.';
        }
    }

    if (typeof body.type_id !== 'string' || !UUID_REGEX.test(body.type_id)) {
        return 'type_id is required and must be a valid UUID.';
    }

    if (typeof body.difficulty_level !== 'string' || !VALID_DIFFICULTY_LEVELS.includes(body.difficulty_level)) {
        return `difficulty_level is required and must be one of: ${VALID_DIFFICULTY_LEVELS.join(', ')}.`;
    }

    if (typeof body.content !== 'string' || !body.content.trim()) {
        return 'content is required and must be a non-empty string.';
    }

    if (Object.prototype.hasOwnProperty.call(body, 'media_url') && body.media_url !== null) {
        if (typeof body.media_url !== 'string') {
            return 'media_url must be a string or null.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'explanation') && body.explanation !== null) {
        if (typeof body.explanation !== 'string') {
            return 'explanation must be a string or null.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'requested_status')) {
        if (!['DRAFT', 'ACTIVE'].includes(body.requested_status)) {
            return 'requested_status must be DRAFT or ACTIVE.';
        }
    }

    if (!body.answer_spec || typeof body.answer_spec !== 'object' || Array.isArray(body.answer_spec)) {
        return 'answer_spec is required and must be an object.';
    }

    return null;
}

function validatePatchQuestionBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const allowedFields = [
        'lesson_id',
        'type_id',
        'difficulty_level',
        'content',
        'media_url',
        'explanation',
        'requested_status',
        'answer_spec'
    ];

    const unsupported = Object.keys(body).filter(k => !allowedFields.includes(k));
    if (unsupported.length > 0) {
        return 'Request contains unsupported fields.';
    }

    if (Object.keys(body).length === 0) {
        return 'At least one field is required for update.';
    }

    if (Object.prototype.hasOwnProperty.call(body, 'lesson_id') && body.lesson_id !== null) {
        if (typeof body.lesson_id !== 'string' || !UUID_REGEX.test(body.lesson_id)) {
            return 'lesson_id must be a valid UUID or null.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'type_id')) {
        if (typeof body.type_id !== 'string' || !UUID_REGEX.test(body.type_id)) {
            return 'type_id must be a valid UUID.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'difficulty_level')) {
        if (typeof body.difficulty_level !== 'string' || !VALID_DIFFICULTY_LEVELS.includes(body.difficulty_level)) {
            return `difficulty_level must be one of: ${VALID_DIFFICULTY_LEVELS.join(', ')}.`;
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'content')) {
        if (typeof body.content !== 'string' || !body.content.trim()) {
            return 'content must be a non-empty string.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'media_url') && body.media_url !== null) {
        if (typeof body.media_url !== 'string') {
            return 'media_url must be a string or null.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'explanation') && body.explanation !== null) {
        if (typeof body.explanation !== 'string') {
            return 'explanation must be a string or null.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'requested_status')) {
        if (!['DRAFT', 'ACTIVE'].includes(body.requested_status)) {
            return 'requested_status must be DRAFT or ACTIVE.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'answer_spec')) {
        if (!body.answer_spec || typeof body.answer_spec !== 'object' || Array.isArray(body.answer_spec)) {
            return 'answer_spec must be an object.';
        }
    }

    return null;
}

// 1. GET /api/v1/questions - Tìm kiếm, lọc, phân trang câu hỏi
router.get('/', async (req, res, next) => {
    try {
        const {
            q = '',
            subject_id,
            chapter_id,
            lesson_id,
            type_id,
            difficulty_level,
            status,
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

        if (chapter_id && !UUID_REGEX.test(chapter_id)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid chapter_id format.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (lesson_id && !UUID_REGEX.test(lesson_id)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid lesson_id format.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (type_id && !UUID_REGEX.test(type_id)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid type_id format.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (difficulty_level && !VALID_DIFFICULTY_LEVELS.includes(difficulty_level)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: `difficulty_level must be one of: ${VALID_DIFFICULTY_LEVELS.join(', ')}.`,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (status && !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: `status must be one of: ${VALID_STATUSES.join(', ')}.`,
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

        const {questions, total} = await questionsService.findQuestions({
            from,
            to,
            q: String(q).trim(),
            subject_id,
            chapter_id,
            lesson_id,
            type_id,
            difficulty_level,
            status
        });

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Questions retrieved successfully.',
            data: questions,
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

// 2. POST /api/v1/questions - Tạo câu hỏi
router.post('/', async (req, res, next) => {
    try {
        const validationError = validateCreateQuestionBody(req.body);
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

        const {
            lesson_id,
            type_id,
            difficulty_level,
            content,
            media_url,
            explanation,
            requested_status,
            answer_spec
        } = req.body;

        const questionType = await questionTypesService.findQuestionTypeById(type_id);
        if (!questionType) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid type_id or question type not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const answerSpecError = validateAnswerSpec(answer_spec, questionType.code, content);
        if (answerSpecError) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: answerSpecError,
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const createdQuestion = await questionsService.createQuestion({
            lesson_id: lesson_id ?? null,
            type_id,
            difficulty_level,
            content: content.trim(),
            media_url: media_url ?? null,
            explanation: explanation ?? null,
            requested_status: requested_status ?? 'DRAFT',
            answer_spec,
            created_by: req.currentUser.id
        });

        return res.status(201).json({
            success: true,
            code: 'SUCCESS',
            message: 'Question created successfully.',
            data: createdQuestion,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// 3. GET /api/v1/questions/:questionId - Chi tiết câu hỏi
router.get('/:questionId', async (req, res, next) => {
    try {
        const {questionId} = req.params;

        if (!UUID_REGEX.test(questionId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid question ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const question = await questionsService.findQuestionById(questionId);
        if (!question) {
            return res.status(404).json({
                success: false,
                code: 'QUESTION_NOT_FOUND',
                message: 'Question not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        delete question._rawVersion;

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Question retrieved successfully.',
            data: question,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// 4. PATCH /api/v1/questions/:questionId - Cập nhật câu hỏi
router.patch('/:questionId', async (req, res, next) => {
    try {
        const {questionId} = req.params;

        if (!UUID_REGEX.test(questionId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid question ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const validationError = validatePatchQuestionBody(req.body);
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

        const existingQuestion = await questionsService.findQuestionById(questionId);
        if (!existingQuestion) {
            return res.status(404).json({
                success: false,
                code: 'QUESTION_NOT_FOUND',
                message: 'Question not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Ownership check: TEACHER can only update their own question
        if (req.currentUser.role === 'TEACHER' && existingQuestion.created_by !== req.currentUser.id) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to update this question.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const targetTypeId = req.body.type_id || existingQuestion.type_id;
        const targetContent = req.body.content || existingQuestion.content;

        if (req.body.type_id || req.body.answer_spec) {
            const questionType = await questionTypesService.findQuestionTypeById(targetTypeId);
            if (!questionType) {
                return res.status(400).json({
                    success: false,
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid type_id or question type not found.',
                    data: null,
                    trace_id: req.traceId,
                    timestamp: new Date().toISOString()
                });
            }

            const specToValidate = req.body.answer_spec || existingQuestion.answer_spec;
            const answerSpecError = validateAnswerSpec(specToValidate, questionType.code, targetContent);
            if (answerSpecError) {
                return res.status(400).json({
                    success: false,
                    code: 'VALIDATION_ERROR',
                    message: answerSpecError,
                    data: null,
                    trace_id: req.traceId,
                    timestamp: new Date().toISOString()
                });
            }
        }

        const updatedQuestion = await questionsService.updateQuestion(
            questionId,
            req.body,
            existingQuestion,
            req.currentUser.id
        );

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Question updated successfully.',
            data: updatedQuestion,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// 5. PATCH /api/v1/questions/:questionId/status - Chuyển trạng thái câu hỏi
router.patch('/:questionId/status', async (req, res, next) => {
    try {
        const {questionId} = req.params;

        if (!UUID_REGEX.test(questionId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid question ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Request body must be a JSON object.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const allowedFields = ['status'];
        const unsupported = Object.keys(req.body).filter(k => !allowedFields.includes(k));
        if (unsupported.length > 0) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Request contains unsupported fields.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (!req.body.status || !VALID_STATUSES.includes(req.body.status)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: `status is required and must be one of: ${VALID_STATUSES.join(', ')}.`,
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const existingQuestion = await questionsService.findQuestionById(questionId);
        if (!existingQuestion) {
            return res.status(404).json({
                success: false,
                code: 'QUESTION_NOT_FOUND',
                message: 'Question not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Ownership check
        if (req.currentUser.role === 'TEACHER' && existingQuestion.created_by !== req.currentUser.id) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to update status for this question.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const updated = await questionsService.updateQuestionStatus(questionId, req.body.status);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Question status updated successfully.',
            data: updated,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// 6. DELETE /api/v1/questions/:questionId - Xóa mềm câu hỏi
router.delete('/:questionId', async (req, res, next) => {
    try {
        const {questionId} = req.params;

        if (!UUID_REGEX.test(questionId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid question ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const existingQuestion = await questionsService.findQuestionById(questionId);
        if (!existingQuestion) {
            return res.status(404).json({
                success: false,
                code: 'QUESTION_NOT_FOUND',
                message: 'Question not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Ownership check
        if (req.currentUser.role === 'TEACHER' && existingQuestion.created_by !== req.currentUser.id) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to delete this question.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Cannot delete questions used in exams
        const isUsed = await questionsService.isQuestionUsedInExams(questionId);
        if (isUsed) {
            return res.status(409).json({
                success: false,
                code: 'CONFLICT',
                message: 'Cannot delete question that is already used in exams.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        await questionsService.softDeleteQuestion(questionId, req.currentUser.id);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Question deleted successfully.',
            data: {},
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;

