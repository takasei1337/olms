const supabase = require('../config/supabase');
const aiCheckService = require('./ai-check.service');

function formatQuestionResponse(row) {
    const version = Array.isArray(row.question_versions)
        ? row.question_versions[0]
        : row.question_versions;

    return {
        id: row.id,
        lesson_id: row.lesson_id ?? null,
        type_id: row.type_id,
        status: row.status,
        ai_check_status: row.ai_check_status,
        ai_similarity_score: row.ai_similarity_score !== null && row.ai_similarity_score !== undefined
            ? Number(row.ai_similarity_score)
            : null,
        ai_review_state: (row.ai_similarity_score !== null && Number(row.ai_similarity_score) >= 0.80)
            ? 'NEEDS_TEACHER'
            : null,
        is_duplicate_overridden: Boolean(row.is_duplicate_overridden),
        ai_audit_metadata: row.ai_audit_metadata ?? null,
        current_version_no: version ? version.version_no : 1,
        version_id: version ? version.id : null,
        difficulty_level: version ? version.difficulty_level : null,
        topic_tag: row.topic_tag ?? null,
        content: version ? version.content : '',
        media_url: version ? version.media_url ?? null : null,
        explanation: version ? version.explanation ?? null : null,
        created_by: row.created_by,
        answer_spec: version ? version.options_snapshot : null,
        // Raw version for internal logic (frozen check, etc.)
        _rawVersion: version
    };
}

async function findQuestions({
    from = 0,
    to = 19,
    q = '',
    subject_id = null,
    chapter_id = null,
    lesson_id = null,
    topic_tag = null,
    type_id = null,
    difficulty_level = null,
    status = null
}) {
    let targetLessonIds = null;

    if (subject_id) {
        const {data: chapters, error: cErr} = await supabase
            .from('chapters')
            .select('id')
            .eq('subject_id', subject_id)
            .is('deleted_at', null);

        if (cErr) throw cErr;
        const chapterIds = (chapters ?? []).map(c => c.id);

        if (chapterIds.length === 0) {
            return {questions: [], total: 0};
        }

        const {data: lessons, error: lErr} = await supabase
            .from('lessons')
            .select('id')
            .in('chapter_id', chapterIds)
            .is('deleted_at', null);

        if (lErr) throw lErr;
        targetLessonIds = (lessons ?? []).map(l => l.id);

        if (targetLessonIds.length === 0) {
            return {questions: [], total: 0};
        }
    } else if (chapter_id) {
        const {data: lessons, error: lErr} = await supabase
            .from('lessons')
            .select('id')
            .eq('chapter_id', chapter_id)
            .is('deleted_at', null);

        if (lErr) throw lErr;
        targetLessonIds = (lessons ?? []).map(l => l.id);

        if (targetLessonIds.length === 0) {
            return {questions: [], total: 0};
        }
    }

    let query = supabase
        .from('questions')
        .select(`
            id,
            lesson_id,
            type_id,
            topic_tag,
            status,
            ai_check_status,
            ai_similarity_score,
            created_by,
            created_at,
            updated_at,
            question_versions!inner (
                id,
                version_no,
                type_id,
                difficulty_level,
                content,
                media_url,
                explanation,
                options_snapshot,
                is_current,
                frozen_at
            )
        `, {count: 'exact'})
        .is('deleted_at', null)
        .eq('question_versions.is_current', true);

    if (lesson_id) {
        query = query.eq('lesson_id', lesson_id);
    } else if (targetLessonIds) {
        query = query.in('lesson_id', targetLessonIds);
    }

    if (topic_tag) {
        query = query.eq('topic_tag', topic_tag);
    }

    if (type_id) {
        query = query.eq('type_id', type_id);
    }

    if (status) {
        query = query.eq('status', status);
    }

    if (difficulty_level) {
        query = query.eq('question_versions.difficulty_level', difficulty_level);
    }

    if (q) {
        const safeQ = q.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        query = query.ilike('question_versions.content', `%${safeQ}%`);
    }

    const {data, error, count} = await query
        .order('created_at', {ascending: false})
        .range(from, to);

    if (error) throw error;

    const formatted = (data ?? []).map(row => {
        const formattedRow = formatQuestionResponse(row);
        delete formattedRow._rawVersion;
        return formattedRow;
    });

    return {
        questions: formatted,
        total: count ?? 0
    };
}

async function findQuestionById(questionId) {
    const {data, error} = await supabase
        .from('questions')
        .select(`
            id,
            lesson_id,
            type_id,
            topic_tag,
            status,
            ai_check_status,
            ai_similarity_score,
            is_duplicate_overridden,
            ai_audit_metadata,
            created_by,
            created_at,
            updated_at,
            question_versions!inner (
                id,
                version_no,
                type_id,
                difficulty_level,
                content,
                media_url,
                explanation,
                options_snapshot,
                is_current,
                frozen_at
            )
        `)
        .eq('id', questionId)
        .eq('question_versions.is_current', true)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return formatQuestionResponse(data);
}

