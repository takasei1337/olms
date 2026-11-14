import { useMemo, useState } from 'react';
import { Check, CheckCircle2, HelpCircle, Minus, X } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { cn } from '../../../lib/utils';
import type { QuestionGradingStatus, SubmissionReviewAnswer } from '../types';
import {
  formatCompactScore,
  formatQuestionKindLabel,
  GRADING_STATUS_LABELS,
} from '../utils';
import { GradingStatusBadge } from './VisibilityAndGradingBadges';

interface SubmissionAnswerComparisonListProps {
  answers: SubmissionReviewAnswer[];
  showAnswers?: boolean;
  showFilterBar?: boolean;
}

type FilterValue = 'ALL' | QuestionGradingStatus;

function extractSelectedOptions(resp: SubmissionReviewAnswer['student_response']): string[] {
  if (!resp || typeof resp !== 'object') return [];
  const raw = (resp as { selected_options?: unknown }).selected_options;
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
}

function extractCorrectOptions(ans: SubmissionReviewAnswer['correct_answer']): string[] {
  if (!ans || typeof ans !== 'object') return [];
  const raw = (ans as { correct_options?: unknown }).correct_options;
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
}

function extractDropdownSelections(
  resp: SubmissionReviewAnswer['student_response']
): Map<string, string> {
  const map = new Map<string, string>();
  if (!resp || typeof resp !== 'object') return map;
  const arr = (resp as { selections?: unknown }).selections;
  if (Array.isArray(arr)) {
    for (const item of arr) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as { blank_id?: unknown }).blank_id === 'string' &&
        typeof (item as { value_id?: unknown }).value_id === 'string'
      ) {
        map.set(
          (item as { blank_id: string }).blank_id,
          (item as { value_id: string }).value_id
        );
      }
    }
  }
  return map;
}

function extractDropdownCorrect(
  ans: SubmissionReviewAnswer['correct_answer']
): Map<string, string> {
  const map = new Map<string, string>();
  if (!ans || typeof ans !== 'object') return map;
  const arr = (ans as { blanks?: unknown }).blanks;
  if (Array.isArray(arr)) {
    for (const item of arr) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as { blank_id?: unknown }).blank_id === 'string' &&
        typeof (item as { correct_value_id?: unknown }).correct_value_id === 'string'
      ) {
        map.set(
          (item as { blank_id: string }).blank_id,
          (item as { correct_value_id: string }).correct_value_id
        );
      }
    }
  }
  return map;
}

function extractInputAnswer(resp: SubmissionReviewAnswer['student_response']): string {
  if (!resp || typeof resp !== 'object') return '';
  const txt = (resp as { answer_text?: unknown }).answer_text;
  return typeof txt === 'string' ? txt : '';
}

function extractEquivalentAnswers(ans: SubmissionReviewAnswer['correct_answer']): string[] {
  if (!ans || typeof ans !== 'object') return [];
  const arr = (ans as { equivalent_answers?: unknown }).equivalent_answers;
  return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : [];
}

function extractMatchingPairs(
  obj: SubmissionReviewAnswer['student_response'] | SubmissionReviewAnswer['correct_answer']
): Map<string, string> {
  const map = new Map<string, string>();
  if (!obj || typeof obj !== 'object') return map;
  const arr = (obj as { pairs?: unknown }).pairs;
  if (Array.isArray(arr)) {
    for (const item of arr) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as { left_id?: unknown }).left_id === 'string' &&
        typeof (item as { right_id?: unknown }).right_id === 'string'
      ) {
        map.set(
          (item as { left_id: string }).left_id,
          (item as { right_id: string }).right_id
        );
      }
    }
  }
  return map;
}

function formatDropdownPromptPreview(
  content: string,
  blanks: Array<{ blank_id: string }> | undefined
): string {
  if (!blanks || blanks.length === 0) return content;
  let rendered = content;
  blanks.forEach((b, idx) => {
    const token = `{{${b.blank_id}}}`;
    rendered = rendered.split(token).join(`[Chỗ trống ${idx + 1}]`);
  });
  return rendered;
}

