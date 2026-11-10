const express = require('express');
const router = express.Router();

const pendingEndpoints = [
    ['delete', '/users/:userId'],
    ['patch', '/users/:userId/status'],
    ['post', '/users/:userId/reset-password'],
    ['get', '/audit-logs'],
    ['post', '/exams/:examId/omr/scans'],
    ['get', '/exams/:examId/omr/scans'],
    ['get', '/omr/scans/:scanId'],
    ['post', '/omr/scans/:scanId/rescan'],
    ['patch', '/omr/scans/:scanId/detected-answers/:detectedAnswerId'],
    ['post', '/omr/scans/:scanId/approve'],
    ['post', '/exams/:examId/omr/zipgrade/import'],
    ['post', '/omr/scans/:scanId/resolve'],
];

for (const [method, path] of pendingEndpoints) {
    router[method](path, (req, res) => {
        return res.status(501).json({
            success: false,
            code: 'NOT_IMPLEMENTED',
            message: 'Endpoint is not implemented yet.',
            data: null,
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    });
}

module.exports = router;
