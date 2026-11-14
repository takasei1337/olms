import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Ban,
  CheckCircle2,
  FileEdit,
  Globe,
  Lock,
  PlayCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError } from '../../../api/client';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { useAuth } from '../../auth/AuthContext';
import { getSubjectsApi } from '../../catalog/catalog.api';
import type { Subject } from '../../catalog/types';
import { getQuestionTypesApi } from '../../questions/questions.api';
import type { QuestionType } from '../../questions/types';
import { ExamFormModal } from '../components/ExamFormModal';
import { ExamGenerateTab } from '../components/ExamGenerateTab';
import {
  ExamLifecycleModal,
  type ExamLifecycleActionType,
} from '../components/ExamLifecycleModal';
import { ExamMatrixAndRootTab } from '../components/ExamMatrixAndRootTab';
import { ExamParticipantsTab } from '../components/ExamParticipantsTab';
import {
  DeliveryModeBadge,
  ExamStatusBadge,
} from '../components/ExamStatusBadge';
import {
  getExamByIdApi,
  getExamVariantsApi,
  getRootQuestionsApi,
} from '../exams.api';
import {
  CANCELLABLE_EXAM_STATUSES,
  VISIBILITY_MODE_LABELS,
  type ExamMatrixRowInput,
  type ExamRecord,
  type ExamVariantSummary,
  type RootQuestionsResponse,
} from '../types';
import { formatExamDateTime, formatScore } from '../utils';

type DetailTabValue = 'matrix' | 'generate' | 'participants';

function normalizeTabParam(raw: string | null): DetailTabValue {
  if (raw === 'generate' || raw === 'participants' || raw === 'matrix') {
    return raw;
  }
  return 'matrix';
}

