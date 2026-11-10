const supabase = require('../config/supabase');

async function findChaptersBySubjectId(subjectId) {
    const {data, error} = await supabase
        .from('chapters')
        .select('id, subject_id, code, name, order_no, created_at, updated_at')
        .eq('subject_id', subjectId)
        .is('deleted_at', null)
        .order('order_no', {ascending: true})
        .order('created_at', {ascending: true});

    if (error) throw error;
    return data ?? [];
}

async function findChapterById(chapterId) {
    const {data, error} = await supabase
        .from('chapters')
        .select('id, subject_id, code, name, order_no, created_at, updated_at, deleted_at')
        .eq('id', chapterId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function createChapter({subjectId, code, name, orderNo}) {
    const now = new Date().toISOString();

    const {data, error} = await supabase
        .from('chapters')
        .insert({
            id: require('node:crypto').randomUUID(),
            subject_id: subjectId,
            code: code !== undefined && code !== null && code.trim() !== '' ? code.trim() : null,
            name: name.trim(),
            order_no: orderNo ?? 0,
            created_at: now,
            updated_at: now
        })
        .select('id, subject_id, code, name, order_no, created_at, updated_at')
        .single();

    if (error) throw error;
    return data;
}

async function updateChapter(chapterId, updates) {
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
        .from('chapters')
        .update(updatePayload)
        .eq('id', chapterId)
        .is('deleted_at', null)
        .select('id, subject_id, code, name, order_no, created_at, updated_at')
        .maybeSingle();

    if (error) throw error;
    return data;
}

async function countActiveLessonsByChapterId(chapterId) {
    const {count, error} = await supabase
        .from('lessons')
        .select('id', {count: 'exact', head: true})
        .eq('chapter_id', chapterId)
        .is('deleted_at', null);

    if (error) throw error;
    return count ?? 0;
}

async function softDeleteChapter(chapterId, deletedBy) {
    const now = new Date().toISOString();

    const {data, error} = await supabase
        .from('chapters')
        .update({
            deleted_at: now,
            deleted_by: deletedBy,
            updated_at: now
        })
        .eq('id', chapterId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();

    if (error) throw error;
    return data;
}

module.exports = {
    findChaptersBySubjectId,
    findChapterById,
    createChapter,
    updateChapter,
    countActiveLessonsByChapterId,
    softDeleteChapter
};
