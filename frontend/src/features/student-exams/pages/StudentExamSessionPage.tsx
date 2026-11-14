import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  CloudOff,
  Eraser,
  LayoutGrid,
  Loader2,
  RefreshCw,
  Send,
  WifiOff,
  X,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TechnicalDetails } from '@/components/ui/TechnicalDetails';
import { cn } from '@/lib/utils';
import { ApiError } from '../../../api/client';
import { CountdownClock } from '../components/CountdownClock';
import { QuestionPalette } from '../components/QuestionPalette';
import { QuestionResponseInput } from '../components/QuestionResponseInput';
import { SubmissionReceiptView } from '../components/SubmissionReceiptView';
import { SubmitConfirmModal } from '../components/SubmitConfirmModal';
import { useExamAutosave } from '../hooks/useExamAutosave';
import {
  getActiveExamSession,
  listMyExams,
  startOrResumeExamSession,
  submitExamSubmission,
} from '../student-exams.api';
import type {
  StudentExamListItem,
  StudentExamSessionData,
  SubmitReceiptData,
} from '../types';
import {
  clearExamLocalPreferences,
  computeServerClockOffsetMs,
  createEmptyDraft,
  formatTimeClock,
  generateUuidV4,
  isDraftAnswered,
  loadFlaggedQuestionIds,
  loadSavedQuestionPosition,
  saveFlaggedQuestionIds,
  saveQuestionPosition,
  STUDENT_QUESTION_TYPE_LABELS,
} from '../utils';

const inFlightSessionLoads = new Map<string, Promise<StudentExamSessionData>>();

async function fetchOrStartSessionOnce(examId: string): Promise<StudentExamSessionData> {
  const existing = inFlightSessionLoads.get(examId);
  if (existing) return existing;

  const task = (async () => {
    try {
      return await getActiveExamSession(examId);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SESSION_NOT_FOUND') {
        return await startOrResumeExamSession(examId);
      }
      throw err;
    }
  })().finally(() => {
    inFlightSessionLoads.delete(examId);
  });

  inFlightSessionLoads.set(examId, task);
  return task;
}

interface LocationState {
  examMeta?: StudentExamListItem;
}

