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

module.exports = {
    findQuestionTypes,
    findQuestionTypeById,
    findQuestionTypeByCode
};

