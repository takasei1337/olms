import React, { useEffect, useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AccessibleModal } from '@/components/ui/AccessibleModal';
import { ApiError } from '../../../api/client';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import type { Subject } from '../types';
import { createSubjectApi, updateSubjectApi } from '../catalog.api';

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject | null; // null => create mode
  onSuccess: (saved: Subject) => void;
}

export function SubjectModal({
  isOpen,
  onClose,
  subject,
  onSuccess,
}: SubjectModalProps) {
  const isEdit = Boolean(subject);
  const codeId = useId();
  const nameId = useId();
  const descId = useId();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    code?: string;
    traceId?: string;
    serverMessage?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (subject) {
        setCode(subject.code || '');
        setName(subject.name || '');
        setDescription(subject.description || '');
      } else {
        setCode('');
        setName('');
        setDescription('');
      }
      setErrorMessage(null);
      setErrorDetails(null);
    }
  }, [isOpen, subject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    const trimmedName = name.trim();

    if (!trimmedCode) {
      setErrorMessage('Vui lòng nhập mã môn học.');
      return;
    }
    if (trimmedCode.length > 20) {
      setErrorMessage('Mã môn học không được vượt quá 20 ký tự.');
      return;
    }
    if (!trimmedName) {
      setErrorMessage('Vui lòng nhập tên môn học.');
      return;
    }
    if (trimmedName.length > 150) {
      setErrorMessage('Tên môn học không được vượt quá 150 ký tự.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setErrorDetails(null);

    try {
      if (isEdit && subject) {
        const res = await updateSubjectApi(subject.id, {
          code: trimmedCode,
          name: trimmedName,
          description: description.trim() || null,
        });
        onSuccess(res.data);
      } else {
        const res = await createSubjectApi({
          code: trimmedCode,
          name: trimmedName,
          description: description.trim() || null,
        });
        onSuccess(res.data);
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'CONFLICT') {
          setErrorMessage('Mã môn học này đã tồn tại trong hệ thống. Vui lòng chọn mã khác.');
        } else if (err.code === 'FORBIDDEN') {
          setErrorMessage('Bạn không có quyền chỉnh sửa môn học này.');
        } else {
          setErrorMessage(err.message || 'Không thể lưu môn học. Vui lòng thử lại.');
        }
        setErrorDetails({
          code: err.code,
          traceId: err.traceId,
          serverMessage: err.serverMessage,
        });
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Chỉnh sửa môn học' : 'Thêm môn học mới'}
      description="Nhập mã môn và tên môn học để quản lý nội dung giảng dạy và ngân hàng câu hỏi."
      isBusy={isSubmitting}
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3 text-xs text-semantic-error"
          >
            <p className="font-semibold">{errorMessage}</p>
            {errorDetails ? (
              <div className="mt-2">
                <TechnicalDetails
                  code={errorDetails.code}
                  traceId={errorDetails.traceId}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <label
            htmlFor={codeId}
            className="mb-1 block text-xs font-semibold text-text-primary"
          >
            Mã môn học <span className="text-semantic-error">*</span>
          </label>
          <Input
            id={codeId}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={isSubmitting}
            placeholder="Ví dụ: TOAN10, IT1110..."
            maxLength={20}
            className="h-9 bg-surface-card text-sm text-text-primary placeholder:text-text-secondary"
            required
          />
          <p className="mt-1 text-[11px] text-text-secondary">
            Tối đa 20 ký tự, không được trùng lặp.
          </p>
        </div>

        <div>
          <label
            htmlFor={nameId}
            className="mb-1 block text-xs font-semibold text-text-primary"
          >
            Tên môn học <span className="text-semantic-error">*</span>
          </label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            placeholder="Ví dụ: Giải tích 1, Toán đại số 10..."
            maxLength={150}
            className="h-9 bg-surface-card text-sm text-text-primary placeholder:text-text-secondary"
            required
          />
        </div>

        <div>
          <label
            htmlFor={descId}
            className="mb-1 block text-xs font-semibold text-text-primary"
          >
            Mô tả môn học <span className="font-normal text-text-secondary">(tùy chọn)</span>
          </label>
          <Textarea
            id={descId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            placeholder="Thông tin tổng quan, chuẩn đầu ra hoặc ghi chú..."
            rows={3}
            className="bg-surface-card text-sm text-text-primary placeholder:text-text-secondary"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-surface-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 text-xs"
          >
            Hủy
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="h-9 gap-1.5 font-semibold text-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <span>{isEdit ? 'Lưu thay đổi' : 'Thêm môn học'}</span>
            )}
          </Button>
        </div>
      </form>
    </AccessibleModal>
  );
}
