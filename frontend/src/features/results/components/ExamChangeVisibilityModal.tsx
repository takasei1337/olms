import { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Loader2, SlidersHorizontal } from 'lucide-react';
import { ApiError } from '../../../api/client';
import { AccessibleModal } from '../../../components/ui/AccessibleModal';
import { Button } from '../../../components/ui/button';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { Textarea } from '../../../components/ui/textarea';
import { cn } from '../../../lib/utils';
import type { ExamRecord } from '../../exams/types';
import { changeResultVisibilityApi } from '../results.api';
import type { ResultVisibilityMode } from '../types';
import {
  getReadableErrorMessage,
  VISIBILITY_DESCRIPTIONS,
  VISIBILITY_LABELS,
} from '../utils';

interface ExamChangeVisibilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: ExamRecord;
  onSuccess: (updatedExam: ExamRecord) => void;
}

const ALL_MODES: ResultVisibilityMode[] = [
  'FULL_REVIEW',
  'SCORE_AND_STATUS',
  'SCORE_ONLY',
  'HIDDEN',
];

export function ExamChangeVisibilityModal({
  open,
  onOpenChange,
  exam,
  onSuccess,
}: ExamChangeVisibilityModalProps) {
  const [mode, setMode] = useState<ResultVisibilityMode>(exam.result_visibility_mode);
  const [reason, setReason] = useState('');
  const [touchedReason, setTouchedReason] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setMode(exam.result_visibility_mode);
      setReason('');
      setTouchedReason(false);
      setError(null);
      setSubmitting(false);
    }
  }, [open, exam.result_visibility_mode]);

  const trimmedReason = reason.trim();
  const reasonError =
    trimmedReason.length < 5
      ? 'Vui lòng nhập lý do điều chỉnh tối thiểu 5 ký tự.'
      : trimmedReason.length > 500
        ? 'Lý do điều chỉnh không được vượt quá 500 ký tự.'
        : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouchedReason(true);
    if (reasonError) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await changeResultVisibilityApi(exam.id, {
        result_visibility_mode: mode,
        reason: trimmedReason,
      });
      onSuccess(res.data);
      onOpenChange(false);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AccessibleModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      isBusy={submitting}
      title="Thay đổi chế độ hiển thị kết quả"
      description={`Cập nhật phạm vi xem kết quả sau công bố cho kỳ thi ${exam.code}. Thao tác này sẽ được ghi vào nhật ký kiểm toán.`}
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset className="space-y-2" disabled={submitting}>
          <legend className="text-xs font-semibold text-text-primary">
            Chế độ hiển thị mới
          </legend>
          {ALL_MODES.map((option) => {
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
                  name="visibility-mode"
                  value={option}
                  checked={selected}
                  onChange={() => setMode(option)}
                  className="mt-0.5 size-4 accent-brand-600"
                />
                <div className="space-y-0.5 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                    <span>{VISIBILITY_LABELS[option]}</span>
                    {option === exam.result_visibility_mode ? (
                      <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                        Hiện tại
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

        {mode === 'HIDDEN' ? (
          <div className="flex items-start gap-2 rounded-lg border border-semantic-warning/40 bg-semantic-warning-bg px-3.5 py-2.5 text-xs text-semantic-warning">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p className="leading-relaxed">
              Thí sinh sẽ tạm thời không xem được điểm số và chi tiết bài làm cho đến khi bạn mở lại chế độ công bố khác.
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="visibility-change-reason"
              className="text-xs font-semibold text-text-primary"
            >
              Lý do thay đổi <span className="text-semantic-error">*</span>
            </label>
            <span className="font-mono text-[11px] tabular-nums text-text-secondary">
              {trimmedReason.length} / 500
            </span>
          </div>
          <Textarea
            id="visibility-change-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouchedReason(true)}
            rows={3}
            maxLength={520}
            disabled={submitting}
            placeholder="Ví dụ: Mở cho thí sinh xem giải thích chi tiết sau khi kết thúc ca thi bù."
            aria-invalid={touchedReason && Boolean(reasonError)}
          />
          {touchedReason && reasonError ? (
            <p className="text-xs text-semantic-error">{reasonError}</p>
          ) : null}
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-semantic-error/30 bg-semantic-error-bg px-3.5 py-2.5 text-xs text-semantic-error"
          >
            <div className="flex items-start gap-2">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">
                  {getReadableErrorMessage(error, 'Không thể thay đổi chế độ hiển thị kết quả.')}
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
            type="submit"
            disabled={submitting || Boolean(reasonError)}
            className="bg-brand-600 text-white hover:bg-brand-700"
          >
            {submitting ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <SlidersHorizontal aria-hidden="true" className="size-4" />
            )}
            <span>Lưu chế độ hiển thị</span>
          </Button>
        </div>
      </form>
    </AccessibleModal>
  );
}