function ChoiceComparison({ answer }: { answer: SubmissionReviewAnswer }) {
  const spec = answer.render_spec;
  if (!spec || (spec.kind !== 'SINGLE_CHOICE' && spec.kind !== 'MULTI_CHOICE')) return null;

  const selectedSet = new Set(extractSelectedOptions(answer.student_response));
  const correctSet = new Set(extractCorrectOptions(answer.correct_answer));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
        <span>
          Thí sinh chọn:{' '}
          <strong className="font-mono text-text-primary">
            {selectedSet.size > 0 ? Array.from(selectedSet).join(', ') : 'Chưa chọn'}
          </strong>
        </span>
        {correctSet.size > 0 ? (
          <span>
            Đáp án đúng:{' '}
            <strong className="font-mono text-semantic-success">
              {Array.from(correctSet).join(', ')}
            </strong>
          </span>
        ) : null}
      </div>

      <ul className="space-y-1.5">
        {spec.choices.map((choice) => {
          const isSelected = selectedSet.has(choice.display_label);
          const isCorrect = correctSet.has(choice.display_label);

          const isMatched = isSelected && isCorrect;
          const isWrongPicked = isSelected && !isCorrect;
          const isMissed = !isSelected && isCorrect;

          return (
            <li
              key={choice.display_label}
              className={cn(
                'flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm',
                isMatched && 'border-semantic-success/40 bg-semantic-success-bg/70',
                isWrongPicked && 'border-semantic-error/40 bg-semantic-error-bg/70',
                isMissed && 'border-semantic-success/30 border-dashed bg-semantic-success-bg/35',
                !isMatched &&
                  !isWrongPicked &&
                  !isMissed &&
                  'border-surface-border bg-surface-canvas text-text-secondary'
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-semibold',
                    isMatched || isMissed
                      ? 'border-semantic-success/40 bg-surface-card text-semantic-success'
                      : isWrongPicked
                        ? 'border-semantic-error/40 bg-surface-card text-semantic-error'
                        : 'border-surface-border bg-surface-card text-text-secondary'
                  )}
                >
                  {choice.display_label}
                </span>
                <span className="leading-relaxed text-text-primary">{choice.text}</span>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs font-medium">
                {isMatched ? (
                  <span className="inline-flex items-center gap-1 text-semantic-success">
                    <Check aria-hidden="true" className="size-3.5" />
                    <span>Chọn đúng</span>
                  </span>
                ) : null}
                {isWrongPicked ? (
                  <span className="inline-flex items-center gap-1 text-semantic-error">
                    <X aria-hidden="true" className="size-3.5" />
                    <span>Đã chọn (sai)</span>
                  </span>
                ) : null}
                {isMissed ? (
                  <span className="inline-flex items-center gap-1 text-semantic-success">
                    <CheckCircle2 aria-hidden="true" className="size-3.5" />
                    <span>Đáp án đúng</span>
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DropdownComparison({ answer }: { answer: SubmissionReviewAnswer }) {
  const spec = answer.render_spec;
  if (!spec || spec.kind !== 'DROPDOWN') return null;

  const studentMap = extractDropdownSelections(answer.student_response);
  const correctMap = extractDropdownCorrect(answer.correct_answer);

  return (
    <div className="space-y-2">
      {spec.blanks.map((blank, idx) => {
        const valueLabelById = new Map(blank.choices.map((c) => [c.value_id, c.label]));
        const chosenId = studentMap.get(blank.blank_id);
        const correctId = correctMap.get(blank.blank_id);
        const chosenText = chosenId ? valueLabelById.get(chosenId) ?? chosenId : null;
        const correctText = correctId ? valueLabelById.get(correctId) ?? correctId : null;
        const isMatched = Boolean(chosenId && correctId && chosenId === correctId);

        return (
          <div
            key={blank.blank_id}
            className="grid grid-cols-1 gap-2 rounded-lg border border-surface-border bg-surface-canvas p-3 text-xs sm:grid-cols-12 sm:items-center"
          >
            <div className="font-semibold text-text-primary sm:col-span-3">
              Chỗ trống {idx + 1}
            </div>
            <div className="sm:col-span-4">
              <span className="block text-[11px] text-text-muted">Thí sinh chọn</span>
              <span
                className={cn(
                  'mt-0.5 inline-flex items-center gap-1 font-medium',
                  !chosenText
                    ? 'italic text-text-muted'
                    : isMatched
                      ? 'text-semantic-success'
                      : 'text-semantic-error'
                )}
              >
                {chosenText ? (
                  <>
                    {isMatched ? (
                      <Check aria-hidden="true" className="size-3.5" />
                    ) : (
                      <X aria-hidden="true" className="size-3.5" />
                    )}
                    <span>{chosenText}</span>
                  </>
                ) : (
                  <>
                    <Minus aria-hidden="true" className="size-3.5" />
                    <span>Chưa chọn</span>
                  </>
                )}
              </span>
            </div>
            <div className="sm:col-span-5">
              <span className="block text-[11px] text-text-muted">Đáp án đúng</span>
              <span className="mt-0.5 inline-flex items-center gap-1 font-semibold text-semantic-success">
                <CheckCircle2 aria-hidden="true" className="size-3.5" />
                <span>{correctText ?? '--'}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InputComparison({ answer }: { answer: SubmissionReviewAnswer }) {
  const studentText = extractInputAnswer(answer.student_response).trim();
  const equivalentAnswers = extractEquivalentAnswers(answer.correct_answer);
  const isCorrect = answer.grading_status === 'CORRECT';

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div
        className={cn(
          'rounded-lg border p-3 text-sm',
          !studentText
            ? 'border-surface-border bg-surface-canvas'
            : isCorrect
              ? 'border-semantic-success/40 bg-semantic-success-bg/60'
              : 'border-semantic-error/40 bg-semantic-error-bg/60'
        )}
      >
        <p className="text-xs font-medium text-text-secondary">Bài làm của thí sinh</p>
        <p className={cn('mt-1 font-medium', studentText ? 'text-text-primary' : 'italic text-text-muted')}>
          {studentText || 'Không có câu trả lời'}
        </p>
      </div>

      <div className="rounded-lg border border-semantic-success/30 bg-semantic-success-bg/40 p-3 text-sm">
        <p className="text-xs font-medium text-text-secondary">Đáp án đúng chấp nhận</p>
        {equivalentAnswers.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {equivalentAnswers.map((val, idx) => (
              <Badge
                key={`${val}-${idx}`}
                className="border-semantic-success/30 bg-surface-card font-medium text-semantic-success hover:bg-surface-card"
              >
                {val}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs italic text-text-muted">Không có dữ liệu đáp án</p>
        )}
      </div>
    </div>
  );
}

function MatchingComparison({ answer }: { answer: SubmissionReviewAnswer }) {
  const spec = answer.render_spec;
  if (!spec || spec.kind !== 'MATCHING') return null;

  const rightById = new Map(spec.right_items.map((r) => [r.id, r.label]));
  const studentPairs = extractMatchingPairs(answer.student_response);
  const correctPairs = extractMatchingPairs(answer.correct_answer);

  return (
    <div className="space-y-2">
      {spec.left_items.map((left, idx) => {
        const chosenRightId = studentPairs.get(left.id);
        const correctRightId = correctPairs.get(left.id);
        const chosenLabel = chosenRightId ? rightById.get(chosenRightId) ?? chosenRightId : null;
        const correctLabel = correctRightId ? rightById.get(correctRightId) ?? correctRightId : null;
        const isMatched = Boolean(chosenRightId && correctRightId && chosenRightId === correctRightId);

        return (
          <div
            key={left.id}
            className="grid grid-cols-1 gap-2 rounded-lg border border-surface-border bg-surface-canvas p-3 text-xs sm:grid-cols-12 sm:items-center"
          >
            <div className="font-medium text-text-primary sm:col-span-4">
              <span className="mr-1.5 font-mono text-text-muted">{idx + 1}.</span>
              {left.label}
            </div>
            <div className="sm:col-span-4">
              <span className="block text-[11px] text-text-muted">Thí sinh ghép với</span>
              <span
                className={cn(
                  'mt-0.5 inline-flex items-start gap-1 font-medium',
                  !chosenLabel
                    ? 'italic text-text-muted'
                    : isMatched
                      ? 'text-semantic-success'
                      : 'text-semantic-error'
                )}
              >
                {chosenLabel ? (
                  <>
                    {isMatched ? (
                      <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                    ) : (
                      <X aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                    )}
                    <span>{chosenLabel}</span>
                  </>
                ) : (
                  <>
                    <Minus aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                    <span>Chưa ghép</span>
                  </>
                )}
              </span>
            </div>
            <div className="sm:col-span-4">
              <span className="block text-[11px] text-text-muted">Đáp án đúng</span>
              <span className="mt-0.5 inline-flex items-start gap-1 font-semibold text-semantic-success">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                <span>{correctLabel ?? '--'}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SubmissionAnswerComparisonList({
  answers,
  showAnswers = true,
  showFilterBar = true,
}: SubmissionAnswerComparisonListProps) {
  const [filter, setFilter] = useState<FilterValue>('ALL');

  const counts = useMemo(() => {
    const map: Record<FilterValue, number> = {
      ALL: answers.length,
      CORRECT: 0,
      PARTIAL: 0,
      WRONG: 0,
      BLANK: 0,
    };
    for (const a of answers) {
      if (a.grading_status in map) {
        map[a.grading_status] += 1;
      }
    }
    return map;
  }, [answers]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return answers;
    return answers.filter((a) => a.grading_status === filter);
  }, [answers, filter]);

  const filterButtons: Array<{ value: FilterValue; label: string }> = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'CORRECT', label: GRADING_STATUS_LABELS.CORRECT },
    { value: 'PARTIAL', label: GRADING_STATUS_LABELS.PARTIAL },
    { value: 'WRONG', label: GRADING_STATUS_LABELS.WRONG },
    { value: 'BLANK', label: GRADING_STATUS_LABELS.BLANK },
  ];

  return (
    <div className="space-y-4">
      {showFilterBar ? (
        <div
          role="group"
          aria-label="Lọc câu hỏi theo trạng thái chấm"
          className="flex flex-wrap items-center gap-1.5"
        >
          {filterButtons.map((btn) => {
            const active = filter === btn.value;
            return (
              <button
                key={btn.value}
                type="button"
                onClick={() => setFilter(btn.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-surface-border bg-surface-card text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                )}
              >
                <span>{btn.label}</span>
                <span
                  className={cn(
                    'rounded px-1 py-0.5 font-mono text-[11px] tabular-nums',
                    active ? 'bg-white/20 text-white' : 'bg-surface-muted text-text-secondary'
                  )}
                >
                  {counts[btn.value]}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-border bg-surface-card px-4 py-8 text-center text-sm text-text-secondary">
          Không có câu hỏi nào thuộc nhóm trạng thái đang chọn.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const kind = item.render_spec?.kind;
            const rawContent = item.content || '';
            const displayContent =
              kind === 'DROPDOWN' && item.render_spec?.kind === 'DROPDOWN'
                ? formatDropdownPromptPreview(rawContent, item.render_spec.blanks)
                : rawContent;
            const hasScoreInfo =
              item.earned_score !== undefined &&
              item.earned_score !== null &&
              item.max_score !== undefined &&
              item.max_score !== null;

            return (
              <article
                key={item.position}
                className="rounded-xl border border-surface-border bg-surface-card p-4 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-surface-muted px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-text-primary">
                      Câu {item.position}
                    </span>
                    {kind ? (
                      <span className="text-xs font-medium text-text-secondary">
                        {formatQuestionKindLabel(kind)}
                      </span>
                    ) : null}
                    <GradingStatusBadge status={item.grading_status} />
                  </div>

                  {hasScoreInfo ? (
                    <div className="font-mono text-xs font-semibold tabular-nums text-text-primary">
                      {formatCompactScore(item.earned_score)} / {formatCompactScore(item.max_score)}{' '}
                      <span className="font-sans font-normal text-text-secondary">điểm</span>
                    </div>
                  ) : null}
                </div>

                {displayContent || item.media_url || showAnswers ? (
                  <div className="mt-3 space-y-3">
                    {displayContent ? (
                      <p className="max-w-3xl text-sm font-medium leading-relaxed whitespace-pre-line text-text-primary">
                        {displayContent}
                      </p>
                    ) : null}

                    {item.media_url ? (
                      <div>
                        <img
                          src={item.media_url}
                          alt={`Hình minh họa câu ${item.position}`}
                          className="max-h-64 rounded-lg border border-surface-border object-contain"
                        />
                      </div>
                    ) : null}

                    {showAnswers ? (
                      <>
                        {(kind === 'SINGLE_CHOICE' || kind === 'MULTI_CHOICE') ? (
                          <ChoiceComparison answer={item} />
                        ) : null}
                        {kind === 'DROPDOWN' ? <DropdownComparison answer={item} /> : null}
                        {kind === 'INPUT' ? <InputComparison answer={item} /> : null}
                        {kind === 'MATCHING' ? <MatchingComparison answer={item} /> : null}

                        {item.explanation ? (
                          <div className="flex items-start gap-2 rounded-lg border border-surface-border bg-surface-muted/70 px-3 py-2.5 text-xs leading-relaxed text-text-secondary">
                            <HelpCircle
                              aria-hidden="true"
                              className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-300"
                            />
                            <div>
                              <span className="font-semibold text-text-primary">Giải thích: </span>
                              <span>{item.explanation}</span>
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
