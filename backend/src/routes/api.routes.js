const express = require('express');

const router = express.Router();
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const subjectsRoutes = require('./subjects.routes');
const questionTypesRoutes = require('./question-types.routes');
const questionsRoutes = require('./questions.routes');
const chaptersRoutes = require('./chapters.routes');
const lessonsRoutes = require('./lessons.routes');
const examsRoutes = require('./exams.routes');
const participantsRoutes = require('./participants.routes');
const resultsRoutes = require('./results.routes');
const meRoutes = require('./me.routes');
const auditLogsRoutes = require('./audit-logs.routes');

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/audit-logs', auditLogsRoutes);
router.use('/subjects', subjectsRoutes);
router.use('/chapters', chaptersRoutes);
router.use('/lessons', lessonsRoutes);
router.use('/question-types', questionTypesRoutes);
router.use('/questions', questionsRoutes);
router.use('/exams/:examId/participants', participantsRoutes);
router.use('/exams/:examId', resultsRoutes);
router.use('/exams', examsRoutes);
router.use('/me', meRoutes);

module.exports = router;
