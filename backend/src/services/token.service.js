const jwt = require('jsonwebtoken');
const {
    randomBytes, createHash
} = require('node:crypto');

const REFRESH_TOKEN_TTL_DAYS = 7;

function generateAccessToken(user) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('JWT_ACCESS_SECRET is not configured');

    return jwt.sign(
        {
            sub: user.id,
            role: user.role
        },
        secret,
        {
            algorithm: 'HS256',
            expiresIn: '15m'
        }
    );
}

function generateRefreshToken() {
    return randomBytes(32).toString('hex');
}

function hashRefreshToken(token) {
    return createHash('sha256')
    .update(token)
    .digest('hex');
}

function getRefreshTokenExpiresAt() {
    const expireAt = new Date();
    expireAt.setUTCDate(
        expireAt.getUTCDate() + REFRESH_TOKEN_TTL_DAYS
    );

    return expireAt.toISOString();
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    hashRefreshToken,
    REFRESH_TOKEN_TTL_DAYS,
    getRefreshTokenExpiresAt
};