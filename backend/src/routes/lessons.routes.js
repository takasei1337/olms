const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const requireAdminOrTeacher = require('../middlewares/require-admin-or-teacher');
const lessonsService = require('../services/lessons.service');
const chaptersService = require('../services/chapters.service');
const subjectsService = require('../services/subjects.service');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.use(authenticate);
router.use(requireAdminOrTeacher);

function validatePatchLessonInput(body) {
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

// 1. PATCH /api/v1/lessons/:lessonId - Sửa bài học
router.patch('/:lessonId', async (req, res, next) => {
    try {
        const {lessonId} = req.params;

        if (!UUID_REGEX.test(lessonId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid lesson ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const validationError = validatePatchLessonInput(req.body);
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

        const existingLesson = await lessonsService.findLessonById(lessonId);
        if (!existingLesson) {
            return res.status(404).json({
                success: false,
                code: 'LESSON_NOT_FOUND',
                message: 'Lesson not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // P-02: Check ownership via parent chapter & subject
        const chapter = await chaptersService.findChapterById(existingLesson.chapter_id);
        const subject = chapter ? await subjectsService.findSubjectById(chapter.subject_id) : null;
        if (req.currentUser.role === 'TEACHER' && (!subject || subject.created_by !== req.currentUser.id)) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to update this lesson.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const updatedLesson = await lessonsService.updateLesson(lessonId, req.body);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Lesson updated successfully.',
            data: updatedLesson,
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

// 2. DELETE /api/v1/lessons/:lessonId - Xóa mềm bài học
router.delete('/:lessonId', async (req, res, next) => {
    try {
        const {lessonId} = req.params;

        if (!UUID_REGEX.test(lessonId)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid lesson ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const existingLesson = await lessonsService.findLessonById(lessonId);
        if (!existingLesson) {
            return res.status(404).json({
                success: false,
                code: 'LESSON_NOT_FOUND',
                message: 'Lesson not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // P-02: Check ownership via parent chapter & subject
        const chapter = await chaptersService.findChapterById(existingLesson.chapter_id);
        const subject = chapter ? await subjectsService.findSubjectById(chapter.subject_id) : null;
        if (req.currentUser.role === 'TEACHER' && (!subject || subject.created_by !== req.currentUser.id)) {
            return res.status(403).json({
                success: false,
                code: 'FORBIDDEN',
                message: 'You do not have permission to delete this lesson.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        // Check active questions constraint
        const activeQuestionsCount = await lessonsService.countActiveQuestionsByLessonId(lessonId);
        if (activeQuestionsCount > 0) {
            return res.status(409).json({
                success: false,
                code: 'LESSON_HAS_QUESTIONS',
                message: 'Cannot delete lesson that contains active questions.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        await lessonsService.softDeleteLesson(lessonId, req.currentUser.id);

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Lesson deleted successfully.',
            data: {id: lessonId},
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
