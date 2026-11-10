const supabase = require('../config/supabase');
const {hashPassword} = require('./auth.service');
const {revokeAllUserRefreshTokens} = require('./refresh-token.service');
const {recordAuditLog} = require('./audit-logs.service');
const {clearLoginFailures} = require('./login-guard.service');

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


async function updateUser(id, updates) {
    const {data, error} = await supabase
    .from('users')
    .update({
        ...updates,
        updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id, username, full_name, email, phone, role, status, updated_at')
    .maybeSingle();

    if (error) throw error;
    return data;
}

async function updateUserStatus(userId, status, actorUserId, requestMeta = {}) {
    const existing = await findUserById(userId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const {data, error} = await supabase
        .from('users')
        .update({
            status,
            updated_at: now
        })
        .eq('id', userId)
        .is('deleted_at', null)
        .select('id, username, full_name, email, phone, role, status, created_at')
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    if (status === 'LOCKED') {
        await revokeAllUserRefreshTokens(userId);
    clearLoginFailures(existing.username);
    } else if (status === 'ACTIVE') {
        clearLoginFailures(existing.username);
    }

    await recordAuditLog({
        actorUserId,
        action: 'USER_STATUS_CHANGED',
        entityName: 'users',
        entityId: userId,
        oldValue: {status: existing.status},
        newValue: {status: data.status},
        requestMeta
    });

    return data;
}

async function resetUserPassword(userId, newPassword, actorUserId, requestMeta = {}) {
    const existing = await findUserById(userId);
    if (!existing) return null;

    const passwordHash = await hashPassword(newPassword);
    const now = new Date().toISOString();

    const {data, error} = await supabase
        .from('users')
        .update({
            password_hash: passwordHash,
            updated_at: now
        })
        .eq('id', userId)
        .is('deleted_at', null)
        .select('id, username')
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    await revokeAllUserRefreshTokens(userId);
    clearLoginFailures(existing.username);

    await recordAuditLog({
        actorUserId,
        action: 'USER_PASSWORD_RESET',
        entityName: 'users',
        entityId: userId,
        newValue: {
            username: existing.username,
            reset_by: actorUserId
        },
        requestMeta
    });

    return data;
}

async function softDeleteUser(userId, actorUserId, requestMeta = {}) {
    const existing = await findUserById(userId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const {data, error} = await supabase
        .from('users')
        .update({
            deleted_at: now,
            deleted_by: actorUserId,
            updated_at: now
        })
        .eq('id', userId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    await revokeAllUserRefreshTokens(userId);
    clearLoginFailures(existing.username);

    await recordAuditLog({
        actorUserId,
        action: 'USER_SOFT_DELETED',
        entityName: 'users',
        entityId: userId,
        oldValue: {
            username: existing.username,
            role: existing.role,
            status: existing.status
        },
        newValue: {
            deleted_at: now,
            deleted_by: actorUserId
        },
        requestMeta
    });

    return data;
}

module.exports = {
    findUsers,
    findUserById,
    createUser,
    updateUser,
    updateUserStatus,
    resetUserPassword,
    softDeleteUser
};