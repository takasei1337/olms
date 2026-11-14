import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ApiError } from '../../../api/client';
import { AccessibleModal } from '../../../components/ui/AccessibleModal';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { getSubmissionResultDetailApi } from '../results.api';
import type { SubmissionReviewDetail, TeacherExamResultRow } from '../types';
import {
  formatCompactScore,
  formatScoreValue,
  getReadableErrorMessage,
} from '../utils';
import { SubmissionAnswerComparisonList } from './SubmissionAnswerComparisonList';
import { ParticipantResultStatusBadge } from './VisibilityAndGradingBadges';

interface TeacherSubmissionReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  participant: TeacherExamResultRow | null;
}

export function TeacherSubmissionReviewModal({
  open,
  onOpenChange,
  examId,
  participant,
}: TeacherSubmissionReviewModalProps) {
  const [detail, setDetail] = useState<SubmissionReviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const submissionId = participant?.submission_id ?? null;

  useEffect(() => {
    if (!open || !submissionId) {
      setDetail(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getSubmissionResultDetailApi(examId, submissionId, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setDetail(res.data);
        }
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
  }, [open, examId, submissionId, reloadTick]);

  const title = participant
    ? `Chi tiết bài chấm — ${participant.full_name} (${participant.student_code})`
    : 'Chi tiết bài chấm thí sinh';

  const summary = detail?.summary;

  return (
    <AccessibleModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      isBusy={loading}
      title={title}
      description="Đối chiếu đáp án thí sinh đã lưu, đáp án đúng của mã đề và điểm chấm tự động từng câu."
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-44 rounded-xl" />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-xl border border-semantic-error/30 bg-semantic-error-bg p-4 text-xs text-semantic-error"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="font-medium">
                  {getReadableErrorMessage(error, 'Không thể tải chi tiết bài chấm.')}
                </p>
                {error instanceof ApiError ? (
                  <TechnicalDetails code={error.code} traceId={error.traceId} />
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setReloadTick((v) => v + 1)}
                  className="bg-surface-card text-text-primary"
                >
                  <RefreshCw aria-hidden="true" className="size-3.5" />
                  <span>Tải lại bài chấm</span>
                </Button>
              </div>
            </div>
          </div>
        ) : detail && participant ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-muted/60 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="rounded-md border border-surface-border bg-surface-card px-2 py-0.5 font-mono font-semibold text-text-primary">
                  {participant.student_code}
                </span>
                <span className="font-semibold text-text-primary">{participant.full_name}</span>
                <ParticipantResultStatusBadge status={participant.status} />
              </div>

              <div className="flex items-baseline gap-1.5 font-mono">
                <span className="text-xs font-sans text-text-secondary">Tổng điểm:</span>
                <span className="text-lg font-bold tabular-nums text-brand-600 dark:text-brand-300">
                  {formatScoreValue(summary?.total_score ?? participant.score)}
                </span>
                <span className="text-xs tabular-nums text-text-secondary">
                  / {formatCompactScore(summary?.max_score ?? 10)}
                </span>
              </div>
            </div>

            {detail.answers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-border bg-surface-card px-4 py-8 text-center text-sm text-text-secondary">
                Bài làm chưa có dữ liệu chi tiết từng câu hỏi.
              </div>
            ) : (
              <SubmissionAnswerComparisonList
                answers={detail.answers}
                showAnswers
                showFilterBar
              />
            )}
          </>
        ) : null}

        <div className="flex justify-end border-t border-surface-border pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </div>
      </div>
    </AccessibleModal>
  );
}
