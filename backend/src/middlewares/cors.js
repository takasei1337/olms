const DEFAULT_DEV_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:4173',
    'http://127.0.0.1:4173'
];

function getAllowedOrigins() {
    const raw = process.env.CORS_ORIGIN;
    if (typeof raw === 'string' && raw.trim()) {
        return raw.split(',').map(s => s.trim()).filter(Boolean);
    }
    return process.env.NODE_ENV === 'production' ? [] : DEFAULT_DEV_ORIGINS;
}

/**
 * CORS middleware supporting credentialed cookies (olms_refresh) and Bearer/Idempotency-Key headers.
 */
function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;
    const allowedOrigins = getAllowedOrigins();
    const isWildcard = allowedOrigins.includes('*');
    const isAllowed = Boolean(origin && (isWildcard || allowedOrigins.includes(origin)));

    res.setHeader('Vary', 'Origin');

    if (isAllowed) {
        // Echo the request origin so browsers allow Access-Control-Allow-Credentials: true
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Idempotency-Key');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition,X-Trace-Id');
        res.setHeader('Access-Control-Max-Age', '86400');
    }

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    return next();
}

module.exports = corsMiddleware;
