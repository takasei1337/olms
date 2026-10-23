const supabase = require('../config/supabase');
const bcrypt = require('bcrypt');

async function findUserByUsername(username) {
    const {data, error} = await supabase
    .from('users')
    .select('id, username, full_name, password_hash, role, status')
    .eq('username', username)
    .is('deleted_at', null)
    .maybeSingle();

    if (error) throw error;

    return data;
}

async function verifyPassword(password, passwordHash) {
    return await bcrypt.compare(password, passwordHash);
}

async function checkCredentials(username, password) {
    const user = await findUserByUsername(username);
    if (!user || user.status !== 'ACTIVE') return null;
    const passwordMatches = await verifyPassword(password, user.password_hash);
    if (!passwordMatches) return null;
    return user;
}

async function findActiveUserById(userId) {
    const {data, error} = await supabase
    .from('users')
    .select('id, username, full_name, role, status')
    .eq('id', userId)
    .eq('status', 'ACTIVE')
    .is('deleted_at', null)
    .maybeSingle();

    if (error) throw error;
    return data;
}


module.exports = {
    findUserByUsername,
    verifyPassword,
    checkCredentials,
    findActiveUserById
};