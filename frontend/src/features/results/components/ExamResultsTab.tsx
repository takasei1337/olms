import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Eye,
  Globe2,
  Info,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { ApiError } from '../../../api/client';
import { Button } from '../../../components/ui/button';
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
import { ExamPaginationFooter } from '../../exams/components/ExamPaginationFooter';
import type { ExamRecord } from '../../exams/types';
import { getExamResultsApi, getExamStatisticsApi } from '../results.api';
import type {
  ExamResultParticipantStatus,
  ExamStatisticsData,
  TeacherExamResultRow,
  TeacherExamResultsMeta,
} from '../types';
import { formatScoreValue, getReadableErrorMessage } from '../utils';
import { ExamChangeVisibilityModal } from './ExamChangeVisibilityModal';
import { ExamPublishResultsModal } from './ExamPublishResultsModal';
import { ExamStatisticsPanel } from './ExamStatisticsPanel';
import { TeacherSubmissionReviewModal } from './TeacherSubmissionReviewModal';
import { ParticipantResultStatusBadge } from './VisibilityAndGradingBadges';

interface ExamResultsTabProps {
  exam: ExamRecord;
  canManage: boolean;
  onExamUpdated: (nextExam: ExamRecord) => void;
}

const ALL_STATUS_VALUE = '__ALL__';

const STATUS_FILTER_OPTIONS: Array<{ value: ExamResultParticipantStatus; label: string }> = [
  { value: 'GRADED', label: 'Đã chấm điểm' },
  { value: 'SUBMITTED', label: 'Đã nộp — chờ chấm' },
  { value: 'GRADING', label: 'Đang chấm điểm' },
  { value: 'IN_PROGRESS', label: 'Đang làm bài' },
  { value: 'REGISTERED', label: 'Chưa vào thi' },
  { value: 'FLAGGED', label: 'Cần xem xét' },
];

