import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from '../../../api/client';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { PasswordInput } from '../../auth/components/PasswordInput';
import { PasswordRequirements } from '../../auth/components/PasswordRequirements';
import { evaluatePasswordComplexity, ROLE_LABELS, STATUS_LABELS } from '../../auth/types';
import type { UserRecord } from '../types';
import {
  resetUserPasswordApi,
  softDeleteUserApi,
  updateUserStatusApi,
} from '../users.api';
import { AccessibleModal } from './AccessibleModal';

interface UserStatusModalProps {
  user: UserRecord | null;
  currentUserId: string;
  onClose: () => void;
  onSuccess: (updatedUser: UserRecord, nextStatus: 'ACTIVE' | 'LOCKED') => void;
}

export function UserStatusModal({
  user,
  currentUserId,
  onClose,
  onSuccess,
}: UserStatusModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<{ code?: string; message: string; traceId?: string } | null>(
    null
  );

  useEffect(() => {
    setError(null);
    setIsSubmitting(false);
  }, [user]);

  if (!user) return null;

  const nextStatus: 'ACTIVE' | 'LOCKED' = user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
  const isLocking = nextStatus === 'LOCKED';
  const isSelfLockAttempt = user.id === currentUserId && isLocking;

  const handleConfirm = async () => {
    if (isSubmitting || isSelfLockAttempt) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await updateUserStatusApi(user.id, { status: nextStatus });
      onSuccess(res.data, nextStatus);
    } catch (err) {
      if (err instanceof ApiError) {
        setError({
          code: err.code,
          message: err.message,
          traceId: err.traceId,
        });
      } else {
        setError({
          message: 'Không thể cập nhật trạng thái tài khoản. Vui lòng thử lại.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AccessibleModal
      isOpen={Boolean(user)}
      onClose={onClose}
      isBusy={isSubmitting}
      title={
        isLocking
          ? `Khóa tài khoản @${user.username}`
          : `Mở khóa tài khoản @${user.username}`
      }
      description={`Trạng thái hiện tại: ${STATUS_LABELS[user.status]}`}
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3 text-xs text-semantic-error"
          >
            <p className="font-semibold text-pretty">{error.message}</p>
            <TechnicalDetails code={error.code} traceId={error.traceId} />
          </div>
        ) : null}

        {isSelfLockAttempt ? (
          <div
            role="alert"
            className="rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3 text-xs text-semantic-error"
          >
            Bạn không thể tự khóa tài khoản đang dùng để đăng nhập.
          </div>
        ) : (
          <div className="rounded-md border border-surface-border bg-surface-muted/60 p-3.5 text-xs leading-relaxed text-text-primary">
            <p className="font-semibold">
              {user.full_name} (<span className="font-mono">@{user.username}</span> ·{' '}
              {ROLE_LABELS[user.role]})
            </p>
            {isLocking ? (
              <p className="mt-1.5 text-pretty text-text-secondary">
                Khi khóa tài khoản, người dùng này sẽ bị đăng xuất khỏi mọi thiết bị và không thể đăng nhập cho đến khi được mở khóa lại.
              </p>
            ) : (
              <p className="mt-1.5 text-pretty text-text-secondary">
                Khi mở khóa, tài khoản sẽ chuyển sang trạng thái <strong>Đang hoạt động</strong> và người dùng có thể đăng nhập trở lại.
              </p>
            )}
          </div>
        )}

        <div className="sticky -bottom-4 -mx-5 -mb-4 mt-4 flex flex-wrap items-center justify-end gap-2.5 border-t border-surface-border bg-surface-card px-5 py-3.5 sm:-mx-6 sm:px-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-8 text-xs font-medium"
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant={isLocking ? 'destructive' : 'default'}
            size="sm"
            onClick={handleConfirm}
            disabled={isSubmitting || isSelfLockAttempt}
            className="h-8 text-xs font-semibold"
          >
            {isSubmitting
              ? 'Đang xử lý...'
              : isLocking
              ? 'Khóa tài khoản'
              : 'Mở khóa tài khoản'}
          </Button>
        </div>
      </div>
    </AccessibleModal>
  );
}

interface ResetPasswordModalProps {
  user: UserRecord | null;
  onClose: () => void;
  onSuccess: (user: UserRecord) => void;
}

export function ResetPasswordModal({
  user,
  onClose,
  onSuccess,
}: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [submitError, setSubmitError] = useState<{
    code?: string;
    message: string;
    traceId?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setNewPassword('');
    setConfirmPassword('');
    setFieldErrors({});
    setSubmitError(null);
    setIsSubmitting(false);
  }, [user]);

  if (!user) return null;

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    const complexity = evaluatePasswordComplexity(newPassword);

    if (!newPassword) {
      errors.newPassword = 'Vui lòng nhập mật khẩu mới.';
    } else if (!complexity.isValid) {
      errors.newPassword =
        'Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Vui lòng xác nhận lại mật khẩu mới.';
    } else if (newPassword && confirmPassword !== newPassword) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await resetUserPasswordApi(user.id, { new_password: newPassword });
      setNewPassword('');
      setConfirmPassword('');
      onSuccess(user);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError({
          code: err.code,
          message: err.message,
          traceId: err.traceId,
        });
      } else {
        setSubmitError({
          message: 'Không thể đặt lại mật khẩu lúc này. Vui lòng thử lại.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AccessibleModal
      isOpen={Boolean(user)}
      onClose={onClose}
      isBusy={isSubmitting}
      title={`Đặt lại mật khẩu cho @${user.username}`}
      description={`${user.full_name} · ${ROLE_LABELS[user.role]}`}
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="rounded-md border border-brand-500/30 bg-semantic-info-bg p-3 text-xs leading-relaxed text-pretty text-text-primary">
          Sau khi đặt lại mật khẩu, người dùng này sẽ bị đăng xuất khỏi mọi thiết bị và cần đăng nhập bằng mật khẩu mới.
        </div>

        {submitError ? (
          <div
            role="alert"
            className="rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3 text-xs text-semantic-error"
          >
            <p className="font-semibold text-pretty">{submitError.message}</p>
            <TechnicalDetails code={submitError.code} traceId={submitError.traceId} />
          </div>
        ) : null}

        <PasswordInput
          label="Mật khẩu mới *"
          name="new_password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            if (fieldErrors.newPassword) {
              setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
            }
          }}
          disabled={isSubmitting}
          placeholder="Nhập mật khẩu mới cho người dùng"
          error={fieldErrors.newPassword}
        />

        <PasswordRequirements password={newPassword} />

        <PasswordInput
          label="Xác nhận mật khẩu mới *"
          name="confirm_password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (fieldErrors.confirmPassword) {
              setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }
          }}
          disabled={isSubmitting}
          placeholder="Nhập lại mật khẩu mới"
          error={fieldErrors.confirmPassword}
        />

        <div className="sticky -bottom-4 -mx-5 -mb-4 mt-4 flex flex-wrap items-center justify-end gap-2.5 border-t border-surface-border bg-surface-card px-5 py-3.5 sm:-mx-6 sm:px-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-8 text-xs font-medium"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="h-8 text-xs font-semibold"
          >
            {isSubmitting ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
          </Button>
        </div>
      </form>
    </AccessibleModal>
  );
}

