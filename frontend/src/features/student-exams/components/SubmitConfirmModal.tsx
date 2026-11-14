import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { AccessibleModal } from '@/components/ui/AccessibleModal';
import { Button } from '@/components/ui/button';

interface SubmitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSubmit: () => void;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  flaggedCount: number;
  pendingCount: number;
  errorCount: number;
  isFlushing: boolean;
  isSubmitting: boolean;
  submitError: string | null;
}

export function SubmitConfirmModal({
  isOpen,
  onClose,
  onConfirmSubmit,
  totalQuestions,
  answeredCount,
  unansweredCount,
  flaggedCount,
  pendingCount,
  errorCount,
  isFlushing,
  isSubmitting,
  submitError,
}: SubmitConfirmModalProps) {
  const isBusy = isFlushing || isSubmitting;

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận nộp bài thi"
      description="Sau khi nộp bài, bạn không thể chỉnh sửa hoặc làm lại bài thi này."
      isBusy={isBusy}
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-surface-border bg-surface-panel p-3.5 text-sm">
          <div>
            <p className="text-xs text-text-secondary">Tổng số câu</p>
            <p className="font-semibold tabular-nums text-text-primary">
              {totalQuestions} câu
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Đã trả lời</p>
            <p className="font-semibold tabular-nums text-semantic-success">
              {answeredCount} câu
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Chưa trả lời</p>
            <p className="font-semibold tabular-nums text-text-primary">
              {unansweredCount} câu
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Đánh dấu xem lại</p>
            <p className="font-semibold tabular-nums text-semantic-warning">
              {flaggedCount} câu
            </p>
          </div>
        </div>

        {pendingCount > 0 ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-brand-500/30 bg-semantic-info-bg p-3 text-xs text-brand-700 dark:text-brand-200">
            <Loader2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 animate-spin" />
            <span>
              Còn {pendingCount} câu đang chờ đồng bộ máy chủ. Hệ thống sẽ tự động lưu xong trước khi gửi nộp bài.
            </span>
          </div>
        ) : null}

        {errorCount > 0 ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-semantic-danger/35 bg-semantic-danger-bg p-3 text-xs text-semantic-danger">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              Có {errorCount} câu gặp lỗi lưu trước đó. Khi bấm Xác nhận nộp bài, hệ thống sẽ thử đồng bộ lại một lần nữa.
            </span>
          </div>
        ) : null}

        {unansweredCount > 0 && errorCount === 0 ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-semantic-warning/35 bg-semantic-warning-bg p-3 text-xs text-semantic-warning">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              Bạn vẫn còn {unansweredCount} câu chưa trả lời. Bạn có chắc chắn muốn nộp bài ngay bây giờ không?
            </span>
          </div>
        ) : null}

        {submitError ? (
          <div
            role="alert"
            className="rounded-lg border border-semantic-danger/40 bg-semantic-danger-bg p-3 text-xs text-semantic-danger"
          >
            {submitError}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isBusy}
          >
            Tiếp tục làm bài
          </Button>
          <Button
            type="button"
            onClick={onConfirmSubmit}
            disabled={isBusy}
            className="gap-2 bg-brand-600 text-white hover:bg-brand-700"
          >
            {isBusy ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="size-4" />
            )}
            <span>
              {isFlushing
                ? 'Đang lưu đáp án cuối...'
                : isSubmitting
                ? 'Đang nộp bài...'
                : 'Xác nhận nộp bài'}
            </span>
          </Button>
        </div>
      </div>
    </AccessibleModal>
  );
}
