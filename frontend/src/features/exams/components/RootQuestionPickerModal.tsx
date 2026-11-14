import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  HelpCircle,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '../../../api/client';
import { AccessibleModal } from '../../../components/ui/AccessibleModal';
import { getLessonsByChapterApi } from '../../catalog/catalog.api';
import type { Chapter, Lesson } from '../../catalog/types';
import { getQuestionsApi } from '../../questions/questions.api';
import {
  DIFFICULTY_LABELS,
  KIND_LABELS,
  type QuestionDifficulty,
  type QuestionRecord,
  type QuestionType,
} from '../../questions/types';
import type { ExamsPaginationMeta } from '../types';
import { ExamPaginationFooter } from './ExamPaginationFooter';

interface RootQuestionPickerModalProps {
  isOpen: boolean;
  subjectId: string;
  chapters: Chapter[];
  questionTypes: QuestionType[];
  existingQuestionIds: Set<string>;
  onClose: () => void;
  onConfirmAdd: (pickedQuestions: QuestionRecord[]) => void;
}

export function RootQuestionPickerModal({
  isOpen,
  subjectId,
  chapters,
  questionTypes,
  existingQuestionIds,
  onClose,
  onConfirmAdd,
}: RootQuestionPickerModalProps) {
  const filterIdPrefix = useId();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [chapterFilter, setChapterFilter] = useState('');
  const [lessonFilter, setLessonFilter] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<
    QuestionDifficulty | ''
  >('');
  const [page, setPage] = useState(1);

  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [meta, setMeta] = useState<ExamsPaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);

  const [selectedMap, setSelectedMap] = useState<Map<string, QuestionRecord>>(
    new Map()
  );
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedMap(new Map());
    setPage(1);
  }, [isOpen]);

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setPage(1);
    }, 300);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [searchInput]);

  useEffect(() => {
    if (!isOpen || !chapterFilter) {
      setLessons([]);
      setLessonFilter('');
      return;
    }

    const controller = new AbortController();
    getLessonsByChapterApi(chapterFilter, controller.signal)
      .then((res) => {
        setLessons(res.data || []);
      })
      .catch(() => {
        setLessons([]);
      });
    return () => controller.abort();
  }, [isOpen, chapterFilter]);

  const loadQuestions = useCallback(
    async (signal?: AbortSignal) => {
      if (!isOpen || !subjectId) return;
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await getQuestionsApi(
          {
            subject_id: subjectId,
            chapter_id: chapterFilter || undefined,
            lesson_id: lessonFilter || undefined,
            type_id: typeFilter || undefined,
            difficulty_level: difficultyFilter || undefined,
            status: 'ACTIVE',
            q: debouncedQuery || undefined,
            page,
            page_size: 10,
          },
          signal
        );
        setQuestions(res.data || []);
        setMeta(res.meta || null);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setLoadError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [
      isOpen,
      subjectId,
      chapterFilter,
      lessonFilter,
      typeFilter,
      difficultyFilter,
      debouncedQuery,
      page,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadQuestions(controller.signal);
    return () => controller.abort();
  }, [loadQuestions]);

  const typeLabelMap = new Map(
    questionTypes.map((qt) => [qt.id, KIND_LABELS[qt.code] || qt.name])
  );

  const toggleQuestion = (q: QuestionRecord) => {
    if (existingQuestionIds.has(q.id)) return;
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(q.id)) {
        next.delete(q.id);
      } else {
        next.set(q.id, q);
      }
      return next;
    });
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedQuery('');
    setChapterFilter('');
    setLessonFilter('');
    setTypeFilter('');
    setDifficultyFilter('');
    setPage(1);
  };

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClass="max-w-4xl"
      title="Chọn câu hỏi vào đề gốc"
      description="Chỉ hiển thị câu hỏi Đang sử dụng thuộc môn học của kỳ thi."
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label
              htmlFor={`${filterIdPrefix}-search`}
              className="mb-1 block text-[11px] font-medium text-text-secondary"
            >
              Tìm nội dung / chủ đề
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-text-muted"
              />
              <Input
                id={`${filterIdPrefix}-search`}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm từ khóa câu hỏi..."
                className="h-8 bg-surface-card pl-8 text-xs text-text-primary"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor={`${filterIdPrefix}-chapter`}
              className="mb-1 block text-[11px] font-medium text-text-secondary"
            >
              Chương
            </label>
            <Select
              value={chapterFilter || 'ALL'}
              onValueChange={(val) => {
                setChapterFilter(val === 'ALL' ? '' : val);
                setLessonFilter('');
                setPage(1);
              }}
            >
              <SelectTrigger
                id={`${filterIdPrefix}-chapter`}
                className="h-8 bg-surface-card text-xs text-text-primary"
              >
                <SelectValue placeholder="Tất cả chương" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả chương</SelectItem>
                {chapters.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    {ch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label
              htmlFor={`${filterIdPrefix}-type`}
              className="mb-1 block text-[11px] font-medium text-text-secondary"
            >
              Dạng câu
            </label>
            <Select
              value={typeFilter || 'ALL'}
              onValueChange={(val) => {
                setTypeFilter(val === 'ALL' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger
                id={`${filterIdPrefix}-type`}
                className="h-8 bg-surface-card text-xs text-text-primary"
              >
                <SelectValue placeholder="Tất cả dạng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả dạng câu</SelectItem>
                {questionTypes.map((qt) => (
                  <SelectItem key={qt.id} value={qt.id}>
                    {KIND_LABELS[qt.code] || qt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label
              htmlFor={`${filterIdPrefix}-difficulty`}
              className="mb-1 block text-[11px] font-medium text-text-secondary"
            >
              Độ khó
            </label>
            <div className="flex items-center gap-1.5">
              <Select
                value={difficultyFilter || 'ALL'}
                onValueChange={(val) => {
                  setDifficultyFilter(
                    val === 'ALL' ? '' : (val as QuestionDifficulty)
                  );
                  setPage(1);
                }}
              >
                <SelectTrigger
                  id={`${filterIdPrefix}-difficulty`}
                  className="h-8 bg-surface-card text-xs text-text-primary"
                >
                  <SelectValue placeholder="Độ khó" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả độ khó</SelectItem>
                  {(
                    Object.keys(DIFFICULTY_LABELS) as QuestionDifficulty[]
                  ).map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>
                      {DIFFICULTY_LABELS[lvl]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                aria-label="Đặt lại bộ lọc"
                title="Đặt lại bộ lọc"
                className="h-8 shrink-0 px-2 text-xs"
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {chapterFilter && lessons.length > 0 ? (
          <div className="max-w-xs">
            <Select
              value={lessonFilter || 'ALL'}
              onValueChange={(val) => {
                setLessonFilter(val === 'ALL' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 bg-surface-card text-xs text-text-primary">
                <SelectValue placeholder="Lọc theo bài học" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả bài học trong chương</SelectItem>
                {lessons.map((lesson) => (
                  <SelectItem key={lesson.id} value={lesson.id}>
                    {lesson.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {loadError ? (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-semantic-danger/30 bg-semantic-danger-bg px-3 py-2 text-xs text-semantic-danger"
          >
            <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
            <span>
              {loadError instanceof ApiError
                ? loadError.message
                : 'Không thể tải danh sách câu hỏi.'}
            </span>
          </div>
        ) : null}

        {/* Questions list */}
        <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card">
          <div className="max-h-[45vh] overflow-y-auto divide-y divide-surface-border">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="p-3">
                  <Skeleton className="mb-1.5 h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))
            ) : questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                <HelpCircle
                  aria-hidden="true"
                  className="size-6 text-text-muted"
                />
                <p className="text-xs font-medium text-text-primary">
                  Không có câu hỏi Đang sử dụng nào khớp điều kiện lọc.
                </p>
              </div>
            ) : (
              questions.map((q) => {
                const alreadyInRoot = existingQuestionIds.has(q.id);
                const isSelected = selectedMap.has(q.id);

                return (
                  <button
                    key={q.id}
                    type="button"
                    disabled={alreadyInRoot}
                    onClick={() => toggleQuestion(q)}
                    className={`flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40 ${
                      alreadyInRoot
                        ? 'cursor-not-allowed bg-surface-muted/40 opacity-65'
                        : isSelected
                        ? 'bg-semantic-info-bg/50'
                        : 'hover:bg-surface-muted/30'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${
                        alreadyInRoot || isSelected
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-surface-border bg-surface-card'
                      }`}
                    >
                      {alreadyInRoot || isSelected ? (
                        <Check className="size-3" />
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="line-clamp-2 text-xs leading-relaxed text-text-primary">
                        {q.content}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {typeLabelMap.get(q.type_id) || 'Dạng câu'}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {DIFFICULTY_LABELS[q.difficulty_level] ||
                            q.difficulty_level}
                        </Badge>
                        {q.topic_tag ? (
                          <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
                            #{q.topic_tag}
                          </span>
                        ) : null}
                        {alreadyInRoot ? (
                          <span className="text-[10px] font-semibold text-semantic-success">
                            Đã có trong đề gốc
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <ExamPaginationFooter
            page={page}
            meta={meta}
            itemLabel="câu hỏi"
            isLoading={isLoading}
            showPageSize={false}
            onPageChange={setPage}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-border pt-3">
          <span className="text-xs text-text-secondary tabular-nums">
            Đã chọn thêm:{' '}
            <strong className="font-semibold text-text-primary">
              {selectedMap.size}
            </strong>{' '}
            câu hỏi
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs font-medium"
            >
              Đóng
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selectedMap.size === 0}
              onClick={() => {
                onConfirmAdd(Array.from(selectedMap.values()));
                onClose();
              }}
              className="h-8 gap-1.5 text-xs font-semibold"
            >
              <Plus aria-hidden="true" className="size-3.5" />
              <span>Thêm vào đề gốc ({selectedMap.size})</span>
            </Button>
          </div>
        </div>
      </div>
    </AccessibleModal>
  );
}
