const supabase = require('../config/supabase');
const bcrypt = require('bcrypt');

async function findUserByUsername(username) {
    const {data, error} = await supabase
    .from('users')
    .select('id, username, password_hash, role, status')
    .eq('username', username)
    .is('delete_at', null)
    .maybeSingle();

    if (error) throw error;

    return data;
}

async function verifyPassword(password, passwordHash) {
    return await bcrypt.compare(password, passwordHash);
}

async function checkCredentinals(username, password) {
    const user = await findUserByUsername(username);
    if (!user || user.status !== 'ACTIVE') return null;
    const passwordMatches = await verifyPassword(password, user.password_hash);
    if (!passwordMatches) return null;
    return user;
}


module.exports = {
    findUserByUsername,
    verifyPassword,
    checkCredentinals
};