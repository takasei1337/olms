require('dotenv').config({quiet: true});
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-secret-key-12345';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

const {verifyPassword} = require('./src/services/auth.service');

test('verifyPassword returns true for correct password', async() => {
    const password = '12345';
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await verifyPassword(password, passwordHash);

    assert.equal(result, true);
});

test('verifyPassword returns false for incorrect password', async() => {
    const password = '12345';
    const wrongPassword = 'wrong-password';
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await verifyPassword(wrongPassword, passwordHash);

    assert.equal(result, false);
});