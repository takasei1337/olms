const express = require('express');
const router = express.Router();

const pendingEndpoints = [
    ['delete', '/users/:userId'],
    ['patch', '/users/:userId/status'],
    ['post', '/users/:userId/reset-password'],
    ['get', '/audit-logs'],
    ['post', '/question-types'],
    ['patch', '/question-types/:typeId'],
    ['delete', '/question-types/:typeId'],
    ['post', '/questions/:questionId/ai-override'],
    ['post', '/questions/:questionId/clone'],
    ['get', '/questions/:questionId/versions'],
    ['post', '/exams/:examId/generate'],
    ['get', '/exams/:examId/variants'],
    ['post', '/exams/:examId/publish'],
    ['post', '/exams/:examId/start'],
    ['post', '/exams/:examId/end'],
    ['post', '/exams/:examId/results/publish'],
    ['post', '/exams/:examId/archive'],
    ['post', '/exams/:examId/cancel'],
    ['post', '/exams/:examId/print-files'],
    ['get', '/exams/:examId/participants'],
    ['post', '/exams/:examId/participants'],
    ['post', '/exams/:examId/participants/import/preview'],
    ['post', '/exams/:examId/participants/import/commit'],
    ['delete', '/exams/:examId/participants/:participantId'],
    ['post', '/exams/:examId/participants/credentials/export'],
    ['post', '/exams/:examId/participants/:participantId/credentials/reset'],
    ['get', '/me/exams'],
    ['post', '/me/exams/:examId/session'],
    ['get', '/me/exams/:examId/session'],
    ['put', '/me/submissions/:submissionId/answers/:variantQuestionId'],
    ['post', '/me/submissions/:submissionId/submit'],
    ['get', '/exams/:examId/results'],
    ['get', '/exams/:examId/results/:submissionId'],
    ['get', '/exams/:examId/statistics'],
    ['post', '/exams/:examId/omr/scans'],
    ['get', '/exams/:examId/omr/scans'],
    ['get', '/omr/scans/:scanId'],
    ['post', '/omr/scans/:scanId/rescan'],
    ['patch', '/omr/scans/:scanId/detected-answers/:detectedAnswerId'],
    ['post', '/omr/scans/:scanId/approve'],
    ['post', '/exams/:examId/omr/zipgrade/import'],
    ['get', '/me/results'],
    ['get', '/me/results/:examId'],
    ['get', '/me/results/:examId/review'],
    ['post', '/exams/:examId/results/visibility'],
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
