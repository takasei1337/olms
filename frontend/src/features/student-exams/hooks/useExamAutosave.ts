import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../../api/client';
import { autosaveQuestionAnswer } from '../student-exams.api';
import type {
  CasConflictErrorData,
  LocalAnswerDraft,
  QuestionRuntimeState,
  StudentExamSessionData,
} from '../types';
import {
  buildStrictAutosavePayload,
  cloneDraft,
  createEmptyDraft,
  draftFromSavedAnswer,
  draftsEqual,
  generateUuidV4,
  isDraftAnswered,
} from '../utils';

const INPUT_DEBOUNCE_MS = 500;
const TRANSIENT_RETRY_DELAYS_MS = [450, 1200];
const MAX_CAS_RETRIES = 2;

const SESSION_TERMINAL_CODES = new Set([
  'SESSION_EXPIRED',
  'SUBMISSION_ALREADY_CLOSED',
  'SUBMISSION_LOCKED',
]);

interface UseExamAutosaveOptions {
  submissionId: string | null;
  isReadOnly?: boolean;
  onServerTimeSync?: (serverTimeIso: string) => void;
  onConflictResynced?: (message: string) => void;
  onSessionTerminalError?: (code: string, message: string) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function buildInitialQuestionMap(
  session: StudentExamSessionData
): Record<string, QuestionRuntimeState> {
  const savedById = new Map(
    session.saved_answers.map((ans) => [ans.exam_variant_question_id, ans])
  );

  const next: Record<string, QuestionRuntimeState> = {};
  for (const q of session.questions) {
    const saved = savedById.get(q.exam_variant_question_id);
    const draft = draftFromSavedAnswer(q.type_code, saved);
    const confirmedSeq = saved ? Number(saved.client_sequence ?? 0) : 0;
    const answered = isDraftAnswered(draft);

    next[q.exam_variant_question_id] = {
      draft,
      confirmedSeq,
      status: saved && answered ? 'saved' : 'idle',
      savedAt: null,
      errorMessage: null,
    };
  }
  return next;
}

export function useExamAutosave({
  submissionId,
  isReadOnly = false,
  onServerTimeSync,
  onConflictResynced,
  onSessionTerminalError,
}: UseExamAutosaveOptions) {
  const [questionStates, setQuestionStates] = useState<
    Record<string, QuestionRuntimeState>
  >({});

  const submissionIdRef = useRef<string | null>(submissionId);
  const isReadOnlyRef = useRef<boolean>(isReadOnly);
  const unmountedRef = useRef<boolean>(false);

  const draftRef = useRef<Map<string, LocalAnswerDraft>>(new Map());
  const lastSavedDraftRef = useRef<Map<string, LocalAnswerDraft | null>>(new Map());
  const confirmedSeqRef = useRef<Map<string, number>>(new Map());
  const statusRef = useRef<Map<string, QuestionRuntimeState['status']>>(new Map());
  const needsSyncRef = useRef<Map<string, boolean>>(new Map());
  const drainPromisesRef = useRef<Map<string, Promise<void>>>(new Map());
  const debounceTimersRef = useRef<Map<string, number>>(new Map());

  const callbacksRef = useRef({
    onServerTimeSync,
    onConflictResynced,
    onSessionTerminalError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onServerTimeSync,
      onConflictResynced,
      onSessionTerminalError,
    };
  }, [onServerTimeSync, onConflictResynced, onSessionTerminalError]);

  useEffect(() => {
    submissionIdRef.current = submissionId;
  }, [submissionId]);

  useEffect(() => {
    isReadOnlyRef.current = isReadOnly;
  }, [isReadOnly]);

  useEffect(() => {
    unmountedRef.current = false;
    const timers = debounceTimersRef.current;
    return () => {
      unmountedRef.current = true;
      for (const timerId of timers.values()) {
        window.clearTimeout(timerId);
      }
      timers.clear();
    };
  }, []);

  const patchQuestionState = useCallback(
    (
      qId: string,
      patch: Partial<QuestionRuntimeState>
    ) => {
      if (unmountedRef.current) return;
      if (patch.status !== undefined) {
        statusRef.current.set(qId, patch.status);
      }
      setQuestionStates((prev) => {
        const current = prev[qId];
        if (!current) return prev;
        return {
          ...prev,
          [qId]: {
            ...current,
            ...patch,
          },
        };
      });
    },
    []
  );

