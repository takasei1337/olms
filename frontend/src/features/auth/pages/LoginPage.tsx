import React, { useEffect, useId, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';
import { ApiError, type LockoutData } from '../../../api/client';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { useAuth } from '../AuthContext';
import { PasswordInput } from '../components/PasswordInput';
import { getSafeRedirectPath } from '../utils/redirect';

export function LoginPage() {
  const { login, sessionNotice, clearNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const usernameId = useId();
  const usernameErrorId = `${usernameId}-error`;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
  }>({});
  const [submitError, setSubmitError] = useState<{
    code?: string;
    message: string;
    traceId?: string;
    isNetwork?: boolean;
  } | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [lockedUntilText, setLockedUntilText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setRetryCountdown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryCountdown]);

  const validateForm = (): boolean => {
    const errors: { username?: string; password?: string } = {};
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      errors.username = 'Vui lòng nhập tên đăng nhập.';
    } else if (trimmedUsername.length > 50) {
      errors.username = 'Tên đăng nhập không được vượt quá 50 ký tự.';
    }

    if (!password) {
      errors.password = 'Vui lòng nhập mật khẩu.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);
    clearNotice();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const user = await login({
        username: username.trim(),
        password,
      });

      const locationState = location.state as { from?: unknown } | null;
      const targetPath = getSafeRedirectPath(locationState?.from, user.role);
      navigate(targetPath, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const lockData = (err.data && typeof err.data === 'object' ? err.data : {}) as LockoutData;
        if (err.status === 429 && typeof lockData.retry_after_seconds === 'number') {
          setRetryCountdown(Math.max(1, Math.ceil(lockData.retry_after_seconds)));
        } else {
          setRetryCountdown(0);
        }

        if (lockData.locked_until) {
          try {
            const formatted = new Date(lockData.locked_until).toLocaleTimeString('vi-VN');
            setLockedUntilText(formatted);
          } catch {
            setLockedUntilText(null);
          }
        } else {
          setLockedUntilText(null);
        }

        setSubmitError({
          code: err.code,
          message: err.message,
          traceId: err.traceId,
          isNetwork: err.isNetworkError,
        });
      } else {
        setSubmitError({
          message: 'Không thể đăng nhập lúc này. Vui lòng thử lại.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const noticeStyles = {
    info: 'border-brand-500/30 bg-semantic-info-bg text-text-primary',
    success: 'border-semantic-success/30 bg-semantic-success-bg text-semantic-success',
    warning: 'border-semantic-warning/30 bg-semantic-warning-bg text-semantic-warning',
    error: 'border-semantic-error/30 bg-semantic-error-bg text-semantic-error',
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-canvas px-4 py-8 sm:px-6 lg:px-8">
      <Card className="mx-auto grid w-full max-w-4xl grid-cols-1 overflow-hidden border-surface-border bg-surface-card shadow-sm lg:grid-cols-12">
        {/* Left Region: Academic Brand & Context (Desktop 5 cols, compact header on Mobile) */}
        <section
          aria-label="Giới thiệu hệ thống OLMS"
          className="flex flex-col justify-between border-b border-surface-border bg-brand-900 p-6 text-white sm:p-8 lg:col-span-5 lg:border-b-0 lg:border-r lg:border-r-white/10"
        >
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white shadow-sm">
                OLMS
              </span>
              <span className="text-sm font-semibold text-blue-100">
                Hệ thống Khảo thí Trực tuyến
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-balance text-white sm:text-2xl">
                Đăng nhập hệ thống OLMS
              </h1>
              <p className="text-xs leading-relaxed text-pretty text-blue-100/90 sm:text-sm">
                Quản lý ngân hàng câu hỏi <br />
                Tổ chức kỳ thi trực tuyến <br />
                Chấm điểm tự động dành cho nhà trường.
              </p>
            </div>
          </div>

          <div className="mt-6 hidden space-y-3 border-t border-white/15 pt-5 text-xs leading-relaxed text-blue-100/90 lg:block">
            <p className="inline-flex items-center gap-1.5 font-semibold text-white">
              <ShieldCheck aria-hidden="true" className="size-4 text-blue-200" />
              <span>Hướng dẫn tài khoản theo vai trò</span>
            </p>
            <ul className="space-y-2 text-pretty">
              <li>
                <strong className="text-white">Quản trị viên &amp; Giáo viên:</strong> Sử dụng tên đăng nhập đã được cấp phát và chủ động đổi mật khẩu định kỳ.
              </li>
              <li>
                <strong className="text-white">Sinh viên dự thi:</strong> Tài khoản được tạo tự động khi sinh viên có trong danh sách tham gia thi.
              </li>
            </ul>
          </div>
        </section>

        {/* Right Region: Login Form (Desktop 7 cols) */}
        <section
          aria-label="Biểu mẫu đăng nhập"
          className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-7"
        >
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-text-primary sm:text-lg">
                Thông tin đăng nhập
              </h2>
              <p className="mt-0.5 text-xs text-text-secondary">
                Nhập tên đăng nhập và mật khẩu đã được cấp để tiếp tục.
              </p>
            </div>
            <ThemeToggle className="shrink-0" />
          </div>

          {sessionNotice ? (
            <div
              role={sessionNotice.type === 'error' ? 'alert' : 'status'}
              className={cn(
                'mb-5 rounded-md border p-3.5 text-xs leading-relaxed',
                noticeStyles[sessionNotice.type]
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-pretty">{sessionNotice.message}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearNotice}
                  aria-label="Đóng thông báo"
                  className="h-6 shrink-0 px-2 text-xs underline"
                >
                  Đóng
                </Button>
              </div>
            </div>
          ) : null}

          {submitError ? (
            <div
              role="alert"
              className="mb-5 rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3.5 text-xs text-semantic-error"
            >
              <div className="flex items-start gap-2">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-pretty">{submitError.message}</p>
                  {retryCountdown > 0 ? (
                    <p className="mt-1.5 font-mono tabular-nums text-text-primary">
                      Thời gian chờ còn lại: <strong>{retryCountdown} giây</strong>
                      {lockedUntilText ? ` (mở khóa lúc ${lockedUntilText})` : ''}
                    </p>
                  ) : null}
                  <TechnicalDetails code={submitError.code} traceId={submitError.traceId} />
                </div>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor={usernameId}
                className="block text-sm font-medium text-text-primary"
              >
                Tên đăng nhập
              </label>
              <Input
                id={usernameId}
                name="username"
                type="text"
                autoComplete="username"
                maxLength={60}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (fieldErrors.username) {
                    setFieldErrors((prev) => ({ ...prev, username: undefined }));
                  }
                }}
                disabled={isSubmitting}
                placeholder="Nhập tên đăng nhập"
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={fieldErrors.username ? usernameErrorId : undefined}
                className={cn(
                  'h-10 bg-surface-card text-sm text-text-primary placeholder:text-text-secondary',
                  fieldErrors.username
                    ? 'border-semantic-error focus-visible:ring-semantic-error'
                    : 'border-surface-border focus-visible:border-brand-600 focus-visible:ring-brand-500/30',
                  'disabled:bg-surface-muted disabled:text-text-secondary'
                )}
              />
              {fieldErrors.username ? (
                <p
                  id={usernameErrorId}
                  role="alert"
                  className="text-xs font-medium text-semantic-error"
                >
                  {fieldErrors.username}
                </p>
              ) : null}
            </div>

            <PasswordInput
              label="Mật khẩu"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              disabled={isSubmitting}
              placeholder="Nhập mật khẩu"
              error={fieldErrors.password}
            />

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-10 w-full font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    <span>Đang đăng nhập...</span>
                  </>
                ) : (
                  <>
                    <LogIn aria-hidden="true" className="size-4" />
                    <span>Đăng nhập</span>
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="mt-6 border-t border-surface-border pt-4 text-xs leading-relaxed text-pretty text-text-secondary">
            <p>
              Quên mật khẩu hoặc tài khoản bị khóa? <br></br>Vui lòng liên hệ Quản trị viên hoặc Giáo viên để được cấp lại.
            </p>
          </div>
        </section>
      </Card>
    </main>
  );
}
