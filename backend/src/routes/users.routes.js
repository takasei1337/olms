const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const requireAdmin = require('../middlewares/require-admin');
const {findUsers, findUserById, createUser, updateUser, updateUserStatus, resetUserPassword, softDeleteUser} = require('../services/users.service');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidPassword(password) {
    return typeof password === 'string' &&
        password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^A-Za-z0-9]/.test(password);
}

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

function buildRequestMeta(req) {
    return {
        ip: req.ip || null,
        userAgent: req.get('user-agent') || null
    };
}

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

    if (!isValidPassword(body.password)) {
        return 'password must have at least 8 characters, including uppercase, lowercase, number and special character.';
    }

    if (body.full_name.length > 150) {
        return 'full_name must not exceed 150 characters.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(body.email) || body.email.length > 150) {
        return 'email must be a valid email address with at most 150 characters.';
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
            page,
            page_size: pageSize,
            total_items: total,
            total_pages: Math.ceil(total / pageSize)
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

router.patch('/:id', async (req, res, next) => {

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

        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Request body must be a JSON object.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }    

        const allowedFields = ['full_name', 'email', 'phone', 'role'];

        const unsupportedFields = (Object.keys(req.body).filter(field => !allowedFields.includes(field)));

        if (unsupportedFields.length > 0) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Request contains unsupported fields.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (Object.keys(req.body).length === 0) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'At least one field is required for update.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'full_name')) {
            if (typeof req.body.full_name !== 'string' || !req.body.full_name.trim() || req.body.full_name.length > 150) {
                return res.status(400).json({
                    success: false,
                    code: 'VALIDATION_ERROR',
                    message: 'full_name must be a non-empty string with at most 150 characters.',
                    data: null,
                    trace_id: req.traceId,
                    timestamp: new Date().toISOString()
                });
            }
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'email')) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (typeof req.body.email !== 'string' || !emailRegex.test(req.body.email) || req.body.email.length > 150) {
                return res.status(400).json({
                    success: false,
                    code: 'VALIDATION_ERROR',
                    message: 'email must be a valid email address with at most 150 characters.',
                    data: null,
                    trace_id: req.traceId,
                    timestamp: new Date().toISOString()
                });
            }
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'role')) {
            if (typeof req.body.role !== 'string' || !['ADMIN', 'TEACHER'].includes(req.body.role)) {
                return res.status(400).json({
                    success: false,
                    code: 'VALIDATION_ERROR',
                    message: 'role must be ADMIN or TEACHER.',
                    data: null,
                    trace_id: req.traceId,
                    timestamp: new Date().toISOString()
                });
            }
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) {
            if (req.body.phone !== null && (typeof req.body.phone !== 'string' || !/^\+?[0-9]{9,15}$/.test(req.body.phone))) {
                return res.status(400).json({
                    success: false,
                    code: 'VALIDATION_ERROR',
                    message: 'phone must be null or a valid phone number containing 9 to 15 digits.',
                    data: null,
                    trace_id: req.traceId,
                    timestamp: new Date().toISOString()
                });
            }
        }

        const user = await updateUser(id, req.body);
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
            message: 'User updated successfully.',
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

router.patch('/:id/status', async (req, res, next) => {
    try {
        const {id} = req.params;
        if (!UUID_REGEX.test(id)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid user ID format.');
        }

        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
        }

        const keys = Object.keys(req.body);
        if (keys.some(k => k !== 'status') || typeof req.body.status !== 'string' || !['ACTIVE', 'LOCKED'].includes(req.body.status)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Body must contain only status with value ACTIVE or LOCKED.');
        }

        if (id === req.auth.sub && req.body.status === 'LOCKED') {
            return sendError(res, req, 409, 'CANNOT_LOCK_SELF', 'Administrators cannot lock their own account.');
        }

        const updated = await updateUserStatus(id, req.body.status, req.auth.sub, buildRequestMeta(req));
        if (!updated) {
            return sendError(res, req, 404, 'USER_NOT_FOUND', 'User not found.');
        }

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'User status updated successfully.',
            data: updated,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/reset-password', async (req, res, next) => {
    try {
        const {id} = req.params;
        if (!UUID_REGEX.test(id)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid user ID format.');
        }

        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
        }

        const keys = Object.keys(req.body);
        if (keys.some(k => k !== 'new_password') || !Object.prototype.hasOwnProperty.call(req.body, 'new_password')) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Body must contain only new_password.');
        }

        if (!isValidPassword(req.body.new_password)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'new_password must have at least 8 characters, including uppercase, lowercase, number and special character.');
        }

        const updated = await resetUserPassword(id, req.body.new_password, req.auth.sub, buildRequestMeta(req));
        if (!updated) {
            return sendError(res, req, 404, 'USER_NOT_FOUND', 'User not found.');
        }

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'User password reset successfully.',
            data: {},
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const {id} = req.params;
        if (!UUID_REGEX.test(id)) {
            return sendError(res, req, 400, 'VALIDATION_ERROR', 'Invalid user ID format.');
        }

        if (id === req.auth.sub) {
            return sendError(res, req, 409, 'CANNOT_DELETE_SELF', 'Administrators cannot delete their own account.');
        }

        const deleted = await softDeleteUser(id, req.auth.sub, buildRequestMeta(req));
        if (!deleted) {
            return sendError(res, req, 404, 'USER_NOT_FOUND', 'User not found.');
        }

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'User deleted successfully.',
            data: {},
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;