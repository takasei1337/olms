import { useId } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type {
  LocalAnswerDraft,
  QuestionRenderSpec,
} from '../types';

const EMPTY_SENTINEL = '__OLMS_EMPTY__';

function formatBlankHeading(blankId: string, index: number, total: number): string {
  if (total === 1) return 'Chọn đáp án phù hợp';
  const match = /^b(?:lank)?[_-]?(\d+)$/i.exec(blankId.trim());
  if (match) return `Chỗ trống ${match[1]}`;
  return `Chỗ trống ${index + 1}`;
}

interface QuestionResponseInputProps {
  variantQuestionId: string;
  renderSpec: QuestionRenderSpec | null;
  draft: LocalAnswerDraft;
  disabled?: boolean;
  onChange: (nextDraft: LocalAnswerDraft) => void;
  onBlurFlush?: () => void;
}

export function QuestionResponseInput({
  variantQuestionId,
  renderSpec,
  draft,
  disabled = false,
  onChange,
  onBlurFlush,
}: QuestionResponseInputProps) {
  const baseId = useId();

  if (!renderSpec) {
    return (
      <div className="rounded-lg border border-semantic-warning/30 bg-semantic-warning-bg p-3 text-sm text-semantic-warning">
        Không thể hiển thị cấu hình đáp án cho câu hỏi này. Vui lòng thử đồng bộ lại phiên thi.
      </div>
    );
  }

  switch (renderSpec.kind) {
    case 'SINGLE_CHOICE': {
      const selected = draft.selectedOptions[0] ?? '';

      return (
        <div
          role="radiogroup"
          aria-label="Chọn một đáp án đúng"
          className="space-y-2.5"
        >
          {renderSpec.choices.map((choice) => {
            const isSelected = selected === choice.display_label;
            const inputId = `${baseId}-sc-${choice.display_label}`;

            return (
              <label
                key={choice.display_label}
                htmlFor={inputId}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 text-sm transition-colors select-none',
                  disabled && 'cursor-not-allowed opacity-60',
                  isSelected
                    ? 'border-brand-600 bg-brand-500/8 text-text-primary'
                    : 'border-surface-border bg-surface-panel text-text-primary hover:border-brand-500/50 hover:bg-surface-muted'
                )}
              >
                <input
                  id={inputId}
                  type="radio"
                  name={`question-${variantQuestionId}`}
                  value={choice.display_label}
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() =>
                    onChange({
                      ...draft,
                      kind: 'SINGLE_CHOICE',
                      selectedOptions: [choice.display_label],
                    })
                  }
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold tabular-nums transition-colors',
                    isSelected
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-surface-border bg-surface-card text-text-secondary'
                  )}
                >
                  {choice.display_label}
                </span>
                <span className="flex-1 pt-0.5 leading-relaxed whitespace-pre-wrap">
                  {choice.text}
                </span>
              </label>
            );
          })}
        </div>
      );
    }

    case 'MULTI_CHOICE': {
      const selectedSet = new Set(draft.selectedOptions);
      const orderedLabels = renderSpec.choices.map((c) => c.display_label);

      const handleToggle = (label: string, checked: boolean) => {
        const nextSet = new Set(selectedSet);
        if (checked) {
          nextSet.add(label);
        } else {
          nextSet.delete(label);
        }
        const sorted = orderedLabels.filter((lbl) => nextSet.has(lbl));
        onChange({
          ...draft,
          kind: 'MULTI_CHOICE',
          selectedOptions: sorted,
        });
      };

      return (
        <div
          role="group"
          aria-label="Chọn một hoặc nhiều đáp án đúng"
          className="space-y-2.5"
        >
          {renderSpec.choices.map((choice) => {
            const isChecked = selectedSet.has(choice.display_label);
            const checkboxId = `${baseId}-mc-${choice.display_label}`;

            return (
              <label
                key={choice.display_label}
                htmlFor={checkboxId}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 text-sm transition-colors select-none',
                  disabled && 'cursor-not-allowed opacity-60',
                  isChecked
                    ? 'border-brand-600 bg-brand-500/8 text-text-primary'
                    : 'border-surface-border bg-surface-panel text-text-primary hover:border-brand-500/50 hover:bg-surface-muted'
                )}
              >
                <Checkbox
                  id={checkboxId}
                  checked={isChecked}
                  disabled={disabled}
                  onCheckedChange={(checkedState) =>
                    handleToggle(choice.display_label, checkedState === true)
                  }
                  className="mt-1 shrink-0"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold tabular-nums transition-colors',
                    isChecked
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-surface-border bg-surface-card text-text-secondary'
                  )}
                >
                  {choice.display_label}
                </span>
                <span className="flex-1 pt-0.5 leading-relaxed whitespace-pre-wrap">
                  {choice.text}
                </span>
              </label>
            );
          })}
        </div>
      );
    }

    case 'DROPDOWN': {
      const selectionByBlank = new Map(
        draft.dropdownSelections.map((s) => [s.blank_id, s.value_id])
      );

      const handleBlankChange = (blankId: string, rawVal: string) => {
        const nextMap = new Map(selectionByBlank);
        if (rawVal === EMPTY_SENTINEL) {
          nextMap.delete(blankId);
        } else {
          nextMap.set(blankId, rawVal);
        }
        const ordered = renderSpec.blanks
          .map((b) => {
            const v = nextMap.get(b.blank_id);
            return v ? { blank_id: b.blank_id, value_id: v } : null;
          })
          .filter((item): item is { blank_id: string; value_id: string } => Boolean(item));

        onChange({
          ...draft,
          kind: 'DROPDOWN',
          dropdownSelections: ordered,
        });
      };

      return (
        <div className="space-y-3">
          {renderSpec.blanks.map((blank, idx) => {
            const currentVal = selectionByBlank.get(blank.blank_id) ?? EMPTY_SENTINEL;
            const heading = formatBlankHeading(
              blank.blank_id,
              idx,
              renderSpec.blanks.length
            );
            const triggerId = `${baseId}-dd-${blank.blank_id}`;

            return (
              <div
                key={blank.blank_id}
                className="flex flex-col gap-2 rounded-lg border border-surface-border bg-surface-panel p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <label
                  htmlFor={triggerId}
                  className="text-sm font-medium text-text-primary"
                >
                  {heading}
                </label>

                <div className="flex items-center gap-2 sm:w-80">
                  <Select
                    value={currentVal}
                    disabled={disabled}
                    onValueChange={(val) => handleBlankChange(blank.blank_id, val)}
                  >
                    <SelectTrigger
                      id={triggerId}
                      aria-label={heading}
                      className="h-9 bg-surface-card text-sm text-text-primary"
                    >
                      <SelectValue placeholder="Chọn đáp án" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_SENTINEL}>
                        -- Chưa chọn đáp án --
                      </SelectItem>
                      {blank.choices.map((ch) => (
                        <SelectItem key={ch.value_id} value={ch.value_id}>
                          {ch.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    case 'INPUT': {
      const inputId = `${baseId}-input`;
      return (
        <div className="space-y-2">
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-text-secondary"
          >
            Nhập câu trả lời của bạn
          </label>
          <Textarea
            id={inputId}
            value={draft.answerText}
            disabled={disabled}
            rows={3}
            onChange={(e) =>
              onChange({
                ...draft,
                kind: 'INPUT',
                answerText: e.target.value,
              })
            }
            onBlur={() => onBlurFlush?.()}
            placeholder="Nhập đáp án ngắn gọn, chính xác..."
            className="min-h-24 resize-y bg-surface-card text-sm text-text-primary"
          />
          {renderSpec.input_hint ? (
            <p className="text-xs text-text-secondary">
              Gợi ý định dạng: {renderSpec.input_hint}
            </p>
          ) : (
            <p className="text-xs text-text-secondary">
              Hệ thống tự động lưu sau khi bạn ngừng gõ hoặc chuyển câu hỏi.
            </p>
          )}
        </div>
      );
    }

    case 'MATCHING': {
      const rightByLeft = new Map(
        draft.matchingPairs.map((p) => [p.left_id, p.right_id])
      );

      // Build map showing which left item index already uses a right item
      const leftIndexByRightId = new Map<string, number>();
      renderSpec.left_items.forEach((left, idx) => {
        const chosenRight = rightByLeft.get(left.id);
        if (chosenRight && !leftIndexByRightId.has(chosenRight)) {
          leftIndexByRightId.set(chosenRight, idx + 1);
        }
      });

      const handlePairChange = (leftId: string, rawRightVal: string) => {
        const nextMap = new Map(rightByLeft);
        if (rawRightVal === EMPTY_SENTINEL) {
          nextMap.delete(leftId);
        } else {
          nextMap.set(leftId, rawRightVal);
        }
        const ordered = renderSpec.left_items
          .map((l) => {
            const r = nextMap.get(l.id);
            return r ? { left_id: l.id, right_id: r } : null;
          })
          .filter((item): item is { left_id: string; right_id: string } => Boolean(item));

        onChange({
          ...draft,
          kind: 'MATCHING',
          matchingPairs: ordered,
        });
      };

      const handleClearAllPairs = () => {
        onChange({
          ...draft,
          kind: 'MATCHING',
          matchingPairs: [],
        });
      };

      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs text-text-secondary">
            <span>Ghép từng mục bên trái với vế tương ứng bên phải</span>
            {draft.matchingPairs.length > 0 && !disabled ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearAllPairs}
                className="h-7 px-2 text-xs text-text-secondary hover:text-text-primary"
              >
                Bỏ ghép tất cả
              </Button>
            ) : null}
          </div>

          <div className="space-y-2.5">
            {renderSpec.left_items.map((left, idx) => {
              const currentRightId = rightByLeft.get(left.id) ?? EMPTY_SENTINEL;
              const selectId = `${baseId}-match-${left.id}`;

              return (
                <div
                  key={left.id}
                  className="grid grid-cols-1 items-center gap-2.5 rounded-lg border border-surface-border bg-surface-panel p-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.1fr)] md:gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded border border-surface-border bg-surface-card text-[11px] font-semibold tabular-nums text-text-secondary">
                      {idx + 1}
                    </span>
                    <span className="text-sm leading-snug text-text-primary">
                      {left.label}
                    </span>
                  </div>

                  <ArrowRight
                    aria-hidden="true"
                    className="hidden size-4 text-text-muted md:block"
                  />

                  <Select
                    value={currentRightId}
                    disabled={disabled}
                    onValueChange={(val) => handlePairChange(left.id, val)}
                  >
                    <SelectTrigger
                      id={selectId}
                      aria-label={`Chọn vế ghép cho mục ${idx + 1}: ${left.label}`}
                      className="h-9 bg-surface-card text-sm text-text-primary"
                    >
                      <SelectValue placeholder="Chọn vế ghép tương ứng" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_SENTINEL}>
                        -- Chưa chọn vế ghép --
                      </SelectItem>
                      {renderSpec.right_items.map((right) => {
                        const usedBy = leftIndexByRightId.get(right.id);
                        const suffix =
                          usedBy !== undefined && usedBy !== idx + 1
                            ? ` (đang ghép với mục ${usedBy})`
                            : '';
                        return (
                          <SelectItem key={right.id} value={right.id}>
                            {right.label}
                            {suffix}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  }
}
