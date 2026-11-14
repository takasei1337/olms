import React, { useEffect, useId, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '../../../api/client';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { useAuth } from '../../auth/AuthContext';
import type {
  AnswerSpec,
  QuestionDifficulty,
  QuestionKind,
  QuestionRecord,
  QuestionType,
} from '../types';
import {
  createDefaultAnswerSpec,
  sanitizeAnswerSpecPayload,
  validateAnswerSpecDraft,
} from '../adapters/answer-spec.adapter';
import {
  createQuestionApi,
  getQuestionByIdApi,
  getQuestionTypesApi,
  updateQuestionApi,
} from '../questions.api';
import {
  getChaptersBySubjectApi,
  getLessonsByChapterApi,
  getLessonTopicsApi,
  getSubjectsApi,
} from '../../catalog/catalog.api';
import type { Chapter, Lesson, LessonTopic, Subject } from '../../catalog/types';
import { SingleChoiceEditor } from '../components/editor/SingleChoiceEditor';
import { MultiChoiceEditor } from '../components/editor/MultiChoiceEditor';
import { DropdownEditor } from '../components/editor/DropdownEditor';
import { InputEditor } from '../components/editor/InputEditor';
import { MatchingEditor } from '../components/editor/MatchingEditor';
import { QuestionPreview } from '../components/preview/QuestionPreview';

export function QuestionEditorPage() {
  const { user } = useAuth();
  const { questionId } = useParams<{ questionId: string }>();
  const isEdit = Boolean(questionId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Preset query params from catalog or filter
  const presetSubjectId = searchParams.get('subject_id') || '';
  const presetChapterId = searchParams.get('chapter_id') || '';
  const presetLessonId = searchParams.get('lesson_id') || '';

  // Form IDs
  const contentId = useId();
  const mediaUrlId = useId();
  const explanationId = useId();
  const topicTagId = useId();

  // Ownership state
  const [questionCreatedBy, setQuestionCreatedBy] = useState<string | null>(null);
  const isOwnerOrAdmin =
    !isEdit ||
    user?.role === 'ADMIN' ||
    (Boolean(questionCreatedBy) && questionCreatedBy === user?.id);

  // Question Types
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');

  // Catalog selectors
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonTopics, setLessonTopics] = useState<LessonTopic[]>([]);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(presetSubjectId);
  const [selectedChapterId, setSelectedChapterId] = useState<string>(presetChapterId);
  const [selectedLessonId, setSelectedLessonId] = useState<string>(presetLessonId);

  // Form Fields
  const [difficultyLevel, setDifficultyLevel] =
    useState<QuestionDifficulty>('EASY');
  const [topicTag, setTopicTag] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [explanation, setExplanation] = useState('');
  const [requestedStatus, setRequestedStatus] = useState<'DRAFT' | 'ACTIVE'>(
    'DRAFT'
  );

  // Answer Spec
  const [answerSpec, setAnswerSpec] = useState<AnswerSpec>(
    createDefaultAnswerSpec('SINGLE_CHOICE')
  );

  // State flags
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    code?: string;
    traceId?: string;
    serverMessage?: string;
  } | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Load question types and initial subjects
  useEffect(() => {
    let isMounted = true;
    Promise.all([getQuestionTypesApi(), getSubjectsApi({ page_size: 100 })])
      .then(([typesRes, subjectsRes]) => {
        if (!isMounted) return;
        const types = typesRes.data ?? [];
        setQuestionTypes(types);
        setSubjects(subjectsRes.data ?? []);

        if (!isEdit && types.length > 0) {
          const sc = types.find((t) => t.code === 'SINGLE_CHOICE') || types[0];
          setSelectedTypeId(sc.id);
          setAnswerSpec(createDefaultAnswerSpec(sc.code));
        }
      })
      .catch(() => {
        // Handled via error state
      })
      .finally(() => {
        if (isMounted && !isEdit) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isEdit]);

  // Load existing question for Edit mode
  useEffect(() => {
    if (!isEdit || !questionId) return;

    let isMounted = true;
    setIsLoading(true);

    getQuestionByIdApi(questionId)
      .then((res) => {
        if (!isMounted) return;
        const q: QuestionRecord = res.data;
        setQuestionCreatedBy(q.created_by);
        setSelectedTypeId(q.type_id);
        setDifficultyLevel(q.difficulty_level || 'EASY');
        setTopicTag(q.topic_tag || '');
        setContent(q.content || '');
        setMediaUrl(q.media_url || '');
        setExplanation(q.explanation || '');
        setRequestedStatus(q.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT');

        if (q.answer_spec) {
          setAnswerSpec(q.answer_spec);
        }

        if (q.lesson_id) {
          setSelectedLessonId(q.lesson_id);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        if (err instanceof ApiError) {
          setErrorMessage(err.message || 'Không thể tải chi tiết câu hỏi.');
          setErrorDetails({
            code: err.code,
            traceId: err.traceId,
            serverMessage: err.serverMessage,
          });
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isEdit, questionId]);

  // Load chapters when selectedSubjectId changes
  useEffect(() => {
    if (!selectedSubjectId) {
      setChapters([]);
      setSelectedChapterId('');
      setLessons([]);
      setSelectedLessonId('');
      return;
    }
    getChaptersBySubjectApi(selectedSubjectId)
      .then((res) => {
        setChapters(res.data ?? []);
      })
      .catch(() => setChapters([]));
  }, [selectedSubjectId]);

  // Load lessons when selectedChapterId changes
  useEffect(() => {
    if (!selectedChapterId) {
      setLessons([]);
      setSelectedLessonId('');
      return;
    }
    getLessonsByChapterApi(selectedChapterId)
      .then((res) => {
        setLessons(res.data ?? []);
      })
      .catch(() => setLessons([]));
  }, [selectedChapterId]);

  // Load topics when selectedLessonId changes
  useEffect(() => {
    if (!selectedLessonId) {
      setLessonTopics([]);
      return;
    }
    getLessonTopicsApi(selectedLessonId)
      .then((res) => {
        setLessonTopics(res.data ?? []);
      })
      .catch(() => setLessonTopics([]));
  }, [selectedLessonId]);

  // Warn on page unload if draft has unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Current selected question type object
  const currentQuestionType = questionTypes.find((t) => t.id === selectedTypeId);
  const currentKind: QuestionKind = currentQuestionType?.code || 'SINGLE_CHOICE';

  // Handler when user changes question type
  const handleTypeChange = (newTypeId: string) => {
    if (newTypeId === selectedTypeId) return;
    const targetType = questionTypes.find((t) => t.id === newTypeId);
    if (!targetType) return;

    // Check if user has entered answer content
    const hasExistingData = content.trim().length > 0;
    if (hasExistingData) {
      const confirmSwitch = window.confirm(
        'Thay đổi dạng câu hỏi sẽ khởi tạo lại cấu trúc đáp án tương ứng. Bạn có chắc chắn muốn chuyển không?'
      );
      if (!confirmSwitch) return;
    }

    setSelectedTypeId(newTypeId);
    setAnswerSpec(createDefaultAnswerSpec(targetType.code));
    setIsDirty(true);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTypeId) {
      setErrorMessage('Vui lòng chọn dạng câu hỏi.');
      return;
    }
    if (!content.trim()) {
      setErrorMessage('Nội dung câu hỏi không được để trống.');
      return;
    }

    // Validate answer_spec strictly against backend validator rules
    const specValidationError = validateAnswerSpecDraft(answerSpec, content.trim());
    if (specValidationError) {
      setErrorMessage(specValidationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setErrorDetails(null);

    const sanitizedSpec = sanitizeAnswerSpecPayload(answerSpec);
    const normalizedTopicTag = topicTag.trim() || null;
    const normalizedMediaUrl = mediaUrl.trim() || null;
    const normalizedExplanation = explanation.trim() || null;
    const normalizedLessonId = selectedLessonId || null;

    try {
      if (isEdit && questionId) {
        await updateQuestionApi(questionId, {
          lesson_id: normalizedLessonId,
          type_id: selectedTypeId,
          difficulty_level: difficultyLevel,
          topic_tag: normalizedTopicTag,
          content: content.trim(),
          media_url: normalizedMediaUrl,
          explanation: normalizedExplanation,
          requested_status: requestedStatus,
          answer_spec: sanitizedSpec,
        });

        setIsDirty(false);
        setSuccessBanner('Cập nhật câu hỏi thành công.');
        setTimeout(() => {
          navigate('/questions');
        }, 1200);
      } else {
        const res = await createQuestionApi({
          lesson_id: normalizedLessonId,
          type_id: selectedTypeId,
          difficulty_level: difficultyLevel,
          topic_tag: normalizedTopicTag,
          content: content.trim(),
          media_url: normalizedMediaUrl,
          explanation: normalizedExplanation,
          requested_status: requestedStatus,
          answer_spec: sanitizedSpec,
        });

        setIsDirty(false);
        setSuccessBanner('Tạo câu hỏi mới thành công.');
        setTimeout(() => {
          navigate(`/questions?highlight_id=${res.data.id}`);
        }, 1200);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'CONFLICT') {
          setErrorMessage('Phát hiện xung đột hoặc câu hỏi trùng lặp.');
        } else if (err.code === 'FORBIDDEN') {
          setErrorMessage('Bạn không có quyền chỉnh sửa câu hỏi này.');
        } else {
          setErrorMessage(
            err.message || 'Không thể lưu câu hỏi. Vui lòng kiểm tra lại thông tin.'
          );
        }
        setErrorDetails({
          code: err.code,
          traceId: err.traceId,
          serverMessage: err.serverMessage,
        });
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định khi lưu câu hỏi.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 py-8">
        <Skeleton className="h-8 w-60 rounded-md" />
        <Skeleton className="h-40 w-full rounded-md" />
        <Skeleton className="h-60 w-full rounded-md" />
      </div>
    );
  }

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);
  const selectedLesson = lessons.find((l) => l.id === selectedLessonId);

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex flex-col justify-between gap-3 border-b border-surface-border pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigate('/questions')}
            aria-label="Quay lại ngân hàng câu hỏi"
            className="size-9 shrink-0"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-text-primary sm:text-2xl">
              {isEdit ? 'Chỉnh sửa câu hỏi' : 'Soạn câu hỏi mới'}
            </h1>
            <p className="text-xs text-text-secondary sm:text-sm">
              Hỗ trợ 5 dạng câu hỏi chuẩn khảo thí, kiểm tra tính hợp lệ và xem trước kết quả trực tiếp.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/questions')}
            disabled={isSubmitting}
            className="h-9 text-xs"
          >
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            form="question-editor-form"
            size="sm"
            disabled={isSubmitting || (isEdit && !isOwnerOrAdmin)}
            className="h-9 gap-1.5 font-semibold text-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <Save aria-hidden="true" className="size-3.5" />
                <span>{isEdit ? 'Lưu thay đổi' : 'Tạo câu hỏi'}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Read-only Alert when user is not owner and not admin */}
      {isEdit && !isOwnerOrAdmin ? (
        <div
          role="alert"
          className="rounded-md border border-semantic-warning/30 bg-semantic-warning-bg p-3.5 text-xs text-semantic-warning"
        >
          <p className="font-semibold text-text-primary">
            Chế độ chỉ đọc: Bạn không có quyền chỉnh sửa câu hỏi này vì tài nguyên thuộc sở hữu của người dùng khác.
          </p>
        </div>
      ) : null}

      {/* Success Banner */}
      {successBanner ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-semantic-success/30 bg-semantic-success-bg p-3 text-xs font-semibold text-semantic-success"
        >
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
          <span>{successBanner} Đang chuyển hướng...</span>
        </div>
      ) : null}

      {/* Error Alert */}
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-md border border-semantic-error/30 bg-semantic-error-bg p-3.5 text-xs text-semantic-error"
        >
          <p className="font-semibold">{errorMessage}</p>
          {errorDetails ? (
            <div className="mt-2">
              <TechnicalDetails
                code={errorDetails.code}
                traceId={errorDetails.traceId}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 2-Column Responsive Layout: Left = Editor Form, Right = Live Preview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Editor Form Column */}
        <div className="space-y-5 lg:col-span-7">
          <form
            id="question-editor-form"
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* Classification & Metadata Card */}
            <Card className="border-surface-border bg-surface-card shadow-sm">
              <CardHeader className="border-b border-surface-border p-3.5">
                <CardTitle className="text-sm font-bold text-text-primary">
                  1. Phân loại &amp; Thông tin chung
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 p-4">
                {/* Subject -> Chapter -> Lesson selectors */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-text-primary">
                      Môn học
                    </label>
                    <Select
                      value={selectedSubjectId || 'NONE'}
                      onValueChange={(val) => {
                        setSelectedSubjectId(val === 'NONE' ? '' : val);
                        setIsDirty(true);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Chọn môn học" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">(Không chọn môn)</SelectItem>
                        {subjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.code} - {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-text-primary">
                      Chương
                    </label>
                    <Select
                      value={selectedChapterId || 'NONE'}
                      onValueChange={(val) => {
                        setSelectedChapterId(val === 'NONE' ? '' : val);
                        setIsDirty(true);
                      }}
                      disabled={!selectedSubjectId}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Chọn chương" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">(Không chọn chương)</SelectItem>
                        {chapters.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-text-primary">
                      Bài học
                    </label>
                    <Select
                      value={selectedLessonId || 'NONE'}
                      onValueChange={(val) => {
                        setSelectedLessonId(val === 'NONE' ? '' : val);
                        setIsDirty(true);
                      }}
                      disabled={!selectedChapterId}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Chọn bài học" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">(Chưa gắn bài học)</SelectItem>
                        {lessons.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Question Type, Difficulty & Topic Tag */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-text-primary">
                      Dạng câu hỏi <span className="text-semantic-error">*</span>
                    </label>
                    <Select
                      value={selectedTypeId}
                      onValueChange={handleTypeChange}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="h-9 text-xs font-semibold text-brand-700 dark:text-brand-300">
                        <SelectValue placeholder="Chọn dạng câu hỏi" />
                      </SelectTrigger>
                      <SelectContent>
                        {questionTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-text-primary">
                      Độ khó <span className="text-semantic-error">*</span>
                    </label>
                    <Select
                      value={difficultyLevel}
                      onValueChange={(val) => {
                        setDifficultyLevel(val as QuestionDifficulty);
                        setIsDirty(true);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EASY">Dễ (EASY)</SelectItem>
                        <SelectItem value="MEDIUM">Trung bình (MEDIUM)</SelectItem>
                        <SelectItem value="HARD">Khó (HARD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label
                      htmlFor={topicTagId}
                      className="mb-1 block text-xs font-semibold text-text-primary"
                    >
                      Chủ đề (Topic Tag)
                    </label>
                    <Input
                      id={topicTagId}
                      value={topicTag}
                      onChange={(e) => {
                        setTopicTag(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="Ví dụ: gioihan_hamso..."
                      maxLength={100}
                      className="h-9 text-xs font-mono"
                    />

                    {/* Suggestions from existing lesson topics */}
                    {lessonTopics.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {lessonTopics.slice(0, 4).map((t) => (
                          <button
                            key={t.topic_tag}
                            type="button"
                            onClick={() => {
                              setTopicTag(t.topic_tag);
                              setIsDirty(true);
                            }}
                            className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-mono text-text-secondary hover:text-text-primary"
                          >
                            #{t.topic_tag}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Initial Status selector */}
                <div className="w-full sm:w-1/3">
                  <label className="mb-1 block text-xs font-semibold text-text-primary">
                    Trạng thái ban đầu
                  </label>
                  <Select
                    value={requestedStatus}
                    onValueChange={(val) => {
                      setRequestedStatus(val as 'DRAFT' | 'ACTIVE');
                      setIsDirty(true);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Bản nháp (DRAFT)</SelectItem>
                      <SelectItem value="ACTIVE">Kích hoạt sử dụng (ACTIVE)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Content & Media Card */}
            <Card className="border-surface-border bg-surface-card shadow-sm">
              <CardHeader className="border-b border-surface-border p-3.5">
                <CardTitle className="text-sm font-bold text-text-primary">
                  2. Nội dung câu hỏi &amp; Lời giải
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 p-4">
                <div>
                  <label
                    htmlFor={contentId}
                    className="mb-1 block text-xs font-semibold text-text-primary"
                  >
                    Nội dung câu hỏi <span className="text-semantic-error">*</span>
                  </label>
                  <Textarea
                    id={contentId}
                    value={content}
                    onChange={(e) => {
                      setContent(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder={
                      currentKind === 'DROPDOWN'
                        ? 'Nhập nội dung câu hỏi, chèn {{b1}}, {{b2}} vào vị trí muốn đặt menu thả xuống...'
                        : 'Nhập nội dung đề bài...'
                    }
                    rows={4}
                    className="text-sm"
                    required
                  />
                  {currentKind === 'DROPDOWN' ? (
                    <p className="mt-1 text-[11px] text-text-secondary">
                      Lưu ý: Dạng câu hỏi Chọn vào chỗ trống yêu cầu mỗi thẻ {'{{mã_blank}}'} phải có mặt trong đề bài.
                    </p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor={mediaUrlId}
                    className="mb-1 block text-xs font-semibold text-text-primary"
                  >
                    Đường dẫn hình ảnh minh họa (URL) <span className="font-normal text-text-secondary">(tùy chọn)</span>
                  </label>
                  <Input
                    id={mediaUrlId}
                    value={mediaUrl}
                    onChange={(e) => {
                      setMediaUrl(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="https://example.com/hinh-anh-minh-hoa.png"
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <label
                    htmlFor={explanationId}
                    className="mb-1 block text-xs font-semibold text-text-primary"
                  >
                    Lời giải chi tiết &amp; Hướng dẫn chấm <span className="font-normal text-text-secondary">(tùy chọn)</span>
                  </label>
                  <Textarea
                    id={explanationId}
                    value={explanation}
                    onChange={(e) => {
                      setExplanation(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Nhập phương pháp giải hoặc giải thích cho đáp án..."
                    rows={3}
                    className="text-xs"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Answer Structure Card based on Kind */}
            <Card className="border-surface-border bg-surface-card shadow-sm">
              <CardHeader className="border-b border-surface-border p-3.5">
                <CardTitle className="text-sm font-bold text-text-primary">
                  3. Soạn thảo đáp án ({currentQuestionType?.name || currentKind})
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4">
                {currentKind === 'SINGLE_CHOICE' && answerSpec.kind === 'SINGLE_CHOICE' && (
                  <SingleChoiceEditor
                    spec={answerSpec}
                    onChange={(next) => {
                      setAnswerSpec(next);
                      setIsDirty(true);
                    }}
                    disabled={isSubmitting}
                  />
                )}

                {currentKind === 'MULTI_CHOICE' && answerSpec.kind === 'MULTI_CHOICE' && (
                  <MultiChoiceEditor
                    spec={answerSpec}
                    onChange={(next) => {
                      setAnswerSpec(next);
                      setIsDirty(true);
                    }}
                    disabled={isSubmitting}
                  />
                )}

                {currentKind === 'DROPDOWN' && answerSpec.kind === 'DROPDOWN' && (
                  <DropdownEditor
                    spec={answerSpec}
                    onChange={(next) => {
                      setAnswerSpec(next);
                      setIsDirty(true);
                    }}
                    questionContent={content}
                    onContentChange={(newContent) => {
                      setContent(newContent);
                      setIsDirty(true);
                    }}
                    disabled={isSubmitting}
                  />
                )}

                {currentKind === 'INPUT' && answerSpec.kind === 'INPUT' && (
                  <InputEditor
                    spec={answerSpec}
                    onChange={(next) => {
                      setAnswerSpec(next);
                      setIsDirty(true);
                    }}
                    disabled={isSubmitting}
                  />
                )}

                {currentKind === 'MATCHING' && answerSpec.kind === 'MATCHING' && (
                  <MatchingEditor
                    spec={answerSpec}
                    onChange={(next) => {
                      setAnswerSpec(next);
                      setIsDirty(true);
                    }}
                    disabled={isSubmitting}
                  />
                )}
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Live Preview Column */}
        <div className="space-y-3 lg:col-span-5">
          <div className="sticky top-6">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-secondary">
              Xem trước câu hỏi (Live Preview)
            </span>
            <QuestionPreview
              content={content}
              mediaUrl={mediaUrl}
              explanation={explanation}
              difficultyLevel={difficultyLevel}
              kind={currentKind}
              answerSpec={answerSpec}
              topicTag={topicTag}
              subjectName={selectedSubject?.name}
              chapterName={selectedChapter?.name}
              lessonName={selectedLesson?.name}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
