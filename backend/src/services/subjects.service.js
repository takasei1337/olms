const supabase = require('../config/supabase');

async function findSubjects(from, to, q) {
    let query = supabase
        .from('subjects')
        .select('id, code, name, description', {count: 'exact'})
        .is('deleted_at', null);

    if (q) {
        const safeQ = q.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        query = query.or(`code.ilike."%${safeQ}%",name.ilike."%${safeQ}%"`);
    }

    const {data, error, count} = await query
        .order('created_at', {ascending: false})
        .range(from, to);

    if (error) throw error;

    return {
        subjects: data ?? [],
        total: count ?? 0
    };
}

async function findSubjectById(subjectId) {
    const {data, error} = await supabase
        .from('subjects')
        .select('id, code, name, description, created_by')
        .eq('id', subjectId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function createSubject({code, name, description, createdBy}) {
    const now = new Date().toISOString();

    const {data, error} = await supabase
        .from('subjects')
        .insert({
            id: require('node:crypto').randomUUID(),
            code,
            name,
            description: description !== undefined ? description : null,
            created_by: createdBy,
            created_at: now,
            updated_at: now
        })
        .select('id, code, name, description')
        .single();

    if (error) throw error;
    return data;
}

async function updateSubject(subjectId, updates) {
    const now = new Date().toISOString();

    const {data, error} = await supabase
        .from('subjects')
        .update({
            ...updates,
            updated_at: now
        })
        .eq('id', subjectId)
        .is('deleted_at', null)
        .select('id, code, name, description')
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function softDeleteSubject(subjectId, deletedBy) {
    const now = new Date().toISOString();

    const {data, error} = await supabase
        .from('subjects')
        .update({
            deleted_at: now,
            deleted_by: deletedBy,
            updated_at: now
        })
        .eq('id', subjectId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();

    if (error) throw error;
    return data;
}

module.exports = {
    findSubjects,
    findSubjectById,
    createSubject,
    updateSubject,
    softDeleteSubject
};

