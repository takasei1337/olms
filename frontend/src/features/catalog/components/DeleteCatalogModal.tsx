import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccessibleModal } from '@/components/ui/AccessibleModal';
import { ApiError } from '../../../api/client';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import {
  deleteChapterApi,
  deleteLessonApi,
  deleteSubjectApi,
} from '../catalog.api';

export type CatalogDeleteTargetType = 'subject' | 'chapter' | 'lesson';

export interface CatalogDeleteTarget {
  type: CatalogDeleteTargetType;
  id: string;
  name: string;
  code?: string | null;
}

interface DeleteCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: CatalogDeleteTarget | null;
  onSuccess: () => void;
}

const TYPE_LABELS: Record<CatalogDeleteTargetType, string> = {
  subject: 'môn học',
  chapter: 'chương',
  lesson: 'bài học',
};

export function DeleteCatalogModal({
  isOpen,
  onClose,
  target,
  onSuccess,
}: DeleteCatalogModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    code?: string;
    traceId?: string;
    serverMessage?: string;
  } | null>(null);

  if (!target) return null;

  const typeLabel = TYPE_LABELS[target.type];

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    setErrorDetails(null);

    try {
      if (target.type === 'subject') {
        await deleteSubjectApi(target.id);
      } else if (target.type === 'chapter') {
        await deleteChapterApi(target.id);
      } else {
        await deleteLessonApi(target.id);
      }
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'CHAPTER_HAS_LESSONS') {
          setErrorMessage(
            'Không thể xóa chương này vì đang chứa các bài học còn hiệu lực. Vui lòng chuyển hoặc xóa các bài học trước.'
          );
        } else if (err.code === 'LESSON_HAS_QUESTIONS') {
          setErrorMessage(
            'Không thể xóa bài học này vì đang có câu hỏi thuộc bài học. Vui lòng chuyển hoặc xóa câu hỏi trước.'
          );
        } else if (err.code === 'FORBIDDEN') {
          setErrorMessage(`Bạn không có quyền xóa ${typeLabel} này.`);
        } else {
          setErrorMessage(
            err.message || `Không thể xóa ${typeLabel}. Vui lòng thử lại sau.`
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
      title={`Xác nhận xóa ${typeLabel}`}
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
              Bạn có chắc chắn muốn xóa {typeLabel} sau đây?
            </p>
            <p className="font-medium text-text-primary">
              <span className="font-bold">{target.name}</span>
              {target.code ? ` (${target.code})` : ''}
            </p>
            <p className="text-text-secondary">
              Dữ liệu sẽ được đánh dấu xóa mềm trên hệ thống. Hành động này không thể hoàn tác trực tiếp từ giao diện.
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
