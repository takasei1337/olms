const express = require('express');

const router = express.Router();
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);

module.exports = router;