  const hydrateFromSession = useCallback(
    (
      session: StudentExamSessionData,
      options: { preserveDirtyEdits?: boolean } = {}
    ) => {
      const { preserveDirtyEdits = false } = options;
      const initialMap = buildInitialQuestionMap(session);

      if (!preserveDirtyEdits) {
        for (const timerId of debounceTimersRef.current.values()) {
          window.clearTimeout(timerId);
        }
        debounceTimersRef.current.clear();
        needsSyncRef.current.clear();
      }

      const mergedMap: Record<string, QuestionRuntimeState> = {};

      for (const q of session.questions) {
        const qId = q.exam_variant_question_id;
        const serverEntry = initialMap[qId] ?? {
          draft: createEmptyDraft(q.type_code),
          confirmedSeq: 0,
          status: 'idle' as const,
          savedAt: null,
          errorMessage: null,
        };

        const isDirty =
          preserveDirtyEdits &&
          (needsSyncRef.current.get(qId) ||
            drainPromisesRef.current.has(qId) ||
            debounceTimersRef.current.has(qId) ||
            statusRef.current.get(qId) === 'dirty' ||
            statusRef.current.get(qId) === 'error');

        const serverSavedDraft = session.saved_answers.find(
          (s) => s.exam_variant_question_id === qId
        )
          ? cloneDraft(serverEntry.draft)
          : null;

        confirmedSeqRef.current.set(qId, serverEntry.confirmedSeq);
        lastSavedDraftRef.current.set(qId, serverSavedDraft);

        if (isDirty) {
          const existingDraft = draftRef.current.get(qId) ?? serverEntry.draft;
          const existingStatus = statusRef.current.get(qId) ?? 'dirty';
          mergedMap[qId] = {
            draft: existingDraft,
            confirmedSeq: serverEntry.confirmedSeq,
            status: existingStatus,
            savedAt: null,
            errorMessage: null,
          };
          draftRef.current.set(qId, existingDraft);
          statusRef.current.set(qId, existingStatus);
        } else {
          draftRef.current.set(qId, cloneDraft(serverEntry.draft));
          statusRef.current.set(qId, serverEntry.status);
          mergedMap[qId] = serverEntry;
        }
      }

      setQuestionStates(mergedMap);
    },
    []
  );

