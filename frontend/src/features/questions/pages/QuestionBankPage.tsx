import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  HelpCircle,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ApiError } from '../../../api/client';
import { useAuth } from '../../auth/AuthContext';
import {
  getChaptersBySubjectApi,
  getLessonsByChapterApi,
  getLessonTopicsApi,
  getSubjectsApi,
} from '../../catalog/catalog.api';
import type { Chapter, Lesson, LessonTopic, Subject } from '../../catalog/types';
import {
  cloneQuestionApi,
  getQuestionsApi,
  getQuestionTypesApi,
} from '../questions.api';
import type {
  QuestionDifficulty,
  QuestionKind,
  QuestionRecord,
  QuestionsPaginationMeta,
  QuestionStatus,
  QuestionType,
} from '../types';
import {
  DIFFICULTY_LABELS,
  KIND_LABELS,
  STATUS_LABELS,
} from '../types';
import { QuestionRowActionsMenu } from '../components/QuestionRowActionsMenu';
import { QuestionDetailModal } from '../components/QuestionDetailModal';
import { QuestionVersionsModal } from '../components/QuestionVersionsModal';
import { QuestionStatusModal } from '../components/QuestionStatusModal';
import { DeleteQuestionModal } from '../components/DeleteQuestionModal';

interface FilterSelectOption {
  value: string;
  label: string;
}

const DIFFICULTY_FILTER_OPTIONS: readonly FilterSelectOption[] = [
  { value: 'ALL', label: 'Tất cả độ khó' },
  { value: 'EASY', label: 'Dễ' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HARD', label: 'Khó' },
];

const STATUS_FILTER_OPTIONS: readonly FilterSelectOption[] = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'DRAFT', label: 'Bản nháp' },
  { value: 'ACTIVE', label: 'Đang sử dụng' },
  { value: 'INACTIVE', label: 'Tạm ngưng' },
  { value: 'ARCHIVED', label: 'Lưu trữ' },
];

const PAGE_SIZE_OPTIONS: readonly FilterSelectOption[] = [
  { value: '10', label: '10 dòng' },
  { value: '20', label: '20 dòng' },
  { value: '50', label: '50 dòng' },
];

