const {recordAuditLog} = require('./audit-logs.service');

const DEFAULT_RATE_WINDOW_MS = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 60 * 1000);
const DEFAULT_RATE_MAX = Number(process.env.LOGIN_RATE_LIMIT_MAX || 60);
const MAX_FAILED_ATTEMPTS = Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS || 5);
const FAILURE_WINDOW_MS = Number(process.env.LOGIN_FAILURE_WINDOW_MS || 15 * 60 * 1000);
const LOCKOUT_DURATION_MS = Number(process.env.LOGIN_LOCKOUT_MS || 5 * 60 * 1000);

const ipWindows = new Map();
const accountAttempts = new Map();

function normalizeKey(username) {
    return typeof username === 'string' ? username.trim().toLowerCase() : '';
}

function pruneTimestamps(list, cutoffMs) {
    return list.filter(ts => ts > cutoffMs);
}

/**
 * Express middleware enforcing per-IP sliding-window rate limiting on login attempts.
 */
function loginRateLimiter(req, res, next) {
    const now = Date.now();
    const windowMs = DEFAULT_RATE_WINDOW_MS;
    const maxRequests = DEFAULT_RATE_MAX;
    const ipKey = req.ip || req.socket?.remoteAddress || 'unknown';

    const existing = pruneTimestamps(ipWindows.get(ipKey) || [], now - windowMs);
    if (existing.length >= maxRequests) {
        const oldest = existing[0];
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        res.set('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({
            success: false,
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many login requests. Please try again later.',
            data: {retry_after_seconds: retryAfterSeconds},
            trace_id: req.traceId,
            timestamp: new Date().toISOString()
        });
    }

    existing.push(now);
    ipWindows.set(ipKey, existing);
    return next();
}

/**
 * Inspect whether a username is currently under a temporary failed-login lockout.
 */
function getAccountLockState(username) {
    const key = normalizeKey(username);
    if (!key) return {locked: false, retryAfterSeconds: 0, lockedUntil: null};

    const entry = accountAttempts.get(key);
    if (!entry) return {locked: false, retryAfterSeconds: 0, lockedUntil: null};

    const now = Date.now();
    if (entry.lockedUntil && entry.lockedUntil > now) {
        return {
            locked: true,
            retryAfterSeconds: Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000)),
            lockedUntil: new Date(entry.lockedUntil).toISOString()
        };
    }

    if (entry.lockedUntil && entry.lockedUntil <= now) {
        accountAttempts.delete(key);
    }

    return {locked: false, retryAfterSeconds: 0, lockedUntil: null};
}

/**
 * Record a failed credential attempt and apply a temporary lockout after repeated failures.
 */
async function recordFailedLogin(username, requestMeta = {}) {
    const key = normalizeKey(username);
    if (!key) return {locked: false, attemptsRemaining: MAX_FAILED_ATTEMPTS};

    const now = Date.now();
    const existing = accountAttempts.get(key) || {timestamps: [], lockedUntil: 0};
    const recent = pruneTimestamps(existing.timestamps, now - FAILURE_WINDOW_MS);
    recent.push(now);

    if (recent.length >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = now + LOCKOUT_DURATION_MS;
        accountAttempts.set(key, {timestamps: recent, lockedUntil});

        await recordAuditLog({
            actorUserId: null,
            action: 'AUTH_ACCOUNT_TEMP_LOCKED',
            entityName: 'users',
            entityId: null,
            newValue: {
                username: key,
                failed_attempts: recent.length,
                locked_until: new Date(lockedUntil).toISOString()
            },
            requestMeta
        });

        return {
            locked: true,
            attemptsRemaining: 0,
            retryAfterSeconds: Math.max(1, Math.ceil(LOCKOUT_DURATION_MS / 1000)),
            lockedUntil: new Date(lockedUntil).toISOString()
        };
    }

    accountAttempts.set(key, {timestamps: recent, lockedUntil: 0});
    return {
        locked: false,
        attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - recent.length),
        retryAfterSeconds: 0,
        lockedUntil: null
    };
}

/**
 * Clear failed login attempts and any active temporary lockout for a username.
 */
function clearLoginFailures(username) {
    const key = normalizeKey(username);
    if (key) {
        accountAttempts.delete(key);
    }
}

function _resetLoginGuard() {
    ipWindows.clear();
    accountAttempts.clear();
}

module.exports = {
    loginRateLimiter,
    getAccountLockState,
    recordFailedLogin,
    clearLoginFailures,
    _resetLoginGuard,
    MAX_FAILED_ATTEMPTS,
    LOCKOUT_DURATION_MS
};
