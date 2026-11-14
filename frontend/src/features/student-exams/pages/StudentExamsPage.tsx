import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TechnicalDetails } from '@/components/ui/TechnicalDetails';
import { ApiError } from '../../../api/client';
import { ExamPaginationFooter } from '../../exams/components/ExamPaginationFooter';
import {
  DeliveryModeBadge,
  ExamStatusBadge,
} from '../../exams/components/ExamStatusBadge';
import type { ExamsPaginationMeta } from '../../exams/types';
import { formatExamDateTime, formatScore } from '../../exams/utils';
import {
  listMyExams,
  startOrResumeExamSession,
} from '../student-exams.api';
import type { StudentExamListItem } from '../types';

type StatusFilter = 'ALL' | 'IN_PROGRESS' | 'PUBLISHED' | 'CLOSED';

export function StudentExamsPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<StudentExamListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{
    message: string;
    code?: string;
    traceId?: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [enteringExamId, setEnteringExamId] = useState<string | null>(null);
  const [examActionError, setExamActionError] = useState<
    Record<string, { message: string; code?: string; traceId?: string }>
  >({});
  const [completedExamIds, setCompletedExamIds] = useState<Record<string, boolean>>({});

  const fetchExams = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await listMyExams();
      setExams(items);
    } catch (err) {
      if (err instanceof ApiError) {
        setError({
          message: err.message,
          code: err.code,
          traceId: err.traceId,
        });
      } else {
        setError({
          message: 'Không thể tải danh sách kỳ thi của bạn. Vui lòng thử lại.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchExams();
  }, [fetchExams]);

  const filteredExams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return exams.filter((exam) => {
      if (statusFilter === 'IN_PROGRESS' && exam.status !== 'IN_PROGRESS') {
        return false;
      }
      if (statusFilter === 'PUBLISHED' && exam.status !== 'PUBLISHED') {
        return false;
      }
      if (
        statusFilter === 'CLOSED' &&
        exam.status !== 'ENDED' &&
        exam.status !== 'RESULT_PUBLISHED'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        exam.code.toLowerCase().includes(q) ||
        exam.name.toLowerCase().includes(q)
      );
    });
  }, [exams, searchQuery, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, pageSize]);

  const totalItems = filteredExams.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedExams = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredExams.slice(start, start + pageSize);
  }, [filteredExams, safePage, pageSize]);

  const paginationMeta: ExamsPaginationMeta | null =
    totalItems > 0
      ? {
          page: safePage,
          page_size: pageSize,
          total_items: totalItems,
          total_pages: totalPages,
        }
      : null;

  const handleEnterExam = async (exam: StudentExamListItem) => {
    if (enteringExamId) return;
    setEnteringExamId(exam.id);
    setExamActionError((prev) => {
      const next = { ...prev };
      delete next[exam.id];
      return next;
    });

    try {
      await startOrResumeExamSession(exam.id);
      navigate(`/my-exams/${exam.id}/session`, {
        state: { examMeta: exam },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'SUBMISSION_ALREADY_CLOSED') {
          setCompletedExamIds((prev) => ({ ...prev, [exam.id]: true }));
        }
        setExamActionError((prev) => ({
          ...prev,
          [exam.id]: {
            message: err.message,
            code: err.code,
            traceId: err.traceId,
          },
        }));
      } else {
        setExamActionError((prev) => ({
          ...prev,
          [exam.id]: {
            message: 'Không thể khởi tạo phiên làm bài. Vui lòng thử lại.',
          },
        }));
      }
    } finally {
      setEnteringExamId(null);
    }
  };

  const countByStatus = useMemo(() => {
    let activeCount = 0;
    let upcomingCount = 0;
    let endedCount = 0;
    for (const exam of exams) {
      if (exam.status === 'IN_PROGRESS') activeCount += 1;
      else if (exam.status === 'PUBLISHED') upcomingCount += 1;
      else if (exam.status === 'ENDED' || exam.status === 'RESULT_PUBLISHED') {
        endedCount += 1;
      }
    }
    return { activeCount, upcomingCount, endedCount };
  }, [exams]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 border-b border-surface-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            Kỳ thi của tôi
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Theo dõi lịch thi được phân công và vào làm bài trực tuyến trong khung giờ hợp lệ.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void fetchExams()}
          disabled={isLoading}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw
            aria-hidden="true"
            className={`size-4 ${isLoading ? 'animate-spin' : ''}`}
          />
          <span>Làm mới</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
          <p className="text-xs font-medium text-text-secondary">Đang diễn ra</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-semantic-warning">
            {countByStatus.activeCount}
          </p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
          <p className="text-xs font-medium text-text-secondary">Sắp mở</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-semantic-success">
            {countByStatus.upcomingCount}
          </p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-card p-4">
          <p className="text-xs font-medium text-text-secondary">Đã kết thúc</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-text-primary">
            {countByStatus.endedCount}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-surface-border bg-surface-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-surface-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-sm">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted"
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã hoặc tên kỳ thi..."
              aria-label="Tìm theo mã hoặc tên kỳ thi"
              className="h-9 bg-surface-panel pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val as StatusFilter)}
            >
              <SelectTrigger
                aria-label="Lọc theo trạng thái kỳ thi"
                className="h-9 w-full bg-surface-panel text-sm sm:w-48"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                <SelectItem value="IN_PROGRESS">Đang diễn ra</SelectItem>
                <SelectItem value="PUBLISHED">Sắp mở</SelectItem>
                <SelectItem value="CLOSED">Đã kết thúc</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
            {[1, 2].map((idx) => (
              <div
                key={idx}
                className="space-y-3 rounded-xl border border-surface-border bg-surface-panel p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-9 w-36" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="rounded-lg border border-semantic-danger/35 bg-semantic-danger-bg p-4 text-sm text-semantic-danger">
              <div className="flex items-start gap-2.5">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-2">
                  <p className="font-medium">{error.message}</p>
                  <TechnicalDetails code={error.code} traceId={error.traceId} />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void fetchExams()}
                  >
                    Thử tải lại
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : paginatedExams.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-full border border-surface-border bg-surface-panel text-text-muted">
              <ClipboardList aria-hidden="true" className="size-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-text-primary">
              {exams.length === 0
                ? 'Bạn chưa được ghi danh vào kỳ thi nào'
                : 'Không tìm thấy kỳ thi phù hợp'}
            </h2>
            <p className="mt-1 max-w-md text-sm text-text-secondary">
              {exams.length === 0
                ? 'Khi giáo viên phát hành kỳ thi và ghi danh bạn vào phòng thi, thông tin kỳ thi sẽ hiển thị tại đây.'
                : 'Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc trạng thái khác.'}
            </p>
            {(searchQuery || statusFilter !== 'ALL') ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
                className="mt-4"
              >
                Xóa bộ lọc
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
            {paginatedExams.map((exam) => {
              const isPaperOnly = exam.delivery_mode === 'PAPER';
              const canEnterOnline = exam.status === 'IN_PROGRESS' && !isPaperOnly;
              const isCompletedLocally = completedExamIds[exam.id] === true;
              const isEntering = enteringExamId === exam.id;
              const cardErr = examActionError[exam.id];

              return (
                <article
                  key={exam.id}
                  className="flex flex-col justify-between rounded-xl border border-surface-border bg-surface-card p-5 transition-colors hover:border-brand-500/40"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center rounded-md border border-surface-border bg-surface-panel px-2 py-0.5 font-mono text-xs font-semibold text-text-primary">
                        {exam.code}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <DeliveryModeBadge mode={exam.delivery_mode} />
                        <ExamStatusBadge status={exam.status} />
                      </div>
                    </div>

                    <h2 className="mt-3 font-display text-lg font-bold leading-snug text-text-primary">
                      {exam.name}
                    </h2>

                    <dl className="mt-4 space-y-2 text-xs text-text-secondary">
                      <div className="flex items-center gap-2">
                        <BookOpen aria-hidden="true" className="size-3.5 shrink-0 text-text-muted" />
                        <span>
                          Quy mô:{' '}
                          <strong className="font-semibold tabular-nums text-text-primary">
                            {exam.total_questions} câu
                          </strong>
                          {exam.total_score !== null ? (
                            <>
                              {' · '}
                              <strong className="font-semibold tabular-nums text-text-primary">
                                {formatScore(exam.total_score)} điểm
                              </strong>
                            </>
                          ) : null}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock aria-hidden="true" className="size-3.5 shrink-0 text-text-muted" />
                        <span>
                          Thời lượng:{' '}
                          <strong className="font-semibold tabular-nums text-text-primary">
                            {exam.duration_minutes} phút
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-start gap-2">
                        <CalendarClock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-text-muted" />
                        <span className="tabular-nums">
                          Mở: <strong className="font-medium text-text-primary">{formatExamDateTime(exam.opens_at)}</strong>
                          <br />
                          Đóng: <strong className="font-medium text-text-primary">{formatExamDateTime(exam.closes_at)}</strong>
                        </span>
                      </div>
                    </dl>
                  </div>

                  <div className="mt-5 space-y-2.5 border-t border-surface-border pt-4">
                    {isPaperOnly ? (
                      <div className="flex items-start gap-2 rounded-lg border border-surface-border bg-surface-panel px-3 py-2 text-xs text-text-secondary">
                        <FileText aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          Kỳ thi này thực hiện trên giấy (phiếu OMR), không mở phiên làm bài trực tuyến trên hệ thống.
                        </span>
                      </div>
                    ) : exam.status === 'PUBLISHED' ? (
                      <div className="flex items-start gap-2 rounded-lg border border-semantic-info/30 bg-semantic-info-bg px-3 py-2 text-xs text-semantic-info">
                        <Clock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          Chưa đến thời gian mở đề. Vui lòng quay lại khi kỳ thi chuyển sang trạng thái Đang diễn ra.
                        </span>
                      </div>
                    ) : exam.status === 'RESULT_PUBLISHED' ? (
                      <div className="flex flex-col gap-2.5 rounded-lg border border-semantic-success/30 bg-semantic-success-bg/60 px-3 py-2.5 text-xs text-semantic-success sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                          <span>
                            Kỳ thi đã công bố kết quả. Bạn có thể xem điểm và chi tiết bài làm.
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/my-results/${exam.id}`)}
                          className="h-7 shrink-0 border-semantic-success/40 bg-surface-card text-xs font-semibold text-semantic-success hover:bg-surface-muted"
                        >
                          <Award aria-hidden="true" className="size-3.5" />
                          <span>Xem kết quả</span>
                        </Button>
                      </div>
                    ) : exam.status === 'ENDED' || exam.status === 'ARCHIVED' ? (
                      <div className="flex flex-col gap-2 rounded-lg border border-surface-border bg-surface-panel px-3 py-2 text-xs text-text-secondary sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                          <span>
                            Kỳ thi đã kết thúc. Kết quả sẽ hiển thị sau khi giảng viên công bố.
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/my-results/${exam.id}`)}
                          className="h-7 shrink-0 text-xs font-medium text-text-primary hover:bg-surface-muted"
                        >
                          <Award aria-hidden="true" className="size-3.5" />
                          <span>Tra cứu kết quả</span>
                        </Button>
                      </div>
                    ) : null}

                    {cardErr ? (
                      <div
                        role="alert"
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          isCompletedLocally
                            ? 'border-semantic-success/35 bg-semantic-success-bg text-semantic-success'
                            : 'border-semantic-danger/35 bg-semantic-danger-bg text-semantic-danger'
                        }`}
                      >
                        <p className="font-medium">{cardErr.message}</p>
                        {!isCompletedLocally ? (
                          <TechnicalDetails
                            code={cardErr.code}
                            traceId={cardErr.traceId}
                          />
                        ) : null}
                      </div>
                    ) : null}

                    {canEnterOnline ? (
                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          onClick={() => void handleEnterExam(exam)}
                          disabled={isEntering || isCompletedLocally || enteringExamId !== null}
                          className="w-full gap-2 bg-brand-600 text-white hover:bg-brand-700 sm:w-auto"
                        >
                          {isEntering ? (
                            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                          ) : isCompletedLocally ? (
                            <CheckCircle2 aria-hidden="true" className="size-4" />
                          ) : (
                            <Play aria-hidden="true" className="size-4" />
                          )}
                          <span>
                            {isCompletedLocally
                              ? 'Đã nộp bài thi'
                              : isEntering
                              ? 'Đang mở phòng thi...'
                              : 'Vào làm bài'}
                          </span>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!isLoading && !error && paginationMeta ? (
          <ExamPaginationFooter
            page={safePage}
            pageSize={pageSize}
            meta={paginationMeta}
            itemLabel="kỳ thi"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : null}
      </section>
    </div>
  );
}
