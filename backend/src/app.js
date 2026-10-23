const express = require('express');
const cookieParser = require('cookie-parser');
const healthRoutes = require('./routes/health.routes');
const apiRoutes = require('./routes/api.routes');
const requestContext = require('./middlewares/request-context');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(requestContext);

app.use(healthRoutes);
app.use('/api/v1', apiRoutes);

app.use((err, req, res, next) => {
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