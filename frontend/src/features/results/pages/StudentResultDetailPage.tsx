import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  EyeOff,
  Info,
  Lock,
  MinusCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { ApiError } from '../../../api/client';
import { Button, buttonVariants } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { cn } from '../../../lib/utils';
import { getMyResultByExamApi, getMyResultReviewApi } from '../results.api';
import type {
  ExamResultParticipantStatus,
  ResultSummary,
  SubmissionReviewDetail,
} from '../types';
import {
  formatCompactScore,
  formatScoreValue,
  getReadableErrorMessage,
} from '../utils';
import { SubmissionAnswerComparisonList } from '../components/SubmissionAnswerComparisonList';
import {
  GradingStatusBadge,
  ParticipantResultStatusBadge,
  VisibilityModeBadge,
} from '../components/VisibilityAndGradingBadges';

function normalizeStatus(raw: string): ExamResultParticipantStatus {
  switch (raw) {
    case 'NOT_STARTED':
    case 'REGISTERED':
    case 'IN_PROGRESS':
    case 'SUBMITTED':
    case 'GRADING':
    case 'GRADED':
    case 'FLAGGED':
      return raw;
    default:
      return 'REGISTERED';
  }
}

export function StudentResultDetailPage() {
  const { examId = '' } = useParams<{ examId: string }>();

  const [summary, setSummary] = useState<ResultSummary | null>(null);
  const [review, setReview] = useState<SubmissionReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!examId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setReview(null);
    setReviewNotice(null);

    getMyResultByExamApi(examId, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const data = res.data;
        setSummary(data);

        const canFetchReview =
          data.result_published &&
          data.result_available &&
          (data.visibility === 'SCORE_AND_STATUS' || data.visibility === 'FULL_REVIEW');

        if (!canFetchReview) {
          return;
        }

        setReviewLoading(true);
        getMyResultReviewApi(examId, controller.signal)
          .then((revRes) => {
            if (!controller.signal.aborted) {
              setReview(revRes.data);
              if (revRes.data?.summary) {
                setSummary(revRes.data.summary);
              }
            }
          })
          .catch((revErr) => {
            if (controller.signal.aborted || revErr?.name === 'AbortError') return;
            if (
              revErr instanceof ApiError &&
              ['RESULT_HIDDEN', 'REVIEW_NOT_ALLOWED', 'RESULT_NOT_READY'].includes(revErr.code)
            ) {
              setReviewNotice(getReadableErrorMessage(revErr));
            } else {
              setError(revErr);
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) {
              setReviewLoading(false);
            }
          });
      })
      .catch((err) => {
        if (!controller.signal.aborted && err?.name !== 'AbortError') {
          setError(err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [examId, reloadTick]);

  const statusCounts = useMemo(() => {
    const answers = review?.answers || [];
    return answers.reduce(
      (acc, item) => {
        acc[item.grading_status] = (acc[item.grading_status] || 0) + 1;
        return acc;
      },
      { CORRECT: 0, PARTIAL: 0, WRONG: 0, BLANK: 0 }
    );
  }, [review]);

  const effectiveSummary = review?.summary ?? summary;
  const visibility = effectiveSummary?.visibility ?? 'HIDDEN';
  const isAvailable = Boolean(
    effectiveSummary?.result_published &&
      effectiveSummary?.result_available &&
      visibility !== 'HIDDEN'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            to="/my-results"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            <span>Quay lại Kết quả thi của tôi</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
            {effectiveSummary?.exam_name || 'Chi tiết kết quả kỳ thi'}
          </h1>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setReloadTick((v) => v + 1)}
          disabled={loading || reviewLoading}
        >
          <RefreshCw
            aria-hidden="true"
            className={`size-3.5 ${loading || reviewLoading ? 'animate-spin' : ''}`}
          />
          <span>Làm mới</span>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-semantic-error/30 bg-semantic-error-bg p-5 text-xs text-semantic-error"
        >
          <div className="flex items-start gap-3">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div className="flex-1 space-y-2">
              <h2 className="text-sm font-semibold">Không thể tải kết quả kỳ thi</h2>
              <p>{getReadableErrorMessage(error, 'Vui lòng thử lại sau ít phút.')}</p>
              {error instanceof ApiError ? (
                <TechnicalDetails code={error.code} traceId={error.traceId} />
              ) : null}
              <div className="pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setReloadTick((v) => v + 1)}
                  className="bg-surface-card text-text-primary"
                >
                  Thử lại
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : effectiveSummary ? (
        <>
          {/* Summary / Policy Banner */}
          {!isAvailable ? (
            <div className="rounded-xl border border-surface-border bg-surface-card p-6 shadow-xs sm:p-8">
              <div className="mx-auto max-w-lg text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-surface-border bg-surface-muted text-text-secondary">
                  {effectiveSummary.result_published ? (
                    <EyeOff aria-hidden="true" className="size-6" />
                  ) : (
                    <Lock aria-hidden="true" className="size-6" />
                  )}
                </div>

                <h2 className="mt-4 text-base font-semibold text-text-primary">
                  {effectiveSummary.result_published
                    ? 'Kết quả kỳ thi hiện đang được ẩn'
                    : 'Kết quả kỳ thi chưa được công bố'}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                  {effectiveSummary.result_published
                    ? 'Giảng viên đã tạm thời chuyển chế độ hiển thị sang ẩn kết quả. Điểm số và chi tiết bài làm sẽ hiển thị lại khi giảng viên mở công bố.'
                    : 'Bài làm của bạn đang được tổng hợp hoặc chờ giảng viên công bố điểm chính thức. Vui lòng quay lại kiểm tra sau.'}
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <ParticipantResultStatusBadge
                    status={normalizeStatus(effectiveSummary.submission_status)}
                  />
                  <VisibilityModeBadge mode="HIDDEN" />
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <Link
                    to="/my-results"
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                  >
                    <ArrowLeft aria-hidden="true" className="size-3.5" />
                    <span>Về danh sách kết quả</span>
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setReloadTick((v) => v + 1)}
                    className="bg-brand-600 text-white hover:bg-brand-700"
                  >
                    <RefreshCw aria-hidden="true" className="size-3.5" />
                    <span>Kiểm tra lại</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Score Header Card */}
              <div className="flex flex-col justify-between gap-4 rounded-xl border border-surface-border bg-surface-card p-5 shadow-xs sm:flex-row sm:items-center">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ParticipantResultStatusBadge
                      status={normalizeStatus(effectiveSummary.submission_status)}
                    />
                    <VisibilityModeBadge mode={visibility} />
                  </div>
                  <p className="text-xs leading-relaxed text-text-secondary">
                    {visibility === 'SCORE_ONLY'
                      ? 'Giảng viên hiện chỉ mở xem tổng điểm cho kỳ thi này.'
                      : visibility === 'SCORE_AND_STATUS'
                        ? 'Bạn có thể xem tổng điểm và trạng thái Đúng / Sai từng câu; đáp án chi tiết đang được ẩn.'
                        : 'Bạn có thể xem đầy đủ điểm số, bài làm đã chọn, đáp án đúng và giải thích từng câu.'}
                  </p>
                </div>

                <div className="shrink-0 rounded-xl border border-brand-500/25 bg-semantic-info-bg/50 px-5 py-3 text-left sm:text-right">
                  <span className="block text-[11px] font-medium text-text-secondary">
                    Tổng điểm đạt được
                  </span>
                  <div className="mt-0.5 flex items-baseline gap-1 font-mono">
                    <span className="text-3xl font-bold tabular-nums text-brand-600 dark:text-brand-300">
                      {formatScoreValue(effectiveSummary.total_score)}
                    </span>
                    <span className="text-sm tabular-nums text-text-secondary">
                      / {formatCompactScore(effectiveSummary.max_score ?? 10)}
                    </span>
                  </div>
                </div>
              </div>

              {visibility === 'SCORE_ONLY' ? (
                <div className="flex items-start gap-3 rounded-xl border border-semantic-info/30 bg-semantic-info-bg px-4 py-3.5 text-xs text-semantic-info">
                  <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <p className="leading-relaxed">
                    Chế độ <strong className="font-semibold">Chỉ hiện tổng điểm</strong> không hiển thị danh sách câu hỏi và đáp án. Nếu cần phúc khảo chi tiết, vui lòng liên hệ trực tiếp giảng viên phụ trách.
                  </p>
                </div>
              ) : null}

              {reviewNotice ? (
                <div className="flex items-start gap-3 rounded-xl border border-semantic-warning/30 bg-semantic-warning-bg px-4 py-3.5 text-xs text-semantic-warning">
                  <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <p>{reviewNotice}</p>
                </div>
              ) : null}

              {/* SCORE_AND_STATUS and FULL_REVIEW breakdown */}
              {(visibility === 'SCORE_AND_STATUS' || visibility === 'FULL_REVIEW') &&
              !reviewNotice ? (
                reviewLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-44 rounded-xl" />
                    <Skeleton className="h-44 rounded-xl" />
                  </div>
                ) : review ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-semantic-success/30 bg-semantic-success-bg/50 px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-semantic-success">
                          <CheckCircle2 aria-hidden="true" className="size-3.5" />
                          <span>Câu đúng</span>
                        </div>
                        <p className="mt-1 font-mono text-xl font-bold tabular-nums text-text-primary">
                          {statusCounts.CORRECT}
                        </p>
                      </div>

                      <div className="rounded-xl border border-semantic-warning/30 bg-semantic-warning-bg/50 px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-semantic-warning">
                          <CircleDot aria-hidden="true" className="size-3.5" />
                          <span>Đúng một phần</span>
                        </div>
                        <p className="mt-1 font-mono text-xl font-bold tabular-nums text-text-primary">
                          {statusCounts.PARTIAL}
                        </p>
                      </div>

                      <div className="rounded-xl border border-semantic-error/30 bg-semantic-error-bg/50 px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-semantic-error">
                          <XCircle aria-hidden="true" className="size-3.5" />
                          <span>Câu sai</span>
                        </div>
                        <p className="mt-1 font-mono text-xl font-bold tabular-nums text-text-primary">
                          {statusCounts.WRONG}
                        </p>
                      </div>

                      <div className="rounded-xl border border-surface-border bg-surface-card px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                          <MinusCircle aria-hidden="true" className="size-3.5" />
                          <span>Bỏ trống</span>
                        </div>
                        <p className="mt-1 font-mono text-xl font-bold tabular-nums text-text-primary">
                          {statusCounts.BLANK}
                        </p>
                      </div>
                    </div>

                    {visibility === 'SCORE_AND_STATUS' ? (
                      <div className="space-y-4">
                        <div className="flex items-start gap-2.5 rounded-xl border border-surface-border bg-surface-muted/70 px-4 py-3 text-xs text-text-secondary">
                          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-muted" />
                          <p className="leading-relaxed">
                            Kỳ thi đang bật chế độ <strong className="text-text-primary">Điểm &amp; trạng thái câu</strong>: hiển thị tổng điểm và kết quả Đúng / Sai từng câu; nội dung câu hỏi, đáp án đúng và giải thích đang được ẩn.
                          </p>
                        </div>

                        <div className="rounded-xl border border-surface-border bg-surface-card p-4 shadow-xs sm:p-5">
                          <h2 className="text-sm font-semibold text-text-primary">
                            Trạng thái từng câu ({review.answers.length} câu)
                          </h2>
                          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
                            {review.answers.map((ans) => (
                              <div
                                key={ans.position}
                                className="flex flex-col items-start justify-between gap-2 rounded-lg border border-surface-border bg-surface-canvas p-3"
                              >
                                <span className="font-mono text-xs font-semibold tabular-nums text-text-primary">
                                  Câu {ans.position}
                                </span>
                                <GradingStatusBadge status={ans.grading_status} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <SubmissionAnswerComparisonList
                        answers={review.answers}
                        showAnswers
                        showFilterBar
                      />
                    )}
                  </div>
                ) : null
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
