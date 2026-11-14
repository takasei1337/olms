import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  QuestionRuntimeState,
  StudentSessionQuestion,
} from '../types';
import { isDraftAnswered } from '../utils';

interface QuestionPaletteProps {
  questions: StudentSessionQuestion[];
  questionStates: Record<string, QuestionRuntimeState>;
  flaggedIds: Set<string>;
  currentIndex: number;
  onSelectIndex: (index: number) => void;
}

export function QuestionPalette({
  questions,
  questionStates,
  flaggedIds,
  currentIndex,
  onSelectIndex,
}: QuestionPaletteProps) {
  let answeredCount = 0;
  for (const q of questions) {
    const st = questionStates[q.exam_variant_question_id];
    if (st && isDraftAnswered(st.draft)) answeredCount += 1;
  }
  const unansweredCount = Math.max(0, questions.length - answeredCount);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 rounded-lg border border-surface-border bg-surface-panel px-2.5 py-2 text-center text-xs">
        <div>
          <p className="text-[11px] text-text-secondary">Đã trả lời</p>
          <p className="font-semibold tabular-nums text-text-primary">
            {answeredCount}/{questions.length}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-text-secondary">Chưa làm</p>
          <p className="font-semibold tabular-nums text-text-primary">
            {unansweredCount}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-text-secondary">Xem lại</p>
          <p className="font-semibold tabular-nums text-semantic-warning">
            {flaggedIds.size}
          </p>
        </div>
      </div>

      <div
        role="navigation"
        aria-label="Điều hướng danh sách câu hỏi"
        className="grid grid-cols-5 gap-2"
      >
        {questions.map((q, idx) => {
          const st = questionStates[q.exam_variant_question_id];
          const answered = st ? isDraftAnswered(st.draft) : false;
          const isError = st?.status === 'error';
          const isSaving =
            st?.status === 'saving' ||
            st?.status === 'dirty' ||
            st?.status === 'retrying';
          const isFlagged = flaggedIds.has(q.exam_variant_question_id);
          const isCurrent = idx === currentIndex;

          const statusDesc = isError
            ? 'Lưu thất bại'
            : isSaving
            ? 'Đang lưu'
            : answered
            ? 'Đã trả lời'
            : 'Chưa trả lời';
          const ariaLabel = `Câu ${q.position} — ${statusDesc}${isFlagged ? ' — Đang đánh dấu xem lại' : ''}`;

          return (
            <button
              key={q.exam_variant_question_id}
              type="button"
              onClick={() => onSelectIndex(idx)}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={ariaLabel}
              className={cn(
                'relative inline-flex h-10 items-center justify-center rounded-md border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isError &&
                  'border-semantic-danger/60 bg-semantic-danger-bg text-semantic-danger',
                !isError &&
                  isSaving &&
                  'border-brand-500/45 bg-semantic-info-bg text-brand-700 dark:text-brand-200',
                !isError &&
                  !isSaving &&
                  answered &&
                  'border-semantic-success/45 bg-semantic-success-bg text-semantic-success',
                !isError &&
                  !isSaving &&
                  !answered &&
                  'border-surface-border bg-surface-card text-text-secondary hover:bg-surface-muted hover:text-text-primary',
                isCurrent && 'ring-2 ring-brand-600 ring-offset-1 ring-offset-surface-card'
              )}
            >
              <span>{q.position}</span>
              {isFlagged ? (
                <Bookmark
                  aria-hidden="true"
                  className="absolute top-0.5 right-0.5 size-3 fill-semantic-warning text-semantic-warning"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-text-secondary">
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] border border-semantic-success/60 bg-semantic-success/20" />
          <span>Đã trả lời</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] border border-surface-border bg-surface-card" />
          <span>Chưa trả lời</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] border border-brand-600 ring-1 ring-brand-600" />
          <span>Đang xem</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Bookmark
            aria-hidden="true"
            className="size-3 fill-semantic-warning text-semantic-warning"
          />
          <span>Đánh dấu xem lại</span>
        </div>
      </div>
    </div>
  );
}
