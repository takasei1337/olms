const supabase = require('../config/supabase');
const {hashPassword} = require('./auth.service');

async function findUsers(from, to, q, role, status) {
    let query = supabase
    .from('users')
    .select('id, username, full_name, role, status', {count : 'exact'})
    .is('deleted_at', null);

    if (q) {
        const safeQ = q.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        query = query.or(`username.ilike."%${safeQ}%", full_name.ilike."%${safeQ}%"`);
    }

    if (role) {
        query = query.eq('role', role);
    }

    if (status) {
        query = query.eq('status', status);
    }

    const {data, error, count} = await query.order('id', {ascending: true}).range(from, to);

    if (error) throw error;

    return {
        users: data ?? [],
        total: count ?? 0
    };
}

async function findUserById(userId) {
    const {data, error} = await supabase
    .from('users')
    .select('id, username, full_name, role, status')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle();

    if (error) throw error;
    return data;
}

async function createUser(username, password, fullName, email, role) {
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    const {data, error} = await supabase
    .from('users')
    .insert({
        id: require('node:crypto').randomUUID(),
        username, password_hash: passwordHash,
        full_name: fullName,
        email, role, status: 'ACTIVE',
        created_at: now, updated_at: now
    })
    .select('id, username, full_name, email, role, status, created_at')
    .single();

    if (error) throw error;
    return data;
}

module.exports = {
    findUsers,
    findUserById,
    createUser
};