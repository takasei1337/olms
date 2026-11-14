import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Info,
  KeyRound,
  Loader2,
  Lock,
  RotateCcw,
  Search,
  Trash2,
  Upload,
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
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '../../../api/client';
import { AccessibleModal } from '../../../components/ui/AccessibleModal';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import {
  createParticipantApi,
  deleteParticipantApi,
  exportParticipantsCredentialsApi,
  getParticipantsApi,
  resetParticipantCredentialsApi,
} from '../exams.api';
import {
  PARTICIPANT_STATUS_LABELS,
  PRE_START_PARTICIPANT_EXAM_STATUSES,
  type ExamRecord,
  type ExamsPaginationMeta,
  type ExportCredentialsFormat,
  type ParticipantCredentialOutcome,
  type ParticipantImportCommitResult,
  type ParticipantRecord,
  type ParticipantStatus,
} from '../types';
import { resolveApiDownloadUrl } from '../utils';
import { ExamPaginationFooter } from './ExamPaginationFooter';
import {
  AttendanceStatusBadge,
  ParticipantStatusBadge,
} from './ExamStatusBadge';
import { ParticipantCredentialsModal } from './ParticipantCredentialsModal';
import { ParticipantImportModal } from './ParticipantImportModal';

interface ExamParticipantsTabProps {
  exam: ExamRecord;
}