  const runQuestionDrain = useCallback(
    async (qId: string): Promise<void> => {
      while (needsSyncRef.current.get(qId)) {
        if (unmountedRef.current || isReadOnlyRef.current) {
          return;
        }

        const activeSubId = submissionIdRef.current;
        if (!activeSubId) return;

        needsSyncRef.current.set(qId, false);
        const latestDraft = draftRef.current.get(qId);
        if (!latestDraft) return;

        const targetDraft = cloneDraft(latestDraft);
        const lastSaved = lastSavedDraftRef.current.get(qId);

        if (
          lastSaved &&
          draftsEqual(targetDraft, lastSaved) &&
          statusRef.current.get(qId) === 'saved'
        ) {
          continue;
        }

        let expectedSeq = confirmedSeqRef.current.get(qId) ?? 0;
        let editToken = generateUuidV4();
        let casRetries = 0;
        let transientRetryIdx = 0;
        let completedThisTarget = false;

        patchQuestionState(qId, {
          status: 'saving',
          errorMessage: null,
        });

        while (!completedThisTarget) {
          if (unmountedRef.current || isReadOnlyRef.current) {
            return;
          }

          const payload = buildStrictAutosavePayload(
            targetDraft,
            expectedSeq,
            editToken
          );

          try {
            const ack = await autosaveQuestionAnswer(activeSubId, qId, payload);

            confirmedSeqRef.current.set(qId, ack.accepted_sequence);
            lastSavedDraftRef.current.set(qId, cloneDraft(targetDraft));
            callbacksRef.current.onServerTimeSync?.(ack.server_time);

            const currentDraftNow = draftRef.current.get(qId);
            const hasNewerLocalEdit =
              Boolean(currentDraftNow && !draftsEqual(currentDraftNow, targetDraft)) ||
              Boolean(needsSyncRef.current.get(qId));

            if (hasNewerLocalEdit) {
              needsSyncRef.current.set(qId, true);
              patchQuestionState(qId, {
                confirmedSeq: ack.accepted_sequence,
                savedAt: ack.saved_at,
                errorMessage: null,
              });
            } else {
              patchQuestionState(qId, {
                confirmedSeq: ack.accepted_sequence,
                status: isDraftAnswered(targetDraft) ? 'saved' : 'idle',
                savedAt: ack.saved_at,
                errorMessage: null,
              });
            }

            completedThisTarget = true;
          } catch (err) {
            const apiErr = err instanceof ApiError ? err : null;

            if (apiErr && SESSION_TERMINAL_CODES.has(apiErr.code)) {
              needsSyncRef.current.set(qId, false);
              patchQuestionState(qId, {
                status: 'error',
                errorMessage: apiErr.message,
              });
              callbacksRef.current.onSessionTerminalError?.(
                apiErr.code,
                apiErr.message
              );
              return;
            }

            if (
              apiErr &&
              (apiErr.code === 'ANSWER_REVISION_CONFLICT' ||
                apiErr.code === 'EDIT_TOKEN_REUSED_DIFFERENT_PAYLOAD')
            ) {
              const errData = (apiErr.data ?? {}) as CasConflictErrorData;
              if (typeof errData.server_time === 'string') {
                callbacksRef.current.onServerTimeSync?.(errData.server_time);
              }
              if (typeof errData.current_sequence === 'number') {
                expectedSeq = errData.current_sequence;
                confirmedSeqRef.current.set(qId, errData.current_sequence);
              }

              if (errData.can_retry !== false && casRetries < MAX_CAS_RETRIES) {
                casRetries += 1;
                editToken = generateUuidV4();
                patchQuestionState(qId, {
                  confirmedSeq: expectedSeq,
                  status: 'retrying',
                  errorMessage: 'Đang đồng bộ lại thứ tự lưu với máy chủ...',
                });
                callbacksRef.current.onConflictResynced?.(
                  'Đã phát hiện thay đổi phiên trước đó, hệ thống tự động đồng bộ lại đáp án.'
                );
                // If user changed answer further while request failed, break to restart with newest draft
                const newest = draftRef.current.get(qId);
                if (newest && !draftsEqual(newest, targetDraft)) {
                  needsSyncRef.current.set(qId, true);
                  completedThisTarget = true;
                }
                continue;
              }

              patchQuestionState(qId, {
                confirmedSeq: expectedSeq,
                status: 'error',
                errorMessage: apiErr.message,
              });
              return;
            }

            const isTransient =
              !apiErr || apiErr.isNetworkError || apiErr.status === 0 || apiErr.status >= 500;

            if (
              isTransient &&
              transientRetryIdx < TRANSIENT_RETRY_DELAYS_MS.length
            ) {
              const delayMs = TRANSIENT_RETRY_DELAYS_MS[transientRetryIdx];
              transientRetryIdx += 1;
              patchQuestionState(qId, {
                status: 'retrying',
                errorMessage: 'Mất kết nối tạm thời — đang thử lưu lại...',
              });
              await sleep(delayMs);

              // Preserve exact same edit_token & expectedSeq if draft is still unchanged;
              // if user changed answer in the meantime, break and sync the newer draft cleanly.
              const newest = draftRef.current.get(qId);
              if (newest && !draftsEqual(newest, targetDraft)) {
                needsSyncRef.current.set(qId, true);
                completedThisTarget = true;
              }
              continue;
            }

            const msg =
              err instanceof ApiError
                ? err.message
                : 'Không thể lưu đáp án. Vui lòng thử lại.';
            patchQuestionState(qId, {
              status: 'error',
              errorMessage: msg,
            });
            return;
          }
        }
      }
    },
    [patchQuestionState]
  );

  const enqueueSync = useCallback(
    (qId: string): Promise<void> => {
      if (isReadOnlyRef.current || !submissionIdRef.current) {
        return Promise.resolve();
      }

      needsSyncRef.current.set(qId, true);
      const existingDrain = drainPromisesRef.current.get(qId);
      if (existingDrain) {
        return existingDrain;
      }

      const promise = runQuestionDrain(qId).finally(() => {
        drainPromisesRef.current.delete(qId);
        // Handle edge case where a new edit landed between while check exit and finally
        if (needsSyncRef.current.get(qId) && !unmountedRef.current && !isReadOnlyRef.current) {
          void enqueueSync(qId);
        }
      });

      drainPromisesRef.current.set(qId, promise);
      return promise;
    },
    [runQuestionDrain]
  );

