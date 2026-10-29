const supabase = require('../config/supabase');

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

module.exports = {
    findUsers,
    findUserById
};