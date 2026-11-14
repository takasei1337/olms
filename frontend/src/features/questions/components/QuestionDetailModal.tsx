import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AccessibleModal } from '@/components/ui/AccessibleModal';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { ApiError } from '../../../api/client';
import {
  DIFFICULTY_LABELS,
  KIND_LABELS,
  STATUS_LABELS,
  type QuestionRecord,
  type QuestionType,
} from '../types';
import { getQuestionByIdApi } from '../questions.api';
import { QuestionPreview } from './preview/QuestionPreview';

interface QuestionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionId: string | null;
  questionTypes: QuestionType[];
}

export function QuestionDetailModal({
  isOpen,
  onClose,
  questionId,
  questionTypes,
}: QuestionDetailModalProps) {
  const [question, setQuestion] = useState<QuestionRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    code?: string;
    traceId?: string;
    serverMessage?: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !questionId) {
      setQuestion(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);
    setErrorDetails(null);

    getQuestionByIdApi(questionId)
      .then((res) => {
        if (isMounted) {
          setQuestion(res.data);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err instanceof ApiError) {
          setErrorMessage(err.message || 'Không thể tải chi tiết câu hỏi.');
          setErrorDetails({
            code: err.code,
            traceId: err.traceId,
            serverMessage: err.serverMessage,
          });
        } else {
          setErrorMessage('Đã xảy ra lỗi không xác định.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, questionId]);

  const qType = questionTypes.find((t) => t.id === question?.type_id);
  const kind = qType?.code || 'SINGLE_CHOICE';

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title="Chi tiết câu hỏi"
      maxWidthClass="max-w-3xl"
    >
      {isLoading ? (
        <div className="space-y-3 py-4">
          <Skeleton className="h-6 w-1/3 rounded" />
          <Skeleton className="h-24 w-full rounded" />
          <Skeleton className="h-32 w-full rounded" />
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
      ) : question ? (
        <div className="space-y-4">
          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2 border-b border-surface-border pb-3">
            <Badge variant="outline" className="text-xs">
              Dạng: {KIND_LABELS[kind]}
            </Badge>
            <Badge
              variant={
                question.difficulty_level === 'EASY'
                  ? 'default'
                  : question.difficulty_level === 'MEDIUM'
                  ? 'secondary'
                  : 'destructive'
              }
              className="text-xs"
            >
              Độ khó: {DIFFICULTY_LABELS[question.difficulty_level]}
            </Badge>
            <Badge variant="outline" className="text-xs font-semibold">
              Trạng thái: {STATUS_LABELS[question.status]}
            </Badge>
            {question.topic_tag ? (
              <Badge variant="secondary" className="font-mono text-xs">
                #{question.topic_tag}
              </Badge>
            ) : null}
            <span className="font-mono text-xs text-text-secondary">
              Phiên bản v{question.current_version_no}
            </span>
          </div>

          {/* Question Preview */}
          {question.answer_spec ? (
            <QuestionPreview
              content={question.content}
              mediaUrl={question.media_url}
              explanation={question.explanation}
              difficultyLevel={question.difficulty_level}
              kind={kind}
              answerSpec={question.answer_spec}
              topicTag={question.topic_tag}
            />
          ) : (
            <div className="whitespace-pre-wrap rounded-md border border-surface-border bg-surface-canvas p-3 text-sm text-text-primary">
              {question.content}
            </div>
          )}
        </div>
      ) : null}
    </AccessibleModal>
  );
}