export function StudentExamSessionPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state ?? null) as LocationState | null;

  const [examMeta, setExamMeta] = useState<StudentExamListItem | null>(
    navState?.examMeta ?? null
  );
  const [session, setSession] = useState<StudentExamSessionData | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isResyncing, setIsResyncing] = useState(false);
  const [loadError, setLoadError] = useState<{
    message: string;
    code?: string;
    traceId?: string;
  } | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(() => new Set());
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isFlushingBeforeSubmit, setIsFlushingBeforeSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmitReceiptData | null>(null);
  const [wasAutoSubmittedOnExpiry, setWasAutoSubmittedOnExpiry] = useState(false);
  const [isLockedByExpiryOrClose, setIsLockedByExpiryOrClose] = useState(false);

  const submitIdempotencyKeyRef = useRef<string>(generateUuidV4());
  const submissionActiveIdRef = useRef<string | null>(null);

  const handleServerTimeSync = useCallback((serverTimeIso: string) => {
    setClockOffsetMs(computeServerClockOffsetMs(serverTimeIso));
  }, []);

  const handleConflictResynced = useCallback((msg: string) => {
    setNoticeBanner(msg);
  }, []);

  const submitFinal = useCallback(
    async (
      targetSubmissionId: string,
      options: { isAutoExpiry?: boolean; flushPending?: () => Promise<unknown> } = {}
    ) => {
      const { isAutoExpiry = false, flushPending } = options;
      setSubmitError(null);

      try {
        if (flushPending && !isAutoExpiry) {
          setIsFlushingBeforeSubmit(true);
          await flushPending();
          setIsFlushingBeforeSubmit(false);
        }

        setIsSubmitting(true);
        const result = await submitExamSubmission(
          targetSubmissionId,
          submitIdempotencyKeyRef.current
        );
        clearExamLocalPreferences(targetSubmissionId);
        setReceipt(result);
        setWasAutoSubmittedOnExpiry(isAutoExpiry);
        setIsSubmitModalOpen(false);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.code === 'SUBMISSION_ALREADY_CLOSED') {
            setIsLockedByExpiryOrClose(true);
          }
          setSubmitError(err.message);
        } else {
          setSubmitError('Không thể nộp bài lúc này. Vui lòng kiểm tra kết nối và bấm thử lại.');
        }
      } finally {
        setIsFlushingBeforeSubmit(false);
        setIsSubmitting(false);
      }
    },
    []
  );

  const handleSessionTerminalError = useCallback(
    (code: string, message: string) => {
      setIsLockedByExpiryOrClose(true);
      if (code === 'SESSION_EXPIRED' && submissionActiveIdRef.current) {
        setNoticeBanner(
          'Hết thời gian làm bài theo đồng hồ máy chủ. Hệ thống đang thu nhận bài làm...'
        );
        void submitFinal(submissionActiveIdRef.current, { isAutoExpiry: true });
      } else {
        setNoticeBanner(message);
      }
    },
    [submitFinal]
  );

  const {
    questionStates,
    summary,
    hydrateFromSession,
    updateDraft,
    flushQuestion,
    retryQuestion,
    flushAll,
  } = useExamAutosave({
    submissionId: session?.submission_id ?? null,
    isReadOnly: Boolean(receipt) || isLockedByExpiryOrClose,
    onServerTimeSync: handleServerTimeSync,
    onConflictResynced: handleConflictResynced,
    onSessionTerminalError: handleSessionTerminalError,
  });

  // Load exam metadata if navigated directly or reloaded (F5)
  useEffect(() => {
    if (!examId) return;
    if (examMeta?.id === examId) return;

    let cancelled = false;
    listMyExams()
      .then((items) => {
        if (cancelled) return;
        const found = items.find((item) => item.id === examId) ?? null;
        if (found) setExamMeta(found);
      })
      .catch(() => {
        // Non-blocking fallback metadata
      });

    return () => {
      cancelled = true;
    };
  }, [examId, examMeta?.id]);

  const loadInitialSession = useCallback(async () => {
    if (!examId) return;
    setIsLoadingSession(true);
    setLoadError(null);
    setNoticeBanner(null);

    try {
      const data = await fetchOrStartSessionOnce(examId);

      submissionActiveIdRef.current = data.submission_id;
      submitIdempotencyKeyRef.current = generateUuidV4();
      setSession(data);
      setClockOffsetMs(computeServerClockOffsetMs(data.server_time));
      setFlaggedIds(loadFlaggedQuestionIds(data.submission_id));
      const savedPos = loadSavedQuestionPosition(data.submission_id);
      if (savedPos !== null && data.questions.length > 0) {
        setCurrentIndex(Math.min(savedPos, data.questions.length - 1));
      } else {
        setCurrentIndex(0);
      }
      hydrateFromSession(data, { preserveDirtyEdits: false });
    } catch (err) {
      if (err instanceof ApiError) {
        setLoadError({
          message: err.message,
          code: err.code,
          traceId: err.traceId,
        });
      } else {
        setLoadError({
          message: 'Không thể tải phiên làm bài. Vui lòng thử lại.',
        });
      }
    } finally {
      setIsLoadingSession(false);
    }
  }, [examId, hydrateFromSession]);

  useEffect(() => {
    void loadInitialSession();
  }, [loadInitialSession]);

  const handleManualResync = useCallback(async () => {
    if (!examId || isResyncing || receipt) return;
    setIsResyncing(true);
    setNoticeBanner(null);
    try {
      const fresh = await getActiveExamSession(examId);
      setSession(fresh);
      setClockOffsetMs(computeServerClockOffsetMs(fresh.server_time));
      hydrateFromSession(fresh, { preserveDirtyEdits: true });
      await flushAll();
      setNoticeBanner('Đã đồng bộ lại thời gian và dữ liệu bài làm từ máy chủ.');
    } catch (err) {
      if (err instanceof ApiError) {
        if (
          err.code === 'SESSION_EXPIRED' ||
          err.code === 'SUBMISSION_ALREADY_CLOSED'
        ) {
          handleSessionTerminalError(err.code, err.message);
        } else {
          setNoticeBanner(err.message);
        }
      } else {
        setNoticeBanner('Không thể đồng bộ lại phiên lúc này.');
      }
    } finally {
      setIsResyncing(false);
    }
  }, [examId, isResyncing, receipt, hydrateFromSession, flushAll, handleSessionTerminalError]);

  // Network online/offline recovery
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      setNoticeBanner('Kết nối mạng đã khôi phục. Đang đồng bộ lại các thay đổi...');
      void flushAll();
    };
    const onOffline = () => {
      setIsOnline(false);
      setNoticeBanner(
        'Mất kết nối mạng. Các thay đổi sẽ được giữ tạm và tự lưu lại ngay khi có mạng.'
      );
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [flushAll]);

  // Guard unload ONLY while active mutations have not been server-confirmed
  useEffect(() => {
    if (receipt || summary.pendingCount === 0) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [receipt, summary.pendingCount]);

  // Persist current viewing position across F5
  useEffect(() => {
    if (session?.submission_id) {
      saveQuestionPosition(session.submission_id, currentIndex);
    }
  }, [session?.submission_id, currentIndex]);

  const currentQuestion = session?.questions[currentIndex] ?? null;
  const currentState = currentQuestion
    ? questionStates[currentQuestion.exam_variant_question_id]
    : undefined;

  const navigateToQuestion = useCallback(
    (nextIndex: number) => {
      if (!session || nextIndex < 0 || nextIndex >= session.questions.length) {
        return;
      }
      if (currentQuestion) {
        void flushQuestion(currentQuestion.exam_variant_question_id);
      }
      setCurrentIndex(nextIndex);
      setIsMobilePaletteOpen(false);
    },
    [session, currentQuestion, flushQuestion]
  );

  // Keyboard shortcuts: Left / Right arrow keys outside form controls
  useEffect(() => {
    if (!session || receipt || isSubmitModalOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobilePaletteOpen) {
        setIsMobilePaletteOpen(false);
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase();
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable ||
        target?.getAttribute('role') === 'combobox' ||
        target?.getAttribute('role') === 'listbox'
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        navigateToQuestion(currentIndex - 1);
      } else if (e.key === 'ArrowRight') {
        navigateToQuestion(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    session,
    receipt,
    isSubmitModalOpen,
    isMobilePaletteOpen,
    currentIndex,
    navigateToQuestion,
  ]);

  const toggleFlagCurrent = () => {
    if (!session || !currentQuestion) return;
    const qId = currentQuestion.exam_variant_question_id;
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      saveFlaggedQuestionIds(session.submission_id, next);
      return next;
    });
  };

  const handleClearCurrentAnswer = () => {
    if (!currentQuestion || isLockedByExpiryOrClose) return;
    updateDraft(
      currentQuestion.exam_variant_question_id,
      createEmptyDraft(currentQuestion.type_code),
      { immediate: true }
    );
  };

  const handleTimerExpire = useCallback(() => {
    if (!session || receipt) return;
    setIsLockedByExpiryOrClose(true);
    setNoticeBanner(
      'Đã hết thời gian làm bài theo đồng hồ máy chủ. Hệ thống đang tự động thu bài...'
    );
    void submitFinal(session.submission_id, {
      isAutoExpiry: true,
      flushPending: flushAll,
    });
  }, [session, receipt, submitFinal, flushAll]);

  const handleBackToList = async () => {
    if (currentQuestion && !receipt && !isLockedByExpiryOrClose) {
      await flushQuestion(currentQuestion.exam_variant_question_id);
    }
    navigate('/my-exams');
  };

  const currentIsFlagged = currentQuestion
    ? flaggedIds.has(currentQuestion.exam_variant_question_id)
    : false;
  const currentHasAnswer = currentState ? isDraftAnswered(currentState.draft) : false;

  const currentSaveBadge = useMemo(() => {
    if (!currentState) return null;
    switch (currentState.status) {
      case 'saving':
      case 'retrying':
        return {
          tone: 'info',
          text:
            currentState.status === 'retrying'
              ? 'Đang thử lưu lại...'
              : 'Đang lưu...',
        };
      case 'dirty':
        return { tone: 'neutral', text: 'Chờ lưu...' };
      case 'saved':
        return {
          tone: 'success',
          text: currentState.savedAt
            ? `Đã lưu lúc ${formatTimeClock(currentState.savedAt)}`
            : 'Đã lưu trên máy chủ',
        };
      case 'error':
        return {
          tone: 'danger',
          text: currentState.errorMessage || 'Lưu thất bại',
        };
      default:
        return { tone: 'neutral', text: 'Chưa lưu đáp án' };
    }
  }, [currentState]);

  if (isLoadingSession) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center justify-between border-b border-surface-border pb-4">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4 rounded-xl border border-surface-border bg-surface-card p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
          <div className="rounded-xl border border-surface-border bg-surface-card p-4">
            <Skeleton className="h-44 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !session) {
    return (
      <div className="mx-auto max-w-xl py-8">
        <section className="rounded-xl border border-surface-border bg-surface-card p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-semantic-danger/35 bg-semantic-danger-bg text-semantic-danger">
              <AlertCircle aria-hidden="true" className="size-5" />
            </span>
            <div className="space-y-3">
              <div>
                <h1 className="font-display text-lg font-bold text-text-primary">
                  Không thể vào phiên làm bài
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                  {loadError?.message || 'Kỳ thi hiện không khả dụng cho tài khoản của bạn.'}
                </p>
              </div>

              <TechnicalDetails code={loadError?.code} traceId={loadError?.traceId} />

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <Button
                  type="button"
                  onClick={() => navigate('/my-exams')}
                  className="gap-2 bg-brand-600 text-white hover:bg-brand-700"
                >
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  <span>Về danh sách kỳ thi</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void loadInitialSession()}
                >
                  Thử lại
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (receipt) {
    return (
      <SubmissionReceiptView
        receipt={receipt}
        examCode={examMeta?.code}
        examName={examMeta?.name}
        variantCode={session.variant_code}
        wasAutoSubmittedOnExpiry={wasAutoSubmittedOnExpiry}
        onBackToExams={() => navigate('/my-exams')}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Slim sticky exam header */}
      <header className="sticky top-2 z-20 rounded-xl border border-surface-border bg-surface-card/95 px-4 py-3 shadow-sm backdrop-blur lg:top-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleBackToList()}
              disabled={isSubmitting || isFlushingBeforeSubmit}
              aria-label="Quay lại danh sách kỳ thi"
              className="h-8 gap-1.5 px-2.5"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Danh sách</span>
            </Button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {examMeta?.code ? (
                  <span className="rounded border border-surface-border bg-surface-panel px-1.5 py-0.5 font-mono text-[11px] font-semibold text-text-primary">
                    {examMeta.code}
                  </span>
                ) : null}
                <h1 className="truncate font-display text-sm font-bold text-text-primary sm:text-base">
                  {examMeta?.name || 'Phòng thi trực tuyến'}
                </h1>
              </div>
              <p className="mt-0.5 text-xs text-text-secondary">
                Mã đề{' '}
                <strong className="font-mono font-semibold text-text-primary">
                  {session.variant_code}
                </strong>{' '}
                · Đã trả lời{' '}
                <strong className="tabular-nums text-text-primary">
                  {summary.answeredCount}/{session.questions.length}
                </strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CountdownClock
              deadlineIso={session.deadline_at}
              clockOffsetMs={clockOffsetMs}
              initialRemainingSeconds={session.remaining_seconds}
              isStopped={Boolean(receipt) || isLockedByExpiryOrClose}
              onExpire={handleTimerExpire}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsMobilePaletteOpen(true)}
              className="h-9 gap-1.5 lg:hidden"
            >
              <LayoutGrid aria-hidden="true" className="size-4" />
              <span>Bảng câu hỏi</span>
            </Button>

            <Button
              type="button"
              onClick={() => {
                setSubmitError(null);
                setIsSubmitModalOpen(true);
              }}
              disabled={isSubmitting || isFlushingBeforeSubmit}
              className="h-9 gap-2 bg-brand-600 text-white hover:bg-brand-700"
            >
              <Send aria-hidden="true" className="size-4" />
              <span>Nộp bài</span>
            </Button>
          </div>
        </div>
      </header>

      {(!isOnline || noticeBanner || isLockedByExpiryOrClose) ? (
        <div
          role="status"
          className={cn(
            'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs',
            !isOnline || isLockedByExpiryOrClose
              ? 'border-semantic-warning/40 bg-semantic-warning-bg text-semantic-warning'
              : 'border-brand-500/35 bg-semantic-info-bg text-brand-700 dark:text-brand-200'
          )}
        >
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <WifiOff aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
            )}
            <span>
              {noticeBanner ||
                'Mất kết nối mạng. Các đáp án sẽ được giữ và tự lưu lại khi kết nối trở lại.'}
            </span>
          </div>

          {isLockedByExpiryOrClose && session ? (
            <Button
              type="button"
              size="sm"
              onClick={() =>
                void submitFinal(session.submission_id, { isAutoExpiry: true })
              }
              disabled={isSubmitting}
              className="h-7 bg-brand-600 px-3 text-xs text-white hover:bg-brand-700"
            >
              {isSubmitting ? 'Đang thu bài...' : 'Hoàn tất nộp bài'}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19.5rem]">
        {/* Primary Question Card */}
        <main className="rounded-xl border border-surface-border bg-surface-card p-5 shadow-sm sm:p-6">
          {currentQuestion && currentState ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border pb-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center rounded-md bg-brand-600 px-2.5 py-1 text-xs font-semibold tabular-nums text-white">
                    Câu {currentQuestion.position} / {session.questions.length}
                  </span>
                  <span className="rounded-md border border-surface-border bg-surface-panel px-2.5 py-1 text-xs font-medium text-text-secondary">
                    {STUDENT_QUESTION_TYPE_LABELS[currentQuestion.type_code] ||
                      currentQuestion.type_code}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {currentSaveBadge ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
                        currentSaveBadge.tone === 'success' &&
                          'border-semantic-success/35 bg-semantic-success-bg text-semantic-success',
                        currentSaveBadge.tone === 'info' &&
                          'border-brand-500/35 bg-semantic-info-bg text-brand-700 dark:text-brand-200',
                        currentSaveBadge.tone === 'danger' &&
                          'border-semantic-danger/35 bg-semantic-danger-bg text-semantic-danger',
                        currentSaveBadge.tone === 'neutral' &&
                          'border-surface-border bg-surface-panel text-text-secondary'
                      )}
                    >
                      {currentState.status === 'saving' ||
                      currentState.status === 'retrying' ? (
                        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                      ) : currentState.status === 'saved' ? (
                        <CheckCircle2 aria-hidden="true" className="size-3.5" />
                      ) : currentState.status === 'error' ? (
                        <CloudOff aria-hidden="true" className="size-3.5" />
                      ) : null}
                      <span>{currentSaveBadge.text}</span>
                    </span>
                  ) : null}

                  {currentState.status === 'error' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void retryQuestion(currentQuestion.exam_variant_question_id)
                      }
                      className="h-7 px-2.5 text-xs"
                    >
                      Thử lưu lại
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant={currentIsFlagged ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={toggleFlagCurrent}
                    aria-pressed={currentIsFlagged}
                    className={cn(
                      'h-8 gap-1.5 text-xs',
                      currentIsFlagged &&
                        'border-semantic-warning/45 bg-semantic-warning-bg text-semantic-warning hover:bg-semantic-warning-bg'
                    )}
                  >
                    <Bookmark
                      aria-hidden="true"
                      className={cn(
                        'size-3.5',
                        currentIsFlagged && 'fill-semantic-warning'
                      )}
                    />
                    <span>{currentIsFlagged ? 'Đã đánh dấu xem lại' : 'Đánh dấu xem lại'}</span>
                  </Button>
                </div>
              </div>

              <div className="max-w-3xl space-y-4">
                <div className="text-base leading-relaxed font-medium whitespace-pre-wrap text-text-primary">
                  {currentQuestion.content}
                </div>

                {currentQuestion.media_url ? (
                  <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-panel p-2">
                    <img
                      src={currentQuestion.media_url}
                      alt={`Hình minh họa cho câu ${currentQuestion.position}`}
                      className="max-h-80 w-auto rounded object-contain"
                    />
                  </div>
                ) : null}

                <QuestionResponseInput
                  variantQuestionId={currentQuestion.exam_variant_question_id}
                  renderSpec={currentQuestion.render_spec}
                  draft={currentState.draft}
                  disabled={isLockedByExpiryOrClose || isSubmitting}
                  onChange={(nextDraft) =>
                    updateDraft(currentQuestion.exam_variant_question_id, nextDraft)
                  }
                  onBlurFlush={() =>
                    void flushQuestion(currentQuestion.exam_variant_question_id)
                  }
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-4">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigateToQuestion(currentIndex - 1)}
                    disabled={currentIndex === 0}
                    className="gap-1.5"
                  >
                    <ArrowLeft aria-hidden="true" className="size-4" />
                    <span>Câu trước</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigateToQuestion(currentIndex + 1)}
                    disabled={currentIndex >= session.questions.length - 1}
                    className="gap-1.5"
                  >
                    <span>Câu tiếp theo</span>
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {currentHasAnswer && !isLockedByExpiryOrClose ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearCurrentAnswer}
                      className="gap-1.5 text-xs text-text-secondary hover:text-text-primary"
                    >
                      <Eraser aria-hidden="true" className="size-3.5" />
                      <span>Xóa đáp án</span>
                    </Button>
                  ) : null}

                  {currentIndex >= session.questions.length - 1 ? (
                    <Button
                      type="button"
                      onClick={() => {
                        setSubmitError(null);
                        setIsSubmitModalOpen(true);
                      }}
                      className="gap-1.5 bg-brand-600 text-white hover:bg-brand-700"
                    >
                      <Send aria-hidden="true" className="size-4" />
                      <span>Nộp bài thi</span>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </main>

        {/* Desktop Sticky Question Palette Sidebar */}
        <aside className="hidden space-y-4 rounded-xl border border-surface-border bg-surface-card p-4 shadow-sm lg:sticky lg:top-24 lg:block">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              Bảng điều hướng
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleManualResync()}
              disabled={isResyncing}
              className="h-7 gap-1 px-2 text-xs text-text-secondary hover:text-text-primary"
              title="Đồng bộ lại đồng hồ và đáp án với máy chủ"
            >
              <RefreshCw
                aria-hidden="true"
                className={`size-3.5 ${isResyncing ? 'animate-spin' : ''}`}
              />
              <span>Đồng bộ</span>
            </Button>
          </div>

          <QuestionPalette
            questions={session.questions}
            questionStates={questionStates}
            flaggedIds={flaggedIds}
            currentIndex={currentIndex}
            onSelectIndex={navigateToQuestion}
          />

          <div className="border-t border-surface-border pt-3">
            <Button
              type="button"
              onClick={() => {
                setSubmitError(null);
                setIsSubmitModalOpen(true);
              }}
              disabled={isSubmitting || isFlushingBeforeSubmit}
              className="w-full gap-2 bg-brand-600 text-white hover:bg-brand-700"
            >
              <Send aria-hidden="true" className="size-4" />
              <span>Nộp bài thi</span>
            </Button>
          </div>
        </aside>
      </div>

      {/* Mobile Question Palette Drawer */}
      {isMobilePaletteOpen ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={() => setIsMobilePaletteOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Bảng câu hỏi"
            className="flex h-full w-80 max-w-full flex-col justify-between border-l border-surface-border bg-surface-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <h2 className="font-display text-base font-bold text-text-primary">
                  Bảng câu hỏi
                </h2>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleManualResync()}
                    disabled={isResyncing}
                    className="h-8 gap-1 px-2 text-xs"
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className={`size-3.5 ${isResyncing ? 'animate-spin' : ''}`}
                    />
                    <span>Đồng bộ</span>
                  </Button>
                  <button
                    type="button"
                    onClick={() => setIsMobilePaletteOpen(false)}
                    aria-label="Đóng bảng câu hỏi"
                    className="inline-flex size-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </div>

              <QuestionPalette
                questions={session.questions}
                questionStates={questionStates}
                flaggedIds={flaggedIds}
                currentIndex={currentIndex}
                onSelectIndex={navigateToQuestion}
              />
            </div>

            <div className="border-t border-surface-border pt-4">
              <Button
                type="button"
                onClick={() => {
                  setIsMobilePaletteOpen(false);
                  setSubmitError(null);
                  setIsSubmitModalOpen(true);
                }}
                className="w-full gap-2 bg-brand-600 text-white hover:bg-brand-700"
              >
                <Send aria-hidden="true" className="size-4" />
                <span>Nộp bài thi</span>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <SubmitConfirmModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirmSubmit={() =>
          void submitFinal(session.submission_id, {
            isAutoExpiry: false,
            flushPending: flushAll,
          })
        }
        totalQuestions={session.questions.length}
        answeredCount={summary.answeredCount}
        unansweredCount={summary.unansweredCount}
        flaggedCount={flaggedIds.size}
        pendingCount={summary.pendingCount}
        errorCount={summary.errorCount}
        isFlushing={isFlushingBeforeSubmit}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </div>
  );
}
