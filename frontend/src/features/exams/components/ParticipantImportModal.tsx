import React, { useEffect, useId, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiError } from '../../../api/client';
import { AccessibleModal } from '../../../components/ui/AccessibleModal';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import {
  commitParticipantsImportApi,
  previewParticipantsImportApi,
} from '../exams.api';
import type {
  ParticipantImportCommitResult,
  ParticipantImportPreviewResult,
} from '../types';
import { buildParticipantsCsvTemplate, downloadTextFile } from '../utils';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

interface ParticipantImportModalProps {
  isOpen: boolean;
  examId: string;
  examCode: string;
  onClose: () => void;
  onSuccess: (summary: ParticipantImportCommitResult) => void;
}

export function ParticipantImportModal({
  isOpen,
  examId,
  examCode,
  onClose,
  onSuccess,
}: ParticipantImportModalProps) {
  const fileInputId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<unknown>(null);

  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [previewResult, setPreviewResult] =
    useState<ParticipantImportPreviewResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedFile(null);
    setClientError(null);
    setApiError(null);
    setPreviewResult(null);
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientError(null);
    setApiError(null);
    setPreviewResult(null);

    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.xls')) {
      setClientError(
        'Không hỗ trợ định dạng .xls cũ. Vui lòng chuyển sang .xlsx hoặc .csv.'
      );
      setSelectedFile(null);
      return;
    }
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx')) {
      setClientError('Vui lòng chỉ chọn tệp định dạng .csv hoặc .xlsx.');
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setClientError('Dung lượng tệp vượt quá giới hạn tối đa 5MB.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDownloadTemplate = () => {
    downloadTextFile(
      buildParticipantsCsvTemplate(),
      `mau-thi-sinh-${examCode.toLowerCase()}.csv`,
      'text/csv;charset=utf-8'
    );
  };

  const handlePreviewUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);
    setApiError(null);

    if (!selectedFile) {
      setClientError('Vui lòng chọn tệp danh sách thí sinh (.csv hoặc .xlsx).');
      return;
    }

    setIsPreviewing(true);
    try {
      const res = await previewParticipantsImportApi(examId, selectedFile);
      setPreviewResult(res.data);
    } catch (err) {
      setApiError(err);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!previewResult?.import_token) return;
    setClientError(null);
    setApiError(null);
    setIsCommitting(true);

    try {
      const res = await commitParticipantsImportApi(
        examId,
        previewResult.import_token
      );
      onSuccess(res.data);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_IMPORT_TOKEN') {
        setPreviewResult(null);
      }
      setApiError(err);
    } finally {
      setIsCommitting(false);
    }
  };

  const errorMessage =
    clientError ||
    (apiError instanceof ApiError
      ? apiError.message
      : apiError
      ? 'Không thể xử lý tệp import. Vui lòng kiểm tra lại.'
      : null);

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      isBusy={isPreviewing || isCommitting}
      maxWidthClass="max-w-3xl"
      title="Import danh sách thí sinh từ CSV / XLSX"
      description="Quy trình 2 bước: tải tệp để kiểm tra hợp lệ từng dòng trước khi xác nhận ghi danh hàng loạt."
    >
      <div className="space-y-4">
        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-semantic-danger/30 bg-semantic-danger-bg px-3.5 py-2.5 text-xs text-semantic-danger"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium leading-relaxed">{errorMessage}</p>
              {apiError instanceof ApiError ? (
                <TechnicalDetails
                  code={apiError.code}
                  traceId={apiError.traceId}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {!previewResult ? (
          <form onSubmit={handlePreviewUpload} className="space-y-4">
            <div className="flex flex-col justify-between gap-2 rounded-lg border border-surface-border bg-surface-muted/35 p-3.5 text-xs sm:flex-row sm:items-center">
              <div className="space-y-0.5">
                <p className="font-semibold text-text-primary">
                  Tệp mẫu chuẩn CSV (student_code, full_name, email)
                </p>
                <p className="text-[11px] text-text-secondary">
                  Hỗ trợ .csv hoặc .xlsx tối đa 5MB. Các cột mssv / ma_sv / ho_ten đều được nhận diện.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="h-8 shrink-0 gap-1.5 text-xs font-medium"
              >
                <Download aria-hidden="true" className="size-3.5" />
                <span>Tải file CSV mẫu</span>
              </Button>
            </div>

            <div className="rounded-lg border border-dashed border-surface-border bg-surface-card p-5 text-center">
              <FileSpreadsheet
                aria-hidden="true"
                className="mx-auto mb-2 size-7 text-text-secondary"
              />
              <label
                htmlFor={fileInputId}
                className="block cursor-pointer text-xs font-medium text-text-primary"
              >
                Chọn tệp danh sách thí sinh (.csv hoặc .xlsx)
              </label>
              <input
                id={fileInputId}
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileChange}
                disabled={isPreviewing}
                className="mt-3 block w-full cursor-pointer text-xs text-text-secondary file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-surface-border file:bg-surface-muted file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-text-primary hover:file:bg-surface-border/40"
              />
              {selectedFile ? (
                <p className="mt-2 text-[11px] font-medium text-brand-600 dark:text-brand-300">
                  Đã chọn: {selectedFile.name} (
                  {Math.max(1, Math.round(selectedFile.size / 1024))} KB)
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-surface-border pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isPreviewing}
                className="h-8 text-xs font-medium"
              >
                Đóng
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPreviewing || !selectedFile}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                {isPreviewing ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                  />
                ) : (
                  <Upload aria-hidden="true" className="size-3.5" />
                )}
                <span>Bước 1: Kiểm tra &amp; Xem trước</span>
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-lg border border-semantic-success/30 bg-semantic-success-bg px-3 py-2 text-xs">
                <p className="text-[11px] text-semantic-success">Hợp lệ</p>
                <p className="text-base font-bold tabular-nums text-semantic-success">
                  {previewResult.valid_count}
                </p>
              </div>
              <div className="rounded-lg border border-semantic-warning/35 bg-semantic-warning-bg px-3 py-2 text-xs">
                <p className="text-[11px] text-semantic-warning">Trùng lặp</p>
                <p className="text-base font-bold tabular-nums text-semantic-warning">
                  {previewResult.duplicate_count}
                </p>
              </div>
              <div className="rounded-lg border border-semantic-danger/30 bg-semantic-danger-bg px-3 py-2 text-xs">
                <p className="text-[11px] text-semantic-danger">Lỗi / Bỏ qua</p>
                <p className="text-base font-bold tabular-nums text-semantic-danger">
                  {previewResult.invalid_count}
                </p>
              </div>
            </div>

            {/* Rows preview */}
            <div className="max-h-64 overflow-auto rounded-lg border border-surface-border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-surface-border bg-surface-muted text-[11px] font-semibold text-text-secondary">
                  <tr>
                    <th scope="col" className="w-16 px-3 py-2">
                      Dòng
                    </th>
                    <th scope="col" className="w-32 px-3 py-2">
                      MSSV
                    </th>
                    <th scope="col" className="min-w-[160px] px-3 py-2">
                      Họ và tên
                    </th>
                    <th scope="col" className="w-28 px-3 py-2">
                      Kết quả
                    </th>
                    <th scope="col" className="min-w-[180px] px-3 py-2">
                      Ghi chú
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {previewResult.rows.map((row) => (
                    <tr key={`${row.row_no}-${row.student_code}`}>
                      <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-text-secondary">
                        #{row.row_no}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs font-medium text-text-primary">
                        {row.student_code || '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-text-primary">
                        {row.full_name || '—'}
                      </td>
                      <td className="px-3 py-2">
                        {row.valid ? (
                          <Badge variant="outline" className="text-[10px] text-semantic-success border-semantic-success/40">
                            Hợp lệ
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            Bỏ qua
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-text-secondary">
                        {row.warning || 'Sẵn sàng ghi danh'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-border pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isCommitting}
                onClick={() => {
                  setPreviewResult(null);
                  setApiError(null);
                }}
                className="h-8 text-xs font-medium"
              >
                Chọn lại tệp khác
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isCommitting || previewResult.valid_count === 0}
                onClick={handleCommitImport}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                {isCommitting ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                  />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="size-3.5" />
                )}
                <span>
                  Bước 2: Xác nhận ghi danh ({previewResult.valid_count} hợp lệ)
                </span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </AccessibleModal>
  );
}
