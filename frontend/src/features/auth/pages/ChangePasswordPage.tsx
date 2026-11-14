import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Info, KeyRound, Loader2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ApiError } from '../../../api/client';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { changePasswordApi } from '../auth.api';
import { useAuth } from '../AuthContext';
import { PasswordInput } from '../components/PasswordInput';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { evaluatePasswordComplexity } from '../types';

export function ChangePasswordPage() {
  const { user, handlePasswordChanged } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [submitError, setSubmitError] = useState<{
    code?: string;
    message: string;
    traceId?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const errors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!currentPassword) {
      errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.';
    }

    const complexity = evaluatePasswordComplexity(newPassword);
    if (!newPassword) {
      errors.newPassword = 'Vui lòng nhập mật khẩu mới.';
    } else if (!complexity.isValid) {
      errors.newPassword =
        'Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.';
    } else if (currentPassword && newPassword === currentPassword) {
      errors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Vui lòng nhập lại mật khẩu mới để xác nhận.';
    } else if (newPassword && confirmPassword !== newPassword) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp với mật khẩu mới.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await changePasswordApi({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      handlePasswordChanged();
      navigate('/login', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_CURRENT_PASSWORD') {
          setFieldErrors((prev) => ({
            ...prev,
            currentPassword: 'Mật khẩu hiện tại không chính xác.',
          }));
        } else if (err.code === 'PASSWORD_UNCHANGED') {
          setFieldErrors((prev) => ({
            ...prev,
            newPassword: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
          }));
        }
        setSubmitError({
          code: err.code,
          message: err.message,
          traceId: err.traceId,
        });
      } else {
        setSubmitError({
          message: 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex flex-col justify-between gap-2 border-b border-surface-border pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-balance text-text-primary sm:text-2xl">
            Đổi mật khẩu cá nhân
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Cập nhật mật khẩu cho tài khoản{' '}
            <strong className="font-mono font-semibold text-text-primary">
              @{user?.username}
            </strong>
          </p>
        </div>
        <Link
          to="/"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'self-start sm:self-auto')}
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          <span>Quay về Tổng quan</span>
        </Link>
      </div>

      <section aria-label="Biểu mẫu đổi mật khẩu">
        <Card className="border-surface-border bg-surface-card shadow-sm">
          <CardContent className="p-6">
            <div className="mb-5 flex items-start gap-2.5 rounded-md border border-brand-500/30 bg-semantic-info-bg p-3.5 text-xs leading-relaxed text-text-primary">
              <Info
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-200"
              />
              <div>
                <p className="font-semibold">Lưu ý khi đổi mật khẩu:</p>
                <p className="mt-1 text-pretty text-text-secondary">
                  Bạn sẽ bị đăng xuất khỏi mọi thiết bị và cần đăng nhập lại bằng mật khẩu mới.
                </p>
              </div>
            </div>

            {submitError ? (
              <div
                role="alert"
                className="mb-5 rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3.5 text-xs text-semantic-error"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-pretty">{submitError.message}</p>
                    <TechnicalDetails code={submitError.code} traceId={submitError.traceId} />
                  </div>
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <PasswordInput
                label="Mật khẩu hiện tại"
                name="current_password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (fieldErrors.currentPassword) {
                    setFieldErrors((prev) => ({ ...prev, currentPassword: undefined }));
                  }
                }}
                disabled={isSubmitting}
                placeholder="Nhập mật khẩu đang sử dụng"
                error={fieldErrors.currentPassword}
              />

              <PasswordInput
                label="Mật khẩu mới"
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
                placeholder="Nhập mật khẩu mới"
                error={fieldErrors.newPassword}
              />

              <PasswordRequirements password={newPassword} />

              <PasswordInput
                label="Xác nhận mật khẩu mới"
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

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <Link
                  to="/"
                  className={buttonVariants({ variant: 'outline' })}
                >
                  Hủy
                </Link>
                <Button type="submit" disabled={isSubmitting} className="font-semibold">
                  {isSubmitting ? (
                    <>
                      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                      <span>Đang đổi mật khẩu...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound aria-hidden="true" className="size-4" />
                      <span>Đổi mật khẩu</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
