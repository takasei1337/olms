import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AccessibleModal } from '@/components/ui/AccessibleModal';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { ApiError } from '../../../api/client';
import {
  type QuestionRecord,
  type QuestionStatus,
} from '../types';
import { updateQuestionStatusApi } from '../questions.api';

interface QuestionStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: QuestionRecord | null;
  onSuccess: (updated: QuestionRecord) => void;
}

export function QuestionStatusModal({
  isOpen,
  onClose,
  question,
  onSuccess,
}: QuestionStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<QuestionStatus>(
    question?.status || 'DRAFT'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    code?: string;
    traceId?: string;
    serverMessage?: string;
  } | null>(null);

  React.useEffect(() => {
    if (isOpen && question) {
      setSelectedStatus(question.status);
      setErrorMessage(null);
      setErrorDetails(null);
    }
  }, [isOpen, question]);

  if (!question) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStatus === question.status) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setErrorDetails(null);

    try {
      const res = await updateQuestionStatusApi(question.id, selectedStatus);
      onSuccess(res.data);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'CONFLICT') {
          setErrorMessage(
            'Không thể kích hoạt câu hỏi này do phát hiện trùng lặp hoặc xung đột trạng thái.'
          );
        } else if (err.code === 'FORBIDDEN') {
          setErrorMessage('Bạn không có quyền thay đổi trạng thái câu hỏi này.');
        } else {
          setErrorMessage(
            err.message || 'Không thể đổi trạng thái câu hỏi. Vui lòng thử lại.'
          );
        }
        setErrorDetails({
          code: err.code,
          traceId: err.traceId,
          serverMessage: err.serverMessage,
        });
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Đổi trạng thái câu hỏi"
      isBusy={isSubmitting}
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3 text-xs text-semantic-error"
          >
            <p className="font-semibold">{errorMessage}</p>
            {errorDetails ? (
              <div className="mt-2">
                <TechnicalDetails
                  code={errorDetails.code}
                  traceId={errorDetails.traceId}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-xs font-semibold text-text-primary">
            Chọn trạng thái mới:
          </label>
          <Select
            value={selectedStatus}
            onValueChange={(val) => setSelectedStatus(val as QuestionStatus)}
            disabled={isSubmitting}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Bản nháp (DRAFT)</SelectItem>
              <SelectItem value="ACTIVE">Đang sử dụng (ACTIVE)</SelectItem>
              <SelectItem value="INACTIVE">Tạm ngưng (INACTIVE)</SelectItem>
              <SelectItem value="ARCHIVED">Lưu trữ (ARCHIVED)</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1 text-[11px] text-text-secondary">
            Chỉ những câu hỏi ở trạng thái "Đang sử dụng (ACTIVE)" mới có thể đưa vào ma trận đề thi.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-surface-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 text-xs"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || selectedStatus === question.status}
            className="h-9 gap-1.5 font-semibold text-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                <span>Đang cập nhật...</span>
              </>
            ) : (
              <span>Cập nhật trạng thái</span>
            )}
          </Button>
        </div>
      </form>
    </AccessibleModal>
  );
}