async function runSafeAiCheck(questionId, options = {}) {
    try {
        return await aiCheckService.processQuestionAiCheck(questionId, options);
    } catch (err) {
        // Fallback per SRS 5.9 / README 2.1: if AI service fails unexpectedly, mark SKIPPED_TIMEOUT and keep DRAFT
        const now = new Date().toISOString();
        try {
            await supabase
                .from('questions')
                .update({
                    ai_check_status: 'SKIPPED_TIMEOUT',
                    ai_similarity_score: null,
                    ai_audit_metadata: {
                        error: err.message,
                        error_code: err.code || 'ERR_AI_SERVICE_UNAVAILABLE',
                        failed_at: now,
                        retry_needed: true
                    },
                    updated_at: now
                })
                .eq('id', questionId)
                .eq('is_duplicate_overridden', false)
                .neq('ai_check_status', 'OVERRIDDEN');
        } catch (_) {
            // Ignore fallback persistence error
        }
        return null;
    }
}

function isDuplicateBlocked(question) {
    if (!question) return false;
    if (question.is_duplicate_overridden === true || question.ai_check_status === 'OVERRIDDEN') {
        return false;
    }
    return question.ai_similarity_score !== null &&
        question.ai_similarity_score !== undefined &&
        Number(question.ai_similarity_score) >= 0.80;
}

function canAutoActivateAfterAiCheck(question) {
    if (!question) return false;
    if (question.ai_check_status !== 'CHECKED') return false;
    return !isDuplicateBlocked(question);
}

async function recheckQuestionAi(questionId, options = {}) {
    const updatedQuestion = await aiCheckService.processQuestionAiCheck(questionId, options);
    const detail = await findQuestionById(questionId);
    if (detail) {
        delete detail._rawVersion;
        if (updatedQuestion && updatedQuestion.ai_audit_metadata) {
            detail.ai_audit_metadata = updatedQuestion.ai_audit_metadata;
            detail.is_duplicate = Boolean(updatedQuestion.ai_audit_metadata.is_duplicate);
            detail.duplicate_warning = updatedQuestion.ai_audit_metadata.warning || null;
        }
    }
    return detail;
}

async function createQuestion({
    lesson_id,
    type_id,
    difficulty_level,
    topic_tag = null,
    content,
    media_url,
    explanation,
    requested_status = 'DRAFT',
    answer_spec,
    created_by
}) {
    const now = new Date().toISOString();
    const questionId = require('node:crypto').randomUUID();
    const versionId = require('node:crypto').randomUUID();

    const {data: qData, error: qErr} = await supabase
        .from('questions')
        .insert({
            id: questionId,
            lesson_id: lesson_id ?? null,
            type_id,
            topic_tag: topic_tag ?? null,
            status: 'DRAFT',
            ai_check_status: 'PENDING',
            ai_similarity_score: null,
            is_duplicate_overridden: false,
            created_by,
            created_at: now,
            updated_at: now
        })
        .select()
        .single();

    if (qErr) throw qErr;

    const {data: vData, error: vErr} = await supabase
        .from('question_versions')
        .insert({
            id: versionId,
            question_id: questionId,
            version_no: 1,
            type_id,
            difficulty_level,
            content: content.trim(),
            media_url: media_url ?? null,
            explanation: explanation ?? null,
            options_snapshot: answer_spec,
            is_current: true,
            frozen_at: null,
            created_by,
            created_at: now
        })
        .select()
        .single();

    if (vErr) throw vErr;

    const aiUpdated = await runSafeAiCheck(questionId);
    let detail = await findQuestionById(questionId);

    if (!detail) {
        detail = formatQuestionResponse({
            ...qData,
            ...(aiUpdated || {}),
            question_versions: [vData]
        });
    }

    if (requested_status === 'ACTIVE' && canAutoActivateAfterAiCheck(detail)) {
        return await updateQuestionStatus(questionId, 'ACTIVE');
    }

    delete detail._rawVersion;
    return detail;
}

