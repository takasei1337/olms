const express = require('express');
const cookieParser = require('cookie-parser');
const healthRoutes = require('./routes/health.routes');
const apiRoutes = require('./routes/api.routes');
const requestContext = require('./middlewares/request-context');
const securityHeaders = require('./middlewares/security-headers');
const pendingRoutes = require('./routes/pending.routes');

const app = express();

// Disable information leakage header
app.disable('x-powered-by');

// Security Hardening Headers
app.use(securityHeaders);

// Restrict request body size to 1MB to prevent Denial of Service (DoS)
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(requestContext);

app.use(healthRoutes);
app.use('/api/v1', apiRoutes);
app.use('/api/v1', pendingRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    // Handle payload too large error (413)
    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Request payload exceeds limit of 1MB.',
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    }

    // Handle malformed JSON body error (400)
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            code: 'INVALID_JSON_PAYLOAD',
            message: 'Malformed JSON payload provided.',
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    }

    console.error('Unhandled error:', err);

    return res.status(500).json({
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
        trace_id: req.traceId,
        timestamp: new Date().toISOString()
    });
});

module.exports = app;
