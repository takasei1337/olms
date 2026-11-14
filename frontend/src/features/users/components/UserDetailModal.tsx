import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from '../../../api/client';
import { CopyButton } from '../../../components/ui/CopyButton';
import type { UserRecord } from '../types';
import { getUserByIdApi } from '../users.api';
import { AccessibleModal } from './AccessibleModal';
import { RoleBadge, StatusBadge } from './UserBadges';

interface UserDetailModalProps {
  user: UserRecord | null;
  currentUserId: string;
  onClose: () => void;
  onEdit: (user: UserRecord) => void;
  onToggleStatus: (user: UserRecord) => void;
  onResetPassword: (user: UserRecord) => void;
  onDelete: (user: UserRecord) => void;
  onUserLoaded?: (freshUser: UserRecord) => void;
}

export function UserDetailModal({
  user,
  currentUserId,
  onClose,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onDelete,
  onUserLoaded,
}: UserDetailModalProps) {
  const [detail, setDetail] = useState<UserRecord | null>(user);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(
    async (targetId: string, signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getUserByIdApi(targetId, signal);
        setDetail(res.data);
        onUserLoaded?.(res.data);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Không thể tải thông tin chi tiết tài khoản.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [onUserLoaded]
  );

  useEffect(() => {
    if (!user) {
      setDetail(null);
      setError(null);
      return;
    }

    setDetail(user);
    const controller = new AbortController();
    loadDetail(user.id, controller.signal);

    return () => {
      controller.abort();
    };
  }, [user, loadDetail]);

  if (!user) {
    return null;
  }

  const activeUser = detail || user;
  const isSelf = activeUser.id === currentUserId;
  const isSelfLockBlocked = isSelf && activeUser.status === 'ACTIVE';

  return (
    <AccessibleModal
      isOpen={Boolean(user)}
      onClose={onClose}
      title="Chi tiết tài khoản"
      description={`Thông tin hồ sơ và trạng thái của @${activeUser.username}`}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-4">
        {isLoading ? (
          <p role="status" className="text-xs text-text-secondary">
            Đang tải thông tin mới nhất...
          </p>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3 text-xs text-semantic-error"
          >
            <span>{error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadDetail(user.id)}
              className="h-7 border-semantic-error/40 bg-surface-card text-xs font-medium text-semantic-error hover:bg-semantic-error-bg hover:text-semantic-error"
            >
              Thử lại
            </Button>
          </div>
        ) : null}

        <dl className="grid grid-cols-1 gap-3.5 rounded-md border border-surface-border bg-surface-muted/40 p-4 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-text-secondary">Họ và tên</dt>
            <dd className="mt-1 break-words font-semibold text-text-primary">
              {activeUser.full_name}
              {isSelf ? (
                <span className="ml-2 rounded border border-brand-500/30 bg-semantic-info-bg px-1.5 py-0.5 text-[11px] font-medium text-brand-700 dark:text-brand-200">
                  Tài khoản của bạn
                </span>
              ) : null}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-text-secondary">Tên đăng nhập</dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="break-all font-mono text-sm text-text-primary">
                @{activeUser.username}
              </span>
              <CopyButton
                value={activeUser.username}
                ariaLabel={`Sao chép tên đăng nhập ${activeUser.username}`}
              />
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-text-secondary">Vai trò</dt>
            <dd className="mt-1">
              <RoleBadge role={activeUser.role} />
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-text-secondary">Trạng thái</dt>
            <dd className="mt-1">
              <StatusBadge status={activeUser.status} />
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-text-secondary">Địa chỉ Email</dt>
            <dd className="mt-1 break-all text-xs text-text-primary">
              {activeUser.email ? (
                activeUser.email
              ) : (
                <span className="text-text-secondary">
                  Chưa hiển thị (bấm Chỉnh sửa thông tin để cập nhật)
                </span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-medium text-text-secondary">Số điện thoại</dt>
            <dd className="mt-1 font-mono text-xs text-text-primary">
              {activeUser.phone ? (
                activeUser.phone
              ) : (
                <span className="font-sans text-text-secondary">Chưa cập nhật</span>
              )}
            </dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-text-secondary">Mã tài khoản (UUID)</dt>
            <dd className="mt-1 flex items-center justify-between gap-2">
              <span className="break-all font-mono text-xs text-text-secondary">
                {activeUser.id}
              </span>
              <CopyButton
                value={activeUser.id}
                ariaLabel="Sao chép mã tài khoản"
                visibleLabel="Sao chép"
              />
            </dd>
          </div>
        </dl>

        {isSelf ? (
          <p className="rounded-md border border-surface-border bg-surface-muted p-3 text-xs text-pretty text-text-secondary">
            Đây là tài khoản bạn đang dùng để đăng nhập. Tính năng khóa và xóa tài khoản được tắt để tránh mất quyền quản trị.
          </p>
        ) : null}

        <div className="sticky -bottom-4 -mx-5 -mb-4 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-surface-border bg-surface-card px-5 py-3.5 sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEdit(activeUser)}
              className="h-8 text-xs font-medium"
            >
              Chỉnh sửa thông tin
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onToggleStatus(activeUser)}
              disabled={isSelfLockBlocked}
              title={
                isSelfLockBlocked
                  ? 'Không thể tự khóa tài khoản đang đăng nhập'
                  : undefined
              }
              className="h-8 text-xs font-medium"
            >
              {activeUser.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onResetPassword(activeUser)}
              className="h-8 text-xs font-medium"
            >
              Đặt lại mật khẩu
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onDelete(activeUser)}
              disabled={isSelf}
              title={
                isSelf ? 'Không thể tự xóa tài khoản đang đăng nhập' : undefined
              }
              className="h-8 border-semantic-error/30 bg-semantic-error-bg text-xs font-medium text-semantic-error hover:bg-semantic-error/15 hover:text-semantic-error"
            >
              Xóa tài khoản
            </Button>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className="ml-auto h-8 text-xs font-semibold"
          >
            Đóng
          </Button>
        </div>
      </div>
    </AccessibleModal>
  );
}
