import {
  CheckCircle2,
  CircleDot,
  Clock,
  Eye,
  EyeOff,
  FileCheck2,
  HelpCircle,
  Lock,
  MinusCircle,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import type {
  ExamResultParticipantStatus,
  QuestionGradingStatus,
  ResultVisibilityMode,
} from '../types';
import {
  GRADING_STATUS_LABELS,
  PARTICIPANT_RESULT_STATUS_LABELS,
  VISIBILITY_LABELS,
} from '../utils';

export function GradingStatusBadge({ status }: { status: QuestionGradingStatus }) {
  switch (status) {
    case 'CORRECT':
      return (
        <Badge className="gap-1 whitespace-nowrap border-semantic-success/30 bg-semantic-success-bg text-semantic-success hover:bg-semantic-success-bg">
          <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{GRADING_STATUS_LABELS[status]}</span>
        </Badge>
      );
    case 'PARTIAL':
      return (
        <Badge className="gap-1 whitespace-nowrap border-semantic-warning/30 bg-semantic-warning-bg text-semantic-warning hover:bg-semantic-warning-bg">
          <CircleDot aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{GRADING_STATUS_LABELS[status]}</span>
        </Badge>
      );
    case 'WRONG':
      return (
        <Badge className="gap-1 whitespace-nowrap border-semantic-error/30 bg-semantic-error-bg text-semantic-error hover:bg-semantic-error-bg">
          <XCircle aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{GRADING_STATUS_LABELS[status]}</span>
        </Badge>
      );
    case 'BLANK':
    default:
      return (
        <Badge
          variant="outline"
          className="gap-1 whitespace-nowrap border-surface-border bg-surface-muted text-text-secondary"
        >
          <MinusCircle aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{GRADING_STATUS_LABELS.BLANK}</span>
        </Badge>
      );
  }
}

export function VisibilityModeBadge({ mode }: { mode: ResultVisibilityMode }) {
  switch (mode) {
    case 'HIDDEN':
      return (
        <Badge
          variant="outline"
          className="gap-1 whitespace-nowrap border-surface-border bg-surface-muted text-text-secondary"
        >
          <EyeOff aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{VISIBILITY_LABELS.HIDDEN}</span>
        </Badge>
      );
    case 'SCORE_ONLY':
      return (
        <Badge className="gap-1 whitespace-nowrap border-semantic-info/30 bg-semantic-info-bg text-semantic-info hover:bg-semantic-info-bg">
          <Lock aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{VISIBILITY_LABELS.SCORE_ONLY}</span>
        </Badge>
      );
    case 'SCORE_AND_STATUS':
      return (
        <Badge className="gap-1 whitespace-nowrap border-semantic-warning/30 bg-semantic-warning-bg text-semantic-warning hover:bg-semantic-warning-bg">
          <FileCheck2 aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{VISIBILITY_LABELS.SCORE_AND_STATUS}</span>
        </Badge>
      );
    case 'FULL_REVIEW':
      return (
        <Badge className="gap-1 whitespace-nowrap border-semantic-success/30 bg-semantic-success-bg text-semantic-success hover:bg-semantic-success-bg">
          <Eye aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{VISIBILITY_LABELS.FULL_REVIEW}</span>
        </Badge>
      );
  }
}

export function ParticipantResultStatusBadge({ status }: { status: ExamResultParticipantStatus }) {
  switch (status) {
    case 'GRADED':
      return (
        <Badge className="gap-1 whitespace-nowrap border-semantic-success/30 bg-semantic-success-bg text-semantic-success hover:bg-semantic-success-bg">
          <CheckCircle2 aria-hidden="true" className="size-3 shrink-0" />
          <span>{PARTICIPANT_RESULT_STATUS_LABELS.GRADED}</span>
        </Badge>
      );
    case 'SUBMITTED':
    case 'GRADING':
      return (
        <Badge className="gap-1 whitespace-nowrap border-semantic-info/30 bg-semantic-info-bg text-semantic-info hover:bg-semantic-info-bg">
          <Clock aria-hidden="true" className="size-3 shrink-0" />
          <span>{PARTICIPANT_RESULT_STATUS_LABELS[status]}</span>
        </Badge>
      );
    case 'IN_PROGRESS':
      return (
        <Badge className="gap-1 whitespace-nowrap border-semantic-warning/30 bg-semantic-warning-bg text-semantic-warning hover:bg-semantic-warning-bg">
          <CircleDot aria-hidden="true" className="size-3 shrink-0" />
          <span>{PARTICIPANT_RESULT_STATUS_LABELS.IN_PROGRESS}</span>
        </Badge>
      );
    case 'FLAGGED':
      return (
        <Badge className="gap-1 whitespace-nowrap border-semantic-error/30 bg-semantic-error-bg text-semantic-error hover:bg-semantic-error-bg">
          <ShieldAlert aria-hidden="true" className="size-3 shrink-0" />
          <span>{PARTICIPANT_RESULT_STATUS_LABELS.FLAGGED}</span>
        </Badge>
      );
    case 'REGISTERED':
    default:
      return (
        <Badge
          variant="outline"
          className="gap-1 whitespace-nowrap border-surface-border bg-surface-muted text-text-secondary"
        >
          <HelpCircle aria-hidden="true" className="size-3 shrink-0" />
          <span>{PARTICIPANT_RESULT_STATUS_LABELS.REGISTERED}</span>
        </Badge>
      );
  }
}
