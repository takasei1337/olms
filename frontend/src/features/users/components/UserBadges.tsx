import {
  ROLE_LABELS,
  STATUS_LABELS,
  type UserRole,
  type UserStatus,
} from '../../auth/types';

export function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, string> = {
    ADMIN: 'border-brand-500/30 bg-semantic-info-bg text-brand-700 dark:text-brand-200',
    TEACHER: 'border-semantic-success/30 bg-semantic-success-bg text-semantic-success',
    STUDENT: 'border-surface-border bg-surface-muted text-text-secondary',
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${styles[role]}`}
    >
      <span>{ROLE_LABELS[role]}</span>
    </span>
  );
}

export function StatusBadge({ status }: { status: UserStatus }) {
  const styles: Record<UserStatus, string> = {
    ACTIVE: 'border-semantic-success/30 bg-semantic-success-bg text-semantic-success',
    LOCKED: 'border-semantic-error/30 bg-semantic-error-bg text-semantic-error',
    INACTIVE: 'border-semantic-warning/30 bg-semantic-warning-bg text-semantic-warning',
  };

  const dotStyles: Record<UserStatus, string> = {
    ACTIVE: 'bg-semantic-success',
    LOCKED: 'bg-semantic-error',
    INACTIVE: 'bg-semantic-warning',
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotStyles[status]}`}
      />
      <span>{STATUS_LABELS[status]}</span>
    </span>
  );
}
