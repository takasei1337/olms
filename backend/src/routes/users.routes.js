const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const requireAdmin = require('../middlewares/require-admin');
const {findUsers} = require('../services/users.service');

router.use(authenticate);
router.use(requireAdmin);

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

module.exports = router;