const supabase = require('../config/supabase');
const aiCheckService = require('../services/ai-check.service');
const gradingService = require('../services/grading.service');
const {recordAuditLog} = require('../services/audit-logs.service');

const DEFAULT_AI_RETRY_INTERVAL_MS = Number(process.env.AI_RETRY_INTERVAL_MS || 15000);
const DEFAULT_AI_RETRY_BATCH_SIZE = Number(process.env.AI_RETRY_BATCH_SIZE || 5);
const DEFAULT_AI_RETRY_MAX_ATTEMPTS = Number(process.env.AI_RETRY_MAX_ATTEMPTS || 5);
const DEFAULT_AI_RETRY_TIMEOUT_MS = Number(process.env.AI_RETRY_TIMEOUT_MS || 5000);

const DEFAULT_DEADLINE_INTERVAL_MS = Number(process.env.DEADLINE_SWEEP_INTERVAL_MS || 10000);
const DEFAULT_DEADLINE_BATCH_SIZE = Number(process.env.DEADLINE_SWEEP_BATCH_SIZE || 50);

let aiSweepRunning = false;
let deadlineSweepRunning = false;

/**
 * Retry DRAFT questions whose AI duplicate check timed out (SKIPPED_TIMEOUT).
 */
async function sweepSkippedTimeoutQuestions(options = {}) {
    if (aiSweepRunning) {
        return {scanned: 0, retried: 0, checked: 0, timedOut: 0, skipped: 0, busy: true};
    }

    aiSweepRunning = true;
    const summary = {scanned: 0, retried: 0, checked: 0, timedOut: 0, skipped: 0};

    try {
        const client = options.client || supabase;
        const batchSize = options.batchSize || DEFAULT_AI_RETRY_BATCH_SIZE;
        const maxAttempts = options.maxAttempts || DEFAULT_AI_RETRY_MAX_ATTEMPTS;
        const timeoutMs = options.timeoutMs || DEFAULT_AI_RETRY_TIMEOUT_MS;

        const {data: candidates, error} = await client
            .from('questions')
            .select('id, ai_audit_metadata, updated_at')
            .is('deleted_at', null)
            .eq('status', 'DRAFT')
            .eq('ai_check_status', 'SKIPPED_TIMEOUT')
            .eq('is_duplicate_overridden', false)
            .order('updated_at', {ascending: true})
            .limit(batchSize);

        if (error) throw error;

        const rows = candidates ?? [];
        summary.scanned = rows.length;

        for (const row of rows) {
            const meta = row.ai_audit_metadata && typeof row.ai_audit_metadata === 'object'
                ? row.ai_audit_metadata
                : {};
            const retryCount = Number(meta.retry_count || 0);

            if (retryCount >= maxAttempts) {
                summary.skipped++;
                continue;
            }

            summary.retried++;

            try {
                const updated = await aiCheckService.processQuestionAiCheck(row.id, {
                    client,
                    timeoutMs,
                    duplicateCheckService: options.duplicateCheckService
                });

                if (updated?.ai_check_status === 'CHECKED') {
                    summary.checked++;
                } else if (updated?.ai_check_status === 'SKIPPED_TIMEOUT') {
                    summary.timedOut++;
                    const nextMeta = {
                        ...(updated.ai_audit_metadata || {}),
                        retry_count: retryCount + 1,
                        last_retry_at: new Date().toISOString()
                    };
                    await client
                        .from('questions')
                        .update({ai_audit_metadata: nextMeta})
                        .eq('id', row.id)
                        .eq('ai_check_status', 'SKIPPED_TIMEOUT')
                        .eq('updated_at', updated.updated_at);
                }
            } catch (err) {
                if (['ERR_OVERRIDE_PROTECTED', 'ERR_VERSION_MISMATCH_DISCARDED', 'ERR_CONCURRENCY_UPDATE_FAILED', 'ERR_QUESTION_NOT_FOUND'].includes(err.code)) {
                    summary.skipped++;
                } else {
                    summary.timedOut++;
                }
            }
        }

        return summary;
    } finally {
        aiSweepRunning = false;
    }
}

