import React, { useEffect, useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AccessibleModal } from '@/components/ui/AccessibleModal';
import { ApiError } from '../../../api/client';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import type { Lesson } from '../types';
import { createLessonApi, updateLessonApi } from '../catalog.api';

interface LessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapterId: string;
  chapterName: string;
  lesson: Lesson | null; // null => create mode
  defaultOrderNo?: number;
  onSuccess: (saved: Lesson) => void;
}

export function LessonModal({
  isOpen,
  onClose,
  chapterId,
  chapterName,
  lesson,
  defaultOrderNo = 1,
  onSuccess,
}: LessonModalProps) {
  const isEdit = Boolean(lesson);
  const nameId = useId();
  const codeId = useId();
  const orderId = useId();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [orderNo, setOrderNo] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    code?: string;
    traceId?: string;
    serverMessage?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (lesson) {
        setName(lesson.name || '');
        setCode(lesson.code || '');
        setOrderNo(lesson.order_no ?? 1);
      } else {
        setName('');
        setCode('');
        setOrderNo(defaultOrderNo);
      }
      setErrorMessage(null);
      setErrorDetails(null);
    }
  }, [isOpen, lesson, defaultOrderNo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim();

    if (!trimmedName) {
      setErrorMessage('Vui lòng nhập tên bài học.');
      return;
    }
    if (trimmedName.length > 150) {
      setErrorMessage('Tên bài học không được vượt quá 150 ký tự.');
      return;
    }
    if (trimmedCode.length > 20) {
      setErrorMessage('Mã bài học không được vượt quá 20 ký tự.');
      return;
    }
    if (!Number.isInteger(Number(orderNo)) || Number(orderNo) < 0) {
      setErrorMessage('Thứ tự sắp xếp phải là số nguyên không âm.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setErrorDetails(null);

    try {
      if (isEdit && lesson) {
        const res = await updateLessonApi(lesson.id, {
          name: trimmedName,
          code: trimmedCode || null,
          order_no: Number(orderNo),
        });
        onSuccess(res.data);
      } else {
        const res = await createLessonApi(chapterId, {
          name: trimmedName,
          code: trimmedCode || null,
          order_no: Number(orderNo),
        });
        onSuccess(res.data);
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'CONFLICT') {
          setErrorMessage('Mã bài học này đã tồn tại trong chương.');
        } else if (err.code === 'FORBIDDEN') {
          setErrorMessage('Bạn không có quyền thao tác trên bài học này.');
        } else {
          setErrorMessage(err.message || 'Không thể lưu bài học. Vui lòng thử lại.');
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
      title={isEdit ? 'Chỉnh sửa bài học' : 'Thêm bài học mới'}
      description={`Chương: ${chapterName}`}
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
            htmlFor={nameId}
            className="mb-1 block text-xs font-semibold text-text-primary"
          >
            Tên bài học <span className="text-semantic-error">*</span>
          </label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            placeholder="Ví dụ: Bài 1: Khái niệm giới hạn hàm số..."
            maxLength={150}
            className="h-9 bg-surface-card text-sm text-text-primary placeholder:text-text-secondary"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor={codeId}
              className="mb-1 block text-xs font-semibold text-text-primary"
            >
              Mã bài <span className="font-normal text-text-secondary">(tùy chọn)</span>
            </label>
            <Input
              id={codeId}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isSubmitting}
              placeholder="Ví dụ: L1, LESSON_01..."
              maxLength={20}
              className="h-9 bg-surface-card text-sm text-text-primary placeholder:text-text-secondary"
            />
          </div>

          <div>
            <label
              htmlFor={orderId}
              className="mb-1 block text-xs font-semibold text-text-primary"
            >
              Thứ tự hiển thị
            </label>
            <Input
              id={orderId}
              type="number"
              min={0}
              value={orderNo}
              onChange={(e) => setOrderNo(Number(e.target.value))}
              disabled={isSubmitting}
              className="h-9 bg-surface-card text-sm text-text-primary"
            />
          </div>
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
              <span>{isEdit ? 'Lưu thay đổi' : 'Thêm bài học'}</span>
            )}
          </Button>
        </div>
      </form>
    </AccessibleModal>
  );
}
