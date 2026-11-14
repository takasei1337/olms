import {
  Copy,
  Eye,
  History,
  MoreHorizontal,
  Pencil,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { QuestionRecord } from '../types';

interface QuestionRowActionsMenuProps {
  question: QuestionRecord;
  currentUserId: string;
  currentUserRole: string;
  onView: (question: QuestionRecord) => void;
  onEdit: (question: QuestionRecord) => void;
  onClone: (question: QuestionRecord) => void;
  onStatusChange: (question: QuestionRecord) => void;
  onVersions: (question: QuestionRecord) => void;
  onDelete: (question: QuestionRecord) => void;
}

export function QuestionRowActionsMenu({
  question,
  currentUserId,
  currentUserRole,
  onView,
  onEdit,
  onClone,
  onStatusChange,
  onVersions,
  onDelete,
}: QuestionRowActionsMenuProps) {
  const isOwnerOrAdmin =
    currentUserRole === 'ADMIN' || question.created_by === currentUserId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Thao tác cho câu hỏi ${question.id.slice(0, 8)}`}
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
        className="w-56 border-surface-border bg-surface-card p-1.5 text-xs text-text-primary shadow-md"
      >
        <div className="border-b border-surface-border px-2.5 py-1.5">
          <p className="truncate font-mono text-[11px] text-text-secondary">
            ID: {question.id.slice(0, 8)}...
          </p>
          <p className="truncate font-medium text-text-primary">
            v{question.current_version_no} • {question.status}
          </p>
        </div>

        <div className="py-1">
          <DropdownMenuItem
            onSelect={() => onView(question)}
            className="cursor-pointer gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-text-primary focus:bg-surface-muted focus:text-text-primary"
          >
            <Eye aria-hidden="true" className="size-3.5 shrink-0 text-text-secondary" />
            <span>Xem chi tiết</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={!isOwnerOrAdmin}
            onSelect={() => {
              if (isOwnerOrAdmin) onEdit(question);
            }}
            className="cursor-pointer gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-text-primary focus:bg-surface-muted focus:text-text-primary disabled:opacity-50"
          >
            <Pencil aria-hidden="true" className="size-3.5 shrink-0 text-text-secondary" />
            <span>Chỉnh sửa</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => onClone(question)}
            className="cursor-pointer gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-text-primary focus:bg-surface-muted focus:text-text-primary"
          >
            <Copy aria-hidden="true" className="size-3.5 shrink-0 text-text-secondary" />
            <span>Nhân bản</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={!isOwnerOrAdmin}
            onSelect={() => {
              if (isOwnerOrAdmin) onStatusChange(question);
            }}
            className="cursor-pointer gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-text-primary focus:bg-surface-muted focus:text-text-primary disabled:opacity-50"
          >
            <SlidersHorizontal aria-hidden="true" className="size-3.5 shrink-0 text-text-secondary" />
            <span>Đổi trạng thái</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => onVersions(question)}
            className="cursor-pointer gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-text-primary focus:bg-surface-muted focus:text-text-primary"
          >
            <History aria-hidden="true" className="size-3.5 shrink-0 text-text-secondary" />
            <span>Lịch sử phiên bản</span>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator className="my-1 bg-surface-border" />

        <DropdownMenuItem
          disabled={!isOwnerOrAdmin}
          onSelect={() => {
            if (isOwnerOrAdmin) onDelete(question);
          }}
          className="cursor-pointer gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-semantic-danger focus:bg-semantic-danger/10 focus:text-semantic-danger disabled:opacity-50"
        >
          <Trash2 aria-hidden="true" className="size-3.5 shrink-0 text-semantic-danger" />
          <span>Xóa câu hỏi</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
