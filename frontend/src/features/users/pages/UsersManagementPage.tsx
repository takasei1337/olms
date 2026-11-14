import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  RefreshCw,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ApiError } from '../../../api/client';
import { CopyButton } from '../../../components/ui/CopyButton';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { useAuth } from '../../auth/AuthContext';
import {
  ROLE_LABELS,
  STATUS_LABELS,
  type UserRole,
  type UserStatus,
} from '../../auth/types';
import {
  DeleteUserModal,
  ResetPasswordModal,
  UserStatusModal,
} from '../components/UserActionModals';
import { RoleBadge, StatusBadge } from '../components/UserBadges';
import { UserDetailModal } from '../components/UserDetailModal';
import { UserFormModal } from '../components/UserFormModal';
import { UserRowActionsMenu } from '../components/UserRowActionsMenu';
import type { UserRecord, UsersPaginationMeta } from '../types';
import { getUsersApi } from '../users.api';

interface FilterSelectOption {
  value: string;
  label: string;
}

const ROLE_FILTER_OPTIONS: readonly FilterSelectOption[] = [
  { value: 'ALL', label: 'Tất cả vai trò' },
  { value: 'ADMIN', label: 'Quản trị viên' },
  { value: 'TEACHER', label: 'Giáo viên' },
  { value: 'STUDENT', label: 'Sinh viên' },
];

const STATUS_FILTER_OPTIONS: readonly FilterSelectOption[] = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'LOCKED', label: 'Đã khóa' },
  { value: 'INACTIVE', label: 'Ngừng hoạt động' },
];

const PAGE_SIZE_OPTIONS: readonly FilterSelectOption[] = [
  { value: '10', label: '10 dòng' },
  { value: '20', label: '20 dòng' },
  { value: '50', label: '50 dòng' },
];

interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly FilterSelectOption[];
  className?: string;
}

