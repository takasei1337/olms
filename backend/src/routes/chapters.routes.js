const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const requireAdminOrTeacher = require('../middlewares/require-admin-or-teacher');
const chaptersService = require('../services/chapters.service');
const subjectsService = require('../services/subjects.service');
const lessonsService = require('../services/lessons.service');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.use(authenticate);
router.use(requireAdminOrTeacher);

function validatePatchChapterInput(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const allowedFields = ['code', 'name', 'order_no'];
    const unsupportedFields = Object.keys(body).filter(field => !allowedFields.includes(field));
    if (unsupportedFields.length > 0) {
        return 'Request contains unsupported fields.';
    }

    if (Object.keys(body).length === 0) {
        return 'At least one field is required for update.';
    }

    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
            return 'name must be a non-empty string.';
        }
        if (body.name.trim().length > 150) {
            return 'name must not exceed 150 characters.';
        }
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

// 1. PATCH /api/v1/chapters/:chapterId - Sửa chương
router.patch('/:chapterId', async (req, res, next) => {
    try {
        const {chapterId} = req.params;

        if (!UUID_REGEX.test(chapterId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid chapter ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const validationError = validatePatchChapterInput(req.body);
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

        const existingChapter = await chaptersService.findChapterById(chapterId);
        if (!existingChapter) {
            return res.status(404).json({
                success: false,
                code: 'CHAPTER_NOT_FOUND',
                message: 'Chapter not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // P-02: Check ownership via parent subject
        const subject = await subjectsService.findSubjectById(existingChapter.subject_id);
        if (req.currentUser.role === 'TEACHER' && (!subject || subject.created_by !== req.currentUser.id)) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to update this chapter.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const updatedChapter = await chaptersService.updateChapter(chapterId, req.body);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Chapter updated successfully.',
            data: updatedChapter,
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

// 2. DELETE /api/v1/chapters/:chapterId - Xóa mềm chương
router.delete('/:chapterId', async (req, res, next) => {
    try {
        const {chapterId} = req.params;

        if (!UUID_REGEX.test(chapterId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid chapter ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const existingChapter = await chaptersService.findChapterById(chapterId);
        if (!existingChapter) {
            return res.status(404).json({
                success: false,
                code: 'CHAPTER_NOT_FOUND',
                message: 'Chapter not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // P-02: Check ownership via parent subject
        const subject = await subjectsService.findSubjectById(existingChapter.subject_id);
        if (req.currentUser.role === 'TEACHER' && (!subject || subject.created_by !== req.currentUser.id)) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to delete this chapter.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Check active lessons
        const activeLessonsCount = await chaptersService.countActiveLessonsByChapterId(chapterId);
        if (activeLessonsCount > 0) {
            return res.status(409).json({
                success: false,
                code: 'CHAPTER_HAS_LESSONS',
                message: 'Cannot delete chapter that contains active lessons.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        await chaptersService.softDeleteChapter(chapterId, req.currentUser.id);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Chapter deleted successfully.',
            data: {id: chapterId},
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

function validateCreateLessonInput(body) {
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

// 3. GET /api/v1/chapters/:chapterId/lessons - Liệt kê bài học của chương
router.get('/:chapterId/lessons', async (req, res, next) => {
    try {
        const {chapterId} = req.params;

        if (!UUID_REGEX.test(chapterId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid chapter ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const chapter = await chaptersService.findChapterById(chapterId);
        if (!chapter) {
            return res.status(404).json({
                success: false,
                code: 'CHAPTER_NOT_FOUND',
                message: 'Chapter not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const lessons = await lessonsService.findLessonsByChapterId(chapterId);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Lessons fetched successfully.',
            data: lessons,
            meta: null,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

// 4. POST /api/v1/chapters/:chapterId/lessons - Thêm bài học mới cho chương
router.post('/:chapterId/lessons', async (req, res, next) => {
    try {
        const {chapterId} = req.params;

        if (!UUID_REGEX.test(chapterId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid chapter ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const validationError = validateCreateLessonInput(req.body);
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

        const chapter = await chaptersService.findChapterById(chapterId);
        if (!chapter) {
            return res.status(404).json({
                success: false,
                code: 'CHAPTER_NOT_FOUND',
                message: 'Chapter not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // P-02: Check ownership via parent subject
        const subject = await subjectsService.findSubjectById(chapter.subject_id);
        if (req.currentUser.role === 'TEACHER' && (!subject || subject.created_by !== req.currentUser.id)) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to add lesson to this chapter.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const lesson = await lessonsService.createLesson({
            chapterId,
            code: req.body.code,
            name: req.body.name,
            orderNo: req.body.order_no
        });

        return res.status(201).json({
            success: true,
            code: 'SUCCESS',
            message: 'Lesson created successfully.',
            data: lesson,
            meta: null,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                code: 'CONFLICT',
                message: 'Lesson with this code already exists in this chapter.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

module.exports = router;
