import React, { useEffect, useId, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '../../../api/client';
import { AccessibleModal } from '../../../components/ui/AccessibleModal';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import type { Subject } from '../../catalog/types';
import { createExamApi, updateExamApi } from '../exams.api';
import {
  DELIVERY_MODE_LABELS,
  VISIBILITY_MODE_LABELS,
  type CreateExamPayload,
  type ExamDeliveryMode,
  type ExamRecord,
  type ExamResultVisibilityMode,
} from '../types';
import {
  fromLocalDateTimeInput,
  getDefaultExamScheduleInputs,
  toLocalDateTimeInput,
} from '../utils';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ExamFormModalProps {
  isOpen: boolean;
  exam: ExamRecord | null;
  subjects: Subject[];
  onClose: () => void;
  onSuccess: (savedExam: ExamRecord, mode: 'create' | 'edit') => void;
}

export function ExamFormModal({
  isOpen,
  exam,
  subjects,
  onClose,
  onSuccess,
}: ExamFormModalProps) {
  const isEdit = Boolean(exam);
  const idPrefix = useId();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<ExamDeliveryMode>('ONLINE');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [totalQuestions, setTotalQuestions] = useState('10');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [totalScore, setTotalScore] = useState('10');
  const [visibilityMode, setVisibilityMode] =
    useState<ExamResultVisibilityMode>('HIDDEN');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (exam) {
      setCode(exam.code);
      setName(exam.name);
      setSubjectId(exam.subject_id);
      setDeliveryMode(exam.delivery_mode);
      setFormTemplateId(exam.form_template_id ?? '');
      setTotalQuestions(String(exam.total_questions));
      setDurationMinutes(String(exam.duration_minutes));
      setTotalScore(String(exam.total_score));
      setVisibilityMode(exam.result_visibility_mode);
      setOpensAt(toLocalDateTimeInput(exam.opens_at));
      setClosesAt(toLocalDateTimeInput(exam.closes_at));
    } else {
      const defaults = getDefaultExamScheduleInputs();
      setCode('');
      setName('');
      setSubjectId(subjects[0]?.id ?? '');
      setDeliveryMode('ONLINE');
      setFormTemplateId('');
      setTotalQuestions('10');
      setDurationMinutes('45');
      setTotalScore('10');
      setVisibilityMode('HIDDEN');
      setOpensAt(defaults.opensAt);
      setClosesAt(defaults.closesAt);
    }
    setValidationError(null);
    setSubmitError(null);
  }, [isOpen, exam, subjects]);

  const requiresFormTemplate =
    deliveryMode === 'PAPER' || deliveryMode === 'BOTH';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSubmitError(null);

    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    if (!trimmedCode) {
      setValidationError('Vui lòng nhập mã kỳ thi.');
      return;
    }
    if (trimmedCode.length > 30) {
      setValidationError('Mã kỳ thi tối đa 30 ký tự.');
      return;
    }
    if (!trimmedName) {
      setValidationError('Vui lòng nhập tên kỳ thi.');
      return;
    }
    if (trimmedName.length > 200) {
      setValidationError('Tên kỳ thi tối đa 200 ký tự.');
      return;
    }
    if (!subjectId) {
      setValidationError('Vui lòng chọn môn học cho kỳ thi.');
      return;
    }

    const parsedQuestions = Number.parseInt(totalQuestions, 10);
    if (!Number.isInteger(parsedQuestions) || parsedQuestions < 1) {
      setValidationError('Tổng số câu hỏi phải là số nguyên lớn hơn hoặc bằng 1.');
      return;
    }

    const parsedDuration = Number.parseInt(durationMinutes, 10);
    if (!Number.isInteger(parsedDuration) || parsedDuration < 1) {
      setValidationError('Thời lượng làm bài (phút) phải là số nguyên dương.');
      return;
    }

    const parsedScore = Number.parseFloat(totalScore);
    if (!Number.isFinite(parsedScore) || parsedScore <= 0) {
      setValidationError('Tổng điểm kỳ thi phải lớn hơn 0.');
      return;
    }

    const opensIso = fromLocalDateTimeInput(opensAt);
    const closesIso = fromLocalDateTimeInput(closesAt);
    if (!opensIso || !closesIso) {
      setValidationError('Vui lòng chọn đầy đủ thời điểm mở đề và đóng đề.');
      return;
    }
    if (new Date(closesIso).getTime() <= new Date(opensIso).getTime()) {
      setValidationError('Thời điểm đóng đề phải diễn ra sau thời điểm mở đề.');
      return;
    }

    const trimmedTemplateId = formTemplateId.trim();
    if (requiresFormTemplate && !UUID_PATTERN.test(trimmedTemplateId)) {
      setValidationError(
        'Hình thức Thi giấy hoặc Kết hợp yêu cầu mã mẫu phiếu OMR (UUID) hợp lệ.'
      );
      return;
    }

    const payload: CreateExamPayload = {
      code: trimmedCode,
      name: trimmedName,
      subject_id: subjectId,
      delivery_mode: deliveryMode,
      total_questions: parsedQuestions,
      duration_minutes: parsedDuration,
      opens_at: opensIso,
      closes_at: closesIso,
      total_score: parsedScore,
      result_visibility_mode: visibilityMode,
      form_template_id: requiresFormTemplate ? trimmedTemplateId : null,
    };

    setIsSubmitting(true);
    try {
      const response = isEdit && exam
        ? await updateExamApi(exam.id, payload)
        : await createExamApi(payload);
      onSuccess(response.data, isEdit ? 'edit' : 'create');
      onClose();
    } catch (err) {
      setSubmitError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError =
    validationError ||
    (submitError instanceof ApiError
      ? submitError.message
      : submitError
      ? 'Không thể lưu thông tin kỳ thi. Vui lòng thử lại.'
      : null);

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      isBusy={isSubmitting}
      maxWidthClass="max-w-2xl"
      title={isEdit ? 'Chỉnh sửa thông tin kỳ thi' : 'Tạo kỳ thi mới'}
      description={
        isEdit
          ? 'Chỉ chỉnh sửa được thông tin cấu hình khi kỳ thi đang ở trạng thái Bản nháp.'
          : 'Kỳ thi được tạo ở trạng thái Bản nháp để thiết lập ma trận, đề gốc và danh sách thí sinh.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {displayError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-semantic-danger/30 bg-semantic-danger-bg px-3.5 py-2.5 text-xs text-semantic-danger"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium leading-relaxed">{displayError}</p>
              {submitError instanceof ApiError ? (
                <TechnicalDetails
                  code={submitError.code}
                  traceId={submitError.traceId}
                  className="mt-1"
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${idPrefix}-code`}
              className="mb-1.5 block text-xs font-medium text-text-primary"
            >
              Mã kỳ thi <span className="text-semantic-danger">*</span>
            </label>
            <Input
              id={`${idPrefix}-code`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ví dụ: CSDL-GK-2026"
              maxLength={30}
              disabled={isSubmitting}
              className="h-9 bg-surface-card font-mono text-xs uppercase text-text-primary"
            />
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-subject`}
              className="mb-1.5 block text-xs font-medium text-text-primary"
            >
              Môn học <span className="text-semantic-danger">*</span>
            </label>
            <Select
              value={subjectId}
              onValueChange={setSubjectId}
              disabled={isSubmitting}
            >
              <SelectTrigger
                id={`${idPrefix}-subject`}
                className="h-9 bg-surface-card text-xs text-text-primary"
              >
                <SelectValue placeholder="Chọn môn học" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.code} — {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor={`${idPrefix}-name`}
              className="mb-1.5 block text-xs font-medium text-text-primary"
            >
              Tên kỳ thi <span className="text-semantic-danger">*</span>
            </label>
            <Input
              id={`${idPrefix}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Kiểm tra giữa kỳ Cơ sở dữ liệu"
              maxLength={200}
              disabled={isSubmitting}
              className="h-9 bg-surface-card text-xs text-text-primary"
            />
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-questions`}
              className="mb-1.5 block text-xs font-medium text-text-primary"
            >
              Tổng số câu hỏi <span className="text-semantic-danger">*</span>
            </label>
            <Input
              id={`${idPrefix}-questions`}
              type="number"
              min={1}
              step={1}
              value={totalQuestions}
              onChange={(e) => setTotalQuestions(e.target.value)}
              disabled={isSubmitting}
              className="h-9 bg-surface-card text-xs tabular-nums text-text-primary"
            />
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-duration`}
              className="mb-1.5 block text-xs font-medium text-text-primary"
            >
              Thời lượng làm bài (phút) <span className="text-semantic-danger">*</span>
            </label>
            <Input
              id={`${idPrefix}-duration`}
              type="number"
              min={1}
              step={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              disabled={isSubmitting}
              className="h-9 bg-surface-card text-xs tabular-nums text-text-primary"
            />
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-score`}
              className="mb-1.5 block text-xs font-medium text-text-primary"
            >
              Tổng điểm kỳ thi <span className="text-semantic-danger">*</span>
            </label>
            <Input
              id={`${idPrefix}-score`}
              type="number"
              min={0.5}
              step="any"
              value={totalScore}
              onChange={(e) => setTotalScore(e.target.value)}
              disabled={isSubmitting}
              className="h-9 bg-surface-card text-xs tabular-nums text-text-primary"
            />
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-delivery`}
              className="mb-1.5 block text-xs font-medium text-text-primary"
            >
              Hình thức tổ chức
            </label>
            <Select
              value={deliveryMode}
              onValueChange={(val) => setDeliveryMode(val as ExamDeliveryMode)}
              disabled={isSubmitting}
            >
              <SelectTrigger
                id={`${idPrefix}-delivery`}
                className="h-9 bg-surface-card text-xs text-text-primary"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DELIVERY_MODE_LABELS) as ExamDeliveryMode[]).map(
                  (mode) => (
                    <SelectItem key={mode} value={mode}>
                      {DELIVERY_MODE_LABELS[mode]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {requiresFormTemplate ? (
            <div className="sm:col-span-2">
              <label
                htmlFor={`${idPrefix}-template`}
                className="mb-1.5 block text-xs font-medium text-text-primary"
              >
                Mã mẫu phiếu OMR (UUID) <span className="text-semantic-danger">*</span>
              </label>
              <Input
                id={`${idPrefix}-template`}
                value={formTemplateId}
                onChange={(e) => setFormTemplateId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                disabled={isSubmitting}
                className="h-9 bg-surface-card font-mono text-xs text-text-primary"
              />
              <p className="mt-1 text-[11px] text-text-secondary">
                Danh mục mẫu phiếu OMR chưa mở API quản lý trên giao diện; vui lòng nhập mã UUID đã cấu hình hoặc dùng hình thức Thi trực tuyến.
              </p>
            </div>
          ) : null}

          <div>
            <label
              htmlFor={`${idPrefix}-opens`}
              className="mb-1.5 block text-xs font-medium text-text-primary"
            >
              Thời điểm mở đề <span className="text-semantic-danger">*</span>
            </label>
            <Input
              id={`${idPrefix}-opens`}
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              disabled={isSubmitting}
              className="h-9 bg-surface-card text-xs tabular-nums text-text-primary"
            />
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-closes`}
              className="mb-1.5 block text-xs font-medium text-text-primary"
            >
              Thời điểm đóng đề <span className="text-semantic-danger">*</span>
            </label>
            <Input
              id={`${idPrefix}-closes`}
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              disabled={isSubmitting}
              className="h-9 bg-surface-card text-xs tabular-nums text-text-primary"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor={`${idPrefix}-visibility`}
              className="mb-1.5 block text-xs font-medium text-text-primary"
            >
              Chế độ hiển thị kết quả sau khi công bố
            </label>
            <Select
              value={visibilityMode}
              onValueChange={(val) =>
                setVisibilityMode(val as ExamResultVisibilityMode)
              }
              disabled={isSubmitting}
            >
              <SelectTrigger
                id={`${idPrefix}-visibility`}
                className="h-9 bg-surface-card text-xs text-text-primary"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.keys(VISIBILITY_MODE_LABELS) as ExamResultVisibilityMode[]
                ).map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {VISIBILITY_MODE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-surface-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-8 text-xs font-medium"
          >
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            {isSubmitting ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : null}
            <span>{isEdit ? 'Lưu thay đổi' : 'Tạo kỳ thi'}</span>
          </Button>
        </div>
      </form>
    </AccessibleModal>
  );
}
