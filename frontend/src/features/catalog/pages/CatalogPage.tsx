import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  ChevronRight,
  FolderTree,
  HelpCircle,
  Layers,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '../../auth/AuthContext';
import type { Chapter, Lesson, LessonTopic, Subject } from '../types';
import {
  getChaptersBySubjectApi,
  getLessonsByChapterApi,
  getLessonTopicsApi,
  getSubjectsApi,
} from '../catalog.api';
import { SubjectModal } from '../components/SubjectModal';
import { ChapterModal } from '../components/ChapterModal';
import { LessonModal } from '../components/LessonModal';
import {
  DeleteCatalogModal,
  type CatalogDeleteTarget,
} from '../components/DeleteCatalogModal';

export function CatalogPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Selected state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    searchParams.get('subject_id')
  );
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    searchParams.get('chapter_id')
  );
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(
    searchParams.get('lesson_id')
  );

  // Active tab on mobile (< lg): 'subjects' | 'chapters' | 'lessons'
  const [activeMobileView, setActiveMobileView] = useState<
    'subjects' | 'chapters' | 'lessons'
  >('subjects');

  // Data states
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [topics, setTopics] = useState<LessonTopic[]>([]);

  // Loading states
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);

  // Search input for subjects
  const [subjectSearch, setSubjectSearch] = useState('');
  const [debouncedSubjectSearch, setDebouncedSubjectSearch] = useState('');

  // Modals state
  const [subjectModalState, setSubjectModalState] = useState<{
    isOpen: boolean;
    subject: Subject | null;
  }>({ isOpen: false, subject: null });

  const [chapterModalState, setChapterModalState] = useState<{
    isOpen: boolean;
    chapter: Chapter | null;
  }>({ isOpen: false, chapter: null });

  const [lessonModalState, setLessonModalState] = useState<{
    isOpen: boolean;
    lesson: Lesson | null;
  }>({ isOpen: false, lesson: null });

  const [deleteTarget, setDeleteTarget] = useState<CatalogDeleteTarget | null>(
    null
  );

  // Abort controllers to prevent race conditions when switching quickly
  const fetchChaptersAbortRef = useRef<AbortController | null>(null);
  const fetchLessonsAbortRef = useRef<AbortController | null>(null);
  const fetchTopicsAbortRef = useRef<AbortController | null>(null);

  // Debounce subject search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSubjectSearch(subjectSearch.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [subjectSearch]);

  // Sync selected state to URL query params
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedSubjectId) params.set('subject_id', selectedSubjectId);
    if (selectedChapterId) params.set('chapter_id', selectedChapterId);
    if (selectedLessonId) params.set('lesson_id', selectedLessonId);
    setSearchParams(params, { replace: true });
  }, [selectedSubjectId, selectedChapterId, selectedLessonId, setSearchParams]);

  // Load subjects
  const loadSubjects = useCallback(async () => {
    setIsLoadingSubjects(true);
    try {
      const res = await getSubjectsApi({
        q: debouncedSubjectSearch || undefined,
        page: 1,
        page_size: 100,
      });
      const list = res.data ?? [];
      setSubjects(list);

      // If currently selected subject is not in list, auto-select first or clear
      if (list.length > 0) {
        if (!selectedSubjectId || !list.some((s) => s.id === selectedSubjectId)) {
          setSelectedSubjectId(list[0].id);
        }
      } else {
        setSelectedSubjectId(null);
        setChapters([]);
        setLessons([]);
        setTopics([]);
      }
    } catch {
      // Handled via empty state
    } finally {
      setIsLoadingSubjects(false);
    }
  }, [debouncedSubjectSearch, selectedSubjectId]);

  useEffect(() => {
    loadSubjects();
  }, [debouncedSubjectSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load chapters when selectedSubjectId changes
  useEffect(() => {
    if (!selectedSubjectId) {
      setChapters([]);
      setSelectedChapterId(null);
      setLessons([]);
      setSelectedLessonId(null);
      setTopics([]);
      return;
    }

    if (fetchChaptersAbortRef.current) {
      fetchChaptersAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchChaptersAbortRef.current = controller;

    setIsLoadingChapters(true);
    getChaptersBySubjectApi(selectedSubjectId, controller.signal)
      .then((res) => {
        const list = res.data ?? [];
        setChapters(list);
        if (list.length > 0) {
          if (!selectedChapterId || !list.some((c) => c.id === selectedChapterId)) {
            setSelectedChapterId(list[0].id);
          }
        } else {
          setSelectedChapterId(null);
          setLessons([]);
          setSelectedLessonId(null);
          setTopics([]);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setChapters([]);
        }
      })
      .finally(() => {
        setIsLoadingChapters(false);
      });

    return () => {
      controller.abort();
    };
  }, [selectedSubjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load lessons when selectedChapterId changes
  useEffect(() => {
    if (!selectedChapterId) {
      setLessons([]);
      setSelectedLessonId(null);
      setTopics([]);
      return;
    }

    if (fetchLessonsAbortRef.current) {
      fetchLessonsAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchLessonsAbortRef.current = controller;

    setIsLoadingLessons(true);
    getLessonsByChapterApi(selectedChapterId, controller.signal)
      .then((res) => {
        const list = res.data ?? [];
        setLessons(list);
        if (list.length > 0) {
          if (!selectedLessonId || !list.some((l) => l.id === selectedLessonId)) {
            setSelectedLessonId(list[0].id);
          }
        } else {
          setSelectedLessonId(null);
          setTopics([]);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setLessons([]);
        }
      })
      .finally(() => {
        setIsLoadingLessons(false);
      });

    return () => {
      controller.abort();
    };
  }, [selectedChapterId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load topics when selectedLessonId changes
  useEffect(() => {
    if (!selectedLessonId) {
      setTopics([]);
      return;
    }

    if (fetchTopicsAbortRef.current) {
      fetchTopicsAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchTopicsAbortRef.current = controller;

    setIsLoadingTopics(true);
    getLessonTopicsApi(selectedLessonId, controller.signal)
      .then((res) => {
        setTopics(res.data ?? []);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setTopics([]);
        }
      })
      .finally(() => {
        setIsLoadingTopics(false);
      });

    return () => {
      controller.abort();
    };
  }, [selectedLessonId]);

  // Selected item objects
  const selectedSubject =
    subjects.find((s) => s.id === selectedSubjectId) || null;
  const selectedChapter =
    chapters.find((c) => c.id === selectedChapterId) || null;
  const selectedLesson =
    lessons.find((l) => l.id === selectedLessonId) || null;

  // Permission check: ADMIN can edit any; TEACHER can edit their own subject
  const canEditSelectedSubject =
    user?.role === 'ADMIN' ||
    (user?.role === 'TEACHER' && selectedSubject?.created_by === user?.id);

  // Callback after successful Subject save
  const handleSubjectSuccess = (saved: Subject) => {
    setSubjects((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setSelectedSubjectId(saved.id);
  };

  // Callback after successful Chapter save
  const handleChapterSuccess = (saved: Chapter) => {
    setChapters((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next.sort((a, b) => a.order_no - b.order_no);
      }
      return [...prev, saved].sort((a, b) => a.order_no - b.order_no);
    });
    setSelectedChapterId(saved.id);
  };

  // Callback after successful Lesson save
  const handleLessonSuccess = (saved: Lesson) => {
    setLessons((prev) => {
      const idx = prev.findIndex((l) => l.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next.sort((a, b) => a.order_no - b.order_no);
      }
      return [...prev, saved].sort((a, b) => a.order_no - b.order_no);
    });
    setSelectedLessonId(saved.id);
  };

  // Callback after successful deletion
  const handleDeleteSuccess = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'subject') {
      const remaining = subjects.filter((s) => s.id !== deleteTarget.id);
      setSubjects(remaining);
      if (selectedSubjectId === deleteTarget.id) {
        setSelectedSubjectId(remaining[0]?.id || null);
      }
    } else if (deleteTarget.type === 'chapter') {
      const remaining = chapters.filter((c) => c.id !== deleteTarget.id);
      setChapters(remaining);
      if (selectedChapterId === deleteTarget.id) {
        setSelectedChapterId(remaining[0]?.id || null);
      }
    } else {
      const remaining = lessons.filter((l) => l.id !== deleteTarget.id);
      setLessons(remaining);
      if (selectedLessonId === deleteTarget.id) {
        setSelectedLessonId(remaining[0]?.id || null);
      }
    }
  };

  // Navigate to Question Bank filtered by this lesson
  const handleViewQuestionsOfLesson = (lesson: Lesson) => {
    const params = new URLSearchParams();
    if (selectedSubjectId) params.set('subject_id', selectedSubjectId);
    if (selectedChapterId) params.set('chapter_id', selectedChapterId);
    params.set('lesson_id', lesson.id);
    navigate(`/questions?${params.toString()}`);
  };

  return (
    <div className="space-y-5">
      {/* Page Title & Actions */}
      <div className="flex flex-col justify-between gap-3 border-b border-surface-border pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-text-primary sm:text-2xl">
            Môn học, Chương &amp; Bài học
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Cấu trúc cây kiến thức phân cấp phục vụ biên soạn ngân hàng câu hỏi và sinh đề thi.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadSubjects()}
            disabled={isLoadingSubjects}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn(
                'size-3.5 text-text-secondary',
                isLoadingSubjects && 'animate-spin'
              )}
            />
            <span>Làm mới</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setSubjectModalState({ isOpen: true, subject: null })}
            className="h-9 gap-1.5 font-semibold text-xs"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            <span>Thêm môn học</span>
          </Button>
        </div>
      </div>

      {/* Active Breadcrumb Navigation */}
      <nav
        aria-label="Vị trí trong cây kiến thức"
        className="flex flex-wrap items-center gap-2 rounded-md border border-surface-border bg-surface-card px-4 py-2.5 text-xs text-text-secondary"
      >
        <span className="flex items-center gap-1.5 font-medium text-text-primary">
          <FolderTree aria-hidden="true" className="size-3.5 text-brand-600" />
          <span>Cây kiến thức:</span>
        </span>

        {selectedSubject ? (
          <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
            <span>{selectedSubject.name}</span>
            <span className="font-mono text-text-secondary">
              ({selectedSubject.code})
            </span>
          </span>
        ) : (
          <span className="italic text-text-secondary">Chưa chọn môn</span>
        )}

        {selectedChapter ? (
          <>
            <ChevronRight aria-hidden="true" className="size-3 text-text-secondary" />
            <span className="inline-flex items-center gap-1 font-semibold text-text-primary">
              <span>{selectedChapter.name}</span>
              {selectedChapter.code ? (
                <span className="font-mono text-text-secondary">
                  ({selectedChapter.code})
                </span>
              ) : null}
            </span>
          </>
        ) : null}

        {selectedLesson ? (
          <>
            <ChevronRight aria-hidden="true" className="size-3 text-text-secondary" />
            <span className="inline-flex items-center gap-1 font-bold text-brand-700 dark:text-brand-200">
              <span>{selectedLesson.name}</span>
              {selectedLesson.code ? (
                <span className="font-mono text-xs">
                  ({selectedLesson.code})
                </span>
              ) : null}
            </span>
          </>
        ) : null}
      </nav>

      {/* Mobile Navigation Tabs (< lg) */}
      <div className="flex border-b border-surface-border lg:hidden">
        <button
          type="button"
          onClick={() => setActiveMobileView('subjects')}
          className={cn(
            'flex-1 border-b-2 py-2.5 text-center text-xs font-semibold transition-colors',
            activeMobileView === 'subjects'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          )}
        >
          1. Môn học ({subjects.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveMobileView('chapters')}
          disabled={!selectedSubjectId}
          className={cn(
            'flex-1 border-b-2 py-2.5 text-center text-xs font-semibold transition-colors disabled:opacity-40',
            activeMobileView === 'chapters'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          )}
        >
          2. Chương ({chapters.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveMobileView('lessons')}
          disabled={!selectedChapterId}
          className={cn(
            'flex-1 border-b-2 py-2.5 text-center text-xs font-semibold transition-colors disabled:opacity-40',
            activeMobileView === 'lessons'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          )}
        >
          3. Bài học ({lessons.length})
        </button>
      </div>

      {/* 3-Column Master-Detail Layout on Desktop, Single-view on Mobile */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ========================================================
            COLUMN 1: MÔN HỌC (lg:col-span-4)
            ======================================================== */}
        <div
          className={cn(
            'lg:col-span-4',
            activeMobileView !== 'subjects' && 'hidden lg:block'
          )}
        >
          <Card className="h-full border-surface-border bg-surface-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-surface-border p-3.5">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-text-primary">
                <BookOpen aria-hidden="true" className="size-4 text-brand-600" />
                <span>Môn học</span>
                <Badge variant="outline" className="ml-1 text-[11px]">
                  {subjects.length}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 p-3">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-text-secondary"
                />
                <Input
                  type="search"
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  placeholder="Tìm theo tên hoặc mã môn..."
                  className="h-8 bg-surface-card pl-8 text-xs text-text-primary placeholder:text-text-secondary"
                />
              </div>

              <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
                {isLoadingSubjects ? (
                  <div className="space-y-2 p-1">
                    <Skeleton className="h-14 w-full rounded-md" />
                    <Skeleton className="h-14 w-full rounded-md" />
                    <Skeleton className="h-14 w-full rounded-md" />
                  </div>
                ) : subjects.length === 0 ? (
                  <div className="rounded-md border border-dashed border-surface-border p-6 text-center text-xs text-text-secondary">
                    {subjectSearch
                      ? 'Không tìm thấy môn học nào khớp với từ khóa tìm kiếm.'
                      : 'Chưa có môn học nào. Hãy nhấn "Thêm môn học" ở góc trên.'}
                  </div>
                ) : (
                  subjects.map((s) => {
                    const isSelected = s.id === selectedSubjectId;
                    const canEdit =
                      user?.role === 'ADMIN' ||
                      (user?.role === 'TEACHER' && s.created_by === user?.id);

                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedSubjectId(s.id);
                          setActiveMobileView('chapters');
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedSubjectId(s.id);
                            setActiveMobileView('chapters');
                          }
                        }}
                        className={cn(
                          'group flex cursor-pointer items-start justify-between rounded-md border p-2.5 text-left transition-colors',
                          isSelected
                            ? 'border-brand-600 bg-semantic-info-bg shadow-sm'
                            : 'border-surface-border bg-surface-card hover:bg-surface-muted'
                        )}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-brand-700 dark:text-brand-300">
                              {s.code}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs font-semibold text-text-primary">
                            {s.name}
                          </p>
                          {s.description ? (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-text-secondary">
                              {s.description}
                            </p>
                          ) : null}
                        </div>

                        <div
                          className="flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Thao tác với môn học ${s.name}`}
                                className="size-7 opacity-75 group-hover:opacity-100"
                              >
                                <MoreVertical aria-hidden="true" className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() =>
                                  setSubjectModalState({
                                    isOpen: true,
                                    subject: s,
                                  })
                                }
                                disabled={!canEdit}
                              >
                                <Pencil aria-hidden="true" className="mr-2 size-3.5" />
                                <span>Chỉnh sửa môn</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() =>
                                  setDeleteTarget({
                                    type: 'subject',
                                    id: s.id,
                                    name: s.name,
                                    code: s.code,
                                  })
                                }
                                disabled={!canEdit}
                                className="text-semantic-error focus:text-semantic-error"
                              >
                                <Trash2 aria-hidden="true" className="mr-2 size-3.5" />
                                <span>Xóa môn học</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ========================================================
            COLUMN 2: CHƯƠNG HỌC (lg:col-span-4)
            ======================================================== */}
        <div
          className={cn(
            'lg:col-span-4',
            activeMobileView !== 'chapters' && 'hidden lg:block'
          )}
        >
          <Card className="h-full border-surface-border bg-surface-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-surface-border p-3.5">
              <div className="flex items-center gap-2">
                <Layers aria-hidden="true" className="size-4 text-brand-600" />
                <CardTitle className="text-sm font-bold text-text-primary">
                  Chương
                </CardTitle>
                <Badge variant="outline" className="ml-1 text-[11px]">
                  {chapters.length}
                </Badge>
              </div>

              {selectedSubjectId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setChapterModalState({
                      isOpen: true,
                      chapter: null,
                    })
                  }
                  disabled={!canEditSelectedSubject}
                  className="h-7 gap-1 px-2 text-[11px] font-semibold"
                >
                  <Plus aria-hidden="true" className="size-3" />
                  <span>Thêm chương</span>
                </Button>
              ) : null}
            </CardHeader>

            <CardContent className="p-3">
              {!selectedSubjectId ? (
                <div className="rounded-md border border-dashed border-surface-border p-8 text-center text-xs text-text-secondary">
                  Vui lòng chọn một môn học ở cột bên trái để xem danh sách chương.
                </div>
              ) : isLoadingChapters ? (
                <div className="space-y-2 p-1">
                  <Skeleton className="h-12 w-full rounded-md" />
                  <Skeleton className="h-12 w-full rounded-md" />
                </div>
              ) : chapters.length === 0 ? (
                <div className="rounded-md border border-dashed border-surface-border p-8 text-center text-xs text-text-secondary">
                  Môn học này chưa có chương nào.
                  {canEditSelectedSubject ? (
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setChapterModalState({
                            isOpen: true,
                            chapter: null,
                          })
                        }
                        className="h-8 text-xs font-semibold"
                      >
                        <Plus aria-hidden="true" className="mr-1 size-3.5" />
                        <span>Thêm chương đầu tiên</span>
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
                  {chapters.map((ch) => {
                    const isSelected = ch.id === selectedChapterId;

                    return (
                      <div
                        key={ch.id}
                        onClick={() => {
                          setSelectedChapterId(ch.id);
                          setActiveMobileView('lessons');
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedChapterId(ch.id);
                            setActiveMobileView('lessons');
                          }
                        }}
                        className={cn(
                          'group flex cursor-pointer items-start justify-between rounded-md border p-2.5 text-left transition-colors',
                          isSelected
                            ? 'border-brand-600 bg-semantic-info-bg shadow-sm'
                            : 'border-surface-border bg-surface-card hover:bg-surface-muted'
                        )}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
                              #{ch.order_no}
                            </span>
                            {ch.code ? (
                              <span className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">
                                {ch.code}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-xs font-semibold text-text-primary">
                            {ch.name}
                          </p>
                        </div>

                        <div
                          className="flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Thao tác với chương ${ch.name}`}
                                className="size-7 opacity-75 group-hover:opacity-100"
                              >
                                <MoreVertical aria-hidden="true" className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() =>
                                  setChapterModalState({
                                    isOpen: true,
                                    chapter: ch,
                                  })
                                }
                                disabled={!canEditSelectedSubject}
                              >
                                <Pencil aria-hidden="true" className="mr-2 size-3.5" />
                                <span>Chỉnh sửa chương</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() =>
                                  setDeleteTarget({
                                    type: 'chapter',
                                    id: ch.id,
                                    name: ch.name,
                                    code: ch.code,
                                  })
                                }
                                disabled={!canEditSelectedSubject}
                                className="text-semantic-error focus:text-semantic-error"
                              >
                                <Trash2 aria-hidden="true" className="mr-2 size-3.5" />
                                <span>Xóa chương</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ========================================================
            COLUMN 3: BÀI HỌC & CHỦ ĐỀ (lg:col-span-4)
            ======================================================== */}
        <div
          className={cn(
            'lg:col-span-4',
            activeMobileView !== 'lessons' && 'hidden lg:block'
          )}
        >
          <Card className="h-full border-surface-border bg-surface-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-surface-border p-3.5">
              <div className="flex items-center gap-2">
                <FolderTree aria-hidden="true" className="size-4 text-brand-600" />
                <CardTitle className="text-sm font-bold text-text-primary">
                  Bài học
                </CardTitle>
                <Badge variant="outline" className="ml-1 text-[11px]">
                  {lessons.length}
                </Badge>
              </div>

              {selectedChapterId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setLessonModalState({
                      isOpen: true,
                      lesson: null,
                    })
                  }
                  disabled={!canEditSelectedSubject}
                  className="h-7 gap-1 px-2 text-[11px] font-semibold"
                >
                  <Plus aria-hidden="true" className="size-3" />
                  <span>Thêm bài học</span>
                </Button>
              ) : null}
            </CardHeader>

            <CardContent className="space-y-4 p-3">
              {!selectedChapterId ? (
                <div className="rounded-md border border-dashed border-surface-border p-8 text-center text-xs text-text-secondary">
                  Vui lòng chọn một chương để xem danh sách bài học.
                </div>
              ) : isLoadingLessons ? (
                <div className="space-y-2 p-1">
                  <Skeleton className="h-12 w-full rounded-md" />
                  <Skeleton className="h-12 w-full rounded-md" />
                </div>
              ) : lessons.length === 0 ? (
                <div className="rounded-md border border-dashed border-surface-border p-8 text-center text-xs text-text-secondary">
                  Chương này chưa có bài học nào.
                  {canEditSelectedSubject ? (
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setLessonModalState({
                            isOpen: true,
                            lesson: null,
                          })
                        }
                        className="h-8 text-xs font-semibold"
                      >
                        <Plus aria-hidden="true" className="mr-1 size-3.5" />
                        <span>Thêm bài học đầu tiên</span>
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="max-h-[35vh] space-y-1 overflow-y-auto pr-1">
                  {lessons.map((les) => {
                    const isSelected = les.id === selectedLessonId;

                    return (
                      <div
                        key={les.id}
                        onClick={() => setSelectedLessonId(les.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedLessonId(les.id);
                          }
                        }}
                        className={cn(
                          'group flex cursor-pointer items-start justify-between rounded-md border p-2.5 text-left transition-colors',
                          isSelected
                            ? 'border-brand-600 bg-semantic-info-bg shadow-sm'
                            : 'border-surface-border bg-surface-card hover:bg-surface-muted'
                        )}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
                              #{les.order_no}
                            </span>
                            {les.code ? (
                              <span className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">
                                {les.code}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-xs font-semibold text-text-primary">
                            {les.name}
                          </p>
                        </div>

                        <div
                          className="flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Thao tác với bài học ${les.name}`}
                                className="size-7 opacity-75 group-hover:opacity-100"
                              >
                                <MoreVertical aria-hidden="true" className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => handleViewQuestionsOfLesson(les)}
                              >
                                <HelpCircle aria-hidden="true" className="mr-2 size-3.5" />
                                <span>Xem câu hỏi của bài</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  setLessonModalState({
                                    isOpen: true,
                                    lesson: les,
                                  })
                                }
                                disabled={!canEditSelectedSubject}
                              >
                                <Pencil aria-hidden="true" className="mr-2 size-3.5" />
                                <span>Chỉnh sửa bài học</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() =>
                                  setDeleteTarget({
                                    type: 'lesson',
                                    id: les.id,
                                    name: les.name,
                                    code: les.code,
                                  })
                                }
                                disabled={!canEditSelectedSubject}
                                className="text-semantic-error focus:text-semantic-error"
                              >
                                <Trash2 aria-hidden="true" className="mr-2 size-3.5" />
                                <span>Xóa bài học</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Topics Details Panel for Selected Lesson */}
              {selectedLesson ? (
                <div className="rounded-md border border-surface-border bg-surface-muted/40 p-3">
                  <div className="flex items-center justify-between border-b border-surface-border pb-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
                      <Tag aria-hidden="true" className="size-3.5 text-brand-600" />
                      <span>Chủ đề trong bài</span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      onClick={() => handleViewQuestionsOfLesson(selectedLesson)}
                      className="h-6 gap-1 px-2 text-[11px] font-semibold"
                    >
                      <HelpCircle aria-hidden="true" className="size-3" />
                      <span>Ngân hàng câu hỏi</span>
                    </Button>
                  </div>

                  <div className="mt-2.5">
                    {isLoadingTopics ? (
                      <div className="space-y-1.5">
                        <Skeleton className="h-6 w-full rounded" />
                        <Skeleton className="h-6 w-3/4 rounded" />
                      </div>
                    ) : topics.length === 0 ? (
                      <p className="text-center text-[11px] text-text-secondary">
                        Chưa có chủ đề câu hỏi nào được gán cho bài học này.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {topics.map((t) => (
                          <span
                            key={t.topic_tag}
                            className="inline-flex items-center gap-1 rounded bg-surface-card px-2 py-1 text-[11px] font-medium text-text-primary shadow-sm ring-1 ring-surface-border"
                          >
                            <span className="font-mono text-brand-600">
                              #{t.topic_tag}
                            </span>
                            <span className="text-text-secondary">
                              ({t.active_questions}/{t.total_questions})
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <SubjectModal
        isOpen={subjectModalState.isOpen}
        onClose={() => setSubjectModalState({ isOpen: false, subject: null })}
        subject={subjectModalState.subject}
        onSuccess={handleSubjectSuccess}
      />

      {selectedSubject ? (
        <ChapterModal
          isOpen={chapterModalState.isOpen}
          onClose={() =>
            setChapterModalState({ isOpen: false, chapter: null })
          }
          subjectId={selectedSubject.id}
          subjectName={selectedSubject.name}
          chapter={chapterModalState.chapter}
          defaultOrderNo={chapters.length + 1}
          onSuccess={handleChapterSuccess}
        />
      ) : null}

      {selectedChapter ? (
        <LessonModal
          isOpen={lessonModalState.isOpen}
          onClose={() => setLessonModalState({ isOpen: false, lesson: null })}
          chapterId={selectedChapter.id}
          chapterName={selectedChapter.name}
          lesson={lessonModalState.lesson}
          defaultOrderNo={lessons.length + 1}
          onSuccess={handleLessonSuccess}
        />
      ) : null}

      <DeleteCatalogModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        target={deleteTarget}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
