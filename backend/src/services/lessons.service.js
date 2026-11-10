const supabase = require('../config/supabase');

async function findLessonsByChapterId(chapterId) {
    const {data, error} = await supabase
        .from('lessons')
        .select('id, chapter_id, code, name, order_no, created_at, updated_at')
        .eq('chapter_id', chapterId)
        .is('deleted_at', null)
        .order('order_no', {ascending: true})
        .order('created_at', {ascending: true});

    if (error) throw error;
    return data ?? [];
}

async function findLessonById(lessonId) {
    const {data, error} = await supabase
        .from('lessons')
        .select('id, chapter_id, code, name, order_no, created_at, updated_at, deleted_at')
        .eq('id', lessonId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function createLesson({chapterId, code, name, orderNo}) {
    const now = new Date().toISOString();

    const {data, error} = await supabase
        .from('lessons')
        .insert({
            id: require('node:crypto').randomUUID(),
            chapter_id: chapterId,
            code: code !== undefined && code !== null && code.trim() !== '' ? code.trim() : null,
            name: name.trim(),
            order_no: orderNo ?? 0,
            created_at: now,
            updated_at: now
        })
        .select('id, chapter_id, code, name, order_no, created_at, updated_at')
        .single();

    if (error) throw error;
    return data;
}

async function updateLesson(lessonId, updates) {
    const now = new Date().toISOString();

    const updatePayload = {
        updated_at: now
    };

    if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
        updatePayload.name = updates.name.trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'code')) {
        updatePayload.code = updates.code !== null && updates.code !== undefined && updates.code.trim() !== ''
            ? updates.code.trim()
            : null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'order_no')) {
        updatePayload.order_no = updates.order_no;
    }

    const {data, error} = await supabase
        .from('lessons')
        .update(updatePayload)
        .eq('id', lessonId)
        .is('deleted_at', null)
        .select('id, chapter_id, code, name, order_no, created_at, updated_at')
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function countActiveQuestionsByLessonId(lessonId) {
    const {count, error} = await supabase
        .from('questions')
        .select('id', {count: 'exact', head: true})
        .eq('lesson_id', lessonId)
        .is('deleted_at', null);

    if (error) throw error;
    return count ?? 0;
}

async function softDeleteLesson(lessonId, deletedBy) {
    const now = new Date().toISOString();

    const {data, error} = await supabase
        .from('lessons')
        .update({
            deleted_at: now,
            deleted_by: deletedBy,
            updated_at: now
        })
        .eq('id', lessonId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();

    if (error) throw error;
    return data;
}

module.exports = {
    findLessonsByChapterId,
    findLessonById,
    createLesson,
    updateLesson,
    countActiveQuestionsByLessonId,
    softDeleteLesson
};
