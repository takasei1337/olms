const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const requireAdmin = require('../middlewares/require-admin');
const requireAdminOrTeacher = require('../middlewares/require-admin-or-teacher');
const questionTypesService = require('../services/question-types.service');
const {UUID_REGEX} = require('../validators/answer-spec.validator');

router.use(authenticate);

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

function validateQuestionTypePayload(body, isPatch = false) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const allowedFields = ['code', 'name', 'description'];
    const keys = Object.keys(body);
    const unsupported = keys.filter(k => !allowedFields.includes(k));
    if (unsupported.length > 0) {
        return 'Request contains unsupported fields.';
    }

    if (isPatch && keys.length === 0) {
        return 'At least one field is required for update.';
    }

    if (!isPatch || Object.prototype.hasOwnProperty.call(body, 'code')) {
        if (typeof body.code !== 'string' || !body.code.trim()) {
            return 'code is required and must be a non-empty string.';
        }
        if (body.code.trim().length > 30) {
            return 'code must not exceed 30 characters.';
        }
    }

    if (!isPatch || Object.prototype.hasOwnProperty.call(body, 'name')) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
            return 'name is required and must be a non-empty string.';
        }
        if (body.name.trim().length > 100) {
            return 'name must not exceed 100 characters.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'description') && body.description !== null) {
        if (typeof body.description !== 'string') {
            return 'description must be a string or null.';
        }
    }

    return null;
}

// GET /api/v1/question-types - Danh mục dạng câu hỏi
router.get('/', requireAdminOrTeacher, async (req, res, next) => {
    try {
        const questionTypes = await questionTypesService.findQuestionTypes();

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Question types retrieved successfully.',
            data: questionTypes,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/question-types - Thêm dạng câu hỏi (ADMIN only)
router.post('/', requireAdmin, async (req, res, next) => {
    try {
        const validationError = validateQuestionTypePayload(req.body, false);
        if (validationError) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', validationError);
        }

        const code = req.body.code.trim().toUpperCase();
        const name = req.body.name.trim();
        const description = req.body.description === undefined ? null : req.body.description;

        const existing = await questionTypesService.findQuestionTypeByCode(code);
        if (existing) {
            return sendError(res, req, 409, 'CONFLICT', `Question type with code '${code}' already exists.`);
        }

        const created = await questionTypesService.createQuestionType({code, name, description});

        return res.status(201).json({
            success: true,
            code: 'SUCCESS',
            message: 'Question type created successfully.',
            data: created,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// PATCH /api/v1/question-types/:typeId - Cập nhật dạng câu hỏi (ADMIN only)
router.patch('/:typeId', requireAdmin, async (req, res, next) => {
    try {
        const {typeId} = req.params;
        if (!UUID_REGEX.test(typeId)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid question type ID format.');
        }

        const validationError = validateQuestionTypePayload(req.body, true);
        if (validationError) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', validationError);
        }

        const existing = await questionTypesService.findQuestionTypeById(typeId);
        if (!existing) {
            return sendError(res, req, 404, 'QUESTION_TYPE_NOT_FOUND', 'Question type not found.');
        }

        const updates = {};
        if (Object.prototype.hasOwnProperty.call(req.body, 'code')) {
            const normalizedCode = req.body.code.trim().toUpperCase();
            if (normalizedCode !== existing.code) {
                const duplicate = await questionTypesService.findQuestionTypeByCode(normalizedCode);
                if (duplicate && duplicate.id !== typeId) {
                    return sendError(res, req, 409, 'CONFLICT', `Question type with code '${normalizedCode}' already exists.`);
                }
            }
            updates.code = normalizedCode;
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
            updates.name = req.body.name.trim();
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
            updates.description = req.body.description;
        }

        const updated = await questionTypesService.updateQuestionType(typeId, updates);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Question type updated successfully.',
            data: updated,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/v1/question-types/:typeId - Ngưng dạng câu hỏi (ADMIN only)
router.delete('/:typeId', requireAdmin, async (req, res, next) => {
    try {
        const {typeId} = req.params;
        if (!UUID_REGEX.test(typeId)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid question type ID format.');
        }

        const existing = await questionTypesService.findQuestionTypeById(typeId);
        if (!existing) {
            return sendError(res, req, 404, 'QUESTION_TYPE_NOT_FOUND', 'Question type not found.');
        }

        const inUse = await questionTypesService.isQuestionTypeInUse(typeId);
        if (inUse) {
            return sendError(res, req, 409, 'CONFLICT', 'Cannot delete question type that is currently in use.');
        }

        await questionTypesService.softDeleteQuestionType(typeId, req.auth.sub);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Question type deleted successfully.',
            data: {},
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;

