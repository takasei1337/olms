import { useState } from 'react';
import { Eye, CheckCircle2, ImageOff, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DIFFICULTY_LABELS,
  KIND_LABELS,
  type AnswerSpec,
  type QuestionDifficulty,
  type QuestionKind,
} from '../../types';

interface QuestionPreviewProps {
  content: string;
  mediaUrl?: string | null;
  explanation?: string | null;
  difficultyLevel: QuestionDifficulty;
  kind: QuestionKind;
  answerSpec: AnswerSpec;
  topicTag?: string | null;
  subjectName?: string | null;
  chapterName?: string | null;
  lessonName?: string | null;
}

export function QuestionPreview({
  content,
  mediaUrl,
  explanation,
  difficultyLevel,
  kind,
  answerSpec,
  topicTag,
  subjectName,
  chapterName,
  lessonName,
}: QuestionPreviewProps) {
  const [showAnswerKey, setShowAnswerKey] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Simulation states
  const [simulatedSingleChoice, setSimulatedSingleChoice] = useState<string | null>(null);
  const [simulatedMultiChoice, setSimulatedMultiChoice] = useState<Set<string>>(new Set());
  const [simulatedDropdowns, setSimulatedDropdowns] = useState<Record<string, string>>({});
  const [simulatedInput, setSimulatedInput] = useState('');

  return (
    <div className="space-y-4 rounded-lg border border-surface-border bg-surface-card p-4 shadow-sm">
      {/* Header with Badges & Answer Key Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-xs font-semibold">
            {KIND_LABELS[kind]}
          </Badge>
          <Badge
            variant={
              difficultyLevel === 'EASY'
                ? 'default'
                : difficultyLevel === 'MEDIUM'
                ? 'secondary'
                : 'destructive'
            }
            className="text-xs"
          >
            {DIFFICULTY_LABELS[difficultyLevel]}
          </Badge>
          {topicTag ? (
            <Badge variant="secondary" className="font-mono text-xs">
              #{topicTag}
            </Badge>
          ) : null}
        </div>

        <Button
          type="button"
          size="sm"
          variant={showAnswerKey ? 'default' : 'outline'}
          onClick={() => setShowAnswerKey(!showAnswerKey)}
          className="h-7 gap-1 px-2 text-xs font-semibold"
        >
          <Eye aria-hidden="true" className="size-3" />
          <span>{showAnswerKey ? 'Ẩn đáp án chuẩn' : 'Hiện đáp án chuẩn'}</span>
        </Button>
      </div>

      {/* Breadcrumb classification info if provided */}
      {subjectName || chapterName || lessonName ? (
        <div className="text-[11px] text-text-secondary">
          <span>Phân loại: </span>
          <span className="font-medium text-text-primary">
            {[subjectName, chapterName, lessonName].filter(Boolean).join(' › ')}
          </span>
        </div>
      ) : null}

      {/* Question Content (Safe text rendering, no dangerouslySetInnerHTML) */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-text-secondary">Nội dung câu hỏi:</span>
        {kind === 'DROPDOWN' && answerSpec.kind === 'DROPDOWN' ? (
          <div className="rounded-md border border-surface-border bg-surface-canvas p-3 text-sm leading-relaxed text-text-primary">
            {renderDropdownContent(
              content,
              answerSpec,
              simulatedDropdowns,
              (blankId, val) =>
                setSimulatedDropdowns((prev) => ({ ...prev, [blankId]: val })),
              showAnswerKey
            )}
          </div>
        ) : (
          <div className="whitespace-pre-wrap rounded-md border border-surface-border bg-surface-canvas p-3 text-sm leading-relaxed text-text-primary">
            {content || <span className="italic text-text-secondary">Chưa nhập nội dung câu hỏi...</span>}
          </div>
        )}
      </div>

      {/* Media image preview if URL provided */}
      {mediaUrl ? (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-text-secondary">Hình ảnh đính kèm:</span>
          {imageError ? (
            <div className="flex items-center gap-2 rounded-md border border-surface-border bg-surface-muted p-3 text-xs text-text-secondary">
              <ImageOff aria-hidden="true" className="size-4" />
              <span>Không thể tải hình ảnh từ URL: {mediaUrl}</span>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-surface-border bg-surface-muted/30 p-2 text-center">
              <img
                src={mediaUrl}
                alt="Hình ảnh minh họa cho câu hỏi"
                onError={() => setImageError(true)}
                className="mx-auto max-h-60 max-w-full rounded object-contain shadow-sm"
              />
            </div>
          )}
        </div>
      ) : null}

      {/* Answer options preview by type */}
      <div className="space-y-2 border-t border-surface-border pt-3">
        <span className="text-xs font-bold text-text-secondary">
          Mô phỏng làm bài &amp; Lựa chọn:
        </span>

        {kind === 'SINGLE_CHOICE' && answerSpec.kind === 'SINGLE_CHOICE' && (
          <div className="space-y-2">
            {answerSpec.choices.map((choice, i) => {
              const letter = String.fromCharCode(65 + i);
              const isSelected = simulatedSingleChoice === choice.id;

              return (
                <div
                  key={choice.id}
                  onClick={() => setSimulatedSingleChoice(choice.id)}
                  className={`flex cursor-pointer items-center justify-between rounded-md border p-2.5 text-xs transition-colors ${
                    isSelected
                      ? 'border-brand-600 bg-semantic-info-bg font-medium text-text-primary'
                      : 'border-surface-border bg-surface-card hover:bg-surface-muted'
                  } ${
                    showAnswerKey && choice.is_correct
                      ? 'ring-1 ring-semantic-success border-semantic-success'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="preview_single_choice"
                      checked={isSelected}
                      onChange={() => setSimulatedSingleChoice(choice.id)}
                      className="size-3.5 accent-brand-600"
                    />
                    <span className="font-bold">{letter}.</span>
                    <span>{choice.text || <span className="italic text-text-secondary">(trống)</span>}</span>
                  </div>

                  {showAnswerKey && choice.is_correct ? (
                    <Badge variant="default" className="gap-1 text-[10px] bg-semantic-success hover:bg-semantic-success">
                      <CheckCircle2 aria-hidden="true" className="size-3" />
                      <span>Đáp án đúng</span>
                    </Badge>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {kind === 'MULTI_CHOICE' && answerSpec.kind === 'MULTI_CHOICE' && (
          <div className="space-y-2">
            {answerSpec.choices.map((choice, i) => {
              const letter = String.fromCharCode(65 + i);
              const isChecked = simulatedMultiChoice.has(choice.id);

              return (
                <div
                  key={choice.id}
                  onClick={() => {
                    setSimulatedMultiChoice((prev) => {
                      const next = new Set(prev);
                      if (next.has(choice.id)) next.delete(choice.id);
                      else next.add(choice.id);
                      return next;
                    });
                  }}
                  className={`flex cursor-pointer items-center justify-between rounded-md border p-2.5 text-xs transition-colors ${
                    isChecked
                      ? 'border-brand-600 bg-semantic-info-bg font-medium text-text-primary'
                      : 'border-surface-border bg-surface-card hover:bg-surface-muted'
                  } ${
                    showAnswerKey && choice.is_correct
                      ? 'ring-1 ring-semantic-success border-semantic-success'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="size-3.5 rounded accent-brand-600"
                    />
                    <span className="font-bold">{letter}.</span>
                    <span>{choice.text || <span className="italic text-text-secondary">(trống)</span>}</span>
                  </div>

                  {showAnswerKey && choice.is_correct ? (
                    <Badge variant="default" className="gap-1 text-[10px] bg-semantic-success hover:bg-semantic-success">
                      <CheckCircle2 aria-hidden="true" className="size-3" />
                      <span>Đáp án đúng</span>
                    </Badge>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {kind === 'INPUT' && answerSpec.kind === 'INPUT' && (
          <div className="space-y-2">
            <div className="rounded-md border border-surface-border bg-surface-card p-3">
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Mô phỏng ô nhập bài làm của thí sinh:
              </label>
              <input
                type="text"
                value={simulatedInput}
                onChange={(e) => setSimulatedInput(e.target.value)}
                placeholder="Thí sinh gõ câu trả lời vào đây..."
                className="h-8 w-full rounded border border-surface-border bg-surface-canvas px-3 text-xs text-text-primary"
              />
            </div>

            {showAnswerKey ? (
              <div className="rounded-md border border-semantic-success/30 bg-semantic-success-bg/25 p-3 text-xs">
                <span className="font-bold text-semantic-success">
                  Các đáp án được chấp nhận ({answerSpec.equivalent_answers.length}):
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {answerSpec.equivalent_answers.map((ans, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-surface-card px-2 py-0.5 font-medium text-text-primary shadow-sm ring-1 ring-surface-border"
                    >
                      {ans || '(chưa nhập)'}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {kind === 'MATCHING' && answerSpec.kind === 'MATCHING' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded border border-surface-border bg-surface-canvas p-2 text-xs">
                <span className="font-bold text-brand-600">Cột A:</span>
                <ul className="mt-1 space-y-1">
                  {answerSpec.left_items.map((it, i) => (
                    <li key={it.id}>
                      <strong>A{i + 1}:</strong> {it.label || '(trống)'}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded border border-surface-border bg-surface-canvas p-2 text-xs">
                <span className="font-bold text-semantic-info">Cột B:</span>
                <ul className="mt-1 space-y-1">
                  {answerSpec.right_items.map((it, i) => (
                    <li key={it.id}>
                      <strong>B{i + 1}:</strong> {it.label || '(trống)'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {showAnswerKey ? (
              <div className="rounded-md border border-semantic-success/30 bg-semantic-success-bg/25 p-3 text-xs">
                <span className="font-bold text-semantic-success">
                  Đáp án ghép cặp chuẩn ({answerSpec.pairs.length} cặp):
                </span>
                <div className="mt-2 space-y-1">
                  {answerSpec.pairs.map((p, idx) => {
                    const l = answerSpec.left_items.find((it) => it.id === p.left_id);
                    const r = answerSpec.right_items.find((it) => it.id === p.right_id);
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 font-medium text-text-primary"
                      >
                        <span className="rounded bg-surface-card px-1.5 py-0.5 shadow-sm">
                          {l?.label || p.left_id}
                        </span>
                        <span>⟶</span>
                        <span className="rounded bg-surface-card px-1.5 py-0.5 shadow-sm">
                          {r?.label || p.right_id}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Explanation section if available and toggled */}
      {showAnswerKey && explanation ? (
        <div className="rounded-md border border-semantic-info/30 bg-semantic-info-bg/30 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-brand-700 dark:text-brand-300">
            <Lightbulb aria-hidden="true" className="size-3.5" />
            <span>Lời giải chi tiết:</span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-text-primary">
            {explanation}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// Helper to safely render dropdown placeholders in question text
function renderDropdownContent(
  content: string,
  spec: { blanks: Array<{ blank_id: string; choices: Array<{ value_id: string; label: string }>; correct_value_id: string }> },
  simulatedDropdowns: Record<string, string>,
  onSelect: (blankId: string, val: string) => void,
  showAnswerKey: boolean
) {
  if (!content) {
    return <span className="italic text-text-secondary">Chưa nhập nội dung câu hỏi...</span>;
  }

  const parts = content.split(/(\{\{[^}]+\}\})/g);

  return (
    <span>
      {parts.map((part, index) => {
        const match = part.match(/^\{\{([^}]+)\}\}$/);
        if (!match) {
          return <span key={index}>{part}</span>;
        }

        const blankId = match[1].trim();
        const blank = spec.blanks.find((b) => b.blank_id === blankId);

        if (!blank) {
          return (
            <span
              key={index}
              className="inline-block rounded bg-semantic-error-bg px-1.5 py-0.5 font-mono text-xs text-semantic-error"
            >
              {part} (chưa định nghĩa)
            </span>
          );
        }

        const selectedVal = simulatedDropdowns[blankId] || '';

        return (
          <span
            key={index}
            className="inline-block align-middle mx-1 my-0.5"
          >
            <select
              value={selectedVal}
              onChange={(e) => onSelect(blankId, e.target.value)}
              className="h-7 rounded border border-surface-border bg-surface-card px-2 text-xs font-semibold text-text-primary shadow-sm focus:border-brand-600 focus:outline-none"
            >
              <option value="">[Chọn {blankId}]</option>
              {blank.choices.map((ch) => (
                <option key={ch.value_id} value={ch.value_id}>
                  {ch.label} {showAnswerKey && ch.value_id === blank.correct_value_id ? '✓' : ''}
                </option>
              ))}
            </select>
          </span>
        );
      })}
    </span>
  );
}