async function updateQuestion(questionId, updates, existingQuestion, userId) {
    const now = new Date().toISOString();
    const rawVersion = existingQuestion._rawVersion;

    // Check if the current version is frozen or used in exams
    let isFrozen = Boolean(rawVersion && rawVersion.frozen_at);

    if (!isFrozen && rawVersion) {
        const {count} = await supabase
            .from('exam_variant_questions')
            .select('id', {count: 'exact', head: true})
            .eq('question_version_id', rawVersion.id);

        if (count && count > 0) {
            isFrozen = true;
        }
    }

    if (isFrozen) {
        // FROZEN: Immutable old version! Demote old version and insert a new version_no
        const {error: demoteErr} = await supabase
            .from('question_versions')
            .update({is_current: false})
            .eq('id', rawVersion.id);

        if (demoteErr) throw demoteErr;

        const newVersionId = require('node:crypto').randomUUID();
        const nextVersionNo = (rawVersion.version_no ?? 1) + 1;

        const newVersionPayload = {
            id: newVersionId,
            question_id: questionId,
            version_no: nextVersionNo,
            type_id: updates.type_id ?? rawVersion.type_id,
            difficulty_level: updates.difficulty_level ?? rawVersion.difficulty_level,
            content: updates.content ? updates.content.trim() : rawVersion.content,
            media_url: Object.prototype.hasOwnProperty.call(updates, 'media_url')
                ? updates.media_url
                : rawVersion.media_url,
            explanation: Object.prototype.hasOwnProperty.call(updates, 'explanation')
                ? updates.explanation
                : rawVersion.explanation,
            options_snapshot: updates.answer_spec ?? rawVersion.options_snapshot,
            is_current: true,
            frozen_at: null,
            created_by: userId,
            created_at: now
        };

        const {error: insertErr} = await supabase
            .from('question_versions')
            .insert(newVersionPayload);

        if (insertErr) throw insertErr;
    } else if (rawVersion) {
        // NOT FROZEN: Update current version in place
        const versionUpdates = {};
        if (updates.type_id) versionUpdates.type_id = updates.type_id;
        if (updates.difficulty_level) versionUpdates.difficulty_level = updates.difficulty_level;
        if (updates.content) versionUpdates.content = updates.content.trim();
        if (Object.prototype.hasOwnProperty.call(updates, 'media_url')) {
            versionUpdates.media_url = updates.media_url;
        }
        if (Object.prototype.hasOwnProperty.call(updates, 'explanation')) {
            versionUpdates.explanation = updates.explanation;
        }
        if (updates.answer_spec) versionUpdates.options_snapshot = updates.answer_spec;

        if (Object.keys(versionUpdates).length > 0) {
            const {error: vUpdateErr} = await supabase
                .from('question_versions')
                .update(versionUpdates)
                .eq('id', rawVersion.id);

            if (vUpdateErr) throw vUpdateErr;
        }
    }

    // Determine whether AI duplicate check must re-run due to content/classification changes
    const contentChanged = Object.prototype.hasOwnProperty.call(updates, 'content') &&
        updates.content.trim() !== existingQuestion.content;
    const typeChanged = Object.prototype.hasOwnProperty.call(updates, 'type_id') &&
        updates.type_id !== existingQuestion.type_id;
    const lessonChanged = Object.prototype.hasOwnProperty.call(updates, 'lesson_id') &&
        updates.lesson_id !== existingQuestion.lesson_id;
    const shouldRecheckAi = contentChanged || typeChanged || lessonChanged;

    // Update parent question table
    const questionUpdates = {updated_at: now};
    if (Object.prototype.hasOwnProperty.call(updates, 'lesson_id')) {
        questionUpdates.lesson_id = updates.lesson_id;
    }
    if (updates.type_id) {
        questionUpdates.type_id = updates.type_id;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'topic_tag')) {
        questionUpdates.topic_tag = typeof updates.topic_tag === 'string'
            ? (updates.topic_tag.trim() || null)
            : null;
    }
    if (shouldRecheckAi) {
        questionUpdates.status = 'DRAFT';
        questionUpdates.ai_check_status = 'PENDING';
        questionUpdates.ai_similarity_score = null;
        questionUpdates.is_duplicate_overridden = false;
        questionUpdates.ai_audit_metadata = null;
    }

    const {error: qUpdateErr} = await supabase
        .from('questions')
        .update(questionUpdates)
        .eq('id', questionId);

    if (qUpdateErr) throw qUpdateErr;

    if (shouldRecheckAi) {
        await runSafeAiCheck(questionId);
    }

    const updated = await findQuestionById(questionId);
    if (!updated) return null;

    if (updates.requested_status === 'ACTIVE') {
        const canActivate = shouldRecheckAi
            ? canAutoActivateAfterAiCheck(updated)
            : (updated.status === 'ACTIVE' || !isDuplicateBlocked(updated));
        if (canActivate && updated.status !== 'ACTIVE') {
            return await updateQuestionStatus(questionId, 'ACTIVE');
        }
    }

    delete updated._rawVersion;
    return updated;
}

