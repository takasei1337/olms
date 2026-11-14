import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FolderOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
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
import { ApiError } from '../../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { getSubjectsApi } from '../../catalog/catalog.api';
import type { Subject } from '../../catalog/types';
import { ExamFormModal } from '../components/ExamFormModal';
import {
  ExamLifecycleModal,
  type ExamLifecycleActionType,
} from '../components/ExamLifecycleModal';
import { ExamPaginationFooter } from '../components/ExamPaginationFooter';
import { ExamRowActionsMenu } from '../components/ExamRowActionsMenu';
import {
  DeliveryModeBadge,
  ExamStatusBadge,
} from '../components/ExamStatusBadge';
import { getExamsApi } from '../exams.api';
import {
  EXAM_STATUS_LABELS,
  type ExamRecord,
  type ExamsPaginationMeta,
  type ExamStatus,
} from '../types';
import { formatExamDateTime, formatScore } from '../utils';

const STATUS_FILTER_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  ...(Object.keys(EXAM_STATUS_LABELS) as ExamStatus[]).map((status) => ({
    value: status,
    label: EXAM_STATUS_LABELS[status],
  })),
];

export function ExamsPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const filterIdPrefix = useId();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [meta, setMeta] = useState<ExamsPaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExamStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamRecord | null>(null);
  const [lifecycleModal, setLifecycleModal] = useState<{
    exam: ExamRecord;
    action: ExamLifecycleActionType;
  } | null>(null);

  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setPage(1);
    }, 300);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    getSubjectsApi({ page: 1, page_size: 100 }, controller.signal)
      .then((res) => {
        setSubjects(res.data || []);
      })
      .catch(() => {
        // Non-blocking: filter still allows viewing exams
      });
    return () => controller.abort();
  }, []);

  const loadExams = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await getExamsApi(
          {
            q: debouncedQuery || undefined,
            subject_id: subjectFilter || undefined,
            status: statusFilter || undefined,
            page,
            page_size: pageSize,
          },
          signal
        );
        setExams(res.data || []);
        setMeta(res.meta || null);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setLoadError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [debouncedQuery, subjectFilter, statusFilter, page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadExams(controller.signal);
    return () => controller.abort();
  }, [loadExams]);

  const hasActiveFilters = Boolean(
    debouncedQuery || subjectFilter || statusFilter
  );

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedQuery('');
    setSubjectFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const handleOpenCreate = () => {
    setEditingExam(null);
    setIsFormOpen(true);
  };

  const handleLifecycleSuccess = (
    action: ExamLifecycleActionType,
    updatedExam?: ExamRecord
  ) => {
    const actionSuccessMap: Record<ExamLifecycleActionType, string> = {
      delete: 'Đã xóa kỳ thi bản nháp thành công.',
      publish: `Đã phát hành kỳ thi "${updatedExam?.name || ''}".`,
      start: `Kỳ thi "${updatedExam?.name || ''}" đã chuyển sang trạng thái Đang diễn ra.`,
      archive: `Đã lưu trữ kỳ thi "${updatedExam?.name || ''}".`,
      cancel: `Đã hủy kỳ thi "${updatedExam?.name || ''}".`,
    };
    setFeedbackBanner({
      type: 'success',
      message: actionSuccessMap[action],
    });

    if (action === 'delete' && exams.length === 1 && page > 1) {
      setPage((prev) => prev - 1);
    } else {
      loadExams();
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-surface-border pb-4 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-balance text-text-primary sm:text-2xl">
            Quản lý kỳ thi
          </h1>
          <p className="text-xs text-pretty text-text-secondary sm:text-sm">
            Thiết lập kỳ thi, cấu hình ma trận &amp; đề gốc, sinh mã đề và quản lý danh sách thí sinh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadExams()}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`}
            />
            <span>Làm mới</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleOpenCreate}
            disabled={subjects.length === 0}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            <span>Tạo kỳ thi mới</span>
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner ? (
        <div
          role={feedbackBanner.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-xs ${
            feedbackBanner.type === 'success'
              ? 'border-semantic-success/30 bg-semantic-success-bg text-semantic-success'
              : 'border-semantic-danger/30 bg-semantic-danger-bg text-semantic-danger'
          }`}
        >
          <div className="flex items-start gap-2">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="font-medium leading-relaxed">
              {feedbackBanner.message}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="shrink-0 text-[11px] font-semibold underline hover:opacity-80"
          >
            Đóng
          </button>
        </div>
      ) : null}

      {/* Filter Bar */}
      <section aria-label="Bộ lọc tìm kiếm kỳ thi">
        <Card className="border-surface-border bg-surface-card shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2 lg:col-span-2">
                <label
                  htmlFor={`${filterIdPrefix}-search`}
                  className="mb-1 block text-xs font-medium text-text-primary"
                >
                  Tìm kiếm theo mã hoặc tên kỳ thi
                </label>
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-text-muted"
                  />
                  <Input
                    id={`${filterIdPrefix}-search`}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Nhập mã kỳ thi hoặc tên kỳ thi..."
                    className="h-9 bg-surface-card pl-8 text-xs text-text-primary"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor={`${filterIdPrefix}-subject`}
                  className="mb-1 block text-xs font-medium text-text-primary"
                >
                  Môn học
                </label>
                <Select
                  value={subjectFilter || 'ALL'}
                  onValueChange={(val) => {
                    setSubjectFilter(val === 'ALL' ? '' : val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    id={`${filterIdPrefix}-subject`}
                    className="h-9 bg-surface-card text-xs text-text-primary"
                  >
                    <SelectValue placeholder="Tất cả môn học" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả môn học</SelectItem>
                    {subjects.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.code} — {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor={`${filterIdPrefix}-status`}
                  className="mb-1 block text-xs font-medium text-text-primary"
                >
                  Trạng thái
                </label>
                <div className="flex items-center gap-2">
                  <Select
                    value={statusFilter || 'ALL'}
                    onValueChange={(val) => {
                      setStatusFilter(val === 'ALL' ? '' : (val as ExamStatus));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger
                      id={`${filterIdPrefix}-status`}
                      className="h-9 bg-surface-card text-xs text-text-primary"
                    >
                      <SelectValue placeholder="Tất cả trạng thái" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_FILTER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasActiveFilters ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResetFilters}
                      aria-label="Đặt lại bộ lọc"
                      title="Đặt lại bộ lọc"
                      className="h-9 shrink-0 px-2.5 text-xs"
                    >
                      <RotateCcw aria-hidden="true" className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Error Card */}
      {loadError ? (
        <Card className="border-semantic-danger/30 bg-semantic-danger-bg shadow-sm">
          <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-semantic-danger">
                Không thể tải danh sách kỳ thi
              </h2>
              <p className="text-xs text-text-secondary">
                {loadError instanceof ApiError
                  ? loadError.message
                  : 'Lỗi kết nối máy chủ.'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadExams()}
              className="h-8 text-xs font-medium"
            >
              Thử lại
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Data Table Card */}
      <Card className="overflow-hidden border-surface-border bg-surface-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-surface-border bg-surface-muted/50 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              <tr>
                <th scope="col" className="min-w-[230px] px-4 py-3">
                  Kỳ thi
                </th>
                <th scope="col" className="min-w-[150px] px-3 py-3">
                  Môn học
                </th>
                <th scope="col" className="min-w-[180px] px-3 py-3">
                  Cấu trúc &amp; Hình thức
                </th>
                <th scope="col" className="min-w-[180px] px-3 py-3">
                  Khung thời gian
                </th>
                <th scope="col" className="w-36 px-3 py-3">
                  Trạng thái
                </th>
                <th scope="col" className="w-40 px-4 py-3 text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3.5">
                      <Skeleton className="mb-1.5 h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </td>
                    <td className="px-3 py-3.5">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-3 py-3.5">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-3 py-3.5">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-3 py-3.5">
                      <Skeleton className="h-5 w-24" />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Skeleton className="ml-auto h-7 w-28" />
                    </td>
                  </tr>
                ))
              ) : exams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-surface-muted text-text-secondary">
                        <ClipboardList aria-hidden="true" className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-text-primary">
                          {hasActiveFilters
                            ? 'Không tìm thấy kỳ thi phù hợp'
                            : 'Chưa có kỳ thi nào'}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {hasActiveFilters
                            ? 'Thử thay đổi từ khóa, môn học hoặc bộ lọc trạng thái.'
                            : 'Tạo kỳ thi bản nháp đầu tiên để thiết lập ma trận, sinh mã đề và ghi danh thí sinh.'}
                        </p>
                      </div>
                      <div>
                        {hasActiveFilters ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleResetFilters}
                            className="h-8 gap-1.5 text-xs font-medium"
                          >
                            <RotateCcw aria-hidden="true" className="size-3" />
                            <span>Đặt lại bộ lọc</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleOpenCreate}
                            disabled={subjects.length === 0}
                            className="h-8 gap-1.5 text-xs font-medium"
                          >
                            <Plus aria-hidden="true" className="size-3" />
                            <span>Tạo kỳ thi đầu tiên</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                exams.map((exam) => (
                  <tr
                    key={exam.id}
                    className="transition-colors hover:bg-surface-muted/30 focus-within:bg-surface-muted/30"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/exams/${exam.id}`)}
                          className="text-left text-xs font-semibold text-text-primary hover:text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:text-brand-300"
                        >
                          {exam.name}
                        </button>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
                          <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-text-primary">
                            {exam.code}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3 align-top text-xs text-text-primary">
                      {exam.subjects ? (
                        <div className="space-y-0.5">
                          <p className="font-medium text-text-primary">
                            {exam.subjects.name}
                          </p>
                          <p className="font-mono text-[11px] text-text-secondary">
                            {exam.subjects.code}
                          </p>
                        </div>
                      ) : (
                        <span className="text-text-muted">Chưa rõ môn</span>
                      )}
                    </td>

                    <td className="px-3 py-3 align-top">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium tabular-nums text-text-primary">
                          {exam.total_questions} câu ·{' '}
                          {formatScore(exam.total_score)} điểm ·{' '}
                          {exam.duration_minutes} phút
                        </p>
                        <DeliveryModeBadge mode={exam.delivery_mode} />
                      </div>
                    </td>

                    <td className="px-3 py-3 align-top text-[11px] tabular-nums text-text-secondary">
                      <div className="space-y-0.5">
                        <p>
                          Mở:{' '}
                          <span className="font-medium text-text-primary">
                            {formatExamDateTime(exam.opens_at)}
                          </span>
                        </p>
                        <p>
                          Đóng:{' '}
                          <span className="font-medium text-text-primary">
                            {formatExamDateTime(exam.closes_at)}
                          </span>
                        </p>
                      </div>
                    </td>

                    <td className="px-3 py-3 align-top">
                      <ExamStatusBadge status={exam.status} />
                    </td>

                    <td className="px-4 py-3 text-right align-top">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/exams/${exam.id}`)}
                          className="h-7 gap-1 px-2.5 text-xs font-medium"
                        >
                          <FolderOpen aria-hidden="true" className="size-3.5" />
                          <span>Chi tiết</span>
                        </Button>
                        <ExamRowActionsMenu
                          exam={exam}
                          currentUserId={currentUser?.id || ''}
                          currentUserRole={currentUser?.role || ''}
                          onOpenDetail={(target) =>
                            navigate(`/exams/${target.id}`)
                          }
                          onOpenParticipants={(target) =>
                            navigate(`/exams/${target.id}?tab=participants`)
                          }
                          onEditDraft={(target) => {
                            setEditingExam(target);
                            setIsFormOpen(true);
                          }}
                          onLifecycleAction={(target, action) =>
                            setLifecycleModal({ exam: target, action })
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <ExamPaginationFooter
          page={page}
          pageSize={pageSize}
          meta={meta}
          itemLabel="kỳ thi"
          isLoading={isLoading}
          onPageChange={setPage}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
          }}
        />
      </Card>

      {/* Modals */}
      <ExamFormModal
        isOpen={isFormOpen}
        exam={editingExam}
        subjects={subjects}
        onClose={() => {
          setIsFormOpen(false);
          setEditingExam(null);
        }}
        onSuccess={(savedExam, mode) => {
          if (mode === 'create') {
            navigate(`/exams/${savedExam.id}`);
          } else {
            setFeedbackBanner({
              type: 'success',
              message: `Đã cập nhật thông tin kỳ thi "${savedExam.name}".`,
            });
            loadExams();
          }
        }}
      />

      <ExamLifecycleModal
        action={lifecycleModal?.action || null}
        exam={lifecycleModal?.exam || null}
        onClose={() => setLifecycleModal(null)}
        onSuccess={handleLifecycleSuccess}
      />
    </div>
  );
}
