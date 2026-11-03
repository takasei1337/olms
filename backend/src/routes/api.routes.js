const express = require('express');

const router = express.Router();
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const subjectsRoutes = require('./subjects.routes');
const questionTypesRoutes = require('./question-types.routes');
const questionsRoutes = require('./questions.routes');

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/subjects', subjectsRoutes);
router.use('/question-types', questionTypesRoutes);
router.use('/questions', questionsRoutes);

module.exports = router;
