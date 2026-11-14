import { Plus, Trash2, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AnswerSpecDropdown, DropdownBlank } from '../../types';

interface DropdownEditorProps {
  spec: AnswerSpecDropdown;
  onChange: (next: AnswerSpecDropdown) => void;
  questionContent: string;
  onContentChange: (newContent: string) => void;
  disabled?: boolean;
}

export function DropdownEditor({
  spec,
  onChange,
  questionContent,
  onContentChange,
  disabled = false,
}: DropdownEditorProps) {
  // Add new blank
  const handleAddBlank = () => {
    const nextBlankIndex = spec.blanks.length + 1;
    let nextBlankId = `b${nextBlankIndex}`;
    while (spec.blanks.some((b) => b.blank_id === nextBlankId)) {
      nextBlankId = `b${Math.floor(Math.random() * 1000)}`;
    }

    const newBlank: DropdownBlank = {
      blank_id: nextBlankId,
      choices: [
        { value_id: 'v1', label: '' },
        { value_id: 'v2', label: '' },
      ],
      correct_value_id: 'v1',
    };

    onChange({
      ...spec,
      blanks: [...spec.blanks, newBlank],
    });
  };

  // Remove blank
  const handleRemoveBlank = (blankIndex: number) => {
    if (spec.blanks.length <= 1) return;
    const target = spec.blanks[blankIndex];

    // Clean up {{blank_id}} placeholder from content
    const updatedContent = questionContent.replace(
      new RegExp(`\\{\\{${target.blank_id}\\}\\}`, 'g'),
      ''
    );
    onContentChange(updatedContent);

    const nextBlanks = spec.blanks.filter((_, i) => i !== blankIndex);
    onChange({
      ...spec,
      blanks: nextBlanks,
    });
  };

  // Rename blank_id
  const handleRenameBlankId = (blankIndex: number, newId: string) => {
    const oldId = spec.blanks[blankIndex].blank_id;
    const nextBlanks = [...spec.blanks];
    nextBlanks[blankIndex] = {
      ...nextBlanks[blankIndex],
      blank_id: newId,
    };
    onChange({ ...spec, blanks: nextBlanks });

    // Update occurrences in content if oldId was not empty
    if (oldId && newId && oldId !== newId) {
      const updatedContent = questionContent.replace(
        new RegExp(`\\{\\{${oldId}\\}\\}`, 'g'),
        `{{${newId}}}`
      );
      onContentChange(updatedContent);
    }
  };

  // Add choice to a blank
  const handleAddChoice = (blankIndex: number) => {
    const target = spec.blanks[blankIndex];
    const newChoiceId = `v${target.choices.length + 1}`;
    const nextChoices = [...target.choices, { value_id: newChoiceId, label: '' }];

    const nextBlanks = [...spec.blanks];
    nextBlanks[blankIndex] = {
      ...target,
      choices: nextChoices,
    };
    onChange({ ...spec, blanks: nextBlanks });
  };

  // Remove choice from a blank
  const handleRemoveChoice = (blankIndex: number, choiceIndex: number) => {
    const target = spec.blanks[blankIndex];
    if (target.choices.length <= 2) return;

    const removedChoice = target.choices[choiceIndex];
    const nextChoices = target.choices.filter((_, i) => i !== choiceIndex);

    // If removed choice was the correct answer, fallback to first choice
    let nextCorrectId = target.correct_value_id;
    if (target.correct_value_id === removedChoice.value_id) {
      nextCorrectId = nextChoices[0].value_id;
    }

    const nextBlanks = [...spec.blanks];
    nextBlanks[blankIndex] = {
      ...target,
      choices: nextChoices,
      correct_value_id: nextCorrectId,
    };
    onChange({ ...spec, blanks: nextBlanks });
  };

  // Update choice label
  const handleChoiceLabelChange = (
    blankIndex: number,
    choiceIndex: number,
    label: string
  ) => {
    const target = spec.blanks[blankIndex];
    const nextChoices = [...target.choices];
    nextChoices[choiceIndex] = { ...nextChoices[choiceIndex], label };

    const nextBlanks = [...spec.blanks];
    nextBlanks[blankIndex] = { ...target, choices: nextChoices };
    onChange({ ...spec, blanks: nextBlanks });
  };

  // Update correct choice for blank
  const handleSelectCorrect = (blankIndex: number, valueId: string) => {
    const nextBlanks = [...spec.blanks];
    nextBlanks[blankIndex] = {
      ...nextBlanks[blankIndex],
      correct_value_id: valueId,
    };
    onChange({ ...spec, blanks: nextBlanks });
  };

  // Insert placeholder {{blank_id}} into question content
  const handleInsertPlaceholder = (blankId: string) => {
    const placeholder = `{{${blankId}}}`;
    if (questionContent.includes(placeholder)) {
      return; // Already present
    }
    const nextContent = questionContent
      ? `${questionContent} ${placeholder}`
      : placeholder;
    onContentChange(nextContent);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-text-primary">
            Quản lý các vị trí chỗ trống (Blanks)
          </span>
          <p className="text-[11px] text-text-secondary">
            Mỗi chỗ trống cần có thẻ dạng <code className="font-mono font-bold text-brand-600">{'{{tên_chỗ_trống}}'}</code> xuất hiện đúng một lần trong nội dung đề.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddBlank}
          disabled={disabled}
          className="h-7 gap-1 px-2 text-xs font-semibold"
        >
          <Plus aria-hidden="true" className="size-3" />
          <span>Thêm chỗ trống</span>
        </Button>
      </div>

      <div className="space-y-4">
        {spec.blanks.map((blank, blankIndex) => {
          const placeholder = `{{${blank.blank_id}}}`;
          const isPresentInContent = questionContent.includes(placeholder);

          return (
            <div
              key={blankIndex}
              className="space-y-3 rounded-md border border-surface-border bg-surface-card p-3 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-primary">
                    Chỗ trống #{blankIndex + 1}:
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-text-secondary">Mã:</span>
                    <Input
                      value={blank.blank_id}
                      onChange={(e) =>
                        handleRenameBlankId(blankIndex, e.target.value.replace(/\s+/g, ''))
                      }
                      disabled={disabled}
                      placeholder="b1, b2..."
                      className="h-7 w-20 font-mono text-xs"
                    />
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={isPresentInContent ? 'secondary' : 'default'}
                    onClick={() => handleInsertPlaceholder(blank.blank_id)}
                    disabled={disabled || isPresentInContent || !blank.blank_id}
                    className="h-7 gap-1 px-2 text-[11px] font-semibold"
                  >
                    <Code2 aria-hidden="true" className="size-3" />
                    <span>
                      {isPresentInContent
                        ? `Đã chèn ${placeholder}`
                        : `Chèn ${placeholder} vào đề`}
                    </span>
                  </Button>
                </div>

                {spec.blanks.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveBlank(blankIndex)}
                    disabled={disabled}
                    className="h-7 gap-1 px-2 text-xs text-semantic-error hover:bg-semantic-error-bg"
                  >
                    <Trash2 aria-hidden="true" className="size-3" />
                    <span>Xóa chỗ trống</span>
                  </Button>
                ) : null}
              </div>

              {/* Choices in blank */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-text-secondary">
                    Các lựa chọn cho menu thả xuống (Tối thiểu 2):
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAddChoice(blankIndex)}
                    disabled={disabled}
                    className="h-6 gap-1 px-1.5 text-[11px] text-brand-600 hover:text-brand-700"
                  >
                    <Plus aria-hidden="true" className="size-2.5" />
                    <span>Thêm lựa chọn</span>
                  </Button>
                </div>

                <div className="space-y-1.5">
                  {blank.choices.map((choice, choiceIndex) => {
                    const isCorrect = blank.correct_value_id === choice.value_id;

                    return (
                      <div
                        key={choice.value_id}
                        className={`flex items-center gap-2 rounded border px-2 py-1.5 ${
                          isCorrect
                            ? 'border-semantic-success bg-semantic-success-bg/25'
                            : 'border-surface-border bg-surface-canvas'
                        }`}
                      >
                        <label
                          className="flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-text-primary"
                          title="Chọn làm đáp án đúng"
                        >
                          <input
                            type="radio"
                            name={`dropdown_correct_${blankIndex}`}
                            checked={isCorrect}
                            onChange={() =>
                              handleSelectCorrect(blankIndex, choice.value_id)
                            }
                            disabled={disabled}
                            className="size-3.5 accent-brand-600"
                          />
                          <span>Đúng</span>
                        </label>

                        <Input
                          value={choice.label}
                          onChange={(e) =>
                            handleChoiceLabelChange(
                              blankIndex,
                              choiceIndex,
                              e.target.value
                            )
                          }
                          disabled={disabled}
                          placeholder={`Lựa chọn ${choiceIndex + 1}...`}
                          className="h-7 flex-1 text-xs"
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleRemoveChoice(blankIndex, choiceIndex)
                          }
                          disabled={disabled || blank.choices.length <= 2}
                          className="size-6 text-semantic-error disabled:opacity-30"
                        >
                          <Trash2 aria-hidden="true" className="size-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