function FilterSelect({
  id,
  label,
  value,
  onValueChange,
  options,
  className,
}: FilterSelectProps) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-medium text-text-primary"
      >
        {label}
      </label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          className="h-9 bg-surface-card text-sm text-text-primary shadow-sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function UsersManagementPage() {
  const { user: currentUser, updateCurrentUser } = useAuth();
  const filterIdPrefix = useId();

  // Filter & pagination states
  const [searchInput, setSearchInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [refreshTick, setRefreshTick] = useState(0);

  // Data states
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [meta, setMeta] = useState<UsersPaginationMeta>({
    page: 1,
    page_size: 20,
    total_items: 0,
    total_pages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<{
    code?: string;
    message: string;
    traceId?: string;
  } | null>(null);

  // Action feedback banner
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'info';
    message: string;
  } | null>(null);

  // Active modals
  const [detailUser, setDetailUser] = useState<UserRecord | null>(null);
  const [formState, setFormState] = useState<{
    mode: 'create' | 'edit' | null;
    user: UserRecord | null;
  }>({ mode: null, user: null });
  const [statusTargetUser, setStatusTargetUser] = useState<UserRecord | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserRecord | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserRecord | null>(null);

  // Monotonic request ID to prevent stale responses from overwriting newer filters/pages
  const latestRequestIdRef = useRef(0);

  // Debounce searchInput -> appliedQuery and reset page to 1 in one batched transition
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === appliedQuery) return;

    const timer = window.setTimeout(() => {
      setAppliedQuery(trimmed);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput, appliedQuery]);

  // Fetch users list
  useEffect(() => {
    const requestId = ++latestRequestIdRef.current;
    const controller = new AbortController();

    setIsLoading(true);
    setLoadError(null);

    getUsersApi(
      {
        q: appliedQuery,
        role: roleFilter,
        status: statusFilter,
        page,
        page_size: pageSize,
      },
      controller.signal
    )
      .then((res) => {
        if (requestId !== latestRequestIdRef.current) return;

        const fetchedUsers = res.data;
        const responseMeta: UsersPaginationMeta = res.meta ?? {
          page,
          page_size: pageSize,
          total_items: fetchedUsers.length,
          total_pages: fetchedUsers.length > 0 ? 1 : 0,
        };

        // Handle edge case where current page exceeds total_pages after external deletion
        if (
          fetchedUsers.length === 0 &&
          page > 1 &&
          responseMeta.total_pages > 0 &&
          page > responseMeta.total_pages
        ) {
          setPage(responseMeta.total_pages);
          return;
        }

        setUsers(fetchedUsers);
        setMeta(responseMeta);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (requestId !== latestRequestIdRef.current) return;

        if (err instanceof ApiError) {
          setLoadError({
            code: err.code,
            message: err.message,
            traceId: err.traceId,
          });
        } else {
          setLoadError({
            message: 'Không thể tải danh sách tài khoản. Vui lòng thử lại.',
          });
        }
      })
      .finally(() => {
        if (requestId === latestRequestIdRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [appliedQuery, roleFilter, statusFilter, page, pageSize, refreshTick]);

  const handleImmediateSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed !== appliedQuery) {
      setAppliedQuery(trimmed);
      setPage(1);
    } else {
      setRefreshTick((t) => t + 1);
    }
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setAppliedQuery('');
    setRoleFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    searchInput.trim() || appliedQuery || roleFilter || statusFilter
  );

  const handleUserLoadedFromDetail = useCallback((freshUser: UserRecord) => {
    setUsers((prev) =>
      prev.map((item) => (item.id === freshUser.id ? { ...item, ...freshUser } : item))
    );
  }, []);

  const currentUserId = currentUser?.id ?? '';
  const totalPages = Math.max(1, meta.total_pages);
  const startIndex =
    meta.total_items === 0 ? 0 : (meta.page - 1) * meta.page_size + 1;
  const endIndex =
    meta.total_items === 0
      ? 0
      : Math.min(meta.total_items, startIndex + users.length - 1);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 border-b border-surface-border pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-balance text-text-primary sm:text-2xl">
            Quản lý tài khoản người dùng
          </h1>
          <p className="mt-1 text-sm text-pretty text-text-secondary">
            Tra cứu người dùng, tạo tài khoản Quản trị viên hoặc Giáo viên, khóa mở tài khoản và đặt lại mật khẩu.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRefreshTick((t) => t + 1)}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn(
                'size-3.5 text-text-secondary',
                isLoading && 'animate-spin'
              )}
            />
            <span>Làm mới</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              setFeedbackBanner(null);
              setFormState({ mode: 'create', user: null });
            }}
            className="h-9 gap-1.5 font-semibold text-xs"
          >
            <UserPlus aria-hidden="true" className="size-3.5" />
            <span>Tạo tài khoản</span>
          </Button>
        </div>
      </div>

      {feedbackBanner ? (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-md border border-semantic-success/30 bg-semantic-success-bg p-3.5 text-xs text-semantic-success"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p className="font-medium text-pretty">{feedbackBanner.message}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFeedbackBanner(null)}
            aria-label="Đóng thông báo"
            className="h-6 shrink-0 px-2 text-xs underline"
          >
            Đóng
          </Button>
        </div>
      ) : null}

      {/* Filter Bar */}
      <section aria-label="Bộ lọc và tìm kiếm tài khoản">
        <Card className="border-surface-border bg-surface-card shadow-sm">
          <CardContent className="p-4">
            <form
              onSubmit={handleImmediateSearchSubmit}
              className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-12"
            >
              <div className="sm:col-span-3 lg:col-span-5">
                <label
                  htmlFor={`${filterIdPrefix}-q`}
                  className="mb-1 block text-xs font-medium text-text-primary"
                >
                  Tìm kiếm theo tên đăng nhập hoặc họ tên
                </label>
                <div className="relative flex items-center">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 size-3.5 text-text-secondary"
                  />
                  <Input
                    id={`${filterIdPrefix}-q`}
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Nhập tên đăng nhập hoặc họ tên..."
                    className="h-9 bg-surface-card pl-8 text-sm text-text-primary placeholder:text-text-secondary"
                  />
                </div>
              </div>

              <FilterSelect
                id={`${filterIdPrefix}-role`}
                label="Vai trò"
                value={roleFilter || 'ALL'}
                onValueChange={(value) => {
                  setRoleFilter(value === 'ALL' ? '' : (value as UserRole));
                  setPage(1);
                }}
                options={ROLE_FILTER_OPTIONS}
                className="sm:col-span-1 lg:col-span-3"
              />

              <FilterSelect
                id={`${filterIdPrefix}-status`}
                label="Trạng thái"
                value={statusFilter || 'ALL'}
                onValueChange={(value) => {
                  setStatusFilter(value === 'ALL' ? '' : (value as UserStatus));
                  setPage(1);
                }}
                options={STATUS_FILTER_OPTIONS}
                className="sm:col-span-1 lg:col-span-2"
              />

              <FilterSelect
                id={`${filterIdPrefix}-page-size`}
                label="Số dòng / trang"
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
                options={PAGE_SIZE_OPTIONS}
                className="sm:col-span-1 lg:col-span-2"
              />
            </form>

            {hasActiveFilters ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-surface-border pt-3 text-xs text-text-secondary">
                <div className="flex flex-wrap items-center gap-2">
                  <span>Đang lọc:</span>
                  {appliedQuery ? (
                    <span className="rounded border border-surface-border bg-surface-muted px-2 py-0.5 font-medium text-text-primary">
                      Từ khóa: &ldquo;{appliedQuery}&rdquo;
                    </span>
                  ) : null}
                  {roleFilter ? (
                    <span className="rounded border border-surface-border bg-surface-muted px-2 py-0.5 font-medium text-text-primary">
                      Vai trò: {ROLE_LABELS[roleFilter]}
                    </span>
                  ) : null}
                  {statusFilter ? (
                    <span className="rounded border border-surface-border bg-surface-muted px-2 py-0.5 font-medium text-text-primary">
                      Trạng thái: {STATUS_LABELS[statusFilter]}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="font-medium text-brand-600 underline hover:text-brand-700 dark:text-brand-200 dark:hover:text-brand-100"
                >
                  Xóa toàn bộ bộ lọc
                </button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* Error State */}
      {loadError ? (
        <section
          role="alert"
          className="rounded-lg border border-semantic-error/30 bg-semantic-error-bg p-5 text-sm text-semantic-error"
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold text-pretty">
                Không thể tải danh sách tài khoản: {loadError.message}
              </p>
              <TechnicalDetails code={loadError.code} traceId={loadError.traceId} />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRefreshTick((t) => t + 1)}
              className="h-8 shrink-0 border-semantic-error/40 bg-surface-card text-xs font-semibold text-semantic-error hover:bg-semantic-error-bg hover:text-semantic-error"
            >
              Thử lại
            </Button>
          </div>
        </section>
      ) : null}

      {/* Main List Section */}
      <section aria-label="Danh sách tài khoản" aria-busy={isLoading}>
        <Card className="overflow-hidden border-surface-border bg-surface-card shadow-sm">
          {isLoading && users.length === 0 ? (
            <div role="status" className="p-5">
              <p className="mb-3 text-xs font-medium text-text-secondary">
                Đang tải danh sách tài khoản...
              </p>
              <div className="divide-y divide-surface-border rounded-md border border-surface-border">
                {[1, 2, 3, 4, 5].map((row) => (
                  <div
                    key={row}
                    className="grid grid-cols-12 items-center gap-4 px-4 py-3.5"
                  >
                    <Skeleton className="col-span-4 h-4 bg-surface-muted" />
                    <Skeleton className="col-span-3 h-4 bg-surface-muted" />
                    <Skeleton className="col-span-2 h-5 w-20 bg-surface-muted" />
                    <Skeleton className="col-span-1 h-5 w-20 bg-surface-muted" />
                    <div className="col-span-2 flex justify-end gap-2">
                      <Skeleton className="h-7 w-20 bg-surface-muted" />
                      <Skeleton className="h-7 w-16 bg-surface-muted" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !loadError && users.length === 0 ? (
            <div className="p-8 text-center">
              <Users aria-hidden="true" className="mx-auto mb-3 size-8 text-text-secondary/60" />
              <h2 className="text-base font-semibold text-balance text-text-primary">
                {hasActiveFilters
                  ? 'Không tìm thấy tài khoản phù hợp với bộ lọc'
                  : 'Chưa có tài khoản nào trong danh sách'}
              </h2>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-pretty text-text-secondary">
                {hasActiveFilters
                  ? 'Hãy thử đổi từ khóa tìm kiếm, chọn lại vai trò/trạng thái hoặc xóa bộ lọc để xem toàn bộ danh sách.'
                  : 'Bắt đầu bằng cách tạo tài khoản Quản trị viên hoặc Giáo viên mới.'}
              </p>
              <div className="mt-4">
                {hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetFilters}
                    className="h-8 text-xs font-medium"
                  >
                    Xóa bộ lọc tìm kiếm
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setFormState({ mode: 'create', user: null })}
                    className="h-8 gap-1.5 text-xs font-semibold"
                  >
                    <UserPlus aria-hidden="true" className="size-3.5" />
                    <span>Tạo tài khoản</span>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div
                role="region"
                aria-label="Bảng dữ liệu tài khoản người dùng"
                tabIndex={0}
                className="overflow-x-auto focus:outline-none"
              >
                <table
                  role="table"
                  className="block w-full border-collapse text-left text-sm lg:table"
                >
                  <thead
                    role="rowgroup"
                    className="sr-only lg:not-sr-only lg:table-header-group"
                  >
                    <tr
                      role="row"
                      className="border-b border-surface-border bg-surface-muted/70 text-xs font-semibold text-text-secondary lg:table-row"
                    >
                      <th role="columnheader" scope="col" className="px-4 py-3">
                        Họ và tên
                      </th>
                      <th role="columnheader" scope="col" className="px-4 py-3">
                        Tên đăng nhập
                      </th>
                      <th role="columnheader" scope="col" className="px-4 py-3">
                        Vai trò
                      </th>
                      <th role="columnheader" scope="col" className="px-4 py-3">
                        Trạng thái
                      </th>
                      <th role="columnheader" scope="col" className="px-4 py-3 text-right">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    role="rowgroup"
                    className="block divide-y divide-surface-border lg:table-row-group"
                  >
                    {users.map((row) => {
                      const isSelf = row.id === currentUserId;

                      return (
                        <tr
                          key={row.id}
                          role="row"
                          className="grid grid-cols-2 gap-x-3 gap-y-2.5 p-4 transition-colors duration-fast hover:bg-surface-muted/40 sm:grid-cols-12 sm:items-center sm:gap-x-4 sm:gap-y-3 sm:px-5 sm:py-4 lg:table-row lg:p-0"
                        >
                          <td
                            role="cell"
                            className="col-span-2 sm:col-span-6 lg:table-cell lg:w-[28%] lg:max-w-[300px] lg:px-4 lg:py-3.5 lg:align-middle"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="break-words font-semibold text-text-primary">
                                {row.full_name}
                              </span>
                              {isSelf ? (
                                <span className="inline-flex items-center rounded border border-brand-500/30 bg-semantic-info-bg px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:text-brand-200">
                                  Bạn
                                </span>
                              ) : null}
                            </div>
                            {row.email ? (
                              <p
                                className="mt-0.5 truncate text-xs text-text-secondary"
                                title={row.email}
                              >
                                {row.email}
                              </p>
                            ) : null}
                          </td>

                          <td
                            role="cell"
                            className="col-span-2 sm:col-span-6 sm:text-right lg:table-cell lg:w-[24%] lg:max-w-[260px] lg:px-4 lg:py-3.5 lg:text-left lg:align-middle"
                          >
                            <div className="flex items-center justify-between gap-2 sm:justify-end lg:justify-start">
                              <span
                                className="max-w-[180px] truncate font-mono text-xs font-medium text-text-primary sm:max-w-[200px]"
                                title={`@${row.username}`}
                              >
                                @{row.username}
                              </span>
                              <CopyButton
                                value={row.username}
                                ariaLabel={`Sao chép tên đăng nhập ${row.username}`}
                              />
                            </div>
                          </td>

                          <td
                            role="cell"
                            className="col-span-1 sm:col-span-6 lg:table-cell lg:w-[14%] lg:whitespace-nowrap lg:px-4 lg:py-3.5 lg:align-middle"
                          >
                            <span
                              aria-hidden="true"
                              className="mb-1 block text-[11px] text-text-secondary sm:mb-0 sm:mr-1.5 sm:inline sm:text-xs lg:hidden"
                            >
                              Vai trò:
                            </span>
                            <RoleBadge role={row.role} />
                          </td>

                          <td
                            role="cell"
                            className="col-span-1 text-right sm:col-span-6 lg:table-cell lg:w-[14%] lg:whitespace-nowrap lg:px-4 lg:py-3.5 lg:text-left lg:align-middle"
                          >
                            <span
                              aria-hidden="true"
                              className="mb-1 block text-[11px] text-text-secondary sm:mb-0 sm:mr-1.5 sm:inline sm:text-xs lg:hidden"
                            >
                              Trạng thái:
                            </span>
                            <StatusBadge status={row.status} />
                          </td>

                          <td
                            role="cell"
                            className="col-span-2 mt-1 border-t border-surface-border pt-3 sm:col-span-12 lg:mt-0 lg:table-cell lg:w-[20%] lg:whitespace-nowrap lg:border-t-0 lg:px-4 lg:py-3.5 lg:text-right lg:align-middle"
                          >
                            <div className="flex items-center justify-end gap-2 lg:inline-flex">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setDetailUser(row)}
                                aria-label={`Xem chi tiết tài khoản ${row.username}`}
                                className="h-8 gap-1.5 px-2.5 text-xs font-medium"
                              >
                                <Eye aria-hidden="true" className="size-3.5 text-text-secondary" />
                                <span>Xem chi tiết</span>
                              </Button>

                              <UserRowActionsMenu
                                user={row}
                                currentUserId={currentUserId}
                                onEdit={(u) => setFormState({ mode: 'edit', user: u })}
                                onToggleStatus={(u) => setStatusTargetUser(u)}
                                onResetPassword={(u) => setResetPasswordUser(u)}
                                onDelete={(u) => setDeleteTargetUser(u)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="flex flex-col items-start justify-between gap-3 border-t border-surface-border bg-surface-muted/30 px-4 py-3 text-xs text-text-secondary sm:flex-row sm:items-center">
                <div className="tabular-nums">
                  Hiển thị{' '}
                  <strong className="font-semibold text-text-primary">
                    {startIndex}-{endIndex}
                  </strong>{' '}
                  trên{' '}
                  <strong className="font-semibold text-text-primary">
                    {meta.total_items}
                  </strong>{' '}
                  tài khoản (Trang{' '}
                  <strong className="font-semibold text-text-primary">
                    {meta.page}
                  </strong>{' '}
                  / {totalPages})
                  {isLoading ? (
                    <span className="ml-2 text-brand-600 dark:text-brand-200">
                      · Đang cập nhật...
                    </span>
                  ) : null}
                </div>

                <nav
                  aria-label="Phân trang danh sách tài khoản"
                  className="flex w-full items-center justify-between gap-1.5 sm:w-auto sm:justify-end"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(1)}
                    disabled={page <= 1 || isLoading}
                    aria-label="Trang đầu"
                    className="h-8 w-8 p-0"
                  >
                    <ChevronsLeft className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || isLoading}
                    aria-label="Trang trước"
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="px-2 font-mono text-xs font-semibold tabular-nums text-text-primary">
                    {page} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || isLoading}
                    aria-label="Trang sau"
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages || isLoading}
                    aria-label="Trang cuối"
                    className="h-8 w-8 p-0"
                  >
                    <ChevronsRight className="size-4" />
                  </Button>
                </nav>
              </div>
            </>
          )}
        </Card>
      </section>

      {/* Modals */}
      <UserDetailModal
        user={detailUser}
        currentUserId={currentUserId}
        onClose={() => setDetailUser(null)}
        onUserLoaded={handleUserLoadedFromDetail}
        onEdit={(u) => {
          setDetailUser(null);
          setFormState({ mode: 'edit', user: u });
        }}
        onToggleStatus={(u) => {
          setDetailUser(null);
          setStatusTargetUser(u);
        }}
        onResetPassword={(u) => {
          setDetailUser(null);
          setResetPasswordUser(u);
        }}
        onDelete={(u) => {
          setDetailUser(null);
          setDeleteTargetUser(u);
        }}
      />

      <UserFormModal
        mode={formState.mode}
        targetUser={formState.user}
        onClose={() => setFormState({ mode: null, user: null })}
        onSuccess={(savedUser, completedMode) => {
          setFormState({ mode: null, user: null });
          if (completedMode === 'create') {
            setFeedbackBanner({
              type: 'success',
              message: `Đã tạo tài khoản @${savedUser.username} (${savedUser.full_name}).`,
            });
          } else {
            setFeedbackBanner({
              type: 'success',
              message: `Đã lưu thay đổi cho tài khoản @${savedUser.username}.`,
            });
            if (savedUser.id === currentUserId) {
              updateCurrentUser({
                full_name: savedUser.full_name,
                role: savedUser.role,
                status: savedUser.status,
              });
            }
          }
          setUsers((prev) =>
            prev.map((item) =>
              item.id === savedUser.id ? { ...item, ...savedUser } : item
            )
          );
          setRefreshTick((t) => t + 1);
        }}
      />

      <UserStatusModal
        user={statusTargetUser}
        currentUserId={currentUserId}
        onClose={() => setStatusTargetUser(null)}
        onSuccess={(updatedUser, nextStatus) => {
          setStatusTargetUser(null);
          setFeedbackBanner({
            type: 'success',
            message:
              nextStatus === 'LOCKED'
                ? `Đã khóa tài khoản @${updatedUser.username}.`
                : `Đã mở khóa tài khoản @${updatedUser.username}.`,
          });
          setUsers((prev) =>
            prev.map((item) =>
              item.id === updatedUser.id ? { ...item, ...updatedUser } : item
            )
          );
          setRefreshTick((t) => t + 1);
        }}
      />

      <ResetPasswordModal
        user={resetPasswordUser}
        onClose={() => setResetPasswordUser(null)}
        onSuccess={(target) => {
          setResetPasswordUser(null);
          setFeedbackBanner({
            type: 'success',
            message: `Đã đặt lại mật khẩu cho tài khoản @${target.username}.`,
          });
        }}
      />

      <DeleteUserModal
        user={deleteTargetUser}
        currentUserId={currentUserId}
        onClose={() => setDeleteTargetUser(null)}
        onSuccess={(deletedUser) => {
          setDeleteTargetUser(null);
          if (detailUser?.id === deletedUser.id) {
            setDetailUser(null);
          }
          setFeedbackBanner({
            type: 'success',
            message: `Đã xóa tài khoản @${deletedUser.username} (${deletedUser.full_name}).`,
          });

          // Handle deleting the last item on a page > 1
          if (users.length <= 1 && page > 1) {
            setPage((prev) => Math.max(1, prev - 1));
          } else {
            setRefreshTick((t) => t + 1);
          }
        }}
      />
    </div>
  );
}
