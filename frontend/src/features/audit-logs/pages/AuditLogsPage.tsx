import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import {
  Filter,
  History,
  Info,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '../../../api/client';
import { CopyButton } from '../../../components/ui/CopyButton';
import { PaginationFooter } from '../../../components/ui/PaginationFooter';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { getAuditLogsApi } from '../audit-logs.api';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_OPTIONS,
  AUDIT_ENTITY_LABELS,
  AUDIT_ENTITY_OPTIONS,
  type AuditLogRecord,
  type AuditLogsPaginationMeta,
} from '../types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALL_VALUE = '__ALL__';

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}

function shortUuid(value: string): string {
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export function AuditLogsPage() {
  const actorInputId = useId();
  const entitySelectId = useId();
  const actionSelectId = useId();
  const fromDateId = useId();
  const toDateId = useId();

  // Draft form state vs committed query filters
  const [draftEntityName, setDraftEntityName] = useState<string>(ALL_VALUE);
  const [draftAction, setDraftAction] = useState<string>(ALL_VALUE);
  const [draftActorUserId, setDraftActorUserId] = useState<string>('');
  const [draftFromDate, setDraftFromDate] = useState<string>('');
  const [draftToDate, setDraftToDate] = useState<string>('');

  const [appliedFilters, setAppliedFilters] = useState<{
    entityName: string;
    action: string;
    actorUserId: string;
    fromDate: string;
    toDate: string;
  }>({
    entityName: '',
    action: '',
    actorUserId: '',
    fromDate: '',
    toDate: '',
  });

  const [filterError, setFilterError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [reloadTick, setReloadTick] = useState(0);

  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [meta, setMeta] = useState<AuditLogsPaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<{
    message: string;
    code?: string;
    traceId?: string;
  } | null>(null);

  const loadLogs = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const fromIso = appliedFilters.fromDate
          ? new Date(`${appliedFilters.fromDate}T00:00:00`).toISOString()
          : undefined;
        const toIso = appliedFilters.toDate
          ? new Date(`${appliedFilters.toDate}T23:59:59.999`).toISOString()
          : undefined;

        const res = await getAuditLogsApi(
          {
            entity_name: appliedFilters.entityName || undefined,
            action: appliedFilters.action || undefined,
            actor_user_id: appliedFilters.actorUserId || undefined,
            from: fromIso,
            to: toIso,
            page,
            page_size: pageSize,
          },
          signal
        );

        setLogs(res.data ?? []);
        setMeta(res.meta ?? null);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof ApiError) {
          setLoadError({
            message: err.message,
            code: err.code,
            traceId: err.traceId,
          });
        } else {
          setLoadError({
            message: 'Không thể tải danh sách nhật ký hệ thống.',
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [appliedFilters, page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadLogs(controller.signal);
    return () => controller.abort();
  }, [loadLogs, reloadTick]);

  const handleApplyFilters = (e: FormEvent) => {
    e.preventDefault();
    setFilterError(null);

    const trimmedActor = draftActorUserId.trim();
    if (trimmedActor && !UUID_REGEX.test(trimmedActor)) {
      setFilterError('Mã người thực hiện phải đúng định dạng UUID hợp lệ.');
      return;
    }

    if (draftFromDate && draftToDate && draftFromDate > draftToDate) {
      setFilterError('Ngày bắt đầu không được muộn hơn ngày kết thúc.');
      return;
    }

    setPage(1);
    setAppliedFilters({
      entityName: draftEntityName === ALL_VALUE ? '' : draftEntityName,
      action: draftAction === ALL_VALUE ? '' : draftAction,
      actorUserId: trimmedActor,
      fromDate: draftFromDate,
      toDate: draftToDate,
    });
  };

  const handleResetFilters = () => {
    setDraftEntityName(ALL_VALUE);
    setDraftAction(ALL_VALUE);
    setDraftActorUserId('');
    setDraftFromDate('');
    setDraftToDate('');
    setFilterError(null);
    setPage(1);
    setAppliedFilters({
      entityName: '',
      action: '',
      actorUserId: '',
      fromDate: '',
      toDate: '',
    });
  };

  const hasActiveFilters = Boolean(
    appliedFilters.entityName ||
      appliedFilters.action ||
      appliedFilters.actorUserId ||
      appliedFilters.fromDate ||
      appliedFilters.toDate
  );

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col gap-3 border-b border-surface-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <History aria-hidden="true" className="size-5 text-brand-600 dark:text-brand-300" />
            <h1 className="text-xl font-bold text-text-primary sm:text-2xl">
              Nhật ký hệ thống
            </h1>
          </div>
          <p className="text-sm text-text-secondary">
            Theo dõi dấu vết thao tác quản trị, khóa tài khoản và điều chỉnh kỳ thi không thể sửa xóa.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setReloadTick((t) => t + 1)}
          disabled={isLoading}
          className="h-9 gap-1.5 self-start text-xs font-semibold sm:self-auto"
        >
          <RefreshCw
            aria-hidden="true"
            className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`}
          />
          <span>Làm mới</span>
        </Button>
      </div>

      {/* Immutability & Data Masking Policy Notice */}
      <div className="flex items-start gap-2.5 rounded-md border border-surface-border bg-surface-muted/50 px-3.5 py-2.5 text-xs text-text-secondary">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-300" />
        <p className="leading-relaxed">
          Nhật ký chỉ hiển thị thông tin tóm tắt đã lọc (thời điểm, thao tác, đối tượng và mã người thực hiện). Dữ liệu nhạy cảm trước/sau thay đổi và địa chỉ IP được ẩn theo quy định bảo mật.
        </p>
      </div>

      {/* Filter Bar */}
      <Card className="border-surface-border bg-surface-card shadow-sm">
        <CardContent className="p-4">
          <form onSubmit={handleApplyFilters} className="space-y-3" noValidate>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label
                  htmlFor={entitySelectId}
                  className="mb-1 block text-xs font-semibold text-text-primary"
                >
                  Đối tượng tác động
                </label>
                <Select value={draftEntityName} onValueChange={setDraftEntityName}>
                  <SelectTrigger
                    id={entitySelectId}
                    className="h-9 bg-surface-card text-xs text-text-primary"
                  >
                    <SelectValue placeholder="Tất cả đối tượng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>Tất cả đối tượng</SelectItem>
                    {AUDIT_ENTITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor={actionSelectId}
                  className="mb-1 block text-xs font-semibold text-text-primary"
                >
                  Loại thao tác
                </label>
                <Select value={draftAction} onValueChange={setDraftAction}>
                  <SelectTrigger
                    id={actionSelectId}
                    className="h-9 bg-surface-card text-xs text-text-primary"
                  >
                    <SelectValue placeholder="Tất cả thao tác" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>Tất cả thao tác</SelectItem>
                    {AUDIT_ACTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor={actorInputId}
                  className="mb-1 block text-xs font-semibold text-text-primary"
                >
                  Mã người thực hiện (UUID)
                </label>
                <Input
                  id={actorInputId}
                  value={draftActorUserId}
                  onChange={(e) => {
                    setDraftActorUserId(e.target.value);
                    if (filterError) setFilterError(null);
                  }}
                  placeholder="Ví dụ: 0199ac14-..."
                  className="h-9 font-mono text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor={fromDateId}
                  className="mb-1 block text-xs font-semibold text-text-primary"
                >
                  Từ ngày
                </label>
                <Input
                  id={fromDateId}
                  type="date"
                  value={draftFromDate}
                  onChange={(e) => {
                    setDraftFromDate(e.target.value);
                    if (filterError) setFilterError(null);
                  }}
                  className="h-9 text-xs tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor={toDateId}
                  className="mb-1 block text-xs font-semibold text-text-primary"
                >
                  Đến ngày
                </label>
                <Input
                  id={toDateId}
                  type="date"
                  value={draftToDate}
                  onChange={(e) => {
                    setDraftToDate(e.target.value);
                    if (filterError) setFilterError(null);
                  }}
                  className="h-9 text-xs tabular-nums"
                />
              </div>
            </div>

            {filterError ? (
              <p role="alert" className="text-xs font-medium text-semantic-error">
                {filterError}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {hasActiveFilters ||
              draftEntityName !== ALL_VALUE ||
              draftAction !== ALL_VALUE ||
              draftActorUserId ||
              draftFromDate ||
              draftToDate ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilters}
                  className="h-8 gap-1.5 text-xs text-text-secondary"
                >
                  <RotateCcw aria-hidden="true" className="size-3.5" />
                  <span>Xóa bộ lọc</span>
                </Button>
              ) : null}

              <Button type="submit" size="sm" className="h-8 gap-1.5 text-xs font-semibold">
                <Filter aria-hidden="true" className="size-3.5" />
                <span>Áp dụng bộ lọc</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Error State */}
      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-semantic-error/30 bg-semantic-error-bg p-4 text-sm text-semantic-error"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{loadError.message}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReloadTick((t) => t + 1)}
              className="h-8 border-semantic-error/40 bg-surface-card text-xs text-semantic-error hover:bg-semantic-error-bg"
            >
              Thử lại
            </Button>
          </div>
          {loadError.code || loadError.traceId ? (
            <div className="mt-2">
              <TechnicalDetails code={loadError.code} traceId={loadError.traceId} />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Table / Card Results */}
      <Card className="overflow-hidden border-surface-border bg-surface-card shadow-sm">
        {isLoading && logs.length === 0 ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center">
            <History
              aria-hidden="true"
              className="mx-auto size-8 text-text-secondary/50"
            />
            <p className="mt-3 text-sm font-semibold text-text-primary">
              Không có bản ghi nhật ký phù hợp
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              {hasActiveFilters
                ? 'Hãy nới lỏng tiêu chí lọc hoặc xóa bộ lọc để xem toàn bộ lịch sử thao tác.'
                : 'Hệ thống chưa ghi nhận thao tác quản trị nào trong lịch sử.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border bg-surface-muted/50 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3">Thao tác</th>
                    <th className="px-4 py-3">Đối tượng</th>
                    <th className="px-4 py-3">Mã đối tượng</th>
                    <th className="px-4 py-3">Người thực hiện</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {logs.map((row) => {
                    const actionLabel =
                      AUDIT_ACTION_LABELS[row.action] || row.action;
                    const entityLabel =
                      AUDIT_ENTITY_LABELS[row.entity_name] || row.entity_name;

                    return (
                      <tr
                        key={row.id}
                        className="transition-colors hover:bg-surface-muted/30"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-text-secondary">
                          {formatTimestamp(row.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-text-primary">
                            {actionLabel}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-text-secondary">
                            {row.action}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge variant="outline" className="text-[11px] font-medium">
                            {entityLabel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {row.entity_id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <span
                                className="font-mono text-xs text-text-primary"
                                title={row.entity_id}
                              >
                                {shortUuid(row.entity_id)}
                              </span>
                              <CopyButton
                                value={row.entity_id}
                                ariaLabel={`Sao chép mã đối tượng ${row.entity_id}`}
                              />
                            </div>
                          ) : (
                            <span className="text-text-secondary">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.actor_user_id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <span
                                className="font-mono text-xs text-text-primary"
                                title={row.actor_user_id}
                              >
                                {shortUuid(row.actor_user_id)}
                              </span>
                              <CopyButton
                                value={row.actor_user_id}
                                ariaLabel={`Sao chép mã người thực hiện ${row.actor_user_id}`}
                              />
                            </div>
                          ) : (
                            <span className="text-text-secondary">
                              Hệ thống tự động
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (< md) */}
            <div className="divide-y divide-surface-border md:hidden">
              {logs.map((row) => {
                const actionLabel = AUDIT_ACTION_LABELS[row.action] || row.action;
                const entityLabel =
                  AUDIT_ENTITY_LABELS[row.entity_name] || row.entity_name;

                return (
                  <div key={row.id} className="space-y-2 p-4 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-text-primary">{actionLabel}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-text-secondary">
                          {row.action}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[11px]">
                        {entityLabel}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 text-[11px] text-text-secondary">
                      <div className="flex items-center justify-between gap-2">
                        <span>Thời gian:</span>
                        <span className="font-mono tabular-nums text-text-primary">
                          {formatTimestamp(row.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>Mã đối tượng:</span>
                        {row.entity_id ? (
                          <span className="inline-flex items-center gap-1 font-mono text-text-primary">
                            {shortUuid(row.entity_id)}
                            <CopyButton
                              value={row.entity_id}
                              ariaLabel={`Sao chép mã đối tượng ${row.entity_id}`}
                            />
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>Người thực hiện:</span>
                        {row.actor_user_id ? (
                          <span className="inline-flex items-center gap-1 font-mono text-text-primary">
                            {shortUuid(row.actor_user_id)}
                            <CopyButton
                              value={row.actor_user_id}
                              ariaLabel={`Sao chép mã người thực hiện ${row.actor_user_id}`}
                            />
                          </span>
                        ) : (
                          <span>Hệ thống tự động</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <PaginationFooter
              page={page}
              pageSize={pageSize}
              meta={meta}
              itemLabel="bản ghi"
              isLoading={isLoading}
              onPageChange={setPage}
              onPageSizeChange={(nextSize) => {
                setPage(1);
                setPageSize(nextSize);
              }}
              ariaLabel="Phân trang nhật ký hệ thống"
            />
          </>
        )}
      </Card>
    </div>
  );
}
