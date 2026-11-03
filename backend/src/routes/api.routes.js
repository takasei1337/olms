const express = require('express');

const router = express.Router();
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const subjectsRoutes = require('./subjects.routes');

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/subjects', subjectsRoutes);

module.exports = router;
