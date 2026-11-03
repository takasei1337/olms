const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const requireAdminOrTeacher = require('../middlewares/require-admin-or-teacher');
const questionTypesService = require('../services/question-types.service');

router.use(authenticate);
router.use(requireAdminOrTeacher);

// GET /api/v1/question-types - Danh mục dạng câu hỏi
router.get('/', async (req, res, next) => {
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

module.exports = router;

