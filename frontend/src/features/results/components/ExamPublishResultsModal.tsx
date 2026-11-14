import { useEffect, useState } from 'react';
import { AlertCircle, Globe2, Loader2 } from 'lucide-react';
import { ApiError } from '../../../api/client';
import { AccessibleModal } from '../../../components/ui/AccessibleModal';
import { Button } from '../../../components/ui/button';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { cn } from '../../../lib/utils';
import type { ExamRecord } from '../../exams/types';
import { publishExamResultsApi } from '../results.api';
import type { ExamStatisticsData, PublishableVisibilityMode } from '../types';
import {
  getReadableErrorMessage,
  VISIBILITY_DESCRIPTIONS,
  VISIBILITY_LABELS,
} from '../utils';

interface ExamPublishResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: ExamRecord;
  statistics: ExamStatisticsData | null;
  onSuccess: (updatedExam: ExamRecord) => void;
}

const PUBLISH_OPTIONS: PublishableVisibilityMode[] = [
  'SCORE_AND_STATUS',
  'FULL_REVIEW',
  'SCORE_ONLY',
];

export function ExamPublishResultsModal({
  open,
  onOpenChange,
  exam,
  statistics,
  onSuccess,
}: ExamPublishResultsModalProps) {
  const defaultMode: PublishableVisibilityMode =
    exam.result_visibility_mode !== 'HIDDEN'
      ? exam.result_visibility_mode
      : 'SCORE_AND_STATUS';

  const [mode, setMode] = useState<PublishableVisibilityMode>(defaultMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setMode(
        exam.result_visibility_mode !== 'HIDDEN'
          ? exam.result_visibility_mode
          : 'SCORE_AND_STATUS'
      );
      setError(null);
      setSubmitting(false);
    }
  }, [open, exam.result_visibility_mode]);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await publishExamResultsApi(exam.id, {
        result_visibility_mode: mode,
      });
      onSuccess(res.data);
      onOpenChange(false);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  const gradedCount = statistics?.graded_count ?? 0;
  const participantCount = statistics?.participant_count ?? 0;

  return (
    <AccessibleModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      isBusy={submitting}
      title="Công bố kết quả kỳ thi"
      description={`Chọn phạm vi thông tin thí sinh được xem cho kỳ thi ${exam.code} — ${exam.name}.`}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-surface-border bg-surface-muted/70 px-3.5 py-2.5 text-xs text-text-secondary">
          Đã hoàn tất chấm điểm{' '}
          <strong className="font-mono tabular-nums text-text-primary">
            {gradedCount} / {participantCount}
          </strong>{' '}
          thí sinh. Sau khi công bố, thí sinh trong danh sách có thể tra cứu tại mục{' '}
          <strong className="text-text-primary">Kết quả thi</strong>.
        </div>

        <fieldset className="space-y-2" disabled={submitting}>
          <legend className="text-xs font-semibold text-text-primary">
            Chế độ hiển thị cho thí sinh
          </legend>
          {PUBLISH_OPTIONS.map((option) => {
            const selected = mode === option;
            return (
              <label
                key={option}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  selected
                    ? 'border-brand-600 bg-semantic-info-bg/50'
                    : 'border-surface-border bg-surface-card hover:bg-surface-muted/60'
                )}
              >
                <input
                  type="radio"
                  name="publish-visibility-mode"
                  value={option}
                  checked={selected}
                  onChange={() => setMode(option)}
                  className="mt-0.5 size-4 accent-brand-600"
                />
                <div className="space-y-0.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                    <span>{VISIBILITY_LABELS[option]}</span>
                    {option === 'SCORE_AND_STATUS' ? (
                      <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                        Khuyên dùng
                      </span>
                    ) : null}
                  </div>
                  <p className="leading-relaxed text-text-secondary">
                    {VISIBILITY_DESCRIPTIONS[option]}
                  </p>
                </div>
              </label>
            );
          })}
        </fieldset>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-semantic-error/30 bg-semantic-error-bg px-3.5 py-2.5 text-xs text-semantic-error"
          >
            <div className="flex items-start gap-2">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">
                  {getReadableErrorMessage(error, 'Không thể công bố kết quả kỳ thi.')}
                </p>
                {error instanceof ApiError ? (
                  <TechnicalDetails code={error.code} traceId={error.traceId} />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-surface-border pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="bg-brand-600 text-white hover:bg-brand-700"
          >
            {submitting ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Globe2 aria-hidden="true" className="size-4" />
            )}
            <span>Xác nhận công bố</span>
          </Button>
        </div>
      </div>
    </AccessibleModal>
  );
}
