import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardCheck,
  Divide,
  FilePlus2,
  Layers,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiError } from '../../../api/client';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import {
  getChaptersBySubjectApi,
  getLessonsByChapterApi,
} from '../../catalog/catalog.api';
import type { Chapter, Lesson } from '../../catalog/types';
import {
  DIFFICULTY_LABELS,
  KIND_LABELS,
  type QuestionDifficulty,
  type QuestionRecord,
  type QuestionType,
} from '../../questions/types';
import {
  generateDraftRootFromMatrixApi,
  replaceExamMatrixApi,
  replaceRootQuestionsApi,
  validateExamMatrixApi,
} from '../exams.api';
import type {
  ExamMatrixRowInput,
  ExamRecord,
  MatrixValidationResult,
  RootQuestionItem,
  RootQuestionsResponse,
} from '../types';
import {
  formatScore,
  readDraftSession,
  writeDraftSession,
} from '../utils';
import { RootQuestionPickerModal } from './RootQuestionPickerModal';

interface MatrixRowDraft {
  localId: string;
  chapter_id: string;
  lesson_id: string;
  question_type_id: string;
  difficulty_level: QuestionDifficulty;
  num_questions: string;
  score_per_question: string;
  max_questions_per_topic: string;
}

interface RootItemDraft {
  question_id: string;
  type_id: string;
  difficulty_level: QuestionDifficulty;
  lesson_id: string | null;
  topic_tag: string | null;
  content: string;
  score: string;
}

interface ExamMatrixAndRootTabProps {
  exam: ExamRecord;
  isDraft: boolean;
  questionTypes: QuestionType[];
  rootData: RootQuestionsResponse | null;
  onRootDataUpdated: (nextRoot: RootQuestionsResponse) => void;
  onMatrixRowsChanged: (rows: ExamMatrixRowInput[]) => void;
}

function makeMatrixDraftKey(examId: string): string {
  return `olms_exam_matrix_${examId}`;
}

function createLocalId(): string {
  return `row-${Math.random().toString(36).slice(2, 10)}`;
}

function mapRootItemsToDraft(items: RootQuestionItem[]): RootItemDraft[] {
  return items.map((item) => ({
    question_id: item.question_id,
    type_id: item.type_id,
    difficulty_level: item.difficulty_level,
    lesson_id: item.lesson_id,
    topic_tag: item.topic_tag,
    content: item.content,
    score: String(item.score),
  }));
}

