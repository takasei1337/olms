import { KeyRound, Lock, MoreHorizontal, Pencil, Trash2, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UserRecord } from '../types';

interface UserRowActionsMenuProps {
  user: UserRecord;
  currentUserId: string;
  onEdit: (user: UserRecord) => void;
  onToggleStatus: (user: UserRecord) => void;
  onResetPassword: (user: UserRecord) => void;
  onDelete: (user: UserRecord) => void;
}

export function UserRowActionsMenu({
  user,
  currentUserId,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onDelete,
}: UserRowActionsMenuProps) {
  const isSelf = user.id === currentUserId;
  const isSelfLockBlocked = isSelf && user.status === 'ACTIVE';
  const isLockedOrInactive = user.status !== 'ACTIVE';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Thao tác cho tài khoản ${user.username}`}
          className="h-8 gap-1 px-2.5 text-xs font-medium data-[state=open]:bg-accent"
        >
          <span>Thao tác</span>
          <MoreHorizontal aria-hidden="true" className="size-3.5 text-text-secondary" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        collisionPadding={12}
        className="w-60 border-surface-border bg-surface-card p-1.5 text-xs text-text-primary shadow-md"
      >
        <div className="border-b border-surface-border px-2.5 py-1.5">
          <p className="truncate font-semibold text-text-primary" title={user.full_name}>
            {user.full_name}
          </p>
          <p className="truncate font-mono text-[11px] text-text-secondary" title={user.username}>
            @{user.username}
          </p>
        </div>

        <div className="py-1">
          <DropdownMenuItem
            onSelect={() => onEdit(user)}
            className="cursor-pointer gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-text-primary focus:bg-surface-muted focus:text-text-primary"
          >
            <Pencil aria-hidden="true" className="size-3.5 shrink-0 text-text-secondary" />
            <span>Chỉnh sửa thông tin</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={isSelfLockBlocked}
            onSelect={() => {
              if (!isSelfLockBlocked) {
                onToggleStatus(user);
              }
            }}
            className="cursor-pointer flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-xs focus:bg-surface-muted focus:text-text-primary"
          >
            <div className="flex items-center gap-2 font-medium text-text-primary">
              {isLockedOrInactive ? (
                <Unlock aria-hidden="true" className="size-3.5 shrink-0 text-text-secondary" />
              ) : (
                <Lock aria-hidden="true" className="size-3.5 shrink-0 text-text-secondary" />
              )}
              <span>
                {user.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
              </span>
            </div>
            {isSelfLockBlocked ? (
              <span className="pl-5 text-[11px] text-text-secondary">
                Không thể tự khóa tài khoản đang đăng nhập
              </span>
            ) : null}
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => onResetPassword(user)}
            className="cursor-pointer gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-text-primary focus:bg-surface-muted focus:text-text-primary"
          >
            <KeyRound aria-hidden="true" className="size-3.5 shrink-0 text-text-secondary" />
            <span>Đặt lại mật khẩu</span>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator className="my-1 bg-surface-border" />

        <DropdownMenuItem
          disabled={isSelf}
          onSelect={() => {
            if (!isSelf) {
              onDelete(user);
            }
          }}
          className="cursor-pointer flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-xs text-semantic-error focus:bg-semantic-error-bg focus:text-semantic-error"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Trash2 aria-hidden="true" className="size-3.5 shrink-0" />
            <span>Xóa tài khoản</span>
          </div>
          {isSelf ? (
            <span className="pl-5 text-[11px] font-normal text-text-secondary">
              Không thể tự xóa tài khoản đang đăng nhập
            </span>
          ) : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