async function overrideQuestionAi(questionId, {reason, overriddenBy, existingQuestion, requestMeta = {}}) {
    const now = new Date().toISOString();
    const trimmedReason = reason.trim();
    const existingMeta = (existingQuestion.ai_audit_metadata && typeof existingQuestion.ai_audit_metadata === 'object')
        ? existingQuestion.ai_audit_metadata
        : {};

    const updatedMetadata = {
        ...existingMeta,
        review_state: 'OVERRIDDEN',
        override: {
            reason: trimmedReason,
            overridden_by: overriddenBy,
            overridden_at: now,
            previous_ai_check_status: existingQuestion.ai_check_status ?? null,
            previous_similarity_score: existingQuestion.ai_similarity_score ?? null
        }
    };

    const {error: updateErr} = await supabase
        .from('questions')
        .update({
            ai_check_status: 'OVERRIDDEN',
            is_duplicate_overridden: true,
            ai_audit_metadata: updatedMetadata,
            updated_at: now
        })
        .eq('id', questionId)
        .is('deleted_at', null);

    if (updateErr) throw updateErr;

    // Best-effort append-only audit log entry
    try {
        await supabase
            .from('audit_logs')
            .insert({
                actor_user_id: overriddenBy,
                action: 'AI_DUPLICATE_OVERRIDE',
                entity_name: 'questions',
                entity_id: questionId,
                old_value: {
                    ai_check_status: existingQuestion.ai_check_status ?? null,
                    ai_similarity_score: existingQuestion.ai_similarity_score ?? null,
                    is_duplicate_overridden: Boolean(existingQuestion.is_duplicate_overridden)
                },
                new_value: {
                    ai_check_status: 'OVERRIDDEN',
                    is_duplicate_overridden: true,
                    reason: trimmedReason
                },
                ip_address: requestMeta.ip || null,
                user_agent: requestMeta.userAgent ? String(requestMeta.userAgent).slice(0, 255) : null,
                created_at: now
            });
    } catch (_) {
        // Non-blocking audit log fallback
    }

    const updated = await findQuestionById(questionId);
    if (updated) delete updated._rawVersion;
    return updated;
}

async function cloneQuestion(existingQuestion, createdBy) {
    return await createQuestion({
        lesson_id: existingQuestion.lesson_id ?? null,
        type_id: existingQuestion.type_id,
        difficulty_level: existingQuestion.difficulty_level,
        topic_tag: existingQuestion.topic_tag ?? null,
        content: existingQuestion.content,
        media_url: existingQuestion.media_url ?? null,
        explanation: existingQuestion.explanation ?? null,
        requested_status: 'DRAFT',
        answer_spec: existingQuestion.answer_spec,
        created_by: createdBy
    });
}

async function findQuestionVersions(questionId) {
    const {data, error} = await supabase
        .from('question_versions')
        .select('id, question_id, version_no, frozen_at, is_current, options_snapshot')
        .eq('question_id', questionId)
        .order('version_no', {ascending: true});

    if (error) throw error;

    return (data ?? []).map(row => ({
        id: row.id,
        question_id: row.question_id,
        version_no: row.version_no,
        frozen_at: row.frozen_at ?? null,
        is_current: Boolean(row.is_current),
        answer_spec: row.options_snapshot ?? null
    }));
}

async function updateQuestionStatus(questionId, newStatus) {
    const now = new Date().toISOString();

    const {error} = await supabase
        .from('questions')
        .update({
            status: newStatus,
            updated_at: now
        })
        .eq('id', questionId)
        .is('deleted_at', null);

    if (error) throw error;

    const updated = await findQuestionById(questionId);
    if (updated) delete updated._rawVersion;
    return updated;
}

async function isQuestionUsedInExams(questionId) {
    const {data: versions, error: vErr} = await supabase
        .from('question_versions')
        .select('id')
        .eq('question_id', questionId);

    if (vErr) throw vErr;
    const versionIds = (versions ?? []).map(v => v.id);

    if (versionIds.length === 0) return false;

    const {count, error: evqErr} = await supabase
        .from('exam_variant_questions')
        .select('id', {count: 'exact', head: true})
        .in('question_version_id', versionIds);

    if (evqErr) throw evqErr;
    return Boolean(count && count > 0);
}

async function softDeleteQuestion(questionId, deletedBy) {
    const now = new Date().toISOString();

    const {data, error} = await supabase
        .from('questions')
        .update({
            deleted_at: now,
            deleted_by: deletedBy,
            updated_at: now
        })
        .eq('id', questionId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();

    if (error) throw error;
    return data;
}

module.exports = {
    findQuestions,
    findQuestionById,
    createQuestion,
    updateQuestion,
    overrideQuestionAi,
    cloneQuestion,
    findQuestionVersions,
    updateQuestionStatus,
    isQuestionUsedInExams,
    softDeleteQuestion,
    formatQuestionResponse,
    recheckQuestionAi,
    isDuplicateBlocked
};

