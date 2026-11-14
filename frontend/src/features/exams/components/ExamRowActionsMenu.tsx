import {
  Archive,
  Ban,
  FileEdit,
  FolderOpen,
  Globe,
  MoreHorizontal,
  PlayCircle,
  Trash2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CANCELLABLE_EXAM_STATUSES,
  type ExamRecord,
} from '../types';
import type { ExamLifecycleActionType } from './ExamLifecycleModal';

interface ExamRowActionsMenuProps {
  exam: ExamRecord;
  currentUserId: string;
  currentUserRole: string;
  onOpenDetail: (exam: ExamRecord) => void;
  onOpenParticipants: (exam: ExamRecord) => void;
  onEditDraft: (exam: ExamRecord) => void;
  onLifecycleAction: (exam: ExamRecord, action: ExamLifecycleActionType) => void;
}

export function ExamRowActionsMenu({
  exam,
  currentUserId,
  currentUserRole,
  onOpenDetail,
  onOpenParticipants,
  onEditDraft,
  onLifecycleAction,
}: ExamRowActionsMenuProps) {
  const canManage =
    currentUserRole === 'ADMIN' || exam.created_by === currentUserId;
  const isDraft = exam.status === 'DRAFT';
  const canPublish = canManage && exam.status === 'GENERATED';
  const canStart = canManage && exam.status === 'PUBLISHED';
  const canArchive = canManage && exam.status === 'RESULT_PUBLISHED';
  const canCancel =
    canManage && CANCELLABLE_EXAM_STATUSES.includes(exam.status);
  const canDelete = canManage && isDraft;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Thao tác cho kỳ thi ${exam.name}`}
          className="h-7 w-7 p-0"
        >
          <MoreHorizontal aria-hidden="true" className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 text-xs">
        <DropdownMenuItem
          onSelect={() => onOpenDetail(exam)}
          className="cursor-pointer text-xs"
        >
          <FolderOpen aria-hidden="true" className="size-3.5 text-text-secondary" />
          <span>Chi tiết ma trận &amp; đề thi</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onOpenParticipants(exam)}
          className="cursor-pointer text-xs"
        >
          <Users aria-hidden="true" className="size-3.5 text-text-secondary" />
          <span>Quản lý thí sinh</span>
        </DropdownMenuItem>

        {canManage && isDraft ? (
          <DropdownMenuItem
            onSelect={() => onEditDraft(exam)}
            className="cursor-pointer text-xs"
          >
            <FileEdit aria-hidden="true" className="size-3.5 text-text-secondary" />
            <span>Sửa thông tin kỳ thi</span>
          </DropdownMenuItem>
        ) : null}

        {canPublish ? (
          <DropdownMenuItem
            onSelect={() => onLifecycleAction(exam, 'publish')}
            className="cursor-pointer text-xs text-semantic-success focus:text-semantic-success"
          >
            <Globe aria-hidden="true" className="size-3.5" />
            <span>Phát hành kỳ thi</span>
          </DropdownMenuItem>
        ) : null}

        {canStart ? (
          <DropdownMenuItem
            onSelect={() => onLifecycleAction(exam, 'start')}
            className="cursor-pointer text-xs text-brand-600 focus:text-brand-600 dark:text-brand-300"
          >
            <PlayCircle aria-hidden="true" className="size-3.5" />
            <span>Bắt đầu kỳ thi</span>
          </DropdownMenuItem>
        ) : null}

        {canArchive ? (
          <DropdownMenuItem
            onSelect={() => onLifecycleAction(exam, 'archive')}
            className="cursor-pointer text-xs"
          >
            <Archive aria-hidden="true" className="size-3.5 text-text-secondary" />
            <span>Lưu trữ kỳ thi</span>
          </DropdownMenuItem>
        ) : null}

        {canCancel || canDelete ? (
          <>
            <DropdownMenuSeparator />
            {canCancel ? (
              <DropdownMenuItem
                onSelect={() => onLifecycleAction(exam, 'cancel')}
                className="cursor-pointer text-xs text-semantic-danger focus:text-semantic-danger"
              >
                <Ban aria-hidden="true" className="size-3.5" />
                <span>Hủy kỳ thi</span>
              </DropdownMenuItem>
            ) : null}
            {canDelete ? (
              <DropdownMenuItem
                onSelect={() => onLifecycleAction(exam, 'delete')}
                className="cursor-pointer text-xs text-semantic-danger focus:text-semantic-danger"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
                <span>Xóa kỳ thi nháp</span>
              </DropdownMenuItem>
            ) : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
