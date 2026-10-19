function validateLogin(req, res, next) {
    const body = req.body;
    const valid = body !== null &&
        typeof body === 'object' &&
        !Array.isArray(body) &&
        Object.keys(body).length > 0 &&
        typeof body.username === 'string' &&
        body.username.length <= 50 &&
        typeof body.password === 'string';
    
    if (!valid) {
        return res.status(400).json({
            success: false,
            code: 'VALIDATION_FAILED',
            message: 'Dữ liệu yêu cầu không hợp lệ.',
            trace_id: req.traceId,
            timestamp: new Date().toISOString(),   
            data: {
                details: [],
                retryable: false
            }
        });
    }

    next();
}

module.exports = validateLogin;