import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shapes,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '../../../api/client';
import { CopyButton } from '../../../components/ui/CopyButton';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { AccessibleModal } from '../../users/components/AccessibleModal';
import {
  createQuestionTypeApi,
  deleteQuestionTypeApi,
  getQuestionTypesAdminApi,
  updateQuestionTypeApi,
} from '../question-types.api';
import {
  CORE_QUESTION_TYPE_CODES,
  type QuestionTypeAdminRecord,
} from '../types';

const CORE_CODE_SET = new Set<string>(CORE_QUESTION_TYPE_CODES);

export function QuestionTypesPage() {
  const searchInputId = useId();
  const codeInputId = useId();
  const nameInputId = useId();
  const descInputId = useId();

  const [items, setItems] = useState<QuestionTypeAdminRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<{
    message: string;
    code?: string;
    traceId?: string;
  } | null>(null);

  // Form Modal (Create / Edit)
  const [formState, setFormState] = useState<{
    mode: 'create' | 'edit';
    record: QuestionTypeAdminRecord | null;
  } | null>(null);
  const [draftCode, setDraftCode] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [formError, setFormError] = useState<{
    message: string;
    code?: string;
    traceId?: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] =
    useState<QuestionTypeAdminRecord | null>(null);
  const [deleteError, setDeleteError] = useState<{
    message: string;
    code?: string;
    traceId?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadTypes = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await getQuestionTypesAdminApi(signal);
      setItems(res.data ?? []);
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
          message: 'Không thể tải danh mục dạng câu hỏi.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadTypes(controller.signal);
    return () => controller.abort();
  }, [loadTypes, reloadTick]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.code.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        (it.description || '').toLowerCase().includes(q)
    );
  }, [items, searchTerm]);

  const openCreateModal = () => {
    setDraftCode('');
    setDraftName('');
    setDraftDescription('');
    setFormError(null);
    setFormState({ mode: 'create', record: null });
  };

  const openEditModal = (record: QuestionTypeAdminRecord) => {
    setDraftCode(record.code);
    setDraftName(record.name);
    setDraftDescription(record.description ?? '');
    setFormError(null);
    setFormState({ mode: 'edit', record });
  };

  const handleSaveForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!formState) return;

    const normalizedCode = draftCode.trim().toUpperCase();
    const normalizedName = draftName.trim();
    const normalizedDesc = draftDescription.trim() ? draftDescription.trim() : null;

    if (!normalizedCode) {
      setFormError({ message: 'Mã dạng câu hỏi không được để trống.' });
      return;
    }
    if (normalizedCode.length > 30) {
      setFormError({ message: 'Mã dạng câu hỏi tối đa 30 ký tự.' });
      return;
    }
    if (!normalizedName) {
      setFormError({ message: 'Tên hiển thị dạng câu hỏi không được để trống.' });
      return;
    }
    if (normalizedName.length > 100) {
      setFormError({ message: 'Tên hiển thị tối đa 100 ký tự.' });
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (formState.mode === 'create') {
        const res = await createQuestionTypeApi({
          code: normalizedCode,
          name: normalizedName,
          description: normalizedDesc,
        });
        setItems((prev) =>
          [...prev, res.data].sort((a, b) => a.code.localeCompare(b.code))
        );
        setBannerMessage(`Đã tạo dạng câu hỏi mới "${res.data.name}" (${res.data.code}).`);
      } else if (formState.record) {
        const res = await updateQuestionTypeApi(formState.record.id, {
          code: normalizedCode,
          name: normalizedName,
          description: normalizedDesc,
        });
        setItems((prev) =>
          prev
            .map((item) => (item.id === res.data.id ? res.data : item))
            .sort((a, b) => a.code.localeCompare(b.code))
        );
        setBannerMessage(`Đã cập nhật dạng câu hỏi "${res.data.name}".`);
      }
      setFormState(null);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'CONFLICT') {
          setFormError({
            message: `Mã dạng câu hỏi '${normalizedCode}' đã tồn tại trong hệ thống.`,
            code: err.code,
            traceId: err.traceId,
          });
        } else {
          setFormError({
            message: err.message,
            code: err.code,
            traceId: err.traceId,
          });
        }
      } else {
        setFormError({
          message: 'Không thể lưu dạng câu hỏi. Vui lòng thử lại.',
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteQuestionTypeApi(deleteTarget.id);
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setBannerMessage(`Đã xóa dạng câu hỏi "${deleteTarget.name}" (${deleteTarget.code}).`);
      setDeleteTarget(null);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'CONFLICT') {
          setDeleteError({
            message:
              'Không thể xóa dạng câu hỏi này vì đang có câu hỏi hoặc ma trận đề thi sử dụng.',
            code: err.code,
            traceId: err.traceId,
          });
        } else {
          setDeleteError({
            message: err.message,
            code: err.code,
            traceId: err.traceId,
          });
        }
      } else {
        setDeleteError({
          message: 'Không thể xóa dạng câu hỏi. Vui lòng thử lại.',
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const isEditingCoreCode =
    formState?.mode === 'edit' &&
    formState.record !== null &&
    CORE_CODE_SET.has(formState.record.code);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col gap-3 border-b border-surface-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shapes aria-hidden="true" className="size-5 text-brand-600 dark:text-brand-300" />
            <h1 className="text-xl font-bold text-text-primary sm:text-2xl">
              Danh mục dạng câu hỏi
            </h1>
          </div>
          <p className="text-sm text-text-secondary">
            Quản lý các dạng câu hỏi dùng trong Ngân hàng câu hỏi và Ma trận sinh đề thi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReloadTick((t) => t + 1)}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs font-semibold"
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
            onClick={openCreateModal}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            <span>Thêm dạng câu hỏi</span>
          </Button>
        </div>
      </div>

      {/* System Core Notice */}
      <div className="flex items-start gap-2.5 rounded-md border border-surface-border bg-surface-muted/50 px-3.5 py-2.5 text-xs text-text-secondary">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-300" />
        <p className="leading-relaxed">
          Năm mã chuẩn hóa (<span className="font-mono">SINGLE_CHOICE</span>,{' '}
          <span className="font-mono">MULTI_CHOICE</span>,{' '}
          <span className="font-mono">DROPDOWN</span>,{' '}
          <span className="font-mono">INPUT</span>,{' '}
          <span className="font-mono">MATCHING</span>) được trình biên soạn câu hỏi và bộ chấm điểm tự động nhận diện. Nên giữ nguyên các mã lõi này nếu đang vận hành bài thi trực tuyến.
        </p>
      </div>

      {bannerMessage ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-md border border-semantic-success/30 bg-semantic-success-bg px-4 py-2.5 text-xs font-medium text-semantic-success"
        >
          <span>{bannerMessage}</span>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-xs underline"
          >
            Đóng
          </button>
        </div>
      ) : null}

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

      {/* Search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-2.5 size-4 text-text-secondary"
          />
          <Input
            id={searchInputId}
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo mã, tên hoặc mô tả dạng câu hỏi..."
            className="h-9 bg-surface-card pl-9 text-xs"
            aria-label="Tìm kiếm dạng câu hỏi"
          />
        </div>

        <span className="text-xs tabular-nums text-text-secondary">
          Hiển thị <strong className="font-semibold text-text-primary">{filteredItems.length}</strong> /{' '}
          {items.length} dạng câu hỏi
        </span>
      </div>

      {/* Table / Card List */}
      <Card className="overflow-hidden border-surface-border bg-surface-card shadow-sm">
        <CardContent className="p-0">
          {isLoading && items.length === 0 ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-10 text-center">
              <Shapes
                aria-hidden="true"
                className="mx-auto size-8 text-text-secondary/50"
              />
              <p className="mt-3 text-sm font-semibold text-text-primary">
                {searchTerm
                  ? 'Không tìm thấy dạng câu hỏi phù hợp'
                  : 'Chưa có dạng câu hỏi nào'}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {searchTerm
                  ? 'Thử nhập từ khóa khác để lọc lại danh mục.'
                  : 'Nhấn "Thêm dạng câu hỏi" ở góc trên để tạo mới.'}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-surface-border bg-surface-muted/50 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                      <th className="px-4 py-3">Mã định danh</th>
                      <th className="px-4 py-3">Tên dạng câu hỏi</th>
                      <th className="px-4 py-3">Mô tả</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {filteredItems.map((row) => {
                      const isCore = CORE_CODE_SET.has(row.code);

                      return (
                        <tr
                          key={row.id}
                          className="transition-colors hover:bg-surface-muted/30"
                        >
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="rounded border border-surface-border bg-surface-muted px-2 py-0.5 font-mono text-xs font-semibold text-text-primary">
                                {row.code}
                              </span>
                              {isCore ? (
                                <Badge variant="outline" className="text-[10px]">
                                  Chuẩn v1
                                </Badge>
                              ) : null}
                              <CopyButton
                                value={row.code}
                                ariaLabel={`Sao chép mã dạng ${row.code}`}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-text-primary">
                            {row.name}
                          </td>
                          <td className="max-w-md px-4 py-3 text-text-secondary">
                            {row.description || (
                              <span className="italic">Chưa có mô tả</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openEditModal(row)}
                                aria-label={`Chỉnh sửa dạng ${row.name}`}
                                className="h-8 gap-1 px-2.5 text-xs"
                              >
                                <Pencil aria-hidden="true" className="size-3.5" />
                                <span>Sửa</span>
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeleteTarget(row);
                                }}
                                aria-label={`Xóa dạng ${row.name}`}
                                className="h-8 gap-1 border-semantic-error/30 bg-semantic-error-bg px-2.5 text-xs text-semantic-error hover:bg-semantic-error/15 hover:text-semantic-error"
                              >
                                <Trash2 aria-hidden="true" className="size-3.5" />
                                <span>Xóa</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="divide-y divide-surface-border md:hidden">
                {filteredItems.map((row) => {
                  const isCore = CORE_CODE_SET.has(row.code);

                  return (
                    <div key={row.id} className="space-y-2.5 p-4 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded border border-surface-border bg-surface-muted px-2 py-0.5 font-mono font-semibold text-text-primary">
                              {row.code}
                            </span>
                            {isCore ? (
                              <Badge variant="outline" className="text-[10px]">
                                Chuẩn v1
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-sm font-semibold text-text-primary">
                            {row.name}
                          </p>
                        </div>
                      </div>

                      <p className="text-text-secondary">
                        {row.description || (
                          <span className="italic">Chưa có mô tả</span>
                        )}
                      </p>

                      <div className="flex items-center justify-end gap-2 border-t border-surface-border pt-2.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(row)}
                          className="h-8 gap-1 px-2.5 text-xs"
                        >
                          <Pencil aria-hidden="true" className="size-3.5" />
                          <span>Sửa</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(row);
                          }}
                          className="h-8 gap-1 border-semantic-error/30 bg-semantic-error-bg px-2.5 text-xs text-semantic-error hover:bg-semantic-error/15 hover:text-semantic-error"
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" />
                          <span>Xóa</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <AccessibleModal
        isOpen={Boolean(formState)}
        onClose={() => !isSaving && setFormState(null)}
        title={
          formState?.mode === 'edit'
            ? 'Chỉnh sửa dạng câu hỏi'
            : 'Thêm dạng câu hỏi mới'
        }
        description="Mã định danh tự động chuẩn hóa thành chữ in hoa (tối đa 30 ký tự)."
      >
        <form onSubmit={handleSaveForm} className="space-y-4" noValidate>
          {isEditingCoreCode ? (
            <div className="flex items-start gap-2 rounded-md border border-semantic-warning/40 bg-semantic-warning-bg p-3 text-xs text-semantic-warning">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p>
                Đây là mã chuẩn hóa của hệ thống. Thay đổi mã định danh (<span className="font-mono">{formState?.record?.code}</span>) có thể khiến trình biên soạn hoặc chấm điểm tự động không nhận dạng được dạng câu hỏi này.
              </p>
            </div>
          ) : null}

          <div>
            <label
              htmlFor={codeInputId}
              className="mb-1 block text-xs font-semibold text-text-primary"
            >
              Mã dạng câu hỏi <span className="text-semantic-error">*</span>
            </label>
            <Input
              id={codeInputId}
              value={draftCode}
              onChange={(e) => {
                setDraftCode(e.target.value.toUpperCase());
                if (formError) setFormError(null);
              }}
              placeholder="Ví dụ: ORDERING hoặc TRUE_FALSE"
              maxLength={30}
              className="h-9 font-mono text-xs uppercase"
              required
            />
          </div>

          <div>
            <label
              htmlFor={nameInputId}
              className="mb-1 block text-xs font-semibold text-text-primary"
            >
              Tên hiển thị <span className="text-semantic-error">*</span>
            </label>
            <Input
              id={nameInputId}
              value={draftName}
              onChange={(e) => {
                setDraftName(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="Ví dụ: Sắp xếp thứ tự"
              maxLength={100}
              className="h-9 text-xs"
              required
            />
          </div>

          <div>
            <label
              htmlFor={descInputId}
              className="mb-1 block text-xs font-semibold text-text-primary"
            >
              Mô tả (tùy chọn)
            </label>
            <Textarea
              id={descInputId}
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              placeholder="Mô tả ngắn gọn cách sử dụng hoặc quy cách dữ liệu..."
              rows={3}
              className="text-xs"
            />
          </div>

          {formError ? (
            <div
              role="alert"
              className="rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3 text-xs text-semantic-error"
            >
              <p>{formError.message}</p>
              {formError.code || formError.traceId ? (
                <div className="mt-1.5">
                  <TechnicalDetails code={formError.code} traceId={formError.traceId} />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-surface-border pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFormState(null)}
              disabled={isSaving}
              className="h-8 text-xs"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="h-8 text-xs font-semibold"
            >
              {isSaving
                ? 'Đang lưu...'
                : formState?.mode === 'edit'
                  ? 'Lưu thay đổi'
                  : 'Tạo dạng câu hỏi'}
            </Button>
          </div>
        </form>
      </AccessibleModal>

      {/* Delete Confirmation Modal */}
      <AccessibleModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        title="Xác nhận xóa dạng câu hỏi"
        description={
          deleteTarget
            ? `Bạn sắp ngừng sử dụng dạng câu hỏi "${deleteTarget.name}" (${deleteTarget.code}).`
            : undefined
        }
      >
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-text-secondary">
            Thao tác xóa chỉ thực hiện được khi chưa có câu hỏi hoặc ma trận đề thi nào tham chiếu đến dạng này.
          </p>

          {deleteError ? (
            <div
              role="alert"
              className="rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3 text-xs text-semantic-error"
            >
              <p>{deleteError.message}</p>
              {deleteError.code || deleteError.traceId ? (
                <div className="mt-1.5">
                  <TechnicalDetails
                    code={deleteError.code}
                    traceId={deleteError.traceId}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-surface-border pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="h-8 text-xs"
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="h-8 text-xs font-semibold"
            >
              {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
            </Button>
          </div>
        </div>
      </AccessibleModal>
    </div>
  );
}
