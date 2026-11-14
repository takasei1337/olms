import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AnswerSpecInput } from '../../types';

interface InputEditorProps {
  spec: AnswerSpecInput;
  onChange: (next: AnswerSpecInput) => void;
  disabled?: boolean;
}

export function InputEditor({
  spec,
  onChange,
  disabled = false,
}: InputEditorProps) {
  const handleAnswerChange = (index: number, value: string) => {
    const nextAnswers = [...spec.equivalent_answers];
    nextAnswers[index] = value;
    onChange({ ...spec, equivalent_answers: nextAnswers });
  };

  const handleAddAnswer = () => {
    onChange({
      ...spec,
      equivalent_answers: [...spec.equivalent_answers, ''],
    });
  };

  const handleRemoveAnswer = (index: number) => {
    if (spec.equivalent_answers.length <= 1) return;
    const nextAnswers = spec.equivalent_answers.filter((_, i) => i !== index);
    onChange({ ...spec, equivalent_answers: nextAnswers });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-text-primary">
            Danh sách đáp án được chấp nhận (Tối thiểu 1 đáp án)
          </span>
          <p className="text-[11px] text-text-secondary">
            Thí sinh điền khớp với một trong các đáp án tương đương dưới đây sẽ được tính điểm.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddAnswer}
          disabled={disabled}
          className="h-7 gap-1 px-2 text-xs font-semibold"
        >
          <Plus aria-hidden="true" className="size-3" />
          <span>Thêm đáp án chấp nhận</span>
        </Button>
      </div>

      <div className="space-y-2">
        {spec.equivalent_answers.map((answer, index) => (
          <div
            key={index}
            className="flex items-center gap-2 rounded-md border border-surface-border bg-surface-card p-2 shadow-sm"
          >
            <span className="w-6 text-center font-mono text-xs font-bold text-text-secondary">
              #{index + 1}
            </span>
            <Input
              value={answer}
              onChange={(e) => handleAnswerChange(index, e.target.value)}
              disabled={disabled}
              placeholder="Nhập nội dung đáp án chấp nhận (ví dụ: Hà Nội)..."
              className="h-8 flex-1 bg-surface-card text-xs text-text-primary"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveAnswer(index)}
              disabled={disabled || spec.equivalent_answers.length <= 1}
              aria-label={`Xóa đáp án tương đương thứ ${index + 1}`}
              className="size-7 text-semantic-error hover:bg-semantic-error-bg disabled:opacity-30"
            >
              <Trash2 aria-hidden="true" className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