export function QuestionBankPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  const filterIdPrefix = useId();

  // URL-driven query state
  const initialSubject = searchParams.get('subject_id') || '';
  const initialChapter = searchParams.get('chapter_id') || '';
  const initialLesson = searchParams.get('lesson_id') || '';
  const initialTopic = searchParams.get('topic_tag') || '';
  const initialType = searchParams.get('type_id') || '';
  const initialDiff = (searchParams.get('difficulty_level') as QuestionDifficulty) || '';
  const initialStatus = (searchParams.get('status') as QuestionStatus) || '';
  const initialQ = searchParams.get('q') || '';
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const initialPageSize = parseInt(searchParams.get('page_size') || '20', 10);

  // Filters
  const [searchInput, setSearchInput] = useState(initialQ);
  const [appliedQuery, setAppliedQuery] = useState(initialQ);
  const [subjectFilter, setSubjectFilter] = useState(initialSubject);
  const [chapterFilter, setChapterFilter] = useState(initialChapter);
  const [lessonFilter, setLessonFilter] = useState(initialLesson);
  const [topicFilter, setTopicFilter] = useState(initialTopic);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [diffFilter, setDiffFilter] = useState<QuestionDifficulty | ''>(initialDiff);
  const [statusFilter, setStatusFilter] = useState<QuestionStatus | ''>(initialStatus);
  const [page, setPage] = useState(Number.isFinite(initialPage) && initialPage > 0 ? initialPage : 1);
  const [pageSize, setPageSize] = useState(
    Number.isFinite(initialPageSize) && initialPageSize > 0 ? initialPageSize : 20
  );

  // Cascading taxonomy data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [topics, setTopics] = useState<LessonTopic[]>([]);
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([]);

  // List data
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [meta, setMeta] = useState<QuestionsPaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | Error | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Action modals
  const [detailQuestion, setDetailQuestion] = useState<QuestionRecord | null>(null);
  const [versionsQuestion, setVersionsQuestion] = useState<QuestionRecord | null>(null);
  const [statusQuestion, setStatusQuestion] = useState<QuestionRecord | null>(null);
  const [deleteQuestion, setDeleteQuestion] = useState<QuestionRecord | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setAppliedQuery(searchInput.trim());
      setPage(1);
    }, 350);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchInput]);

  // Sync state to URL search params
  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (appliedQuery) nextParams.set('q', appliedQuery);
    if (subjectFilter) nextParams.set('subject_id', subjectFilter);
    if (chapterFilter) nextParams.set('chapter_id', chapterFilter);
    if (lessonFilter) nextParams.set('lesson_id', lessonFilter);
    if (topicFilter) nextParams.set('topic_tag', topicFilter);
    if (typeFilter) nextParams.set('type_id', typeFilter);
    if (diffFilter) nextParams.set('difficulty_level', diffFilter);
    if (statusFilter) nextParams.set('status', statusFilter);
    if (page > 1) nextParams.set('page', String(page));
    if (pageSize !== 20) nextParams.set('page_size', String(pageSize));

    setSearchParams(nextParams, { replace: true });
  }, [
    appliedQuery,
    subjectFilter,
    chapterFilter,
    lessonFilter,
    topicFilter,
    typeFilter,
    diffFilter,
    statusFilter,
    page,
    pageSize,
    setSearchParams,
  ]);

  // Load question types and subjects on mount
  useEffect(() => {
    let cancelled = false;

    async function loadInitialTaxonomy() {
      try {
        const [typesRes, subjectsRes] = await Promise.all([
          getQuestionTypesApi(),
          getSubjectsApi({ page_size: 100 }),
        ]);
        if (!cancelled) {
          setQuestionTypes(typesRes.data || []);
          setSubjects(subjectsRes.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load initial taxonomy:', err);
        }
      }
    }

    loadInitialTaxonomy();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cascading: fetch chapters when subjectFilter changes
  useEffect(() => {
    let cancelled = false;
    if (!subjectFilter) {
      setChapters([]);
      setChapterFilter('');
      setLessons([]);
      setLessonFilter('');
      setTopics([]);
      setTopicFilter('');
      return;
    }

    async function loadChapters() {
      try {
        const res = await getChaptersBySubjectApi(subjectFilter);
        if (!cancelled) {
          setChapters(res.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load chapters for subject:', err);
          setChapters([]);
        }
      }
    }

    loadChapters();
    return () => {
      cancelled = true;
    };
  }, [subjectFilter]);

  // Cascading: fetch lessons when chapterFilter changes
  useEffect(() => {
    let cancelled = false;
    if (!chapterFilter) {
      setLessons([]);
      setLessonFilter('');
      setTopics([]);
      setTopicFilter('');
      return;
    }

    async function loadLessons() {
      try {
        const res = await getLessonsByChapterApi(chapterFilter);
        if (!cancelled) {
          setLessons(res.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load lessons for chapter:', err);
          setLessons([]);
        }
      }
    }

    loadLessons();
    return () => {
      cancelled = true;
    };
  }, [chapterFilter]);

  // Cascading: fetch topics when lessonFilter changes
  useEffect(() => {
    let cancelled = false;
    if (!lessonFilter) {
      setTopics([]);
      setTopicFilter('');
      return;
    }

    async function loadTopics() {
      try {
        const res = await getLessonTopicsApi(lessonFilter);
        if (!cancelled) {
          setTopics(res.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load topics for lesson:', err);
          setTopics([]);
        }
      }
    }

    loadTopics();
    return () => {
      cancelled = true;
    };
  }, [lessonFilter]);

  // Load questions
  const loadQuestions = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await getQuestionsApi(
          {
            q: appliedQuery || undefined,
            subject_id: subjectFilter || undefined,
            chapter_id: chapterFilter || undefined,
            lesson_id: lessonFilter || undefined,
            topic_tag: topicFilter || undefined,
            type_id: typeFilter || undefined,
            difficulty_level: diffFilter || undefined,
            status: statusFilter || undefined,
            page,
            page_size: pageSize,
          },
          signal
        );
        setQuestions(res.data || []);
        setMeta(res.meta || null);
      } catch (err: unknown) {
        if (signal?.aborted) return;
        console.error('Failed to load questions:', err);
        setLoadError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [
      appliedQuery,
      subjectFilter,
      chapterFilter,
      lessonFilter,
      topicFilter,
      typeFilter,
      diffFilter,
      statusFilter,
      page,
      pageSize,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadQuestions(controller.signal);
    return () => controller.abort();
  }, [loadQuestions]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchInput('');
    setAppliedQuery('');
    setSubjectFilter('');
    setChapterFilter('');
    setLessonFilter('');
    setTopicFilter('');
    setTypeFilter('');
    setDiffFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    appliedQuery ||
      subjectFilter ||
      chapterFilter ||
      lessonFilter ||
      topicFilter ||
      typeFilter ||
      diffFilter ||
      statusFilter
  );

  // Clone question handler
  const handleCloneQuestion = async (q: QuestionRecord) => {
    try {
      const res = await cloneQuestionApi(q.id);
      setFeedbackBanner({
        type: 'success',
        message: `Đã nhân bản câu hỏi thành công (Mã mới: ${res.data.id.slice(0, 8)}...). Bản sao đang ở trạng thái bản nháp.`,
      });
      loadQuestions();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Nhân bản câu hỏi thất bại';
      setFeedbackBanner({
        type: 'error',
        message: msg,
      });
    }
  };

  // Helper to get type badge
  const getTypeBadge = (typeId: string) => {
    const t = questionTypes.find((item) => item.id === typeId);
    const code = t?.code as QuestionKind | undefined;
    const label = code ? KIND_LABELS[code] : t?.name || 'Chưa xác định';

    return (
      <span className="inline-flex items-center gap-1 rounded border border-surface-border bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-primary">
        <span>{label}</span>
      </span>
    );
  };

  // Helper to get difficulty badge
  const getDifficultyBadge = (level: QuestionDifficulty) => {
    const label = DIFFICULTY_LABELS[level] || level;
    let colorClass = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    if (level === 'MEDIUM') {
      colorClass = 'border-amber-500/30 bg-amber-500/10 text-amber-400';
    } else if (level === 'HARD') {
      colorClass = 'border-rose-500/30 bg-rose-500/10 text-rose-400';
    }

    return (
      <span
        className={cn(
          'inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold',
          colorClass
        )}
      >
        {label}
      </span>
    );
  };

  // Helper to get status badge
  const getStatusBadge = (status: QuestionStatus) => {
    const label = STATUS_LABELS[status] || status;
    let colorClass = 'border-slate-500/30 bg-slate-500/10 text-slate-400';
    if (status === 'ACTIVE') {
      colorClass = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    } else if (status === 'INACTIVE') {
      colorClass = 'border-amber-500/30 bg-amber-500/10 text-amber-400';
    } else if (status === 'ARCHIVED') {
      colorClass = 'border-purple-500/30 bg-purple-500/10 text-purple-400';
    }

    return (
      <span
        className={cn(
          'inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium',
          colorClass
        )}
      >
        {label}
      </span>
    );
  };

  // Clean content snippet
  const formatContentSnippet = (content: string) => {
    const cleaned = content.replace(/\{\{[^}]+\}\}/g, ' [ ... ] ');
    return cleaned.length > 120 ? `${cleaned.slice(0, 120)}...` : cleaned;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
              Ngân hàng câu hỏi
            </h1>
            <span className="rounded-md border border-surface-border bg-surface-muted px-2 py-0.5 font-mono text-xs text-text-secondary">
              5 dạng chuẩn hóa
            </span>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Tìm kiếm, quản lý và phân loại các câu hỏi kiểm tra theo cấu trúc môn học.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadQuestions()}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn('size-3.5 text-text-secondary', isLoading && 'animate-spin')}
            />
            <span>Làm mới</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              if (subjectFilter) params.set('subject_id', subjectFilter);
              if (chapterFilter) params.set('chapter_id', chapterFilter);
              if (lessonFilter) params.set('lesson_id', lessonFilter);
              const qString = params.toString();
              navigate(qString ? `/questions/new?${qString}` : '/questions/new');
            }}
            className="h-9 gap-1.5 font-semibold text-xs"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            <span>Tạo câu hỏi</span>
          </Button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedbackBanner ? (
        <div
          role="status"
          className={cn(
            'flex items-start justify-between gap-3 rounded-md border p-3.5 text-xs',
            feedbackBanner.type === 'success'
              ? 'border-semantic-success/30 bg-semantic-success-bg text-semantic-success'
              : 'border-semantic-danger/30 bg-semantic-danger-bg text-semantic-danger'
          )}
        >
          <div className="flex items-start gap-2">
            {feedbackBanner.type === 'success' ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            )}
            <p className="font-medium text-pretty">{feedbackBanner.message}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFeedbackBanner(null)}
            aria-label="Đóng thông báo"
            className="h-6 shrink-0 px-2 text-xs underline"
          >
            Đóng
          </Button>
        </div>
      ) : null}

      {/* Filter Card */}
      <section aria-label="Bộ lọc và tìm kiếm câu hỏi">
        <Card className="border-surface-border bg-surface-card shadow-sm">
          <CardContent className="space-y-4 p-4">
            {/* Top row: Search & Reset */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <label
                  htmlFor={`${filterIdPrefix}-q`}
                  className="mb-1 block text-xs font-medium text-text-primary"
                >
                  Tìm kiếm theo nội dung câu hỏi
                </label>
                <div className="relative flex items-center">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 size-3.5 text-text-secondary"
                  />
                  <Input
                    id={`${filterIdPrefix}-q`}
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Nhập từ khóa tìm kiếm nội dung câu hỏi..."
                    className="h-9 bg-surface-card pl-8 text-sm text-text-primary placeholder:text-text-secondary"
                  />
                </div>
              </div>

              <div className="flex items-end justify-between gap-2 lg:col-span-4 lg:justify-end">
                {hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    className="h-9 gap-1.5 text-xs text-text-secondary hover:text-text-primary"
                  >
                    <RotateCcw aria-hidden="true" className="size-3.5" />
                    <span>Đặt lại bộ lọc</span>
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Cascading Taxonomy Filters */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Subject */}
              <div>
                <label
                  htmlFor={`${filterIdPrefix}-subject`}
                  className="mb-1 block text-xs font-medium text-text-primary"
                >
                  Môn học
                </label>
                <Select
                  value={subjectFilter || 'ALL'}
                  onValueChange={(val) => {
                    setSubjectFilter(val === 'ALL' ? '' : val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    id={`${filterIdPrefix}-subject`}
                    className="h-9 bg-surface-card text-xs text-text-primary"
                  >
                    <SelectValue placeholder="Tất cả môn học" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả môn học</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.code ? `[${s.code}] ` : ''}{s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Chapter */}
              <div>
                <label
                  htmlFor={`${filterIdPrefix}-chapter`}
                  className="mb-1 block text-xs font-medium text-text-primary"
                >
                  Chương
                </label>
                <Select
                  value={chapterFilter || 'ALL'}
                  onValueChange={(val) => {
                    setChapterFilter(val === 'ALL' ? '' : val);
                    setPage(1);
                  }}
                  disabled={!subjectFilter}
                >
                  <SelectTrigger
                    id={`${filterIdPrefix}-chapter`}
                    className="h-9 bg-surface-card text-xs text-text-primary disabled:opacity-50"
                  >
                    <SelectValue placeholder={subjectFilter ? 'Tất cả chương' : 'Chọn môn trước'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả chương</SelectItem>
                    {chapters.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.order_no ? `${c.order_no}. ` : ''}{c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lesson */}
              <div>
                <label
                  htmlFor={`${filterIdPrefix}-lesson`}
                  className="mb-1 block text-xs font-medium text-text-primary"
                >
                  Bài học
                </label>
                <Select
                  value={lessonFilter || 'ALL'}
                  onValueChange={(val) => {
                    setLessonFilter(val === 'ALL' ? '' : val);
                    setPage(1);
                  }}
                  disabled={!chapterFilter}
                >
                  <SelectTrigger
                    id={`${filterIdPrefix}-lesson`}
                    className="h-9 bg-surface-card text-xs text-text-primary disabled:opacity-50"
                  >
                    <SelectValue placeholder={chapterFilter ? 'Tất cả bài học' : 'Chọn chương trước'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả bài học</SelectItem>
                    {lessons.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.order_no ? `${l.order_no}. ` : ''}{l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Topic tag */}
              <div>
                <label
                  htmlFor={`${filterIdPrefix}-topic`}
                  className="mb-1 block text-xs font-medium text-text-primary"
                >
                  Chủ đề
                </label>
                {topics.length > 0 ? (
                  <Select
                    value={topicFilter || 'ALL'}
                    onValueChange={(val) => {
                      setTopicFilter(val === 'ALL' ? '' : val);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger
                      id={`${filterIdPrefix}-topic`}
                      className="h-9 bg-surface-card text-xs text-text-primary"
                    >
                      <SelectValue placeholder="Tất cả chủ đề" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả chủ đề</SelectItem>
                      {topics.map((t) => (
                        <SelectItem key={t.topic_tag} value={t.topic_tag}>
                          {t.topic_tag} ({t.total_questions} câu)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`${filterIdPrefix}-topic`}
                    value={topicFilter}
                    onChange={(e) => {
                      setTopicFilter(e.target.value.trim());
                      setPage(1);
                    }}
                    placeholder="Nhập thẻ chủ đề..."
                    className="h-9 bg-surface-card text-xs text-text-primary"
                  />
                )}
              </div>
            </div>

            {/* Type, Difficulty, Status Row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Question Type */}
              <div>
                <label
                  htmlFor={`${filterIdPrefix}-type`}
                  className="mb-1 block text-xs font-medium text-text-primary"
                >
                  Dạng câu hỏi
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
                    className="h-9 bg-surface-card text-xs text-text-primary"
                  >
                    <SelectValue placeholder="Tất cả dạng câu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả dạng câu</SelectItem>
                    {questionTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {KIND_LABELS[t.code as QuestionKind] || t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Difficulty */}
              <div>
                <label
                  htmlFor={`${filterIdPrefix}-diff`}
                  className="mb-1 block text-xs font-medium text-text-primary"
                >
                  Độ khó
                </label>
                <Select
                  value={diffFilter || 'ALL'}
                  onValueChange={(val) => {
                    setDiffFilter(val === 'ALL' ? '' : (val as QuestionDifficulty));
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    id={`${filterIdPrefix}-diff`}
                    className="h-9 bg-surface-card text-xs text-text-primary"
                  >
                    <SelectValue placeholder="Tất cả độ khó" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div>
                <label
                  htmlFor={`${filterIdPrefix}-status`}
                  className="mb-1 block text-xs font-medium text-text-primary"
                >
                  Trạng thái
                </label>
                <Select
                  value={statusFilter || 'ALL'}
                  onValueChange={(val) => {
                    setStatusFilter(val === 'ALL' ? '' : (val as QuestionStatus));
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    id={`${filterIdPrefix}-status`}
                    className="h-9 bg-surface-card text-xs text-text-primary"
                  >
                    <SelectValue placeholder="Tất cả trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Error state */}
      {loadError ? (
        <Card className="border-semantic-danger/30 bg-semantic-danger-bg shadow-sm">
          <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="font-semibold text-sm text-semantic-danger">
                Không thể tải danh sách câu hỏi
              </h2>
              <p className="text-xs text-text-secondary">
                {loadError instanceof ApiError ? loadError.message : 'Lỗi kết nối máy chủ.'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadQuestions()}
              className="h-8 text-xs font-medium"
            >
              Thử lại
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Data Table Card */}
      <Card className="overflow-hidden border-surface-border bg-surface-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-surface-border bg-surface-muted/50 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              <tr>
                <th scope="col" className="px-4 py-3 min-w-[280px]">
                  Nội dung câu hỏi
                </th>
                <th scope="col" className="px-3 py-3 w-36">
                  Dạng câu
                </th>
                <th scope="col" className="px-3 py-3 w-28">
                  Độ khó
                </th>
                <th scope="col" className="px-3 py-3 min-w-[140px]">
                  Chủ đề / Phân loại
                </th>
                <th scope="col" className="px-3 py-3 w-32">
                  Trạng thái
                </th>
                <th scope="col" className="px-3 py-3 w-28">
                  Phiên bản
                </th>
                <th scope="col" className="px-4 py-3 w-28 text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3.5">
                      <Skeleton className="h-4 w-4/5" />
                    </td>
                    <td className="px-3 py-3.5">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-3 py-3.5">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="px-3 py-3.5">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-3 py-3.5">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-3 py-3.5">
                      <Skeleton className="h-4 w-12" />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Skeleton className="ml-auto h-7 w-16" />
                    </td>
                  </tr>
                ))
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-surface-muted text-text-secondary">
                        <HelpCircle className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-sm text-text-primary">
                          {hasActiveFilters
                            ? 'Không tìm thấy câu hỏi phù hợp'
                            : 'Ngân hàng câu hỏi đang trống'}
                        </p>
                        <p className="text-xs text-text-secondary">
                          {hasActiveFilters
                            ? 'Hãy thử thay đổi từ khóa hoặc điều chỉnh các bộ lọc phân loại.'
                            : 'Bắt đầu bằng cách tạo câu hỏi đầu tiên theo một trong 5 dạng chuẩn hóa.'}
                        </p>
                      </div>
                      <div>
                        {hasActiveFilters ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleResetFilters}
                            className="h-8 gap-1.5 text-xs font-medium"
                          >
                            <RotateCcw className="size-3" />
                            <span>Đặt lại bộ lọc</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => navigate('/questions/new')}
                            className="h-8 gap-1.5 text-xs font-medium"
                          >
                            <Plus className="size-3" />
                            <span>Tạo câu hỏi đầu tiên</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                questions.map((q) => (
                  <tr
                    key={q.id}
                    className="transition-colors hover:bg-surface-muted/30 focus-within:bg-surface-muted/30"
                  >
                    {/* Content snippet */}
                    <td className="px-4 py-3 font-normal text-text-primary">
                      <div className="flex flex-col gap-1">
                        <span className="line-clamp-2 text-pretty leading-relaxed">
                          {formatContentSnippet(q.content)}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                          <span className="font-mono">ID: {q.id.slice(0, 8)}</span>
                          {q.media_url ? (
                            <span className="inline-flex items-center gap-0.5 text-accent">
                              <ImageIcon className="size-3" />
                              <span>Có ảnh</span>
                            </span>
                          ) : null}
                          {q.explanation ? (
                            <span className="text-text-muted">• Có lời giải</span>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* Question Type */}
                    <td className="px-3 py-3">
                      {getTypeBadge(q.type_id)}
                    </td>

                    {/* Difficulty */}
                    <td className="px-3 py-3">
                      {getDifficultyBadge(q.difficulty_level)}
                    </td>

                    {/* Taxonomy / Topic tag */}
                    <td className="px-3 py-3">
                      {q.topic_tag ? (
                        <span className="inline-block rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
                          #{q.topic_tag}
                        </span>
                      ) : (
                        <span className="text-text-muted text-[11px]">Không có</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      {getStatusBadge(q.status)}
                    </td>

                    {/* Version & Creator */}
                    <td className="px-3 py-3 font-mono text-[11px] text-text-secondary">
                      <span>v{q.current_version_no}</span>
                    </td>

                    {/* Actions Menu */}
                    <td className="px-4 py-3 text-right">
                      <QuestionRowActionsMenu
                        question={q}
                        currentUserId={currentUser?.id || ''}
                        currentUserRole={currentUser?.role || ''}
                        onView={(target) => setDetailQuestion(target)}
                        onEdit={(target) => navigate(`/questions/${target.id}/edit`)}
                        onClone={handleCloneQuestion}
                        onStatusChange={(target) => setStatusQuestion(target)}
                        onVersions={(target) => setVersionsQuestion(target)}
                        onDelete={(target) => setDeleteQuestion(target)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Server Pagination Footer */}
        {meta && meta.total_pages > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-surface-border px-4 py-3 text-xs text-text-secondary sm:flex-row">
            <div className="flex items-center gap-3">
              <span>
                Trang <strong className="font-semibold text-text-primary">{meta.page}</strong> /{' '}
                {meta.total_pages} (Tổng cộng{' '}
                <strong className="font-semibold text-text-primary">{meta.total_items}</strong> câu hỏi)
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">Hiển thị:</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-7 w-24 bg-surface-card text-xs text-text-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage(1)}
                disabled={page <= 1 || isLoading}
                aria-label="Trang đầu"
                className="h-7 w-7 p-0"
              >
                <ChevronsLeft className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isLoading}
                aria-label="Trang trước"
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="size-3.5" />
              </Button>

              <span className="px-2 text-xs font-medium text-text-primary">
                {page} / {meta.total_pages}
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
                disabled={page >= meta.total_pages || isLoading}
                aria-label="Trang sau"
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage(meta.total_pages)}
                disabled={page >= meta.total_pages || isLoading}
                aria-label="Trang cuối"
                className="h-7 w-7 p-0"
              >
                <ChevronsRight className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Action Modals */}
      {detailQuestion ? (
        <QuestionDetailModal
          questionId={detailQuestion.id}
          questionTypes={questionTypes}
          isOpen={Boolean(detailQuestion)}
          onClose={() => setDetailQuestion(null)}
        />
      ) : null}

      {versionsQuestion ? (
        <QuestionVersionsModal
          questionId={versionsQuestion.id}
          isOpen={Boolean(versionsQuestion)}
          onClose={() => setVersionsQuestion(null)}
        />
      ) : null}

      {statusQuestion ? (
        <QuestionStatusModal
          question={statusQuestion}
          isOpen={Boolean(statusQuestion)}
          onClose={() => setStatusQuestion(null)}
          onSuccess={(updated) => {
            setFeedbackBanner({
              type: 'success',
              message: `Đã cập nhật trạng thái câu hỏi ${updated.id.slice(0, 8)} sang "${STATUS_LABELS[updated.status] || updated.status}".`,
            });
            loadQuestions();
          }}
        />
      ) : null}

      {deleteQuestion ? (
        <DeleteQuestionModal
          question={deleteQuestion}
          isOpen={Boolean(deleteQuestion)}
          onClose={() => setDeleteQuestion(null)}
          onSuccess={(deletedId) => {
            setFeedbackBanner({
              type: 'success',
              message: `Đã xóa câu hỏi ${deletedId.slice(0, 8)} thành công.`,
            });
            // If on last page and only 1 item was deleted, step back
            if (questions.length === 1 && page > 1) {
              setPage((p) => p - 1);
            } else {
              loadQuestions();
            }
          }}
        />
      ) : null}
    </div>
  );
}
