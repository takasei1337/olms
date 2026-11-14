import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateUuid } from '../../../../lib/uuid';
import type { AnswerSpecSingleChoice } from '../../types';

interface SingleChoiceEditorProps {
  spec: AnswerSpecSingleChoice;
  onChange: (next: AnswerSpecSingleChoice) => void;
  disabled?: boolean;
}

export function SingleChoiceEditor({
  spec,
  onChange,
  disabled = false,
}: SingleChoiceEditorProps) {
  const handleTextChange = (index: number, text: string) => {
    const nextChoices = [...spec.choices];
    nextChoices[index] = { ...nextChoices[index], text };
    onChange({ ...spec, choices: nextChoices });
  };

  const handleSelectCorrect = (index: number) => {
    const nextChoices = spec.choices.map((c, i) => ({
      ...c,
      is_correct: i === index,
    }));
    onChange({ ...spec, choices: nextChoices });
  };

  const handleAddChoice = () => {
    const nextChoices = [
      ...spec.choices,
      {
        id: generateUuid(),
        text: '',
        order_no: spec.choices.length + 1,
        is_correct: false,
      },
    ];
    onChange({ ...spec, choices: nextChoices });
  };

  const handleRemoveChoice = (index: number) => {
    if (spec.choices.length <= 2) return;
    const removedWasCorrect = spec.choices[index].is_correct;
    const remaining = spec.choices.filter((_, i) => i !== index);
    const nextChoices = remaining.map((c, i) => ({
      ...c,
      order_no: i + 1,
      // If we removed the only correct choice, make the first choice correct
      is_correct: removedWasCorrect && i === 0 ? true : c.is_correct,
    }));
    onChange({ ...spec, choices: nextChoices });
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= spec.choices.length) return;

    const nextChoices = [...spec.choices];
    const temp = nextChoices[index];
    nextChoices[index] = nextChoices[targetIndex];
    nextChoices[targetIndex] = temp;

    // Reassign order_no strictly 1..N while keeping choice IDs stable
    const reordered = nextChoices.map((c, i) => ({ ...c, order_no: i + 1 }));
    onChange({ ...spec, choices: reordered });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-primary">
          Danh sách lựa chọn (Tối thiểu 2 lựa chọn, chọn 1 đáp án đúng)
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddChoice}
          disabled={disabled}
          className="h-7 gap-1 px-2 text-xs font-semibold"
        >
          <Plus aria-hidden="true" className="size-3" />
          <span>Thêm lựa chọn</span>
        </Button>
      </div>

      <div className="space-y-2">
        {spec.choices.map((choice, index) => {
          const letter = String.fromCharCode(65 + index); // A, B, C, D...

          return (
            <div
              key={choice.id}
              className={`flex items-center gap-2 rounded-md border p-2 transition-colors ${
                choice.is_correct
                  ? 'border-semantic-success bg-semantic-success-bg/30'
                  : 'border-surface-border bg-surface-card'
              }`}
            >
              {/* Radio for is_correct */}
              <label
                className="flex cursor-pointer items-center gap-1.5 px-1 text-xs font-bold text-text-primary"
                title="Chọn làm đáp án đúng"
              >
                <input
                  type="radio"
                  name="single_choice_correct"
                  checked={choice.is_correct}
                  onChange={() => handleSelectCorrect(index)}
                  disabled={disabled}
                  className="size-4 accent-brand-600 focus:ring-1 focus:ring-brand-500"
                />
                <span className="font-mono text-xs">{letter}.</span>
              </label>

              {/* Text input */}
              <Input
                value={choice.text}
                onChange={(e) => handleTextChange(index, e.target.value)}
                disabled={disabled}
                placeholder={`Nội dung lựa chọn ${letter}...`}
                className="h-8 flex-1 bg-surface-card text-xs text-text-primary"
              />

              {/* Reorder and Delete controls */}
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleMove(index, 'up')}
                  disabled={disabled || index === 0}
                  aria-label={`Di chuyển lựa chọn ${letter} lên`}
                  className="size-7 text-text-secondary hover:text-text-primary disabled:opacity-30"
                >
                  <ArrowUp aria-hidden="true" className="size-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleMove(index, 'down')}
                  disabled={disabled || index === spec.choices.length - 1}
                  aria-label={`Di chuyển lựa chọn ${letter} xuống`}
                  className="size-7 text-text-secondary hover:text-text-primary disabled:opacity-30"
                >
                  <ArrowDown aria-hidden="true" className="size-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveChoice(index)}
                  disabled={disabled || spec.choices.length <= 2}
                  aria-label={`Xóa lựa chọn ${letter}`}
                  className="size-7 text-semantic-error hover:bg-semantic-error-bg disabled:opacity-30"
                >
                  <Trash2 aria-hidden="true" className="size-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