export function ExamMatrixAndRootTab({
  exam,
  isDraft,
  questionTypes,
  rootData,
  onRootDataUpdated,
  onMatrixRowsChanged,
}: ExamMatrixAndRootTabProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessonsByChapter, setLessonsByChapter] = useState<
    Record<string, Lesson[]>
  >({});

  const [matrixRows, setMatrixRows] = useState<MatrixRowDraft[]>([]);
  const [matrixDirty, setMatrixDirty] = useState(false);
  const [matrixSaving, setMatrixSaving] = useState(false);
  const [matrixValidating, setMatrixValidating] = useState(false);
  const [matrixResult, setMatrixResult] =
    useState<MatrixValidationResult | null>(null);
  const [matrixError, setMatrixError] = useState<unknown>(null);
  const [matrixSuccessMsg, setMatrixSuccessMsg] = useState<string | null>(null);

  const [strictTopicBalance, setStrictTopicBalance] = useState(false);
  const [preventDuplicateTopic, setPreventDuplicateTopic] = useState(false);
  const [isDrawingRoot, setIsDrawingRoot] = useState(false);

  const [rootItems, setRootItems] = useState<RootItemDraft[]>([]);
  const [rootSaving, setRootSaving] = useState(false);
  const [rootError, setRootError] = useState<unknown>(null);
  const [rootSuccessMsg, setRootSuccessMsg] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Load chapters of exam.subject_id
  useEffect(() => {
    const controller = new AbortController();
    getChaptersBySubjectApi(exam.subject_id, controller.signal)
      .then((res) => {
        setChapters(res.data || []);
      })
      .catch(() => {
        setChapters([]);
      });
    return () => controller.abort();
  }, [exam.subject_id]);

  // Initialize matrix draft rows from sessionStorage or starter defaults
  useEffect(() => {
    const saved = readDraftSession<MatrixRowDraft[] | null>(
      makeMatrixDraftKey(exam.id),
      null
    );
    if (saved && saved.length > 0) {
      setMatrixRows(saved);
      return;
    }

    if (questionTypes.length > 0) {
      const defaultScorePerQ =
        Math.round((exam.total_score / Math.max(1, exam.total_questions)) * 100) /
        100;
      const starter: MatrixRowDraft[] = [
        {
          localId: createLocalId(),
          chapter_id: chapters[0]?.id || '',
          lesson_id: '',
          question_type_id: questionTypes[0].id,
          difficulty_level: 'MEDIUM',
          num_questions: String(exam.total_questions),
          score_per_question: String(defaultScorePerQ > 0 ? defaultScorePerQ : 1),
          max_questions_per_topic: '2',
        },
      ];
      setMatrixRows(starter);
    }
  }, [exam.id, exam.total_questions, exam.total_score, chapters, questionTypes]);

  // Sync root items when rootData arrives
  useEffect(() => {
    if (rootData?.items) {
      setRootItems(mapRootItemsToDraft(rootData.items));
    }
  }, [rootData]);

  // Preload lessons for selected chapters in matrixRows
  useEffect(() => {
    const missingChapterIds = Array.from(
      new Set(
        matrixRows
          .map((row) => row.chapter_id)
          .filter((cid) => Boolean(cid) && !lessonsByChapter[cid])
      )
    );
    if (missingChapterIds.length === 0) return;

    missingChapterIds.forEach((cid) => {
      getLessonsByChapterApi(cid)
        .then((res) => {
          setLessonsByChapter((prev) => ({ ...prev, [cid]: res.data || [] }));
        })
        .catch(() => {
          setLessonsByChapter((prev) => ({ ...prev, [cid]: [] }));
        });
    });
  }, [matrixRows, lessonsByChapter]);

  // Persist matrix draft + notify parent of configured type IDs
  useEffect(() => {
    if (matrixRows.length > 0) {
      writeDraftSession(makeMatrixDraftKey(exam.id), matrixRows);
    }
    const parsedForParent: ExamMatrixRowInput[] = matrixRows
      .filter((r) => Boolean(r.question_type_id))
      .map((r) => ({
        chapter_id: r.chapter_id,
        lesson_id: r.lesson_id || null,
        question_type_id: r.question_type_id,
        difficulty_level: r.difficulty_level,
        num_questions: Number.parseInt(r.num_questions, 10) || 0,
        score_per_question: Number.parseFloat(r.score_per_question) || 0,
        max_questions_per_topic: r.max_questions_per_topic.trim()
          ? Number.parseInt(r.max_questions_per_topic, 10)
          : null,
      }));
    onMatrixRowsChanged(parsedForParent);
  }, [exam.id, matrixRows, onMatrixRowsChanged]);

  const matrixTotals = matrixRows.reduce(
    (acc, row) => {
      const count = Number.parseInt(row.num_questions, 10);
      const score = Number.parseFloat(row.score_per_question);
      const validCount = Number.isFinite(count) && count > 0 ? count : 0;
      const validScore = Number.isFinite(score) && score > 0 ? score : 0;
      return {
        questions: acc.questions + validCount,
        score: acc.score + validCount * validScore,
      };
    },
    { questions: 0, score: 0 }
  );

  const matrixMatchesTarget =
    matrixTotals.questions === exam.total_questions &&
    Math.abs(matrixTotals.score - exam.total_score) < 0.01;

  const updateMatrixRow = (
    localId: string,
    patch: Partial<MatrixRowDraft>
  ) => {
    setMatrixRows((prev) =>
      prev.map((row) => (row.localId === localId ? { ...row, ...patch } : row))
    );
    setMatrixDirty(true);
    setMatrixSuccessMsg(null);
  };

  const handleAddMatrixRow = () => {
    const remainingQ = Math.max(1, exam.total_questions - matrixTotals.questions);
    const defaultScore =
      matrixRows[0]?.score_per_question ||
      String(
        Math.round((exam.total_score / Math.max(1, exam.total_questions)) * 100) /
          100 || 1
      );
    setMatrixRows((prev) => [
      ...prev,
      {
        localId: createLocalId(),
        chapter_id: chapters[0]?.id || '',
        lesson_id: '',
        question_type_id: questionTypes[0]?.id || '',
        difficulty_level: 'MEDIUM',
        num_questions: String(remainingQ),
        score_per_question: defaultScore,
        max_questions_per_topic: '2',
      },
    ]);
    setMatrixDirty(true);
    setMatrixSuccessMsg(null);
  };

  const handleRemoveMatrixRow = (localId: string) => {
    setMatrixRows((prev) => prev.filter((row) => row.localId !== localId));
    setMatrixDirty(true);
    setMatrixSuccessMsg(null);
  };

  const buildValidatedMatrixPayload = (): ExamMatrixRowInput[] | string => {
    if (matrixRows.length === 0) {
      return 'Ma trận cần có ít nhất 1 dòng cấu hình.';
    }

    const payload: ExamMatrixRowInput[] = [];
    for (let i = 0; i < matrixRows.length; i++) {
      const row = matrixRows[i];
      if (!row.question_type_id) {
        return `Dòng ${i + 1}: vui lòng chọn dạng câu hỏi.`;
      }
      if (row.lesson_id && !row.chapter_id) {
        return `Dòng ${i + 1}: phải chọn Chương trước khi chọn Bài học.`;
      }
      const numQ = Number.parseInt(row.num_questions, 10);
      if (!Number.isInteger(numQ) || numQ < 1) {
        return `Dòng ${i + 1}: số câu hỏi phải là số nguyên >= 1.`;
      }
      const scorePerQ = Number.parseFloat(row.score_per_question);
      if (!Number.isFinite(scorePerQ) || scorePerQ <= 0) {
        return `Dòng ${i + 1}: điểm mỗi câu phải lớn hơn 0.`;
      }
      let maxPerTopic: number | null = null;
      if (row.max_questions_per_topic.trim()) {
        const parsedMax = Number.parseInt(row.max_questions_per_topic, 10);
        if (!Number.isInteger(parsedMax) || parsedMax < 1) {
          return `Dòng ${i + 1}: giới hạn số câu/chủ đề phải là số nguyên >= 1 hoặc để trống.`;
        }
        maxPerTopic = parsedMax;
      }

      payload.push({
        chapter_id: row.chapter_id || null,
        lesson_id: row.lesson_id || null,
        question_type_id: row.question_type_id,
        difficulty_level: row.difficulty_level,
        num_questions: numQ,
        score_per_question: scorePerQ,
        max_questions_per_topic: maxPerTopic,
      });
    }

    return payload;
  };

  const handleSaveMatrix = async (): Promise<boolean> => {
    setMatrixError(null);
    setMatrixSuccessMsg(null);

    const payload = buildValidatedMatrixPayload();
    if (typeof payload === 'string') {
      setMatrixError(new Error(payload));
      return false;
    }

    setMatrixSaving(true);
    try {
      await replaceExamMatrixApi(exam.id, payload);
      setMatrixDirty(false);
      setMatrixSuccessMsg(
        'Đã lưu cấu hình ma trận đề thi. Bấm "Kiểm tra tính khả thi" để đối chiếu ngân hàng câu hỏi.'
      );
      return true;
    } catch (err) {
      setMatrixError(err);
      return false;
    } finally {
      setMatrixSaving(false);
    }
  };

  const handleValidateMatrix = async () => {
    setMatrixError(null);
    setMatrixSuccessMsg(null);

    if (isDraft && matrixDirty) {
      const savedOk = await handleSaveMatrix();
      if (!savedOk) return;
    }

    setMatrixValidating(true);
    try {
      const res = await validateExamMatrixApi(exam.id);
      setMatrixResult(res.data);
    } catch (err) {
      setMatrixError(err);
    } finally {
      setMatrixValidating(false);
    }
  };

  const handleDrawRootFromMatrix = async () => {
    setMatrixError(null);
    setMatrixSuccessMsg(null);
    setRootError(null);

    if (isDraft && matrixDirty) {
      const savedOk = await handleSaveMatrix();
      if (!savedOk) return;
    }

    setIsDrawingRoot(true);
    try {
      const res = await generateDraftRootFromMatrixApi(exam.id, {
        strict_topic_balance: strictTopicBalance,
        prevent_duplicate_topic: preventDuplicateTopic,
      });
      onRootDataUpdated(res.data);
      setRootSuccessMsg(
        `Đã rút ${res.data.items.length} câu hỏi vào Đề gốc (${res.data.variant_code || 'ROOT'}) để kiểm tra trước khi sinh mã đề.`
      );
    } catch (err) {
      setMatrixError(err);
    } finally {
      setIsDrawingRoot(false);
    }
  };

  // Root editor calculations & handlers
  const rootTotals = rootItems.reduce(
    (acc, item) => {
      const score = Number.parseFloat(item.score);
      return {
        count: acc.count + 1,
        score: acc.score + (Number.isFinite(score) && score > 0 ? score : 0),
      };
    },
    { count: 0, score: 0 }
  );

  const rootMatchesTarget =
    rootTotals.count === exam.total_questions &&
    Math.abs(rootTotals.score - exam.total_score) < 0.01;

  const handleAddPickedQuestions = (picked: QuestionRecord[]) => {
    const avgScore =
      Math.round((exam.total_score / Math.max(1, exam.total_questions)) * 100) /
      100;
    setRootItems((prev) => {
      const existing = new Set(prev.map((i) => i.question_id));
      const appended: RootItemDraft[] = picked
        .filter((q) => !existing.has(q.id))
        .map((q) => ({
          question_id: q.id,
          type_id: q.type_id,
          difficulty_level: q.difficulty_level,
          lesson_id: q.lesson_id,
          topic_tag: q.topic_tag,
          content: q.content,
          score: String(avgScore > 0 ? avgScore : 1),
        }));
      return [...prev, ...appended];
    });
    setRootSuccessMsg(null);
    setRootError(null);
  };

  const handleMoveRootItem = (index: number, direction: -1 | 1) => {
    const nextIdx = index + direction;
    if (nextIdx < 0 || nextIdx >= rootItems.length) return;
    setRootItems((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(nextIdx, 0, moved);
      return copy;
    });
  };

  const handleRemoveRootItem = (questionId: string) => {
    setRootItems((prev) => prev.filter((item) => item.question_id !== questionId));
  };

  const handleDistributeScoresEvenly = () => {
    if (rootItems.length === 0) return;
    const count = rootItems.length;
    const baseScore = Math.floor((exam.total_score / count) * 100) / 100;
    const remainder =
      Math.round((exam.total_score - baseScore * (count - 1)) * 100) / 100;

    setRootItems((prev) =>
      prev.map((item, idx) => ({
        ...item,
        score: String(idx === count - 1 ? remainder : baseScore),
      }))
    );
  };

  const handleSaveRootQuestions = async () => {
    setRootError(null);
    setRootSuccessMsg(null);

    if (rootItems.length !== exam.total_questions) {
      setRootError(
        new Error(
          `Đề gốc cần đúng ${exam.total_questions} câu hỏi (hiện đang có ${rootItems.length} câu).`
        )
      );
      return;
    }

    const itemsPayload = [];
    for (let i = 0; i < rootItems.length; i++) {
      const scoreNum = Number.parseFloat(rootItems[i].score);
      if (!Number.isFinite(scoreNum) || scoreNum <= 0) {
        setRootError(
          new Error(`Câu số ${i + 1}: điểm câu hỏi phải lớn hơn 0.`)
        );
        return;
      }
      itemsPayload.push({
        question_id: rootItems[i].question_id,
        score: Math.round(scoreNum * 100) / 100,
      });
    }

    if (Math.abs(rootTotals.score - exam.total_score) > 0.01) {
      setRootError(
        new Error(
          `Tổng điểm đề gốc (${formatScore(rootTotals.score)}) phải bằng tổng điểm kỳ thi (${formatScore(exam.total_score)}). Có thể bấm "Chia đều điểm".`
        )
      );
      return;
    }

    setRootSaving(true);
    try {
      const res = await replaceRootQuestionsApi(exam.id, {
        items: itemsPayload,
        variant_code: 'ROOT',
      });
      onRootDataUpdated(res.data);
      setRootSuccessMsg(
        `Đã lưu Đề gốc cố định (${res.data.items.length} câu, ${formatScore(res.data.total_score)} điểm). Sẵn sàng trộn mã đề theo luồng Đề gốc.`
      );
    } catch (err) {
      setRootError(err);
    } finally {
      setRootSaving(false);
    }
  };

  const typeLabelMap = new Map(
    questionTypes.map((qt) => [qt.id, KIND_LABELS[qt.code] || qt.name])
  );
  const existingQuestionIds = new Set(rootItems.map((item) => item.question_id));

  return (
    <div className="space-y-6">
      {/* SECTION A: MATRIX */}
      <Card className="border-surface-border bg-surface-card shadow-sm">
        <CardHeader className="border-b border-surface-border pb-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Layers aria-hidden="true" className="size-4 text-brand-600" />
                <span>Cấu hình ma trận đề thi</span>
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Phân bổ số câu hỏi theo chương, bài học, dạng câu và độ khó. Phiên trình duyệt tự giữ bản nháp khi chưa sinh đề.
              </CardDescription>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium tabular-nums ${
                matrixMatchesTarget
                  ? 'border-semantic-success/30 bg-semantic-success-bg text-semantic-success'
                  : 'border-semantic-warning/35 bg-semantic-warning-bg text-semantic-warning'
              }`}
            >
              <span>
                Số câu: <strong>{matrixTotals.questions}</strong> /{' '}
                {exam.total_questions}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Tổng điểm: <strong>{formatScore(matrixTotals.score)}</strong> /{' '}
                {formatScore(exam.total_score)}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4 sm:p-5">
          {matrixError ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-semantic-danger/30 bg-semantic-danger-bg px-3.5 py-2.5 text-xs text-semantic-danger"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium leading-relaxed">
                  {matrixError instanceof ApiError
                    ? matrixError.message
                    : matrixError instanceof Error
                    ? matrixError.message
                    : 'Không thể xử lý ma trận đề thi.'}
                </p>
                {matrixError instanceof ApiError ? (
                  <TechnicalDetails
                    code={matrixError.code}
                    traceId={matrixError.traceId}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {matrixSuccessMsg ? (
            <div
              role="status"
              className="flex items-center gap-2 rounded-lg border border-semantic-success/30 bg-semantic-success-bg px-3.5 py-2.5 text-xs font-medium text-semantic-success"
            >
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
              <span>{matrixSuccessMsg}</span>
            </div>
          ) : null}

          {/* Matrix Table */}
          <div className="overflow-x-auto rounded-lg border border-surface-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-surface-border bg-surface-muted/50 text-[11px] font-semibold text-text-secondary">
                <tr>
                  <th scope="col" className="w-10 px-2.5 py-2.5">
                    #
                  </th>
                  <th scope="col" className="min-w-[160px] px-2.5 py-2.5">
                    Chương
                  </th>
                  <th scope="col" className="min-w-[150px] px-2.5 py-2.5">
                    Bài học (tùy chọn)
                  </th>
                  <th scope="col" className="min-w-[160px] px-2.5 py-2.5">
                    Dạng câu hỏi
                  </th>
                  <th scope="col" className="min-w-[120px] px-2.5 py-2.5">
                    Độ khó
                  </th>
                  <th scope="col" className="w-24 px-2.5 py-2.5">
                    Số câu
                  </th>
                  <th scope="col" className="w-24 px-2.5 py-2.5">
                    Điểm/câu
                  </th>
                  <th scope="col" className="w-28 px-2.5 py-2.5">
                    Tối đa/chủ đề
                  </th>
                  <th scope="col" className="w-12 px-2.5 py-2.5 text-right">
                    Xóa
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {matrixRows.map((row, idx) => {
                  const lessons = row.chapter_id
                    ? lessonsByChapter[row.chapter_id] || []
                    : [];
                  return (
                    <tr key={row.localId}>
                      <td className="px-2.5 py-2 font-mono text-[11px] text-text-secondary tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-2.5 py-2">
                        <Select
                          value={row.chapter_id || 'ALL'}
                          disabled={!isDraft}
                          onValueChange={(val) =>
                            updateMatrixRow(row.localId, {
                              chapter_id: val === 'ALL' ? '' : val,
                              lesson_id: '',
                            })
                          }
                        >
                          <SelectTrigger
                            aria-label={`Chương dòng ${idx + 1}`}
                            className="h-8 bg-surface-card text-xs"
                          >
                            <SelectValue placeholder="Chọn chương" />
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
                      </td>
                      <td className="px-2.5 py-2">
                        <Select
                          value={row.lesson_id || 'ALL'}
                          disabled={!isDraft || !row.chapter_id}
                          onValueChange={(val) =>
                            updateMatrixRow(row.localId, {
                              lesson_id: val === 'ALL' ? '' : val,
                            })
                          }
                        >
                          <SelectTrigger
                            aria-label={`Bài học dòng ${idx + 1}`}
                            className="h-8 bg-surface-card text-xs"
                          >
                            <SelectValue placeholder="Tất cả bài" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">Tất cả bài học</SelectItem>
                            {lessons.map((lesson) => (
                              <SelectItem key={lesson.id} value={lesson.id}>
                                {lesson.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2.5 py-2">
                        <Select
                          value={row.question_type_id}
                          disabled={!isDraft}
                          onValueChange={(val) =>
                            updateMatrixRow(row.localId, {
                              question_type_id: val,
                            })
                          }
                        >
                          <SelectTrigger
                            aria-label={`Dạng câu dòng ${idx + 1}`}
                            className="h-8 bg-surface-card text-xs"
                          >
                            <SelectValue placeholder="Chọn dạng câu" />
                          </SelectTrigger>
                          <SelectContent>
                            {questionTypes.map((qt) => (
                              <SelectItem key={qt.id} value={qt.id}>
                                {KIND_LABELS[qt.code] || qt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2.5 py-2">
                        <Select
                          value={row.difficulty_level}
                          disabled={!isDraft}
                          onValueChange={(val) =>
                            updateMatrixRow(row.localId, {
                              difficulty_level: val as QuestionDifficulty,
                            })
                          }
                        >
                          <SelectTrigger
                            aria-label={`Độ khó dòng ${idx + 1}`}
                            className="h-8 bg-surface-card text-xs"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              Object.keys(
                                DIFFICULTY_LABELS
                              ) as QuestionDifficulty[]
                            ).map((lvl) => (
                              <SelectItem key={lvl} value={lvl}>
                                {DIFFICULTY_LABELS[lvl]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2.5 py-2">
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          disabled={!isDraft}
                          aria-label={`Số câu dòng ${idx + 1}`}
                          value={row.num_questions}
                          onChange={(e) =>
                            updateMatrixRow(row.localId, {
                              num_questions: e.target.value,
                            })
                          }
                          className="h-8 bg-surface-card text-xs tabular-nums"
                        />
                      </td>
                      <td className="px-2.5 py-2">
                        <Input
                          type="number"
                          min={0.1}
                          step="any"
                          disabled={!isDraft}
                          aria-label={`Điểm mỗi câu dòng ${idx + 1}`}
                          value={row.score_per_question}
                          onChange={(e) =>
                            updateMatrixRow(row.localId, {
                              score_per_question: e.target.value,
                            })
                          }
                          className="h-8 bg-surface-card text-xs tabular-nums"
                        />
                      </td>
                      <td className="px-2.5 py-2">
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          placeholder="Không GH"
                          disabled={!isDraft}
                          aria-label={`Giới hạn chủ đề dòng ${idx + 1}`}
                          value={row.max_questions_per_topic}
                          onChange={(e) =>
                            updateMatrixRow(row.localId, {
                              max_questions_per_topic: e.target.value,
                            })
                          }
                          className="h-8 bg-surface-card text-xs tabular-nums"
                        />
                      </td>
                      <td className="px-2.5 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!isDraft || matrixRows.length <= 1}
                          onClick={() => handleRemoveMatrixRow(row.localId)}
                          aria-label={`Xóa dòng ma trận ${idx + 1}`}
                          className="h-7 w-7 p-0 text-text-secondary hover:text-semantic-danger"
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Matrix Action Toolbar */}
          <div className="flex flex-col justify-between gap-3 pt-1 lg:flex-row lg:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isDraft}
                onClick={handleAddMatrixRow}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                <span>Thêm dòng</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isDraft || matrixSaving}
                onClick={handleSaveMatrix}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {matrixSaving ? (
                  <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                ) : (
                  <Save aria-hidden="true" className="size-3.5" />
                )}
                <span>Lưu ma trận</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={matrixValidating || matrixSaving}
                onClick={handleValidateMatrix}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {matrixValidating ? (
                  <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                ) : (
                  <ClipboardCheck aria-hidden="true" className="size-3.5" />
                )}
                <span>Kiểm tra tính khả thi</span>
              </Button>
            </div>

            {isDraft ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-border bg-surface-muted/35 px-3 py-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-text-primary">
                  <Checkbox
                    checked={strictTopicBalance}
                    onCheckedChange={(v) => setStrictTopicBalance(Boolean(v))}
                  />
                  <span>Cân bằng chủ đề</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-text-primary">
                  <Checkbox
                    checked={preventDuplicateTopic}
                    onCheckedChange={(v) => setPreventDuplicateTopic(Boolean(v))}
                  />
                  <span>Chống trùng chủ đề</span>
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={isDrawingRoot || matrixSaving}
                  onClick={handleDrawRootFromMatrix}
                  className="h-8 gap-1.5 text-xs font-semibold"
                >
                  {isDrawingRoot ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-3.5 animate-spin"
                    />
                  ) : (
                    <Sparkles aria-hidden="true" className="size-3.5" />
                  )}
                  <span>Rút đề gốc từ ma trận</span>
                </Button>
              </div>
            ) : null}
          </div>

          {/* Matrix Feasibility Report */}
          {matrixResult ? (
            <div
              role="status"
              className={`rounded-lg border p-3.5 text-xs ${
                matrixResult.valid
                  ? 'border-semantic-success/30 bg-semantic-success-bg'
                  : 'border-semantic-warning/35 bg-semantic-warning-bg'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  className={`font-semibold ${
                    matrixResult.valid
                      ? 'text-semantic-success'
                      : 'text-semantic-warning'
                  }`}
                >
                  {matrixResult.valid
                    ? 'Ma trận hợp lệ và đủ nguồn câu hỏi trong ngân hàng.'
                    : 'Ma trận chưa đạt điều kiện khả thi — cần điều chỉnh trước khi sinh đề:'}
                </p>
                <span className="font-mono text-[11px] tabular-nums text-text-secondary">
                  Câu: {matrixResult.matrix_questions}/{matrixResult.expected_questions} · Điểm:{' '}
                  {formatScore(matrixResult.matrix_score)}/
                  {formatScore(matrixResult.expected_score)}
                </span>
              </div>
              {matrixResult.issues && matrixResult.issues.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-text-primary">
                  {matrixResult.issues.map((issue, idx) => (
                    <li key={idx}>
                      {typeof issue.row_index === 'number'
                        ? `Dòng ${issue.row_index + 1}: `
                        : ''}
                      {issue.message}
                      {typeof issue.requested === 'number' &&
                      typeof issue.available === 'number'
                        ? ` (Cần ${issue.requested}, hiện có ${issue.available})`
                        : ''}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* SECTION B: FIXED ROOT QUESTIONS */}
      <Card className="border-surface-border bg-surface-card shadow-sm">
        <CardHeader className="border-b border-surface-border pb-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <FilePlus2 aria-hidden="true" className="size-4 text-brand-600" />
                <span>Đề gốc cố định (ROOT)</span>
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Danh sách câu hỏi chuẩn dùng để trộn thành nhiều mã đề (luồng Từ đề gốc) hoặc kiểm duyệt đề rút từ ma trận.
              </CardDescription>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium tabular-nums ${
                rootMatchesTarget
                  ? 'border-semantic-success/30 bg-semantic-success-bg text-semantic-success'
                  : 'border-surface-border bg-surface-muted text-text-secondary'
              }`}
            >
              <span>
                Câu hỏi: <strong>{rootTotals.count}</strong> /{' '}
                {exam.total_questions}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Tổng điểm: <strong>{formatScore(rootTotals.score)}</strong> /{' '}
                {formatScore(exam.total_score)}
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4 sm:p-5">
          {rootError ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-semantic-danger/30 bg-semantic-danger-bg px-3.5 py-2.5 text-xs text-semantic-danger"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium leading-relaxed">
                  {rootError instanceof ApiError
                    ? rootError.message
                    : rootError instanceof Error
                    ? rootError.message
                    : 'Không thể lưu đề gốc.'}
                </p>
                {rootError instanceof ApiError ? (
                  <TechnicalDetails
                    code={rootError.code}
                    traceId={rootError.traceId}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {rootSuccessMsg ? (
            <div
              role="status"
              className="flex items-center gap-2 rounded-lg border border-semantic-success/30 bg-semantic-success-bg px-3.5 py-2.5 text-xs font-medium text-semantic-success"
            >
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
              <span>{rootSuccessMsg}</span>
            </div>
          ) : null}

          {isDraft ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPickerOpen(true)}
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                  <span>Chọn câu hỏi từ ngân hàng</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={rootItems.length === 0}
                  onClick={handleDistributeScoresEvenly}
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  <Divide aria-hidden="true" className="size-3.5" />
                  <span>Chia đều điểm ({formatScore(exam.total_score)})</span>
                </Button>
              </div>

              <Button
                type="button"
                size="sm"
                disabled={rootSaving || rootItems.length === 0}
                onClick={handleSaveRootQuestions}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                {rootSaving ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                  />
                ) : (
                  <Save aria-hidden="true" className="size-3.5" />
                )}
                <span>Lưu đề gốc</span>
              </Button>
            </div>
          ) : null}

          {rootItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-surface-border bg-surface-muted/20 px-4 py-10 text-center text-xs text-text-secondary">
              Chưa có câu hỏi nào trong đề gốc. Bấm{' '}
              <strong className="text-text-primary">
                &quot;Rút đề gốc từ ma trận&quot;
              </strong>{' '}
              ở trên hoặc{' '}
              <strong className="text-text-primary">
                &quot;Chọn câu hỏi từ ngân hàng&quot;
              </strong>{' '}
              để biên soạn đề gốc thủ công.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-surface-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-surface-border bg-surface-muted/50 text-[11px] font-semibold text-text-secondary">
                  <tr>
                    <th scope="col" className="w-12 px-3 py-2.5">
                      STT
                    </th>
                    <th scope="col" className="min-w-[260px] px-3 py-2.5">
                      Nội dung câu hỏi
                    </th>
                    <th scope="col" className="w-40 px-3 py-2.5">
                      Dạng / Độ khó
                    </th>
                    <th scope="col" className="w-28 px-3 py-2.5">
                      Điểm câu
                    </th>
                    {isDraft ? (
                      <th scope="col" className="w-28 px-3 py-2.5 text-right">
                        Sắp xếp
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {rootItems.map((item, idx) => (
                    <tr key={item.question_id}>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-text-secondary tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="line-clamp-2 text-xs leading-relaxed text-text-primary">
                          {item.content}
                        </p>
                        {item.topic_tag ? (
                          <span className="mt-1 inline-block rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
                            #{item.topic_tag}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {typeLabelMap.get(item.type_id) || 'Dạng câu'}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {DIFFICULTY_LABELS[item.difficulty_level] ||
                              item.difficulty_level}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          type="number"
                          min={0.1}
                          step="any"
                          disabled={!isDraft}
                          aria-label={`Điểm câu ${idx + 1}`}
                          value={item.score}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRootItems((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, score: val } : row
                              )
                            );
                          }}
                          className="h-8 bg-surface-card text-xs tabular-nums"
                        />
                      </td>
                      {isDraft ? (
                        <td className="px-3 py-2.5 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={idx === 0}
                              onClick={() => handleMoveRootItem(idx, -1)}
                              aria-label={`Đưa câu ${idx + 1} lên trên`}
                              className="h-7 w-7 p-0"
                            >
                              <ArrowUp aria-hidden="true" className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={idx === rootItems.length - 1}
                              onClick={() => handleMoveRootItem(idx, 1)}
                              aria-label={`Đưa câu ${idx + 1} xuống dưới`}
                              className="h-7 w-7 p-0"
                            >
                              <ArrowDown
                                aria-hidden="true"
                                className="size-3.5"
                              />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRemoveRootItem(item.question_id)
                              }
                              aria-label={`Bỏ câu ${idx + 1} khỏi đề gốc`}
                              className="h-7 w-7 p-0 text-text-secondary hover:text-semantic-danger"
                            >
                              <Trash2 aria-hidden="true" className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <RootQuestionPickerModal
        isOpen={isPickerOpen}
        subjectId={exam.subject_id}
        chapters={chapters}
        questionTypes={questionTypes}
        existingQuestionIds={existingQuestionIds}
        onClose={() => setIsPickerOpen(false)}
        onConfirmAdd={handleAddPickedQuestions}
      />
    </div>
  );
}
