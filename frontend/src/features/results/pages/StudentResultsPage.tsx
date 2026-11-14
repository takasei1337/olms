import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Award,
  CheckCircle2,
  ClipboardList,
  EyeOff,
  RefreshCw,
  Search,
} from 'lucide-react';
import { ApiError } from '../../../api/client';
import { Button, buttonVariants } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Skeleton } from '../../../components/ui/skeleton';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { cn } from '../../../lib/utils';
import { ExamPaginationFooter } from '../../exams/components/ExamPaginationFooter';
import { getMyResultsApi } from '../results.api';
import type { ExamResultParticipantStatus, ResultSummary } from '../types';
import {
  formatCompactScore,
  formatScoreValue,
  getReadableErrorMessage,
} from '../utils';
import {
  ParticipantResultStatusBadge,
  VisibilityModeBadge,
} from '../components/VisibilityAndGradingBadges';

type PublishFilterValue = 'ALL' | 'AVAILABLE' | 'HIDDEN';

const PAGE_SIZE_OPTIONS_DEFAULT = 10;

function normalizeParticipantStatus(status: string): ExamResultParticipantStatus {
  switch (status) {
    case 'NOT_STARTED':
    case 'REGISTERED':
    case 'IN_PROGRESS':
    case 'SUBMITTED':
    case 'GRADING':
    case 'GRADED':
    case 'FLAGGED':
      return status;
    default:
      return 'REGISTERED';
  }
}

