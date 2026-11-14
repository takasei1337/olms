import React, { useEffect, useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ApiError } from '../../../api/client';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { PasswordInput } from '../../auth/components/PasswordInput';
import { PasswordRequirements } from '../../auth/components/PasswordRequirements';
import { evaluatePasswordComplexity, ROLE_LABELS } from '../../auth/types';
import type { CreateUserPayload, UpdateUserPayload, UserRecord } from '../types';
import { createUserApi, getUserByIdApi, updateUserApi } from '../users.api';
import { AccessibleModal } from './AccessibleModal';

interface UserFormModalProps {
  mode: 'create' | 'edit' | null;
  targetUser: UserRecord | null;
  onClose: () => void;
  onSuccess: (savedUser: UserRecord, mode: 'create' | 'edit') => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{9,15}$/;

function getFormInputClass(hasError: boolean, extraClass?: string): string {
  return cn(
    'h-10 bg-surface-card text-sm text-text-primary placeholder:text-text-secondary',
    hasError
      ? 'border-semantic-error focus-visible:ring-semantic-error'
      : 'border-surface-border focus-visible:border-brand-600 focus-visible:ring-brand-500/30',
    'disabled:bg-surface-muted disabled:text-text-secondary',
    extraClass
  );
}

export function UserFormModal({
  mode,
  targetUser,
  onClose,
  onSuccess,
}: UserFormModalProps) {
  const formIdPrefix = useId();
  const isOpen = mode === 'create' || (mode === 'edit' && Boolean(targetUser));

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [clearPhone, setClearPhone] = useState(false);
  const [role, setRole] = useState<'ADMIN' | 'TEACHER'>('TEACHER');
  const [password, setPassword] = useState('');

  const [isFetchingUser, setIsFetchingUser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    role?: string;
    password?: string;
  }>({});
  const [submitError, setSubmitError] = useState<{
    code?: string;
    message: string;
    traceId?: string;
  } | null>(null);

  const isTargetStudent = mode === 'edit' && targetUser?.role === 'STUDENT';

  useEffect(() => {
    if (!isOpen) return;

    setFieldErrors({});
    setSubmitError(null);
    setPassword('');
    setClearPhone(false);

    if (mode === 'create') {
      setUsername('');
      setFullName('');
      setEmail('');
      setPhone('');
      setRole('TEACHER');
      setIsFetchingUser(false);
      return;
    }

    if (mode === 'edit' && targetUser) {
      setUsername(targetUser.username);
      setFullName(targetUser.full_name);
      setEmail(targetUser.email ?? '');
      setPhone(targetUser.phone ?? '');
      if (targetUser.role === 'ADMIN' || targetUser.role === 'TEACHER') {
        setRole(targetUser.role);
      }

      const controller = new AbortController();
      setIsFetchingUser(true);
      getUserByIdApi(targetUser.id, controller.signal)
        .then((res) => {
          const fresh = res.data;
          setUsername(fresh.username);
          setFullName(fresh.full_name);
          if (fresh.email !== undefined) setEmail(fresh.email);
          if (fresh.phone !== undefined) setPhone(fresh.phone ?? '');
          if (fresh.role === 'ADMIN' || fresh.role === 'TEACHER') {
            setRole(fresh.role);
          }
        })
        .catch(() => {
          // Keep initial row data if background detail refresh fails
        })
        .finally(() => {
          setIsFetchingUser(false);
        });

      return () => {
        controller.abort();
      };
    }
  }, [isOpen, mode, targetUser]);

  if (!isOpen) {
    return null;
  }

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (mode === 'create') {
      const trimmedUsername = username.trim();
      if (!trimmedUsername) {
        errors.username = 'Vui lòng nhập tên đăng nhập.';
      } else if (trimmedUsername.length > 50) {
        errors.username = 'Tên đăng nhập không được vượt quá 50 ký tự.';
      }

      if (!trimmedEmail) {
        errors.email = 'Vui lòng nhập địa chỉ email.';
      } else if (!EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 150) {
        errors.email = 'Địa chỉ email không đúng định dạng hoặc vượt quá 150 ký tự.';
      }

      const pwChecks = evaluatePasswordComplexity(password);
      if (!password) {
        errors.password = 'Vui lòng nhập mật khẩu khởi tạo.';
      } else if (!pwChecks.isValid) {
        errors.password =
          'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.';
      }
    } else if (mode === 'edit') {
      if (trimmedEmail && (!EMAIL_REGEX.test(trimmedEmail) || trimmedEmail.length > 150)) {
        errors.email = 'Địa chỉ email không đúng định dạng hoặc vượt quá 150 ký tự.';
      }
      if (!clearPhone && trimmedPhone && !PHONE_REGEX.test(trimmedPhone)) {
        errors.phone =
          'Số điện thoại phải gồm từ 9 đến 15 chữ số (có thể bắt đầu bằng dấu +).';
      }
    }

    if (!trimmedFullName) {
      errors.fullName = 'Vui lòng nhập họ và tên.';
    } else if (trimmedFullName.length > 150) {
      errors.fullName = 'Họ và tên không được vượt quá 150 ký tự.';
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
      if (mode === 'create') {
        const payload: CreateUserPayload = {
          username: username.trim(),
          password,
          full_name: fullName.trim(),
          email: email.trim(),
          role,
        };
        const res = await createUserApi(payload);
        setPassword('');
        onSuccess(res.data, 'create');
      } else if (mode === 'edit' && targetUser) {
        const payload: UpdateUserPayload = {
          full_name: fullName.trim(),
        };

        const trimmedEmail = email.trim();
        if (trimmedEmail) {
          payload.email = trimmedEmail;
        }

        const trimmedPhone = phone.trim();
        if (clearPhone) {
          payload.phone = null;
        } else if (trimmedPhone) {
          payload.phone = trimmedPhone;
        }

        if (!isTargetStudent) {
          payload.role = role;
        }

        const res = await updateUserApi(targetUser.id, payload);
        onSuccess(res.data, 'edit');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'USER_ALREADY_EXISTS') {
          if (mode === 'create') {
            setFieldErrors((prev) => ({
              ...prev,
              username: 'Tên đăng nhập hoặc email này đã được sử dụng.',
              email: 'Tên đăng nhập hoặc email này đã được sử dụng.',
            }));
          } else {
            setFieldErrors((prev) => ({
              ...prev,
              email: 'Địa chỉ email này đã thuộc về tài khoản khác.',
            }));
          }
        }
        setSubmitError({
          code: err.code,
          message: err.message,
          traceId: err.traceId,
        });
      } else {
        setSubmitError({
          message: 'Không thể lưu thông tin tài khoản lúc này. Vui lòng thử lại.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const usernameInputId = `${formIdPrefix}-username`;
  const fullNameInputId = `${formIdPrefix}-full-name`;
  const emailInputId = `${formIdPrefix}-email`;
  const phoneInputId = `${formIdPrefix}-phone`;
  const clearPhoneId = `${formIdPrefix}-clear-phone`;
  const roleInputId = `${formIdPrefix}-role`;

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      isBusy={isSubmitting}
      title={
        mode === 'create'
          ? 'Tạo tài khoản mới'
          : `Chỉnh sửa thông tin @${targetUser?.username ?? ''}`
      }
      description={
        mode === 'create'
          ? 'Cấp tài khoản Quản trị viên hoặc Giáo viên. Tài khoản sẽ hoạt động ngay sau khi tạo.'
          : 'Cập nhật họ tên, email, số điện thoại hoặc vai trò của người dùng.'
      }
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {isFetchingUser ? (
          <p role="status" className="text-xs text-text-secondary">
            Đang tải thông tin mới nhất của tài khoản...
          </p>
        ) : null}

        {submitError ? (
          <div
            role="alert"
            className="rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3 text-xs text-semantic-error"
          >
            <p className="font-semibold text-pretty">{submitError.message}</p>
            <TechnicalDetails code={submitError.code} traceId={submitError.traceId} />
          </div>
        ) : null}

        {/* Row 1: Username | Role */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor={usernameInputId}
              className="block text-sm font-medium text-text-primary"
            >
              Tên đăng nhập{' '}
              {mode === 'create' ? <span className="text-semantic-error">*</span> : null}
            </label>
            <Input
              id={usernameInputId}
              name="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (fieldErrors.username) {
                  setFieldErrors((prev) => ({ ...prev, username: undefined }));
                }
              }}
              disabled={mode === 'edit' || isSubmitting}
              readOnly={mode === 'edit'}
              maxLength={50}
              placeholder="Ví dụ: teacher_math01"
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby={fieldErrors.username ? `${usernameInputId}-error` : undefined}
              className={getFormInputClass(
                Boolean(fieldErrors.username),
                'disabled:font-mono'
              )}
            />
            {mode === 'edit' ? (
              <p className="text-[11px] text-text-secondary">
                Tên đăng nhập cố định sau khi tạo.
              </p>
            ) : null}
            {fieldErrors.username ? (
              <p
                id={`${usernameInputId}-error`}
                role="alert"
                className="text-xs font-medium text-semantic-error"
              >
                {fieldErrors.username}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={roleInputId}
              className="block text-sm font-medium text-text-primary"
            >
              Vai trò <span className="text-semantic-error">*</span>
            </label>
            {isTargetStudent ? (
              <div className="rounded-md border border-surface-border bg-surface-muted px-3 py-2 text-xs text-text-secondary">
                <strong className="font-semibold text-text-primary">
                  {ROLE_LABELS.STUDENT}
                </strong>{' '}
                — Gắn với danh sách dự thi, không đổi sang vai trò khác.
              </div>
            ) : (
              <>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as 'ADMIN' | 'TEACHER')}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id={roleInputId}
                    className="h-10 bg-surface-card text-sm text-text-primary shadow-sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    <SelectItem value="TEACHER">Giáo viên</SelectItem>
                    <SelectItem value="ADMIN">Quản trị viên</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-pretty text-text-secondary">
                  Sinh viên được thêm tự động khi nhập danh sách thí sinh vào kỳ thi.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Full Name | Email */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor={fullNameInputId}
              className="block text-sm font-medium text-text-primary"
            >
              Họ và tên <span className="text-semantic-error">*</span>
            </label>
            <Input
              id={fullNameInputId}
              name="full_name"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (fieldErrors.fullName) {
                  setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                }
              }}
              disabled={isSubmitting}
              maxLength={150}
              placeholder="Nhập họ và tên đầy đủ"
              aria-invalid={Boolean(fieldErrors.fullName)}
              aria-describedby={fieldErrors.fullName ? `${fullNameInputId}-error` : undefined}
              className={getFormInputClass(Boolean(fieldErrors.fullName))}
            />
            {fieldErrors.fullName ? (
              <p
                id={`${fullNameInputId}-error`}
                role="alert"
                className="text-xs font-medium text-semantic-error"
              >
                {fieldErrors.fullName}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={emailInputId}
              className="block text-sm font-medium text-text-primary"
            >
              Địa chỉ Email{' '}
              {mode === 'create' ? (
                <span className="text-semantic-error">*</span>
              ) : (
                <span className="text-xs font-normal text-text-secondary">
                  (để trống nếu giữ nguyên)
                </span>
              )}
            </label>
            <Input
              id={emailInputId}
              name="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              disabled={isSubmitting}
              maxLength={150}
              placeholder={
                mode === 'create'
                  ? 'Ví dụ: giaovien@olms.edu.vn'
                  : 'Nhập email mới nếu cần đổi'
              }
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? `${emailInputId}-error` : undefined}
              className={getFormInputClass(Boolean(fieldErrors.email))}
            />
            {fieldErrors.email ? (
              <p
                id={`${emailInputId}-error`}
                role="alert"
                className="text-xs font-medium text-semantic-error"
              >
                {fieldErrors.email}
              </p>
            ) : null}
          </div>
        </div>

        {/* Row 3 (Edit mode): Phone | Clear Phone */}
        {mode === 'edit' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
            <div className="space-y-1.5">
              <label
                htmlFor={phoneInputId}
                className="block text-sm font-medium text-text-primary"
              >
                Số điện thoại{' '}
                <span className="text-xs font-normal text-text-secondary">
                  (tùy chọn, 9-15 số)
                </span>
              </label>
              <Input
                id={phoneInputId}
                name="phone"
                type="tel"
                value={clearPhone ? '' : phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (fieldErrors.phone) {
                    setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                  }
                }}
                disabled={isSubmitting || clearPhone}
                placeholder="Ví dụ: +84912345678"
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? `${phoneInputId}-error` : undefined}
                className={getFormInputClass(Boolean(fieldErrors.phone))}
              />
              {fieldErrors.phone ? (
                <p
                  id={`${phoneInputId}-error`}
                  role="alert"
                  className="text-xs font-medium text-semantic-error"
                >
                  {fieldErrors.phone}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2 rounded-md border border-surface-border bg-surface-muted/50 p-3 sm:mt-7">
              <input
                id={clearPhoneId}
                type="checkbox"
                checked={clearPhone}
                onChange={(e) => {
                  setClearPhone(e.target.checked);
                  if (e.target.checked) {
                    setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                  }
                }}
                disabled={isSubmitting}
                className="size-4 rounded border-surface-border text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor={clearPhoneId} className="text-xs text-text-secondary">
                Xóa số điện thoại hiện có trên hồ sơ
              </label>
            </div>
          </div>
        ) : null}

        {/* Row 3 (Create mode): Password | Compact Password Rules */}
        {mode === 'create' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
            <div>
              <PasswordInput
                label="Mật khẩu khởi tạo *"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                disabled={isSubmitting}
                placeholder="Nhập mật khẩu khởi tạo"
                error={fieldErrors.password}
              />
            </div>
            <div className="sm:pt-1">
              <PasswordRequirements password={password} />
            </div>
          </div>
        ) : null}

        {/* Sticky Footer Action Bar */}
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
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                <span>
                  {mode === 'create'
                    ? 'Đang tạo tài khoản...'
                    : 'Đang lưu thay đổi...'}
                </span>
              </>
            ) : (
              <span>
                {mode === 'create' ? 'Tạo tài khoản' : 'Lưu thay đổi'}
              </span>
            )}
          </Button>
        </div>
      </form>
    </AccessibleModal>
  );
}