  const updateDraft = useCallback(
    (
      qId: string,
      nextDraft: LocalAnswerDraft,
      options: { immediate?: boolean } = {}
    ) => {
      if (isReadOnlyRef.current) return;

      const normalized = cloneDraft(nextDraft);
      draftRef.current.set(qId, normalized);

      const existingTimer = debounceTimersRef.current.get(qId);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
        debounceTimersRef.current.delete(qId);
      }

      const lastSaved = lastSavedDraftRef.current.get(qId);
      const hasPendingInFlight = drainPromisesRef.current.has(qId);
      const currentStatus = statusRef.current.get(qId);

      if (
        lastSaved &&
        draftsEqual(normalized, lastSaved) &&
        !hasPendingInFlight &&
        currentStatus !== 'error'
      ) {
        needsSyncRef.current.set(qId, false);
        patchQuestionState(qId, {
          draft: normalized,
          status: isDraftAnswered(normalized) ? 'saved' : 'idle',
          errorMessage: null,
        });
        return;
      }

      const shouldDebounce = normalized.kind === 'INPUT' && !options.immediate;

      patchQuestionState(qId, {
        draft: normalized,
        status: 'dirty',
        errorMessage: null,
      });

      if (shouldDebounce) {
        const timerId = window.setTimeout(() => {
          debounceTimersRef.current.delete(qId);
          void enqueueSync(qId);
        }, INPUT_DEBOUNCE_MS);
        debounceTimersRef.current.set(qId, timerId);
      } else {
        void enqueueSync(qId);
      }
    },
    [enqueueSync, patchQuestionState]
  );

  const flushQuestion = useCallback(
    async (qId: string): Promise<void> => {
      const existingTimer = debounceTimersRef.current.get(qId);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
        debounceTimersRef.current.delete(qId);
      }

      const draft = draftRef.current.get(qId);
      const lastSaved = lastSavedDraftRef.current.get(qId);
      const isDirtyOrErr =
        statusRef.current.get(qId) === 'dirty' ||
        statusRef.current.get(qId) === 'error' ||
        (draft &&
          ((lastSaved && !draftsEqual(draft, lastSaved)) ||
            (!lastSaved && isDraftAnswered(draft))));

      if (isDirtyOrErr) {
        await enqueueSync(qId);
      } else {
        const active = drainPromisesRef.current.get(qId);
        if (active) await active;
      }
    },
    [enqueueSync]
  );

  const retryQuestion = useCallback(
    async (qId: string): Promise<void> => {
      const existingTimer = debounceTimersRef.current.get(qId);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
        debounceTimersRef.current.delete(qId);
      }
      await enqueueSync(qId);
    },
    [enqueueSync]
  );

  const flushAll = useCallback(async (): Promise<{
    hasErrors: boolean;
  }> => {
    for (const [qId, timerId] of debounceTimersRef.current.entries()) {
      window.clearTimeout(timerId);
      debounceTimersRef.current.delete(qId);
      needsSyncRef.current.set(qId, true);
    }

    const promises: Promise<void>[] = [];
    for (const qId of draftRef.current.keys()) {
      promises.push(flushQuestion(qId));
    }

    await Promise.all(promises);

    let hasErrors = false;
    for (const st of statusRef.current.values()) {
      if (st === 'error') {
        hasErrors = true;
        break;
      }
    }
    return { hasErrors };
  }, [flushQuestion]);

  const summary = useMemo(() => {
    const values = Object.values(questionStates);
    let answeredCount = 0;
    let pendingCount = 0;
    let errorCount = 0;

    for (const st of values) {
      if (isDraftAnswered(st.draft)) answeredCount += 1;
      if (st.status === 'dirty' || st.status === 'saving' || st.status === 'retrying') {
        pendingCount += 1;
      }
      if (st.status === 'error') errorCount += 1;
    }

    return {
      totalCount: values.length,
      answeredCount,
      unansweredCount: Math.max(0, values.length - answeredCount),
      pendingCount,
      errorCount,
    };
  }, [questionStates]);

  return {
    questionStates,
    summary,
    hydrateFromSession,
    updateDraft,
    flushQuestion,
    retryQuestion,
    flushAll,
  };
}
