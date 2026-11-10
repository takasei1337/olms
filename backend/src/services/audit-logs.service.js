const supabase = require('../config/supabase');

/**
 * Append an immutable entry to audit_logs without blocking the caller on secondary logging errors.
 */
async function recordAuditLog({
    actorUserId = null,
    action,
    entityName,
    entityId = null,
    oldValue = null,
    newValue = null,
    requestMeta = {}
}) {
    try {
        await supabase
            .from('audit_logs')
            .insert({
                actor_user_id: actorUserId || null,
                action,
                entity_name: entityName,
                entity_id: entityId || null,
                old_value: oldValue,
                new_value: newValue,
                ip_address: requestMeta.ip || null,
                user_agent: requestMeta.userAgent ? String(requestMeta.userAgent).slice(0, 255) : null,
                created_at: new Date().toISOString()
            });
    } catch (_) {
        // Non-blocking audit fallback
    }
}

/**
 * List masked immutable audit log entries with filtering and pagination.
 */
async function listAuditLogs({
    actorUserId = null,
    action = '',
    entityName = '',
    from = null,
    to = null,
    page = 1,
    pageSize = 20
}) {
    const rangeFrom = (page - 1) * pageSize;
    const rangeTo = rangeFrom + pageSize - 1;

    let query = supabase
        .from('audit_logs')
        .select('id, actor_user_id, action, entity_name, entity_id, created_at', {count: 'exact'});

    if (actorUserId) {
        query = query.eq('actor_user_id', actorUserId);
    }

    if (action) {
        query = query.eq('action', action);
    }

    if (entityName) {
        query = query.eq('entity_name', entityName);
    }

    if (from) {
        query = query.gte('created_at', from);
    }

    if (to) {
        query = query.lte('created_at', to);
    }

    const {data, error, count} = await query
        .order('created_at', {ascending: false})
        .order('id', {ascending: false})
        .range(rangeFrom, rangeTo);

    if (error) throw error;

    return {
        logs: data ?? [],
        total: count ?? 0
    };
}

module.exports = {
    recordAuditLog,
    listAuditLogs
};
