const {verifyAccessToken} = require("../services/token.service");

function authenticate(req, res, next) {
    const authorization = req.headers.authorization;

    if (!authorization) {
        return res.status(401).json({
            success: false,
            code: "ACCESS_TOKEN_MISSING",
            message: "Access Token is required.",
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    }

    if (!/^Bearer\s+\S+$/i.test(authorization)) {
        return res.status(401).json({
            success: false,
            code: "INVALID_ACCESS_TOKEN",
            message: "Authorization header must use Bearer token format.",
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    }

    const token = authorization.split(/\s+/)[1];

    try {
        req.auth = verifyAccessToken(token);
        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            code: "INVALID_ACCESS_TOKEN",
            message: "Access Token is invalid or expired.",
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = authenticate;

