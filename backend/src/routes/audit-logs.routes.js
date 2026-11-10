const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/authenticate');
const requireAdmin = require('../middlewares/require-admin');
const {listAuditLogs} = require('../services/audit-logs.service');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseIsoTimestamp(rawValue) {
    if (rawValue === undefined || rawValue === null) return null;
    const trimmed = String(rawValue).trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
        return false;
    }
    return parsed.toISOString();
}

router.use(authenticate);
router.use(requireAdmin);

router.get('/', async (req, res, next) => {
    try {
        const rawActor = req.query.actor_user_id !== undefined ? String(req.query.actor_user_id).trim() : '';
        if (rawActor && !UUID_REGEX.test(rawActor)) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'actor_user_id must be a valid UUID.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const action = req.query.action !== undefined ? String(req.query.action).trim() : '';
        const entityName = req.query.entity_name !== undefined ? String(req.query.entity_name).trim() : '';

        const fromIso = parseIsoTimestamp(req.query.from);
        if (fromIso === false) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'from must be a valid ISO 8601 date or timestamp.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const toIso = parseIsoTimestamp(req.query.to);
        if (toIso === false) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'to must be a valid ISO 8601 date or timestamp.',
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        if (fromIso && toIso && fromIso > toIso) {
            return res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'from must not be later than to.',
                data: null,
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
                data: null,
                trace_id: req.traceId,
                timestamp: new Date().toISOString()
            });
        }

        const {logs, total} = await listAuditLogs({
            actorUserId: rawActor || null,
            action,
            entityName,
            from: fromIso,
            to: toIso,
            page,
            pageSize
        });

        return res.status(200).json({
            success: true,
            code: 'SUCCESS',
            message: 'Audit logs retrieved successfully.',
            data: logs,
            meta: {
                page,
                page_size: pageSize,
                total_items: total,
                total_pages: Math.ceil(total / pageSize)
            },
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
