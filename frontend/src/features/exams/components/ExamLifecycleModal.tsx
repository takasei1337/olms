import React, { useEffect, useId, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '../../../api/client';
import { AccessibleModal } from '../../../components/ui/AccessibleModal';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import {
  archiveExamApi,
  cancelExamApi,
  deleteExamApi,
  publishExamApi,
  startExamApi,
} from '../exams.api';
import type { ExamRecord } from '../types';
import { formatExamDateTime } from '../utils';

export type ExamLifecycleActionType =
  | 'delete'
  | 'publish'
  | 'start'
  | 'cancel'
  | 'archive';

interface ExamLifecycleModalProps {
  action: ExamLifecycleActionType | null;
  exam: ExamRecord | null;
  onClose: () => void;
  onSuccess: (
    action: ExamLifecycleActionType,
    updatedExam?: ExamRecord,
    deletedExamId?: string
  ) => void;
}

const ACTION_COPY: Record<
  ExamLifecycleActionType,
  {
    title: string;
    description: string;
    confirmLabel: string;
    destructive: boolean;
  }
> = {
  delete: {
    title: 'Xóa kỳ thi bản nháp',
    description:
      'Thao tác này xóa mềm kỳ thi khỏi danh sách làm việc. Chỉ thực hiện được khi kỳ thi đang ở trạng thái Bản nháp và chưa sinh mã đề.',
    confirmLabel: 'Xác nhận xóa kỳ thi',
    destructive: true,
  },
  publish: {
    title: 'Phát hành kỳ thi',
    description:
      'Sau khi phát hành, kỳ thi được chốt lịch thi và sẵn sàng mở đề theo thời gian quy định. Các mã đề đã sinh không còn chỉnh sửa.',
    confirmLabel: 'Phát hành kỳ thi',
    destructive: false,
  },
  start: {
    title: 'Bắt đầu kỳ thi',
    description:
      'Chuyển trạng thái kỳ thi sang Đang diễn ra để ghi nhận thí sinh vào phòng thi và cho phép làm bài.',
    confirmLabel: 'Bắt đầu kỳ thi',
    destructive: false,
  },
  archive: {
    title: 'Lưu trữ kỳ thi',
    description:
      'Đưa kỳ thi đã công bố kết quả vào trạng thái Lưu trữ lâu dài (chỉ xem và đối chiếu lịch sử).',
    confirmLabel: 'Lưu trữ kỳ thi',
    destructive: false,
  },
  cancel: {
    title: 'Hủy kỳ thi',
    description:
      'Chuyển kỳ thi sang trạng thái Đã hủy. Thao tác này không thể hoàn tác trên kỳ thi hiện tại.',
    confirmLabel: 'Xác nhận hủy kỳ thi',
    destructive: true,
  },
};

export function ExamLifecycleModal({
  action,
  exam,
  onClose,
  onSuccess,
}: ExamLifecycleModalProps) {
  const reasonId = useId();
  const [cancelReason, setCancelReason] = useState('');
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (action && exam) {
      setCancelReason('');
      setSubmitError(null);
    }
  }, [action, exam]);

  if (!action || !exam) {
    return null;
  }

  const copy = ACTION_COPY[action];
  const opensAtMs = Date.parse(exam.opens_at);
  const isBeforeOpenTime =
    action === 'start' && Number.isFinite(opensAtMs) && Date.now() < opensAtMs;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      if (action === 'delete') {
        await deleteExamApi(exam.id);
        onSuccess('delete', undefined, exam.id);
        onClose();
        return;
      }

      let res;
      if (action === 'publish') {
        res = await publishExamApi(exam.id);
      } else if (action === 'start') {
        res = await startExamApi(exam.id);
      } else if (action === 'archive') {
        res = await archiveExamApi(exam.id);
      } else {
        res = await cancelExamApi(exam.id, cancelReason);
      }

      onSuccess(action, res.data);
      onClose();
    } catch (err) {
      setSubmitError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AccessibleModal
      isOpen={Boolean(action && exam)}
      onClose={onClose}
      isBusy={isSubmitting}
      maxWidthClass="max-w-md"
      title={copy.title}
      description={copy.description}
    >
      <form onSubmit={handleConfirm} className="space-y-4">
        <div className="rounded-lg border border-surface-border bg-surface-muted/40 px-3.5 py-2.5 text-xs">
          <p className="font-semibold text-text-primary">{exam.name}</p>
          <p className="mt-0.5 font-mono text-[11px] text-text-secondary">
            Mã kỳ thi: {exam.code}
            {exam.subjects?.name ? ` · Môn: ${exam.subjects.name}` : ''}
          </p>
        </div>

        {isBeforeOpenTime ? (
          <div className="rounded-lg border border-semantic-warning/35 bg-semantic-warning-bg px-3.5 py-2.5 text-xs text-semantic-warning">
            Thời điểm mở đề của kỳ thi là{' '}
            <strong className="font-semibold tabular-nums">
              {formatExamDateTime(exam.opens_at)}
            </strong>
            . Máy chủ sẽ từ chối bắt đầu sớm hơn thời điểm này.
          </div>
        ) : null}

        {action === 'cancel' ? (
          <div>
            <label
              htmlFor={reasonId}
              className="mb-1.5 block text-xs font-medium text-text-primary"
            >
              Lý do hủy kỳ thi (tùy chọn)
            </label>
            <Textarea
              id={reasonId}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ví dụ: Thay đổi lịch thi học kỳ..."
              disabled={isSubmitting}
              className="bg-surface-card text-xs text-text-primary"
            />
          </div>
        ) : null}

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
                  : 'Không thể hoàn tất thao tác. Vui lòng thử lại.'}
              </p>
              {submitError instanceof ApiError ? (
                <TechnicalDetails
                  code={submitError.code}
                  traceId={submitError.traceId}
                  className="mt-1"
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-surface-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-8 text-xs font-medium"
          >
            Quay lại
          </Button>
          <Button
            type="submit"
            size="sm"
            variant={copy.destructive ? 'destructive' : 'default'}
            disabled={isSubmitting}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            {isSubmitting ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : null}
            <span>{copy.confirmLabel}</span>
          </Button>
        </div>
      </form>
    </AccessibleModal>
  );
}