export function ExamParticipantsTab({ exam }: ExamParticipantsTabProps) {
  const idPrefix = useId();
  const canMutatePreStart = PRE_START_PARTICIPANT_EXAM_STATUSES.includes(
    exam.status
  );

  const [participants, setParticipants] = useState<ParticipantRecord[]>([]);
  const [meta, setMeta] = useState<ExamsPaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ParticipantStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Enroll Single Modal
  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [studentCode, setStudentCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [enrollError, setEnrollError] = useState<unknown>(null);
  const [enrollClientError, setEnrollClientError] = useState<string | null>(
    null
  );
  const [isEnrolling, setIsEnrolling] = useState(false);

  // Import CSV/XLSX Modal
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Credential Display Modal (one-time P-01)
  const [credentialOutcome, setCredentialOutcome] = useState<{
    outcome: ParticipantCredentialOutcome;
    mode: 'enroll' | 'reset';
  } | null>(null);

  // Reset Password Reason Modal
  const [resetTarget, setResetTarget] = useState<ParticipantRecord | null>(
    null
  );
  const [resetReason, setResetReason] = useState('');
  const [resetError, setResetError] = useState<unknown>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Delete Participant Modal
  const [deleteTarget, setDeleteTarget] = useState<ParticipantRecord | null>(
    null
  );
  const [deleteError, setDeleteError] = useState<unknown>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Export Credentials
  const [exportingFormat, setExportingFormat] =
    useState<ExportCredentialsFormat | null>(null);
  const [exportError, setExportError] = useState<unknown>(null);

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

  const loadParticipants = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await getParticipantsApi(
          exam.id,
          {
            q: debouncedQuery || undefined,
            status: statusFilter || undefined,
            page,
            page_size: pageSize,
          },
          signal
        );
        setParticipants(res.data || []);
        setMeta(res.meta || null);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setLoadError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [exam.id, debouncedQuery, statusFilter, page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadParticipants(controller.signal);
    return () => controller.abort();
  }, [loadParticipants]);

  const handleOpenEnroll = () => {
    setStudentCode('');
    setFullName('');
    setStudentEmail('');
    setEnrollClientError(null);
    setEnrollError(null);
    setIsEnrollOpen(true);
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollClientError(null);
    setEnrollError(null);

    const code = studentCode.trim();
    const name = fullName.trim();
    const email = studentEmail.trim();

    if (!code || code.length > 30) {
      setEnrollClientError('Vui lòng nhập MSSV (1–30 ký tự).');
      return;
    }
    if (!name || name.length > 150) {
      setEnrollClientError('Vui lòng nhập họ tên thí sinh (1–150 ký tự).');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEnrollClientError('Địa chỉ email không hợp lệ.');
      return;
    }

    setIsEnrolling(true);
    try {
      const res = await createParticipantApi(exam.id, {
        student_code: code,
        full_name: name,
        email: email || null,
      });
      setIsEnrollOpen(false);
      setCredentialOutcome({ outcome: res.data, mode: 'enroll' });
      loadParticipants();
    } catch (err) {
      setEnrollError(err);
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError(null);

    if (!resetReason.trim()) {
      setResetError(new Error('Vui lòng nhập lý do đặt lại mật khẩu.'));
      return;
    }

    setIsResetting(true);
    try {
      const res = await resetParticipantCredentialsApi(
        exam.id,
        resetTarget.id,
        resetReason
      );
      setResetTarget(null);
      setCredentialOutcome({ outcome: res.data, mode: 'reset' });
    } catch (err) {
      setResetError(err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget) return;
    setDeleteError(null);
    setIsDeleting(true);

    try {
      await deleteParticipantApi(exam.id, deleteTarget.id);
      const removedName = deleteTarget.full_name_snapshot;
      setDeleteTarget(null);
      setFeedbackBanner({
        type: 'success',
        message: `Đã xóa thí sinh "${removedName}" khỏi danh sách kỳ thi.`,
      });
      if (participants.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        loadParticipants();
      }
    } catch (err) {
      setDeleteError(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCredentials = async (format: ExportCredentialsFormat) => {
    setExportError(null);
    setExportingFormat(format);
    try {
      const res = await exportParticipantsCredentialsApi(exam.id, format);
      const downloadHref = resolveApiDownloadUrl(res.data.download_url);
      const link = document.createElement('a');
      link.href = downloadHref;
      link.download = res.data.file_name || `tai-khoan-thi.${format.toLowerCase()}`;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setFeedbackBanner({
        type: 'success',
        message: `Đang tải xuống tệp danh sách tài khoản (${format}): ${res.data.file_name}. Lưu ý tệp xuất không bao gồm mật khẩu đã mã hóa.`,
      });
    } catch (err) {
      setExportError(err);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleImportSuccess = (summary: ParticipantImportCommitResult) => {
    setFeedbackBanner({
      type: 'success',
      message: `Import hoàn tất: ghi danh mới ${summary.created_count} thí sinh (bỏ qua trùng: ${summary.skipped_duplicate_count}, lỗi: ${summary.invalid_count}).`,
    });
    setPage(1);
    loadParticipants();
  };

  const hasFilters = Boolean(debouncedQuery || statusFilter);

  return (
    <div className="space-y-4">
      {!canMutatePreStart ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-surface-border bg-surface-muted/40 px-4 py-3 text-xs text-text-secondary"
        >
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Kỳ thi đã qua giai đoạn chuẩn bị trước giờ thi, nên chức năng ghi danh, import, đặt lại mật khẩu và xóa thí sinh đã được khóa. Bạn vẫn có thể theo dõi và xuất danh sách đối chiếu.
          </span>
        </div>
      ) : null}

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
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
            ) : (
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
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

      {exportError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-semantic-danger/30 bg-semantic-danger-bg px-3.5 py-2.5 text-xs text-semantic-danger"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {exportError instanceof ApiError
                ? exportError.message
                : 'Không thể xuất tệp danh sách tài khoản.'}
            </p>
            {exportError instanceof ApiError ? (
              <TechnicalDetails
                code={exportError.code}
                traceId={exportError.traceId}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Filter + Action Toolbar */}
      <Card className="border-surface-border bg-surface-card shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={`${idPrefix}-search`}
                  className="mb-1 block text-xs font-medium text-text-primary"
                >
                  Tìm kiếm thí sinh
                </label>
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-text-muted"
                  />
                  <Input
                    id={`${idPrefix}-search`}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Tìm theo MSSV hoặc họ tên..."
                    className="h-9 bg-surface-card pl-8 text-xs text-text-primary"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor={`${idPrefix}-status`}
                  className="mb-1 block text-xs font-medium text-text-primary"
                >
                  Trạng thái làm bài
                </label>
                <div className="flex items-center gap-2">
                  <Select
                    value={statusFilter || 'ALL'}
                    onValueChange={(val) => {
                      setStatusFilter(
                        val === 'ALL' ? '' : (val as ParticipantStatus)
                      );
                      setPage(1);
                    }}
                  >
                    <SelectTrigger
                      id={`${idPrefix}-status`}
                      className="h-9 bg-surface-card text-xs text-text-primary"
                    >
                      <SelectValue placeholder="Tất cả trạng thái" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                      {(
                        Object.keys(
                          PARTICIPANT_STATUS_LABELS
                        ) as ParticipantStatus[]
                      ).map((status) => (
                        <SelectItem key={status} value={status}>
                          {PARTICIPANT_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasFilters ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchInput('');
                        setDebouncedQuery('');
                        setStatusFilter('');
                        setPage(1);
                      }}
                      aria-label="Đặt lại bộ lọc thí sinh"
                      className="h-9 shrink-0 px-2.5 text-xs"
                    >
                      <RotateCcw aria-hidden="true" className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canMutatePreStart ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleOpenEnroll}
                    className="h-9 gap-1.5 text-xs font-semibold"
                  >
                    <UserPlus aria-hidden="true" className="size-3.5" />
                    <span>Ghi danh thí sinh</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsImportOpen(true)}
                    className="h-9 gap-1.5 text-xs font-medium"
                  >
                    <Upload aria-hidden="true" className="size-3.5" />
                    <span>Import CSV / XLSX</span>
                  </Button>
                </>
              ) : null}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exportingFormat !== null || participants.length === 0}
                onClick={() => handleExportCredentials('XLSX')}
                className="h-9 gap-1.5 text-xs font-medium"
              >
                {exportingFormat === 'XLSX' ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                  />
                ) : (
                  <Download aria-hidden="true" className="size-3.5" />
                )}
                <span>Xuất XLSX</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={exportingFormat !== null || participants.length === 0}
                onClick={() => handleExportCredentials('PDF')}
                className="h-9 gap-1.5 text-xs font-medium"
              >
                {exportingFormat === 'PDF' ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                  />
                ) : (
                  <Download aria-hidden="true" className="size-3.5" />
                )}
                <span>Xuất PDF</span>
              </Button>
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <Info aria-hidden="true" className="size-3.5 shrink-0" />
            <span>
              Tệp xuất XLSX/PDF dùng để đối chiếu tên đăng nhập và mã đề phòng thi (không bao gồm mật khẩu khởi tạo theo chuẩn P-01).
            </span>
          </p>
        </CardContent>
      </Card>

      {loadError ? (
        <Card className="border-semantic-danger/30 bg-semantic-danger-bg shadow-sm">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <p className="text-xs font-medium text-semantic-danger">
              {loadError instanceof ApiError
                ? loadError.message
                : 'Không thể tải danh sách thí sinh.'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadParticipants()}
              className="h-8 text-xs font-medium"
            >
              Thử lại
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Table Card */}
      <Card className="overflow-hidden border-surface-border bg-surface-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-surface-border bg-surface-muted/50 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              <tr>
                <th scope="col" className="w-32 px-4 py-3">
                  MSSV
                </th>
                <th scope="col" className="min-w-[200px] px-3 py-3">
                  Họ và tên
                </th>
                <th scope="col" className="w-40 px-3 py-3">
                  Trạng thái thi
                </th>
                <th scope="col" className="w-36 px-3 py-3">
                  Điểm danh
                </th>
                <th scope="col" className="w-56 px-4 py-3 text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3.5">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-3 py-3.5">
                      <Skeleton className="h-4 w-44" />
                    </td>
                    <td className="px-3 py-3.5">
                      <Skeleton className="h-5 w-24" />
                    </td>
                    <td className="px-3 py-3.5">
                      <Skeleton className="h-5 w-24" />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Skeleton className="ml-auto h-7 w-36" />
                    </td>
                  </tr>
                ))
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2.5">
                      <div className="flex size-10 items-center justify-center rounded-full bg-surface-muted text-text-secondary">
                        <Users aria-hidden="true" className="size-5" />
                      </div>
                      <p className="text-sm font-semibold text-text-primary">
                        {hasFilters
                          ? 'Không tìm thấy thí sinh phù hợp'
                          : 'Chưa có thí sinh nào được ghi danh'}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {hasFilters
                          ? 'Hãy thử thay đổi từ khóa MSSV/họ tên hoặc trạng thái.'
                          : 'Ghi danh lẻ từng thí sinh hoặc import hàng loạt từ tệp CSV/XLSX.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                participants.map((p) => {
                  const canDeleteRow =
                    canMutatePreStart && p.status === 'REGISTERED';
                  return (
                    <tr
                      key={p.id}
                      className="transition-colors hover:bg-surface-muted/30"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-text-primary">
                        {p.student_code}
                      </td>
                      <td className="px-3 py-3 text-xs font-medium text-text-primary">
                        {p.full_name_snapshot}
                      </td>
                      <td className="px-3 py-3">
                        <ParticipantStatusBadge status={p.status} />
                      </td>
                      <td className="px-3 py-3">
                        <AttendanceStatusBadge status={p.attendance_status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canMutatePreStart ? (
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setResetTarget(p);
                                setResetReason('');
                                setResetError(null);
                              }}
                              className="h-7 gap-1 px-2.5 text-[11px] font-medium"
                            >
                              <KeyRound aria-hidden="true" className="size-3" />
                              <span>Đặt lại mật khẩu</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={!canDeleteRow}
                              onClick={() => {
                                setDeleteTarget(p);
                                setDeleteError(null);
                              }}
                              aria-label={`Xóa thí sinh ${p.full_name_snapshot}`}
                              title={
                                canDeleteRow
                                  ? 'Xóa thí sinh khỏi kỳ thi'
                                  : 'Chỉ xóa được thí sinh ở trạng thái Đã ghi danh'
                              }
                              className="h-7 w-7 p-0 text-text-secondary hover:text-semantic-danger"
                            >
                              <Trash2 aria-hidden="true" className="size-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-text-muted">
                            Chỉ xem
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <ExamPaginationFooter
          page={page}
          pageSize={pageSize}
          meta={meta}
          itemLabel="thí sinh"
          isLoading={isLoading}
          onPageChange={setPage}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
          }}
        />
      </Card>

      {/* Enroll Single Modal */}
      <AccessibleModal
        isOpen={isEnrollOpen}
        onClose={() => setIsEnrollOpen(false)}
        isBusy={isEnrolling}
        maxWidthClass="max-w-md"
        title="Ghi danh thí sinh mới"
        description="Hệ thống tự động tạo hoặc liên kết tài khoản sinh viên và cấp mật khẩu khởi tạo 1 lần."
      >
        <form onSubmit={handleEnrollSubmit} className="space-y-4">
          {enrollClientError || enrollError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-semantic-danger/30 bg-semantic-danger-bg px-3 py-2 text-xs text-semantic-danger"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium">
                  {enrollClientError ||
                    (enrollError instanceof ApiError
                      ? enrollError.message
                      : 'Không thể ghi danh thí sinh.')}
                </p>
                {enrollError instanceof ApiError ? (
                  <TechnicalDetails
                    code={enrollError.code}
                    traceId={enrollError.traceId}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <div>
            <label
              htmlFor={`${idPrefix}-enroll-code`}
              className="mb-1.5 block text-xs font-medium text-text-primary"
            >
              Mã số sinh viên (MSSV) <span className="text-semantic-danger">*</span>
            </label>
            <Input
              id={`${idPrefix}-enroll-code`}
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="Ví dụ: 20225001"
              maxLength={30}
              disabled={isEnrolling}
              className="h-9 bg-surface-card font-mono text-xs"
            />
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-enroll-name`}
              className="mb-1.5 block text-xs font-medium text-text-primary"
            >
              Họ và tên <span className="text-semantic-danger">*</span>
            </label>
            <Input
              id={`${idPrefix}-enroll-name`}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn An"
              maxLength={150}
              disabled={isEnrolling}
              className="h-9 bg-surface-card text-xs"
            />
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-enroll-email`}
              className="mb-1.5 block text-xs font-medium text-text-primary"
            >
              Email (tùy chọn)
            </label>
            <Input
              id={`${idPrefix}-enroll-email`}
              type="email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="sinhvien@example.edu.vn"
              maxLength={150}
              disabled={isEnrolling}
              className="h-9 bg-surface-card text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-surface-border pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEnrollOpen(false)}
              disabled={isEnrolling}
              className="h-8 text-xs font-medium"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isEnrolling}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              {isEnrolling ? (
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              ) : null}
              <span>Xác nhận ghi danh</span>
            </Button>
          </div>
        </form>
      </AccessibleModal>

      {/* Reset Credentials Reason Modal */}
      <AccessibleModal
        isOpen={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        isBusy={isResetting}
        maxWidthClass="max-w-md"
        title="Đặt lại mật khẩu thí sinh"
        description="Hệ thống sẽ cấp một mật khẩu mới duy nhất cho thí sinh và ghi nhận nhật ký kiểm toán."
      >
        {resetTarget ? (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div className="rounded-lg border border-surface-border bg-surface-muted/40 px-3 py-2 text-xs">
              <p className="font-semibold text-text-primary">
                {resetTarget.full_name_snapshot}
              </p>
              <p className="font-mono text-[11px] text-text-secondary">
                MSSV: {resetTarget.student_code}
              </p>
            </div>

            {resetError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-semantic-danger/30 bg-semantic-danger-bg px-3 py-2 text-xs text-semantic-danger"
              >
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {resetError instanceof ApiError
                      ? resetError.message
                      : resetError instanceof Error
                      ? resetError.message
                      : 'Không thể đặt lại mật khẩu.'}
                  </p>
                </div>
              </div>
            ) : null}

            <div>
              <label
                htmlFor={`${idPrefix}-reset-reason`}
                className="mb-1.5 block text-xs font-medium text-text-primary"
              >
                Lý do đặt lại mật khẩu <span className="text-semantic-danger">*</span>
              </label>
              <Textarea
                id={`${idPrefix}-reset-reason`}
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ví dụ: Thí sinh quên hoặc thất lạc phiếu tài khoản trước giờ thi"
                disabled={isResetting}
                className="bg-surface-card text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-surface-border pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResetTarget(null)}
                disabled={isResetting}
                className="h-8 text-xs font-medium"
              >
                Quay lại
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isResetting}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                {isResetting ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                  />
                ) : null}
                <span>Cấp mật khẩu mới</span>
              </Button>
            </div>
          </form>
        ) : null}
      </AccessibleModal>

      {/* Delete Participant Confirmation Modal */}
      <AccessibleModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        isBusy={isDeleting}
        maxWidthClass="max-w-md"
        title="Xóa thí sinh khỏi kỳ thi"
        description="Thao tác chỉ thành công khi thí sinh chưa làm bài hoặc chưa phát sinh bài nộp."
      >
        {deleteTarget ? (
          <form onSubmit={handleDeleteSubmit} className="space-y-4">
            <div className="rounded-lg border border-surface-border bg-surface-muted/40 px-3 py-2 text-xs">
              <p className="font-semibold text-text-primary">
                {deleteTarget.full_name_snapshot}
              </p>
              <p className="font-mono text-[11px] text-text-secondary">
                MSSV: {deleteTarget.student_code}
              </p>
            </div>

            {deleteError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-semantic-danger/30 bg-semantic-danger-bg px-3 py-2 text-xs text-semantic-danger"
              >
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {deleteError instanceof ApiError
                      ? deleteError.message
                      : 'Không thể xóa thí sinh.'}
                  </p>
                  {deleteError instanceof ApiError ? (
                    <TechnicalDetails
                      code={deleteError.code}
                      traceId={deleteError.traceId}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-surface-border pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="h-8 text-xs font-medium"
              >
                Quay lại
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="destructive"
                disabled={isDeleting}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                {isDeleting ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                  />
                ) : null}
                <span>Xóa thí sinh</span>
              </Button>
            </div>
          </form>
        ) : null}
      </AccessibleModal>

      <ParticipantImportModal
        isOpen={isImportOpen}
        examId={exam.id}
        examCode={exam.code}
        onClose={() => setIsImportOpen(false)}
        onSuccess={handleImportSuccess}
      />

      <ParticipantCredentialsModal
        outcome={credentialOutcome?.outcome || null}
        mode={credentialOutcome?.mode || 'enroll'}
        onClose={() => setCredentialOutcome(null)}
      />
    </div>
  );
}
