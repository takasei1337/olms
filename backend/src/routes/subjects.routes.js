const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const requireAdminOrTeacher = require('../middlewares/require-admin-or-teacher');
const subjectsService = require('../services/subjects.service');
const chaptersService = require('../services/chapters.service');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.use(authenticate);
router.use(requireAdminOrTeacher);

function validateCreateSubjectInput(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const allowedFields = ['code', 'name', 'description'];
    const unsupportedFields = Object.keys(body).filter(field => !allowedFields.includes(field));
    if (unsupportedFields.length > 0) {
        return 'Request contains unsupported fields.';
    }

    if (typeof body.code !== 'string' || !body.code.trim()) {
        return 'code is required and must be a non-empty string.';
    }
    if (body.code.trim().length > 20) {
        return 'code must not exceed 20 characters.';
    }

    if (typeof body.name !== 'string' || !body.name.trim()) {
        return 'name is required and must be a non-empty string.';
    }
    if (body.name.trim().length > 150) {
        return 'name must not exceed 150 characters.';
    }

    if (Object.prototype.hasOwnProperty.call(body, 'description') && body.description !== null) {
        if (typeof body.description !== 'string') {
            return 'description must be a string or null.';
        }
    }

    return null;
}

function validatePatchSubjectInput(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const allowedFields = ['code', 'name', 'description'];
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
        if (body.code.trim().length > 20) {
            return 'code must not exceed 20 characters.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
            return 'name must be a non-empty string.';
        }
        if (body.name.trim().length > 150) {
            return 'name must not exceed 150 characters.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'description') && body.description !== null) {
        if (typeof body.description !== 'string') {
            return 'description must be a string or null.';
        }
    }

    return null;
}

// 1. GET /api/v1/subjects - Danh sách môn học
router.get('/', async (req, res, next) => {
    try {
        const q = String(req.query.q ?? '').trim();
        const page = Number(req.query.page ?? 1);
        const pageSize = Number(req.query.page_size ?? 20);

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

        const {subjects, total} = await subjectsService.findSubjects(from, to, q);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Subjects retrieved successfully.',
            data: subjects,
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
        next(error);
    }
});

// 2. POST /api/v1/subjects - Tạo môn học
router.post('/', async (req, res, next) => {
    try {
        const validationError = validateCreateSubjectInput(req.body);
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

        const {code, name, description} = req.body;
        const createdBy = req.currentUser.id;

        const subject = await subjectsService.createSubject({
            code: code.trim(),
            name: name.trim(),
            description: description !== undefined ? (typeof description === 'string' ? description.trim() : description) : null,
            createdBy
        });

        return res.status(201).json({
            success: true,
            code: 'SUCCESS',
            message: 'Subject created successfully.',
            data: subject,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                code: 'CONFLICT',
                message: 'Subject with this code already exists.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// 3. PATCH /api/v1/subjects/:subjectId - Cập nhật môn học
router.patch('/:subjectId', async (req, res, next) => {
    try {
        const {subjectId} = req.params;

        if (!UUID_REGEX.test(subjectId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid subject ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const validationError = validatePatchSubjectInput(req.body);
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

        const existingSubject = await subjectsService.findSubjectById(subjectId);
        if (!existingSubject) {
            return res.status(404).json({
                success: false,
                code: 'SUBJECT_NOT_FOUND',
                message: 'Subject not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // P-02: ADMIN can update any; TEACHER can only update their own subjects
        if (req.currentUser.role === 'TEACHER' && existingSubject.created_by !== req.currentUser.id) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to update this subject.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const updates = {};
        if (Object.prototype.hasOwnProperty.call(req.body, 'code')) {
            updates.code = req.body.code.trim();
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
            updates.name = req.body.name.trim();
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
            updates.description = typeof req.body.description === 'string' ? req.body.description.trim() : req.body.description;
        }

        const updatedSubject = await subjectsService.updateSubject(subjectId, updates);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Subject updated successfully.',
            data: updatedSubject,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                code: 'CONFLICT',
                message: 'Subject with this code already exists.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

// 4. DELETE /api/v1/subjects/:subjectId - Xóa mềm môn học
router.delete('/:subjectId', async (req, res, next) => {
    try {
        const {subjectId} = req.params;

        if (!UUID_REGEX.test(subjectId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid subject ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const existingSubject = await subjectsService.findSubjectById(subjectId);
        if (!existingSubject) {
            return res.status(404).json({
                success: false,
                code: 'SUBJECT_NOT_FOUND',
                message: 'Subject not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // P-02: ADMIN can delete any; TEACHER can only delete their own subjects
        if (req.currentUser.role === 'TEACHER' && existingSubject.created_by !== req.currentUser.id) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to delete this subject.',
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        await subjectsService.softDeleteSubject(subjectId, req.currentUser.id);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Subject deleted successfully.',
            data: {},
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

function validateCreateChapterInput(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const allowedFields = ['code', 'name', 'order_no'];
    const unsupportedFields = Object.keys(body).filter(field => !allowedFields.includes(field));
    if (unsupportedFields.length > 0) {
        return 'Request contains unsupported fields.';
    }

    if (typeof body.name !== 'string' || !body.name.trim()) {
        return 'name is required and must be a non-empty string.';
    }
    if (body.name.trim().length > 150) {
        return 'name must not exceed 150 characters.';
    }

    if (Object.prototype.hasOwnProperty.call(body, 'code') && body.code !== null) {
        if (typeof body.code !== 'string') {
            return 'code must be a string or null.';
        }
        if (body.code.trim().length > 20) {
            return 'code must not exceed 20 characters.';
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'order_no')) {
        if (!Number.isInteger(body.order_no) || body.order_no < 0) {
            return 'order_no must be a non-negative integer.';
        }
    }

    return null;
}

// 5. GET /api/v1/subjects/:subjectId/chapters - Liệt kê chương của môn
router.get('/:subjectId/chapters', async (req, res, next) => {
    try {
        const {subjectId} = req.params;

        if (!UUID_REGEX.test(subjectId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid subject ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const subject = await subjectsService.findSubjectById(subjectId);
        if (!subject) {
            return res.status(404).json({
                success: false,
                code: 'SUBJECT_NOT_FOUND',
                message: 'Subject not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const chapters = await chaptersService.findChaptersBySubjectId(subjectId);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Chapters fetched successfully.',
            data: chapters,
            meta: null,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// 6. POST /api/v1/subjects/:subjectId/chapters - Thêm chương mới cho môn
router.post('/:subjectId/chapters', async (req, res, next) => {
    try {
        const {subjectId} = req.params;

        if (!UUID_REGEX.test(subjectId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid subject ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const validationError = validateCreateChapterInput(req.body);
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

        const subject = await subjectsService.findSubjectById(subjectId);
        if (!subject) {
            return res.status(404).json({
                success: false,
                code: 'SUBJECT_NOT_FOUND',
                message: 'Subject not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // P-02: TEACHER can only add chapter to their own subject
        if (req.currentUser.role === 'TEACHER' && subject.created_by !== req.currentUser.id) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to add chapter to this subject.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const chapter = await chaptersService.createChapter({
            subjectId,
            code: req.body.code,
            name: req.body.name,
            orderNo: req.body.order_no
        });

        return res.status(201).json({
            success: true,
            code: 'SUCCESS',
            message: 'Chapter created successfully.',
            data: chapter,
            meta: null,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                code: 'CONFLICT',
                message: 'Chapter with this code already exists in this subject.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

module.exports = router;