export function ExamDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();

  const activeTab = normalizeTabParam(searchParams.get('tab'));

  const [exam, setExam] = useState<ExamRecord | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([]);
  const [rootData, setRootData] = useState<RootQuestionsResponse | null>(null);
  const [variants, setVariants] = useState<ExamVariantSummary[]>([]);
  const [matrixRowsSnapshot, setMatrixRowsSnapshot] = useState<
    ExamMatrixRowInput[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] =
    useState<ExamLifecycleActionType | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const loadExamWorkspace = useCallback(
    async (signal?: AbortSignal, options?: { silent?: boolean }) => {
      if (!examId) return;
      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setLoadError(null);

      try {
        const [examRes, typesRes, rootRes, variantsRes, subjectsRes] =
          await Promise.all([
            getExamByIdApi(examId, signal),
            getQuestionTypesApi(signal),
            getRootQuestionsApi(examId, signal),
            getExamVariantsApi(examId, signal),
            getSubjectsApi({ page: 1, page_size: 100 }, signal),
          ]);

        setExam(examRes.data);
        setQuestionTypes(typesRes.data || []);
        setRootData(rootRes.data || null);
        setVariants(variantsRes.data || []);
        setSubjects(subjectsRes.data || []);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setLoadError(err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [examId]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadExamWorkspace(controller.signal);
    return () => controller.abort();
  }, [loadExamWorkspace]);

  const handleTabChange = (nextTab: string) => {
    const normalized = normalizeTabParam(nextTab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (normalized === 'matrix') {
          next.delete('tab');
        } else {
          next.set('tab', normalized);
        }
        return next;
      },
      { replace: true }
    );
  };

  const handleLifecycleSuccess = (
    action: ExamLifecycleActionType,
    updatedExam?: ExamRecord
  ) => {
    if (action === 'delete') {
      navigate('/exams', { replace: true });
      return;
    }

    if (updatedExam) {
      setExam(updatedExam);
    } else {
      loadExamWorkspace(undefined, { silent: true });
    }

    const msgMap: Record<Exclude<ExamLifecycleActionType, 'delete'>, string> = {
      publish: 'Đã phát hành kỳ thi thành công.',
      start: 'Kỳ thi đã chuyển sang trạng thái Đang diễn ra.',
      archive: 'Đã lưu trữ kỳ thi.',
      cancel: 'Kỳ thi đã được hủy.',
    };
    setFeedbackBanner(msgMap[action]);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-10 w-80 rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    );
  }

  if (loadError || !exam) {
    return (
      <div className="space-y-4">
        <Link
          to="/exams"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          <span>Quay lại danh sách kỳ thi</span>
        </Link>

        <Card className="border-semantic-danger/30 bg-semantic-danger-bg shadow-sm">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-start gap-2.5 text-semantic-danger">
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <h1 className="text-sm font-semibold">
                  Không thể mở thông tin kỳ thi
                </h1>
                <p className="text-xs text-text-secondary">
                  {loadError instanceof ApiError
                    ? loadError.message
                    : 'Kỳ thi không tồn tại hoặc bạn không có quyền truy cập.'}
                </p>
                {loadError instanceof ApiError ? (
                  <TechnicalDetails
                    code={loadError.code}
                    traceId={loadError.traceId}
                  />
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/exams')}
                className="h-8 text-xs"
              >
                Về danh sách kỳ thi
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadExamWorkspace()}
                className="h-8 text-xs"
              >
                Thử lại
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canManage =
    currentUser?.role === 'ADMIN' || exam.created_by === currentUser?.id;
  const isDraft = exam.status === 'DRAFT';
  const canPublish = canManage && exam.status === 'GENERATED';
  const canStart = canManage && exam.status === 'PUBLISHED';
  const canArchive = canManage && exam.status === 'RESULT_PUBLISHED';
  const canCancel =
    canManage && CANCELLABLE_EXAM_STATUSES.includes(exam.status);

  return (
    <div className="space-y-5">
      {/* Breadcrumb Back Navigation */}
      <div>
        <Link
          to="/exams"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          <span>Quay lại danh sách kỳ thi</span>
        </Link>
      </div>

      {/* Header Workspace Card */}
      <Card className="border-surface-border bg-surface-card shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-balance text-text-primary sm:text-2xl">
                  {exam.name}
                </h1>
                <ExamStatusBadge status={exam.status} />
                <DeliveryModeBadge mode={exam.delivery_mode} />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary tabular-nums">
                <span>
                  Mã kỳ thi:{' '}
                  <strong className="font-mono text-text-primary">
                    {exam.code}
                  </strong>
                </span>
                {exam.subjects ? (
                  <span>
                    Môn học:{' '}
                    <strong className="text-text-primary">
                      {exam.subjects.code} — {exam.subjects.name}
                    </strong>
                  </span>
                ) : null}
                <span>
                  Cấu trúc:{' '}
                  <strong className="text-text-primary">
                    {exam.total_questions} câu · {formatScore(exam.total_score)} điểm ·{' '}
                    {exam.duration_minutes} phút
                  </strong>
                </span>
              </div>
            </div>

            {/* Header Contextual Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRefreshing}
                onClick={() => loadExamWorkspace(undefined, { silent: true })}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={isRefreshing ? 'size-3.5 animate-spin' : 'size-3.5'}
                />
                <span>Tải lại</span>
              </Button>

              {canManage && isDraft ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditOpen(true)}
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  <FileEdit aria-hidden="true" className="size-3.5" />
                  <span>Sửa thông tin</span>
                </Button>
              ) : null}

              {canPublish ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setLifecycleAction('publish')}
                  className="h-8 gap-1.5 text-xs font-semibold"
                >
                  <Globe aria-hidden="true" className="size-3.5" />
                  <span>Phát hành kỳ thi</span>
                </Button>
              ) : null}

              {canStart ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setLifecycleAction('start')}
                  className="h-8 gap-1.5 text-xs font-semibold"
                >
                  <PlayCircle aria-hidden="true" className="size-3.5" />
                  <span>Bắt đầu kỳ thi</span>
                </Button>
              ) : null}

              {canArchive ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLifecycleAction('archive')}
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  <Archive aria-hidden="true" className="size-3.5" />
                  <span>Lưu trữ</span>
                </Button>
              ) : null}

              {canCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLifecycleAction('cancel')}
                  className="h-8 gap-1.5 text-xs font-medium text-semantic-danger hover:bg-semantic-danger-bg hover:text-semantic-danger"
                >
                  <Ban aria-hidden="true" className="size-3.5" />
                  <span>Hủy kỳ thi</span>
                </Button>
              ) : null}

              {canManage && isDraft ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLifecycleAction('delete')}
                  className="h-8 gap-1.5 text-xs font-medium text-semantic-danger hover:bg-semantic-danger-bg hover:text-semantic-danger"
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  <span>Xóa nháp</span>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 border-t border-surface-border pt-3 text-xs text-text-secondary sm:grid-cols-3">
            <div className="tabular-nums">
              Mở đề:{' '}
              <span className="font-medium text-text-primary">
                {formatExamDateTime(exam.opens_at)}
              </span>
            </div>
            <div className="tabular-nums">
              Đóng đề:{' '}
              <span className="font-medium text-text-primary">
                {formatExamDateTime(exam.closes_at)}
              </span>
            </div>
            <div>
              Hiển thị kết quả:{' '}
              <span className="font-medium text-text-primary">
                {VISIBILITY_MODE_LABELS[exam.result_visibility_mode] ||
                  exam.result_visibility_mode}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {feedbackBanner ? (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-lg border border-semantic-success/30 bg-semantic-success-bg px-4 py-2.5 text-xs font-medium text-semantic-success"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-[11px] font-semibold underline hover:opacity-80"
          >
            Đóng
          </button>
        </div>
      ) : null}

      {!isDraft ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-surface-border bg-surface-muted/40 px-4 py-3 text-xs text-text-secondary"
        >
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Kỳ thi không còn ở trạng thái Bản nháp nên cấu hình thông tin chung, ma trận đề, đề gốc và quy tắc chấm điểm đã bị khóa sửa để đảm bảo tính nhất quán dữ liệu thi.
          </span>
        </div>
      ) : null}

      {/* Main Workspace Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-4"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-surface-muted p-1 sm:w-fit">
          <TabsTrigger value="matrix" className="text-xs font-medium">
            1. Ma trận &amp; Đề gốc
          </TabsTrigger>
          <TabsTrigger value="generate" className="gap-1.5 text-xs font-medium">
            <span>2. Quy tắc &amp; Sinh mã đề</span>
            {variants.length > 0 ? (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {variants.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="participants" className="text-xs font-medium">
            3. Danh sách thí sinh
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix">
          <ExamMatrixAndRootTab
            exam={exam}
            isDraft={isDraft}
            questionTypes={questionTypes}
            rootData={rootData}
            onRootDataUpdated={(nextRoot) => setRootData(nextRoot)}
            onMatrixRowsChanged={setMatrixRowsSnapshot}
          />
        </TabsContent>

        <TabsContent value="generate">
          <ExamGenerateTab
            exam={exam}
            isDraft={isDraft}
            questionTypes={questionTypes}
            matrixRows={matrixRowsSnapshot}
            rootData={rootData}
            variants={variants}
            onGeneratedSuccess={async () => {
              await loadExamWorkspace(undefined, { silent: true });
            }}
          />
        </TabsContent>

        <TabsContent value="participants">
          <ExamParticipantsTab exam={exam} />
        </TabsContent>
      </Tabs>

      <ExamFormModal
        isOpen={isEditOpen}
        exam={exam}
        subjects={subjects}
        onClose={() => setIsEditOpen(false)}
        onSuccess={(savedExam) => {
          setExam(savedExam);
          setFeedbackBanner('Đã cập nhật thông tin kỳ thi.');
        }}
      />

      <ExamLifecycleModal
        action={lifecycleAction}
        exam={exam}
        onClose={() => setLifecycleAction(null)}
        onSuccess={handleLifecycleSuccess}
      />
    </div>
  );
}
