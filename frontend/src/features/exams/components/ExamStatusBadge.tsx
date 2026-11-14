import {
  Archive,
  Award,
  Ban,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileEdit,
  Globe,
  PlayCircle,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ATTENDANCE_STATUS_LABELS,
  DELIVERY_MODE_LABELS,
  EXAM_STATUS_LABELS,
  PARTICIPANT_STATUS_LABELS,
  type AttendanceStatus,
  type ExamDeliveryMode,
  type ExamStatus,
  type ParticipantStatus,
} from '../types';

const EXAM_STATUS_CLASSES: Record<ExamStatus, string> = {
  DRAFT: 'border-surface-border bg-surface-muted text-text-secondary',
  GENERATED: 'border-brand-500/30 bg-semantic-info-bg text-brand-700 dark:text-brand-200',
  PUBLISHED: 'border-semantic-success/30 bg-semantic-success-bg text-semantic-success',
  IN_PROGRESS: 'border-semantic-warning/35 bg-semantic-warning-bg text-semantic-warning',
  ENDED: 'border-surface-border bg-surface-muted text-text-primary',
  RESULT_PUBLISHED: 'border-brand-500/30 bg-semantic-info-bg text-brand-700 dark:text-brand-200',
  ARCHIVED: 'border-surface-border bg-surface-muted text-text-muted',
  CANCELLED: 'border-semantic-danger/30 bg-semantic-danger-bg text-semantic-danger',
};

function ExamStatusIcon({ status }: { status: ExamStatus }) {
  switch (status) {
    case 'DRAFT':
      return <FileEdit aria-hidden="true" className="size-3 shrink-0" />;
    case 'GENERATED':
      return <FileCheck2 aria-hidden="true" className="size-3 shrink-0" />;
    case 'PUBLISHED':
      return <Globe aria-hidden="true" className="size-3 shrink-0" />;
    case 'IN_PROGRESS':
      return <PlayCircle aria-hidden="true" className="size-3 shrink-0" />;
    case 'ENDED':
      return <Clock aria-hidden="true" className="size-3 shrink-0" />;
    case 'RESULT_PUBLISHED':
      return <Award aria-hidden="true" className="size-3 shrink-0" />;
    case 'ARCHIVED':
      return <Archive aria-hidden="true" className="size-3 shrink-0" />;
    case 'CANCELLED':
      return <Ban aria-hidden="true" className="size-3 shrink-0" />;
  }
}

export function ExamStatusBadge({
  status,
  className,
}: {
  status: ExamStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        EXAM_STATUS_CLASSES[status],
        className
      )}
    >
      <ExamStatusIcon status={status} />
      <span>{EXAM_STATUS_LABELS[status] || status}</span>
    </span>
  );
}

export function DeliveryModeBadge({ mode }: { mode: ExamDeliveryMode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-surface-border bg-surface-canvas px-2 py-0.5 text-[11px] font-medium text-text-secondary whitespace-nowrap">
      {DELIVERY_MODE_LABELS[mode] || mode}
    </span>
  );
}

export function ParticipantStatusBadge({ status }: { status: ParticipantStatus }) {
  const tone =
    status === 'COMPLETED'
      ? 'border-semantic-success/30 bg-semantic-success-bg text-semantic-success'
      : status === 'IN_PROGRESS'
      ? 'border-semantic-warning/35 bg-semantic-warning-bg text-semantic-warning'
      : 'border-surface-border bg-surface-muted text-text-secondary';

  const Icon =
    status === 'COMPLETED'
      ? CheckCircle2
      : status === 'IN_PROGRESS'
      ? Clock
      : Users;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tone
      )}
    >
      <Icon aria-hidden="true" className="size-3 shrink-0" />
      <span>{PARTICIPANT_STATUS_LABELS[status] || status}</span>
    </span>
  );
}

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  const tone =
    status === 'PRESENT'
      ? 'border-semantic-success/30 bg-semantic-success-bg text-semantic-success'
      : status === 'ABSENT'
      ? 'border-semantic-danger/30 bg-semantic-danger-bg text-semantic-danger'
      : 'border-surface-border bg-surface-canvas text-text-secondary';

  const Icon =
    status === 'PRESENT'
      ? UserCheck
      : status === 'ABSENT'
      ? UserMinus
      : Clock;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tone
      )}
    >
      <Icon aria-hidden="true" className="size-3 shrink-0" />
      <span>{ATTENDANCE_STATUS_LABELS[status] || status}</span>
    </span>
  );
}
