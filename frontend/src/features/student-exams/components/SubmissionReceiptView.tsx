import { ArrowLeft, Award, CheckCircle2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/CopyButton';
import { VISIBILITY_MODE_LABELS } from '../../exams/types';
import { formatExamDateTime } from '../../exams/utils';
import type { SubmitReceiptData } from '../types';

interface SubmissionReceiptViewProps {
  receipt: SubmitReceiptData;
  examCode?: string;
  examName?: string;
  variantCode?: string;
  wasAutoSubmittedOnExpiry?: boolean;
  onBackToExams: () => void;
}

export function SubmissionReceiptView({
  receipt,
  examCode,
  examName,
  variantCode,
  wasAutoSubmittedOnExpiry = false,
  onBackToExams,
}: SubmissionReceiptViewProps) {
  const visibilityText =
    VISIBILITY_MODE_LABELS[receipt.visibility] || receipt.visibility;

  return (
    <div className="mx-auto max-w-2xl py-6">
      <section className="rounded-xl border border-surface-border bg-surface-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-semantic-success/35 bg-semantic-success-bg text-semantic-success">
            {wasAutoSubmittedOnExpiry ? (
              <Clock aria-hidden="true" className="size-6" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="size-6" />
            )}
          </span>
          <div>
            <h1 className="font-display text-xl font-bold text-text-primary sm:text-2xl">
              {wasAutoSubmittedOnExpiry
                ? 'Bài thi đã được thu nhận tự động khi hết giờ'
                : 'Đã nộp bài thi thành công'}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Hệ thống đã ghi nhận bài làm của bạn lên máy chủ và khóa chỉnh sửa.
            </p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-surface-border bg-surface-panel p-4 text-sm sm:grid-cols-2">
          {examName ? (
            <div className="sm:col-span-2">
              <dt className="text-xs text-text-secondary">Kỳ thi</dt>
              <dd className="mt-0.5 font-semibold text-text-primary">
                {examCode ? `${examCode} — ` : ''}
                {examName}
              </dd>
            </div>
          ) : null}

          {variantCode ? (
            <div>
              <dt className="text-xs text-text-secondary">Mã đề đã làm</dt>
              <dd className="mt-0.5 font-mono font-semibold tabular-nums text-text-primary">
                {variantCode}
              </dd>
            </div>
          ) : null}

          <div>
            <dt className="text-xs text-text-secondary">Thời gian nộp</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-text-primary">
              {formatExamDateTime(receipt.submitted_at)}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-text-secondary">Trạng thái bài nộp</dt>
            <dd className="mt-1">
              <span className="inline-flex items-center rounded-md border border-semantic-success/35 bg-semantic-success-bg px-2.5 py-0.5 text-xs font-medium text-semantic-success">
                Đã nộp ({receipt.submission_status})
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-xs text-text-secondary">Chế độ công bố điểm</dt>
            <dd className="mt-0.5 text-text-primary">{visibilityText}</dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-xs text-text-secondary">Mã biên nhận bài nộp</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <code className="rounded border border-surface-border bg-surface-card px-2 py-1 font-mono text-xs text-text-primary">
                {receipt.submission_id}
              </code>
              <CopyButton
                value={receipt.submission_id}
                ariaLabel="Sao chép mã biên nhận bài nộp"
                visibleLabel="Sao chép"
              />
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <Link
            to="/my-results"
            className={buttonVariants({ variant: 'outline', size: 'default', className: 'gap-2' })}
          >
            <Award aria-hidden="true" className="size-4" />
            <span>Kết quả thi của tôi</span>
          </Link>
          <Button
            type="button"
            onClick={onBackToExams}
            className="gap-2 bg-brand-600 text-white hover:bg-brand-700"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <span>Về danh sách kỳ thi</span>
          </Button>
        </div>
      </section>
    </div>
  );
}