export function StudentResultsPage() {
  const [items, setItems] = useState<ResultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [publishFilter, setPublishFilter] = useState<PublishFilterValue>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS_DEFAULT);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getMyResultsApi(controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setItems(res.data || []);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted && err?.name !== 'AbortError') {
          setError(err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [reloadTick]);

  const stats = useMemo(() => {
    const publishedList = items.filter(
      (i) => i.result_available && i.total_score !== null && i.total_score !== undefined
    );
    const avg =
      publishedList.length > 0
        ? publishedList.reduce((acc, cur) => acc + Number(cur.total_score || 0), 0) /
          publishedList.length
        : null;
    return {
      total: items.length,
      available: publishedList.length,
      average: avg,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const keyword = searchInput.trim().toLowerCase();
    return items.filter((item) => {
      if (publishFilter === 'AVAILABLE' && !item.result_available) return false;
      if (publishFilter === 'HIDDEN' && item.result_available) return false;
      if (!keyword) return true;
      return (
        item.exam_name.toLowerCase().includes(keyword) ||
        (item.exam_code || '').toLowerCase().includes(keyword)
      );
    });
  }, [items, publishFilter, searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchInput, publishFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const paginationMeta = useMemo(
    () => ({
      page: safePage,
      page_size: pageSize,
      total_items: filtered.length,
      total_pages: totalPages,
    }),
    [safePage, pageSize, filtered.length, totalPages]
  );

  const handleReset = useCallback(() => {
    setSearchInput('');
    setPublishFilter('ALL');
    setPage(1);
  }, []);

  const isFiltered = Boolean(searchInput.trim() || publishFilter !== 'ALL');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
            Kết quả thi của tôi
          </h1>
          <p className="text-sm text-text-secondary">
            Theo dõi điểm số, trạng thái công bố và xem phản hồi chi tiết các kỳ thi bạn đã tham gia.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReloadTick((v) => v + 1)}
            disabled={loading}
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            <span>Làm mới</span>
          </Button>
          <Link
            to="/my-exams"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <ClipboardList aria-hidden="true" className="size-3.5" />
            <span>Kỳ thi của tôi</span>
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-surface-border bg-surface-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-text-secondary">
            <span>Tổng kỳ thi tham gia</span>
            <ClipboardList aria-hidden="true" className="size-4 text-text-muted" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-text-primary">
            {loading && items.length === 0 ? '--' : stats.total}
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-text-secondary">
            <span>Đã công bố kết quả</span>
            <CheckCircle2 aria-hidden="true" className="size-4 text-semantic-success" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-text-primary">
            {loading && items.length === 0 ? '--' : stats.available}
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-text-secondary">
            <span>Điểm trung bình các kỳ đã công bố</span>
            <Award aria-hidden="true" className="size-4 text-brand-600 dark:text-brand-300" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-text-primary">
            {stats.average !== null ? formatScoreValue(stats.average) : '--'}
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-surface-border bg-surface-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted"
          />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo tên kỳ thi..."
            aria-label="Tìm kết quả kỳ thi"
            className="h-9 pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-52">
            <Select
              value={publishFilter}
              onValueChange={(val) => setPublishFilter(val as PublishFilterValue)}
            >
              <SelectTrigger aria-label="Lọc theo trạng thái công bố" className="h-9 text-xs">
                <SelectValue placeholder="Tất cả kết quả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả kỳ thi</SelectItem>
                <SelectItem value="AVAILABLE">Đã công bố điểm</SelectItem>
                <SelectItem value="HIDDEN">Chưa công bố / Đang ẩn</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isFiltered ? (
            <Button type="button" variant="outline" size="sm" onClick={handleReset} className="h-9">
              Đặt lại
            </Button>
          ) : null}
        </div>
      </div>

      {/* List Content */}
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-semantic-error/30 bg-semantic-error-bg p-4 text-xs text-semantic-error"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="flex-1 space-y-2">
              <p className="font-medium">
                {getReadableErrorMessage(error, 'Không thể tải danh sách kết quả thi.')}
              </p>
              {error instanceof ApiError ? (
                <TechnicalDetails code={error.code} traceId={error.traceId} />
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setReloadTick((v) => v + 1)}
                className="bg-surface-card text-text-primary"
              >
                <RefreshCw aria-hidden="true" className="size-3.5" />
                <span>Thử lại</span>
              </Button>
            </div>
          </div>
        </div>
      ) : loading && items.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : pagedItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-border bg-surface-card px-6 py-12 text-center">
          <Award aria-hidden="true" className="mx-auto size-8 text-text-muted" />
          <h2 className="mt-3 text-sm font-semibold text-text-primary">
            {isFiltered ? 'Không tìm thấy kỳ thi phù hợp' : 'Bạn chưa có kết quả kỳ thi nào'}
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            {isFiltered
              ? 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái công bố.'
              : 'Sau khi tham gia thi và giảng viên công bố điểm, kết quả của bạn sẽ hiển thị tại đây.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-border bg-surface-card shadow-xs">
          <div className="divide-y divide-surface-border">
            {pagedItems.map((item) => {
              const hasScore =
                item.result_available &&
                item.total_score !== undefined &&
                item.total_score !== null;

              return (
                <div
                  key={item.exam_id}
                  className="flex flex-col justify-between gap-4 p-4 transition-colors hover:bg-surface-muted/35 sm:flex-row sm:items-center sm:p-5"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.exam_code ? (
                        <span className="rounded border border-surface-border bg-surface-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-text-primary">
                          {item.exam_code}
                        </span>
                      ) : null}
                      <ParticipantResultStatusBadge
                        status={normalizeParticipantStatus(item.submission_status)}
                      />
                      {item.result_published ? (
                        <VisibilityModeBadge mode={item.visibility} />
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                          <EyeOff aria-hidden="true" className="size-3" />
                          <span>Chưa công bố kết quả</span>
                        </span>
                      )}
                    </div>

                    <h2 className="text-sm font-semibold text-text-primary sm:text-base">
                      {item.exam_name}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <span className="block text-[11px] text-text-secondary">Tổng điểm</span>
                      {hasScore ? (
                        <span className="font-mono text-lg font-bold tabular-nums text-brand-600 dark:text-brand-300">
                          {formatScoreValue(item.total_score)}
                          <span className="text-xs font-normal text-text-muted">
                            {' '}
                            / {formatCompactScore(item.max_score ?? 10)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-text-muted">Đang chờ công bố</span>
                      )}
                    </div>

                    <Link
                      to={`/my-results/${item.exam_id}`}
                      className={cn(
                        buttonVariants({
                          variant: item.result_available ? 'default' : 'outline',
                          size: 'sm',
                        }),
                        item.result_available
                          ? 'bg-brand-600 font-semibold text-white hover:bg-brand-700'
                          : 'font-medium'
                      )}
                    >
                      <span>{item.result_available ? 'Xem kết quả' : 'Chi tiết'}</span>
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <ExamPaginationFooter
            page={safePage}
            pageSize={pageSize}
            meta={paginationMeta}
            itemLabel="kỳ thi"
            isLoading={loading}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