export function ExamResultsTab({
  exam,
  canManage,
  onExamUpdated,
}: ExamResultsTabProps) {
  const [statistics, setStatistics] = useState<ExamStatisticsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<unknown>(null);

  const [rows, setRows] = useState<TeacherExamResultRow[]>([]);
  const [meta, setMeta] = useState<TeacherExamResultsMeta | null>(null);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [rowsError, setRowsError] = useState<unknown>(null);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedCode, setDebouncedCode] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExamResultParticipantStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [reloadTick, setReloadTick] = useState(0);

  const [publishOpen, setPublishOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<TeacherExamResultRow | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalized = searchInput.trim();
      setDebouncedCode((prev) => {
        if (prev !== normalized) {
          setPage(1);
        }
        return normalized;
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    setStatsLoading(true);
    setStatsError(null);

    getExamStatisticsApi(exam.id, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setStatistics(res.data);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted && err?.name !== 'AbortError') {
          setStatsError(err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setStatsLoading(false);
        }
      });

    return () => controller.abort();
  }, [exam.id, reloadTick]);

  useEffect(() => {
    const controller = new AbortController();
    setRowsLoading(true);
    setRowsError(null);

    getExamResultsApi(
      exam.id,
      {
        page,
        page_size: pageSize,
        status: statusFilter,
        student_code: debouncedCode,
      },
      controller.signal
    )
      .then((res) => {
        if (!controller.signal.aborted) {
          setRows(res.data);
          setMeta(res.meta ?? null);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted && err?.name !== 'AbortError') {
          setRowsError(err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setRowsLoading(false);
        }
      });

    return () => controller.abort();
  }, [exam.id, page, pageSize, statusFilter, debouncedCode, reloadTick]);

  const handleRefreshAll = useCallback(() => {
    setFeedbackBanner(null);
    setReloadTick((v) => v + 1);
  }, []);

  const handleStatusChange = useCallback((nextVal: string) => {
    setStatusFilter(
      nextVal === ALL_STATUS_VALUE ? '' : (nextVal as ExamResultParticipantStatus)
    );
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSearchInput('');
    setDebouncedCode('');
    setStatusFilter('');
    setPage(1);
  }, []);

  const isFiltered = Boolean(searchInput.trim() || statusFilter);
  const canPublish = exam.status === 'ENDED';
  const canChangeVisibility = exam.status === 'RESULT_PUBLISHED';
  const isPreExam = ['DRAFT', 'GENERATED', 'PUBLISHED'].includes(exam.status);

  return (
    <div className="space-y-5">
      {/* Control bar + Ownership / Readiness notice */}
      <div className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-text-primary">
            Tổng hợp điểm, phổ điểm &amp; công bố kết quả
          </h2>
          <p className="text-xs leading-relaxed text-text-secondary">
            Theo dõi tiến độ chấm bài trực tuyến, rà soát bài làm từng thí sinh và quản lý phạm vi công bố kết quả.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={statsLoading || rowsLoading}
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-3.5 ${statsLoading || rowsLoading ? 'animate-spin' : ''}`}
            />
            <span>Làm mới &amp; Chấm tự động</span>
          </Button>

          {canPublish ? (
            <Button
              type="button"
              size="sm"
              disabled={!canManage}
              onClick={() => setPublishOpen(true)}
              className="bg-brand-600 font-semibold text-white hover:bg-brand-700"
            >
              <Globe2 aria-hidden="true" className="size-3.5" />
              <span>Công bố kết quả</span>
            </Button>
          ) : null}

          {canChangeVisibility ? (
            <Button
              type="button"
              size="sm"
              disabled={!canManage}
              onClick={() => setVisibilityOpen(true)}
              className="bg-brand-600 font-semibold text-white hover:bg-brand-700"
            >
              <SlidersHorizontal aria-hidden="true" className="size-3.5" />
              <span>Đổi chế độ hiển thị</span>
            </Button>
          ) : null}
        </div>
      </div>

      {!canManage ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-semantic-info/30 bg-semantic-info-bg px-4 py-3 text-xs text-semantic-info">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p className="leading-relaxed">
            Bạn đang xem kết quả kỳ thi do giảng viên khác tạo. Chỉ người tạo kỳ thi hoặc Quản trị viên mới được công bố hoặc đổi chế độ hiển thị kết quả.
          </p>
        </div>
      ) : null}

      {isPreExam ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-surface-border bg-surface-muted/70 px-4 py-3 text-xs text-text-secondary">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-muted" />
          <p className="leading-relaxed">
            Kỳ thi chưa bước vào giai đoạn thu bài. Thao tác <strong className="text-text-primary">Công bố kết quả</strong> sẽ khả dụng sau khi kỳ thi kết thúc (<span className="font-medium">Đã kết thúc</span>).
          </p>
        </div>
      ) : null}

      {feedbackBanner ? (
        <div
          role="status"
          className="rounded-xl border border-semantic-success/30 bg-semantic-success-bg px-4 py-2.5 text-xs font-medium text-semantic-success"
        >
          {feedbackBanner}
        </div>
      ) : null}

      {statsError ? (
        <div
          role="alert"
          className="rounded-xl border border-semantic-error/30 bg-semantic-error-bg px-4 py-3 text-xs text-semantic-error"
        >
          <div className="flex items-start gap-2">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">
                {getReadableErrorMessage(statsError, 'Không thể tải thống kê kỳ thi.')}
              </p>
              {statsError instanceof ApiError ? (
                <TechnicalDetails code={statsError.code} traceId={statsError.traceId} />
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <ExamStatisticsPanel exam={exam} statistics={statistics} loading={statsLoading} />
      )}

      {/* Results Table Section */}
      <section
        aria-label="Bảng kết quả thí sinh"
        className="overflow-hidden rounded-xl border border-surface-border bg-surface-card shadow-xs"
      >
        <div className="flex flex-col gap-3 border-b border-surface-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Bảng điểm thí sinh</h3>
            <p className="text-xs text-text-secondary">
              Nhấn <span className="font-medium text-text-primary">Xem bài chấm</span> để kiểm tra câu trả lời và điểm chấm chi tiết từng câu.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-56">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-muted"
              />
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo MSSV..."
                aria-label="Tìm theo mã sinh viên"
                className="h-9 pl-8 text-xs"
              />
            </div>

            <div className="w-full sm:w-48">
              <Select
                value={statusFilter || ALL_STATUS_VALUE}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger aria-label="Lọc theo trạng thái bài làm" className="h-9 text-xs">
                  <SelectValue placeholder="Tất cả trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STATUS_VALUE}>Tất cả trạng thái</SelectItem>
                  {STATUS_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isFiltered ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 shrink-0"
              >
                Đặt lại
              </Button>
            ) : null}
          </div>
        </div>

        {rowsError ? (
          <div className="p-4">
            <div
              role="alert"
              className="rounded-lg border border-semantic-error/30 bg-semantic-error-bg px-4 py-3 text-xs text-semantic-error"
            >
              <div className="flex items-start gap-2">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <div className="flex-1 space-y-2">
                  <p className="font-medium">
                    {getReadableErrorMessage(rowsError, 'Không thể tải bảng điểm thí sinh.')}
                  </p>
                  {rowsError instanceof ApiError ? (
                    <TechnicalDetails code={rowsError.code} traceId={rowsError.traceId} />
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRefreshAll}
                    className="bg-surface-card text-text-primary"
                  >
                    Thử lại
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : rowsLoading && rows.length === 0 ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-text-secondary">
            {isFiltered
              ? 'Không tìm thấy thí sinh phù hợp với từ khóa hoặc bộ lọc hiện tại.'
              : 'Kỳ thi chưa có thí sinh nào trong danh sách.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-surface-muted/50 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3">MSSV</th>
                  <th className="px-4 py-3">Họ và tên</th>
                  <th className="px-4 py-3">Trạng thái bài làm</th>
                  <th className="px-4 py-3 text-right">Điểm số</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.map((row) => (
                  <tr
                    key={row.participant_id}
                    className="transition-colors hover:bg-surface-muted/40"
                  >
                    <td className="px-4 py-3 font-mono font-semibold tabular-nums text-text-primary">
                      {row.student_code}
                    </td>
                    <td className="px-4 py-3 font-medium text-text-primary">{row.full_name}</td>
                    <td className="px-4 py-3">
                      <ParticipantResultStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {row.score !== null && row.score !== undefined ? (
                        <span className="font-semibold text-text-primary">
                          {formatScoreValue(row.score)}
                          <span className="font-normal text-text-muted">
                            {' '}
                            / {formatScoreValue(exam.total_score)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-text-muted">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.submission_id ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setReviewTarget(row)}
                          className="h-8 text-xs font-medium"
                        >
                          <Eye aria-hidden="true" className="size-3.5" />
                          <span>Xem bài chấm</span>
                        </Button>
                      ) : (
                        <span className="text-xs italic text-text-muted">Chưa có bài nộp</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <ExamPaginationFooter
          page={page}
          pageSize={pageSize}
          meta={meta}
          itemLabel="thí sinh"
          isLoading={rowsLoading}
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setPage(1);
          }}
        />
      </section>

      <ExamPublishResultsModal
        open={publishOpen}
        onOpenChange={setPublishOpen}
        exam={exam}
        statistics={statistics}
        onSuccess={(updated) => {
          onExamUpdated(updated);
          setFeedbackBanner('Đã công bố kết quả kỳ thi thành công.');
          setReloadTick((v) => v + 1);
        }}
      />

      <ExamChangeVisibilityModal
        open={visibilityOpen}
        onOpenChange={setVisibilityOpen}
        exam={exam}
        onSuccess={(updated) => {
          onExamUpdated(updated);
          setFeedbackBanner('Đã cập nhật chế độ hiển thị kết quả thành công.');
          setReloadTick((v) => v + 1);
        }}
      />

      <TeacherSubmissionReviewModal
        open={Boolean(reviewTarget)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setReviewTarget(null);
        }}
        examId={exam.id}
        participant={reviewTarget}
      />
    </div>
  );
}
