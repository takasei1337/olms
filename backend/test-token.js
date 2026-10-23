require('dotenv').config({quiet: true});

const test = require('node:test');
const assert = require('node:assert/strict');

const jwt = require('jsonwebtoken');

const {
    generateAccessToken,
    generateRefreshToken,
    hashRefreshToken
} = require('./src/services/token.service');

test('generateAccessToken creates a valid JWT', () => {
    const user = {
        id: 'test-user-123',
        role: 'STUDENT'
    };

    const token = generateAccessToken(user);

    const payload = jwt.verify(
        token, 
        process.env.JWT_ACCESS_SECRET,
        {algorithms: ['HS256']}
    );

    assert.equal(payload.sub, user.id);
    assert.equal(payload.role, user.role);
});

test('generateRefreshToken creates unique random tokens', () => {
    const token1 = generateRefreshToken();
    const token2 = generateRefreshToken();

    assert.equal(token1.length, 64);
    assert.equal(token2.length, 64);

    assert.match(token1, /^[0-9a-f]{64}$/);
    assert.match(token2, /^[0-9a-f]{64}$/);

    assert.notEqual(token1, token2);
});

test('hashRefreshToken creates a consistent SHA-256 hash', () => {
    const token = generateRefreshToken();

    const hash1 = hashRefreshToken(token);
    const hash2 = hashRefreshToken(token);

    assert.equal(hash1, hash2);
    assert.notEqual(hash1, token);
    assert.match(hash1, /^[0-9a-f]{64}$/);
});
