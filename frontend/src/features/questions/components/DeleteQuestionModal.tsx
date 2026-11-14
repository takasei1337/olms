import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccessibleModal } from '@/components/ui/AccessibleModal';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { ApiError } from '../../../api/client';
import type { QuestionRecord } from '../types';
import { deleteQuestionApi } from '../questions.api';

interface DeleteQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: QuestionRecord | null;
  onSuccess: (deletedId: string) => void;
}

export function DeleteQuestionModal({
  isOpen,
  onClose,
  question,
  onSuccess,
}: DeleteQuestionModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    code?: string;
    traceId?: string;
    serverMessage?: string;
  } | null>(null);

  if (!question) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    setErrorDetails(null);

    try {
      await deleteQuestionApi(question.id);
      onSuccess(question.id);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'CONFLICT') {
          setErrorMessage(
            'Không thể xóa câu hỏi này vì câu hỏi đã được đưa vào đề thi thực tế.'
          );
        } else if (err.code === 'FORBIDDEN') {
          setErrorMessage('Bạn không có quyền xóa câu hỏi này.');
        } else {
          setErrorMessage(
            err.message || 'Không thể xóa câu hỏi. Vui lòng thử lại sau.'
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
      setIsDeleting(false);
    }
  };

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận xóa câu hỏi"
      isBusy={isDeleting}
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
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

        <div className="flex items-start gap-3 rounded-md border border-semantic-warning/30 bg-semantic-warning-bg p-3.5 text-xs text-semantic-warning">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-semantic-warning"
          />
          <div className="space-y-1">
            <p className="font-semibold text-text-primary">
              Bạn có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng câu hỏi?
            </p>
            <p className="line-clamp-2 rounded bg-surface-card p-2 font-mono text-[11px] text-text-secondary border border-surface-border">
              {question.content}
            </p>
            <p className="text-text-secondary">
              Câu hỏi sẽ bị đánh dấu xóa mềm và không còn xuất hiện trong ngân hàng câu hỏi.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-surface-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="h-9 text-xs"
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-9 gap-1.5 font-semibold text-xs"
          >
            {isDeleting ? (
              <>
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                <span>Đang xóa...</span>
              </>
            ) : (
              <span>Xác nhận xóa</span>
            )}
          </Button>
        </div>
      </div>
    </AccessibleModal>
  );
}
