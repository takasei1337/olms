const supabase = require('../config/supabase');

async function findQuestionTypes() {
    const {data, error} = await supabase
        .from('question_types')
        .select('id, code, name, description')
        .is('deleted_at', null)
        .order('code', {ascending: true});

    if (error) throw error;
    return data ?? [];
}

async function findQuestionTypeById(id) {
    const {data, error} = await supabase
        .from('question_types')
        .select('id, code, name, description')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function findQuestionTypeByCode(code) {
    const {data, error} = await supabase
        .from('question_types')
        .select('id, code, name, description')
        .eq('code', code)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function createQuestionType({code, name, description = null}) {
    const now = new Date().toISOString();
    const {data, error} = await supabase
        .from('question_types')
        .insert({
            code,
            name,
            description,
            created_at: now,
            updated_at: now
        })
        .select('id, code, name, description')
        .single();

    if (error) throw error;
    return data;
}

async function updateQuestionType(typeId, updates) {
    const payload = {
        ...updates,
        updated_at: new Date().toISOString()
    };

    const {data, error} = await supabase
        .from('question_types')
        .update(payload)
        .eq('id', typeId)
        .is('deleted_at', null)
        .select('id, code, name, description')
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function isQuestionTypeInUse(typeId) {
    const {count: qCount, error: qErr} = await supabase
        .from('questions')
        .select('id', {count: 'exact', head: true})
        .eq('type_id', typeId)
        .is('deleted_at', null);

    if (qErr) throw qErr;
    if (qCount && qCount > 0) return true;

    const {count: mCount, error: mErr} = await supabase
        .from('exam_matrices')
        .select('id', {count: 'exact', head: true})
        .eq('question_type_id', typeId);

    if (mErr) throw mErr;
    return Boolean(mCount && mCount > 0);
}

async function softDeleteQuestionType(typeId, deletedBy) {
    const now = new Date().toISOString();
    const {data, error} = await supabase
        .from('question_types')
        .update({
            deleted_at: now,
            deleted_by: deletedBy,
            updated_at: now
        })
        .eq('id', typeId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();

    if (error) throw error;
    return data;
}

module.exports = {
    findQuestionTypes,
    findQuestionTypeById,
    findQuestionTypeByCode,
    createQuestionType,
    updateQuestionType,
    isQuestionTypeInUse,
    softDeleteQuestionType
};

