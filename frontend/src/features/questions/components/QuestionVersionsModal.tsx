import { useEffect, useState } from 'react';
import { History, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AccessibleModal } from '@/components/ui/AccessibleModal';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { ApiError } from '../../../api/client';
import type { QuestionVersion } from '../types';
import { getQuestionVersionsApi } from '../questions.api';

interface QuestionVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionId: string | null;
}

export function QuestionVersionsModal({
  isOpen,
  onClose,
  questionId,
}: QuestionVersionsModalProps) {
  const [versions, setVersions] = useState<QuestionVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    code?: string;
    traceId?: string;
    serverMessage?: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !questionId) {
      setVersions([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);
    setErrorDetails(null);

    getQuestionVersionsApi(questionId)
      .then((res) => {
        if (isMounted) {
          setVersions(res.data ?? []);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err instanceof ApiError) {
          setErrorMessage(err.message || 'Không thể tải lịch sử phiên bản câu hỏi.');
          setErrorDetails({
            code: err.code,
            traceId: err.traceId,
            serverMessage: err.serverMessage,
          });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, questionId]);

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Lịch sử các phiên bản câu hỏi"
      description="Xem các phiên bản snapshot đã lưu của câu hỏi theo thời gian (chỉ đọc)."
      maxWidthClass="max-w-2xl"
    >
      {isLoading ? (
        <div className="space-y-3 py-4">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      ) : errorMessage ? (
        <div
          role="alert"
          className="rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3.5 text-xs text-semantic-error"
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
      ) : versions.length === 0 ? (
        <p className="py-6 text-center text-xs text-text-secondary">
          Không có phiên bản nào được ghi nhận.
        </p>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => (
            <div
              key={v.id}
              className={`rounded-md border p-3 text-xs transition-colors ${
                v.is_current
                  ? 'border-brand-600 bg-semantic-info-bg/30'
                  : 'border-surface-border bg-surface-card'
              }`}
            >
              <div className="flex items-center justify-between border-b border-surface-border pb-2">
                <div className="flex items-center gap-2">
                  <History aria-hidden="true" className="size-3.5 text-brand-600" />
                  <span className="font-bold text-text-primary">
                    Phiên bản #{v.version_no}
                  </span>
                  {v.is_current ? (
                    <Badge variant="default" className="gap-1 text-[10px]">
                      <CheckCircle2 aria-hidden="true" className="size-2.5" />
                      <span>Hiện hành</span>
                    </Badge>
                  ) : null}
                </div>

                <div className="text-[11px] text-text-secondary">
                  {v.frozen_at ? (
                    <span>Đóng băng lúc: {new Date(v.frozen_at).toLocaleString('vi-VN')}</span>
                  ) : (
                    <span>Đang cập nhật</span>
                  )}
                </div>
              </div>

              {v.answer_spec ? (
                <div className="mt-2 text-text-secondary">
                  <span>Dạng: </span>
                  <span className="font-semibold text-text-primary">
                    {v.answer_spec.kind}
                  </span>
                  {v.answer_spec.kind === 'SINGLE_CHOICE' ||
                  v.answer_spec.kind === 'MULTI_CHOICE' ? (
                    <span className="ml-2">
                      ({v.answer_spec.choices?.length ?? 0} lựa chọn)
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </AccessibleModal>
  );
}