/**
 * Force-submit expired ONLINE IN_PROGRESS submissions via olms_force_submit_expired_online
 * and trigger background grading for newly closed attempts.
 */
async function sweepExpiredSubmissions(options = {}) {
    if (deadlineSweepRunning) {
        return {scanned: 0, expired: 0, submitted: 0, graded: 0, skipped: 0, busy: true};
    }

    deadlineSweepRunning = true;
    const summary = {scanned: 0, expired: 0, submitted: 0, graded: 0, skipped: 0};

    try {
        const client = options.client || supabase;
        const batchSize = options.batchSize || DEFAULT_DEADLINE_BATCH_SIZE;
        const nowMs = options.nowMs !== undefined ? options.nowMs : Date.now();

        const {data: openSubs, error: subErr} = await client
            .from('submissions')
            .select('id, exam_id, started_at, status')
            .eq('source', 'ONLINE')
            .eq('status', 'IN_PROGRESS')
            .order('started_at', {ascending: true})
            .limit(batchSize);

        if (subErr) throw subErr;

        const submissions = openSubs ?? [];
        summary.scanned = submissions.length;
        if (submissions.length === 0) return summary;

        const examIds = [...new Set(submissions.map(s => s.exam_id).filter(Boolean))];
        const {data: exams, error: examErr} = await client
            .from('exams')
            .select('id, duration_minutes, closes_at')
            .in('id', examIds);

        if (examErr) throw examErr;

        const examById = new Map((exams ?? []).map(e => [e.id, e]));

        for (const sub of submissions) {
            const exam = examById.get(sub.exam_id);
            if (!exam || !sub.started_at) {
                summary.skipped++;
                continue;
            }

            const startedDeadline = new Date(sub.started_at).getTime() + Number(exam.duration_minutes) * 60 * 1000;
            const closesDeadline = new Date(exam.closes_at).getTime();
            const effectiveDeadlineMs = Math.min(startedDeadline, closesDeadline);

            if (nowMs < effectiveDeadlineMs) {
                continue;
            }

            summary.expired++;

            const {data: rpcRows, error: rpcErr} = await client.rpc('olms_force_submit_expired_online', {
                p_submission: sub.id
            });

            if (rpcErr) {
                // DB clock_timestamp() is authoritative; ignore tiny local-vs-DB clock skew until next tick
                summary.skipped++;
                continue;
            }

            const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
            if (row && row.submission_status === 'SUBMITTED' && !row.was_retry) {
                summary.submitted++;

                await recordAuditLog({
                    actorUserId: null,
                    action: 'SUBMISSION_DEADLINE_FORCE_SUBMITTED',
                    entityName: 'submissions',
                    entityId: sub.id,
                    newValue: {
                        exam_id: sub.exam_id,
                        effective_deadline_at: new Date(effectiveDeadlineMs).toISOString()
                    }
                });

                try {
                    const gradeResult = await gradingService.gradeSubmission(sub.id);
                    if (gradeResult?.status === 'GRADED') {
                        summary.graded++;
                    }
                } catch (_) {
                    // Grading can still be triggered lazily on results/publish read
                }
            }
        }

        return summary;
    } finally {
        deadlineSweepRunning = false;
    }
}

/**
 * Start periodic background worker intervals for AI retry and deadline recovery.
 */
function startBackgroundWorkers() {
    if (process.env.WORKER_ENABLED === 'false') {
        return {stop: () => {}};
    }

    const aiTimer = setInterval(() => {
        sweepSkippedTimeoutQuestions().catch((err) => {
            console.error('AI retry worker error:', err.message);
        });
    }, DEFAULT_AI_RETRY_INTERVAL_MS);

    const deadlineTimer = setInterval(() => {
        sweepExpiredSubmissions().catch((err) => {
            console.error('Deadline recovery worker error:', err.message);
        });
    }, DEFAULT_DEADLINE_INTERVAL_MS);

    aiTimer.unref();
    deadlineTimer.unref();

    return {
        stop: () => {
            clearInterval(aiTimer);
            clearInterval(deadlineTimer);
        }
    };
}

module.exports = {
    sweepSkippedTimeoutQuestions,
    sweepExpiredSubmissions,
    startBackgroundWorkers
};
