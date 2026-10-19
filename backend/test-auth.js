require('dotenv').config({quiet: true});

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