const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const requireAdmin = require('../middlewares/require-admin');
const {findUsers, findUserById, createUser} = require('../services/users.service');

router.use(authenticate);
router.use(requireAdmin);

function validateCreateUserInput(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be a JSON object.';
    }

    const requiredFields = ['username', 'password', 'full_name', 'email', 'role'];

    for (const field of requiredFields) {
        if (typeof body[field] !== 'string' || !body[field].trim()) {
            return `${field} is required and must be a non-empty string.`;
        }
    }

    if (body.username.length > 50) {
        return 'username must not exceed 50 characters.';
    }

    const validPassword =
        body.password.length >= 8 &&
        /[A-Z]/.test(body.password) &&
        /[a-z]/.test(body.password) &&
        /[0-9]/.test(body.password) &&
        /[^A-Za-z0-9]/.test(body.password);

    if (!validPassword) {
        return 'password must have at least 8 characters, including uppercase, lowercase, number and special character.';
    }

    if (body.full_name.length > 150) {
        return 'full_name must not exceed 150 characters.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(body.email)) {
        return 'email must be a valid email address.';
    }

    if (!['ADMIN', 'TEACHER'].includes(body.role)) {
        return 'role must be ADMIN or TEACHER.';
    }

    const allowedFields = requiredFields;

    if (Object.keys(body).some(field => !allowedFields.includes(field))) {
        return 'Request contains unsupported fields.';
    }

    return null;
}

router.get('/', async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const role = String(req.query.role ?? '').trim().toUpperCase();
    const status = String(req.query.status ?? '').trim().toUpperCase();

    if (role && !['ADMIN', 'TEACHER', 'STUDENT'].includes(role)) {
            return res.status(400).json({
            success: false,
            code: 'VALIDATION_ERROR',
            message: 'role must be ADMIN, TEACHER, or STUDENT.',
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    }

    if (status && !['ACTIVE', 'LOCKED', 'INACTIVE'].includes(status)) {
        return res.status(400).json({
            success: false,
            code: 'VALIDATION_ERROR',
            message: 'status must be ACTIVE, LOCKED, or INACTIVE.',
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    }

    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.page_size ?? 20);

    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        return res.status(400).json({
            success: false,
            code: 'VALIDATION_ERROR',
            message: 'page must be a positive integer and page_size must be an integer between 1 and 100.',
            trace_id: req. traceId,
            timestamp: new Date().toISOString()
        });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const {users, total} = await findUsers(from, to, q, role, status);

    return res.status(200).json({
        success: true,
        code: 'SUCCESS',
        message: 'Users retrieved successfully.',
        data: users,
        meta: {
            pagination: {
                page, page_size: pageSize,
                total, total_pages: Math.ceil(total / pageSize)
            }
        },
        trace_id: req.traceId,
        timestamp: new Date().toISOString()
    });
});

router.get('/:id', async (req, res, next) => {
    try {
        const {id} = req.params;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Invalid user ID format.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        const user = await findUserById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                code: 'USER_NOT_FOUND',
                message: 'User not found.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'User retrieved successfully.',
            data: user,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

router.post('/', async (req, res, next) => {
    try {
        const validationError = validateCreateUserInput(req.body);

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

        const {username, password, full_name, email, role} = req.body;
        
        const user = await createUser(username, password, full_name, email, role);

        return res.status(201).json({
            success: true,
            code: 'SUCCESS',
            message: 'User created successfully.',
            data: user,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                code: 'USER_ALREADY_EXISTS',
                message: 'Username or email already exists.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }
        next(error);
    }
});

module.exports = router;