interface DeleteUserModalProps {
  user: UserRecord | null;
  currentUserId: string;
  onClose: () => void;
  onSuccess: (deletedUser: UserRecord) => void;
}

export function DeleteUserModal({
  user,
  currentUserId,
  onClose,
  onSuccess,
}: DeleteUserModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<{ code?: string; message: string; traceId?: string } | null>(
    null
  );

  useEffect(() => {
    setError(null);
    setIsSubmitting(false);
  }, [user]);

  if (!user) return null;

  const isSelf = user.id === currentUserId;

  const handleConfirm = async () => {
    if (isSubmitting || isSelf) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await softDeleteUserApi(user.id);
      onSuccess(user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError({
          code: err.code,
          message: err.message,
          traceId: err.traceId,
        });
      } else {
        setError({
          message: 'Không thể xóa tài khoản lúc này. Vui lòng thử lại.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AccessibleModal
      isOpen={Boolean(user)}
      onClose={onClose}
      isBusy={isSubmitting}
      title={`Xóa tài khoản @${user.username}`}
      description="Tài khoản sẽ bị thu hồi quyền truy cập và ẩn khỏi danh sách hoạt động."
      maxWidthClass="max-w-md"
    >
      <div className="space-y-4">
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3 text-xs text-semantic-error"
          >
            <p className="font-semibold text-pretty">{error.message}</p>
            <TechnicalDetails code={error.code} traceId={error.traceId} />
          </div>
        ) : null}

        {isSelf ? (
          <div
            role="alert"
            className="rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3 text-xs text-semantic-error"
          >
            Bạn không thể tự xóa tài khoản đang dùng để đăng nhập.
          </div>
        ) : (
          <div className="rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3.5 text-xs leading-relaxed text-text-primary">
            <p className="font-semibold text-semantic-error">
              Bạn có chắc chắn muốn xóa tài khoản này không?
            </p>
            <ul className="mt-2 space-y-1 text-text-primary">
              <li>
                Họ và tên: <strong>{user.full_name}</strong>
              </li>
              <li>
                Tên đăng nhập: <strong className="font-mono">@{user.username}</strong>
              </li>
              <li>
                Vai trò: <strong>{ROLE_LABELS[user.role]}</strong>
              </li>
            </ul>
            <p className="mt-2.5 text-pretty text-text-secondary">
              Người dùng sẽ bị đăng xuất khỏi mọi thiết bị ngay lập tức và không thể đăng nhập bằng tài khoản này nữa.
            </p>
          </div>
        )}

        <div className="sticky -bottom-4 -mx-5 -mb-4 mt-4 flex flex-wrap items-center justify-end gap-2.5 border-t border-surface-border bg-surface-card px-5 py-3.5 sm:-mx-6 sm:px-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-8 text-xs font-medium"
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={isSubmitting || isSelf}
            className="h-8 text-xs font-semibold"
          >
            {isSubmitting ? 'Đang xóa...' : 'Xóa tài khoản'}
          </Button>
        </div>
      </div>
    </AccessibleModal>
  );
}
