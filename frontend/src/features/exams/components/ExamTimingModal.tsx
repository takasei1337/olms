import { useId, useState, type FormEvent } from 'react';
import { AlertCircle, Clock3, Loader2, Octagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '../../../api/client';
import { AccessibleModal } from '../../../components/ui/AccessibleModal';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { changeExamCloseTimeApi, endExamEarlyApi } from '../exams.api';
import type { ExamRecord } from '../types';
import { formatExamDateTime } from '../utils';

export type ExamTimingActionType = 'change-close' | 'end-early';

interface ExamTimingModalProps {
  action: ExamTimingActionType;
  exam: ExamRecord;
  onClose: () => void;
  onSuccess: (action: ExamTimingActionType, exam: ExamRecord) => void;
}

function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const roundedMs = Math.ceil(date.getTime() / 60_000) * 60_000;
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(roundedMs - offsetMs).toISOString().slice(0, 16);
}

export function ExamTimingModal({
  action,
  exam,
  onClose,
  onSuccess,
}: ExamTimingModalProps) {
  const closeTimeId = useId();
  const reasonId = useId();
  const [closeTime, setCloseTime] = useState(() =>
    toLocalDateTimeInput(exam.closes_at)
  );
  const [reason, setReason] = useState('');
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEndEarly = action === 'end-early';
  const reasonIsValid = reason.trim().length >= 5;
  const closeTimeMs = Date.parse(closeTime);
  const closeTimeIsValid =
    isEndEarly || (Number.isFinite(closeTimeMs) && closeTimeMs > Date.now());
  const isShortening =
    !isEndEarly && closeTimeIsValid && closeTimeMs < Date.parse(exam.closes_at);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reasonIsValid || !closeTimeIsValid) return;

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const response = isEndEarly
        ? await endExamEarlyApi(exam.id, reason)
        : await changeExamCloseTimeApi(exam.id, {
            closes_at: new Date(closeTimeMs).toISOString(),
            reason: reason.trim(),
          });
      onSuccess(action, response.data);
      onClose();
    } catch (error) {
      setSubmitError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AccessibleModal
      isOpen
      onClose={onClose}
      isBusy={isSubmitting}
      maxWidthClass="max-w-lg"
      title={isEndEarly ? 'Kết thúc kỳ thi sớm' : 'Điều chỉnh giờ đóng'}
      description={
        isEndEarly
          ? 'Hệ thống sẽ ngừng nhận lượt thi mới, thu và chấm các bài trực tuyến đang làm. Kết quả vẫn được giữ ở trạng thái chưa công bố.'
          : 'Thay đổi thời hạn làm bài cho kỳ thi đã phát hành. Thời hạn mới áp dụng ngay cho mọi thí sinh.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-surface-border bg-surface-muted/40 px-3.5 py-3 text-xs">
          <p className="break-words font-semibold text-text-primary">{exam.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-text-secondary">
            <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
            <span>
              Giờ đóng hiện tại:{' '}
              <strong className="font-semibold tabular-nums text-text-primary">
                {formatExamDateTime(exam.closes_at)}
              </strong>
            </span>
          </p>
        </div>

        {isEndEarly ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-semantic-danger/30 bg-semantic-danger-bg px-3.5 py-3 text-xs text-semantic-danger">
            <Octagon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p className="leading-relaxed">
              Thao tác không thể hoàn tác. Thí sinh chưa bắt đầu sẽ không thể vào thi;
              bài đang làm sẽ được nộp tại thời điểm xác nhận.
            </p>
          </div>
        ) : (
          <div>
            <label
              htmlFor={closeTimeId}
              className="mb-1.5 block text-xs font-medium text-text-primary"
            >
              Giờ đóng mới
            </label>
            <Input
              id={closeTimeId}
              name="closes_at"
              type="datetime-local"
              autoComplete="off"
              value={closeTime}
              onChange={(event) => setCloseTime(event.target.value)}
              min={toLocalDateTimeInput(new Date(Date.now() + 60_000).toISOString())}
              required
              disabled={isSubmitting}
              aria-invalid={!closeTimeIsValid}
              className="bg-surface-card text-sm text-text-primary"
            />
            {!closeTimeIsValid ? (
              <p className="mt-1.5 text-xs text-semantic-danger">
                Giờ đóng mới phải là một thời điểm trong tương lai.
              </p>
            ) : isShortening ? (
              <p className="mt-1.5 text-xs text-semantic-warning">
                Bạn đang rút ngắn thời gian. Bài đang làm sẽ dùng thời hạn mới ngay sau khi lưu.
              </p>
            ) : null}
          </div>
        )}

        <div>
          <label
            htmlFor={reasonId}
            className="mb-1.5 block text-xs font-medium text-text-primary"
          >
            Lý do <span className="text-semantic-danger">*</span>
          </label>
          <Textarea
            id={reasonId}
            name="reason"
            autoComplete="off"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            minLength={5}
            maxLength={500}
            required
            disabled={isSubmitting}
            placeholder={
              isEndEarly
                ? 'Ví dụ: Toàn bộ thí sinh đã hoàn thành bài thi…'
                : 'Ví dụ: Gia hạn do sự cố mạng tại phòng thi…'
            }
            aria-invalid={!reasonIsValid && reason.length > 0}
            className="bg-surface-card text-sm text-text-primary"
          />
          <p className="mt-1.5 text-xs text-text-secondary">
            Tối thiểu 5 ký tự. Lý do được lưu trong nhật ký vận hành.
          </p>
        </div>

        {submitError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-semantic-danger/30 bg-semantic-danger-bg px-3.5 py-2.5 text-xs text-semantic-danger"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium leading-relaxed">
                {submitError instanceof ApiError
                  ? submitError.message
                  : 'Không thể cập nhật kỳ thi. Vui lòng thử lại.'}
              </p>
              {submitError instanceof ApiError ? (
                <TechnicalDetails
                  code={submitError.code}
                  traceId={submitError.traceId}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-surface-border pt-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 text-xs font-medium"
          >
            Quay lại
          </Button>
          <Button
            type="submit"
            size="sm"
            variant={isEndEarly ? 'destructive' : 'default'}
            disabled={isSubmitting}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            {isSubmitting ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : null}
            <span>{isEndEarly ? 'Kết thúc và thu bài' : 'Lưu giờ đóng mới'}</span>
          </Button>
        </div>
      </form>
    </AccessibleModal>
  );
}
