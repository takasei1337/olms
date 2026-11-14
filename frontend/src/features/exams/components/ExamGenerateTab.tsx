import { useEffect, useId, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileCheck2,
  Layers,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
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
import { AccessibleModal } from '../../../components/ui/AccessibleModal';
import { TechnicalDetails } from '../../../components/ui/TechnicalDetails';
import { QuestionPreview } from '../../questions/components/preview/QuestionPreview';
import {
  KIND_LABELS,
  type QuestionKind,
  type QuestionType,
} from '../../questions/types';
import {
  generateExamVariantsApi,
  previewExamVariantsApi,
  replaceGradingRulesApi,
} from '../exams.api';
import {
  GENERATION_MODE_LABELS,
  ROUNDING_RULE_LABELS,
  SCORING_MODE_LABELS,
  type ExamGenerationMode,
  type ExamMatrixRowInput,
  type ExamRecord,
  type ExamVariantSummary,
  type GeneratePreviewQuestion,
  type GeneratePreviewResponse,
  type GradingRoundingRule,
  type GradingRuleInput,
  type GradingScoringMode,
  type RootQuestionsResponse,
} from '../types';
import { readDraftSession, writeDraftSession } from '../utils';

interface RuleRowDraft {
  question_type_id: string;
  enabled: boolean;
  scoring_mode: GradingScoringMode;
  penalty_for_wrong: boolean;
  case_sensitive: boolean;
  rounding_precision: number;
  rounding_rule: GradingRoundingRule;
}

interface ExamGenerateTabProps {
  exam: ExamRecord;
  isDraft: boolean;
  questionTypes: QuestionType[];
  matrixRows: ExamMatrixRowInput[];
  rootData: RootQuestionsResponse | null;
  variants: ExamVariantSummary[];
  onGeneratedSuccess: (nextStatusExamId: string) => Promise<void>;
}

function makeRulesDraftKey(examId: string): string {
  return `olms_exam_rules_${examId}`;
}

function buildDefaultRuleRows(types: QuestionType[]): RuleRowDraft[] {
  return types.map((qt) => ({
    question_type_id: qt.id,
    enabled: true,
    scoring_mode: 'EXACT_MATCH',
    penalty_for_wrong: true,
    case_sensitive: false,
    rounding_precision: 2,
    rounding_rule: 'ROUND_HALF_UP',
  }));
}

function computeVariantCodeRangePreview(
  startCode: string,
  countRaw: string
): string | null {
  const trimmed = startCode.trim();
  const count = Number.parseInt(countRaw, 10);
  if (!/^\d{3,10}$/.test(trimmed) || !Number.isInteger(count) || count < 1) {
    return null;
  }

  try {
    const startBig = BigInt(trimmed);
    const endBig = startBig + BigInt(count) - 1n;
    if (endBig > 9999999999n) return null;
    const width = trimmed.length;
    const firstStr = startBig.toString().padStart(width, '0');
    const lastStr = endBig.toString().padStart(width, '0');
    return count === 1 ? firstStr : `${firstStr} → ${lastStr}`;
  } catch {
    return null;
  }
}

export function ExamGenerateTab({
  exam,
  isDraft,
  questionTypes,
  matrixRows,
  rootData,
  variants,
  onGeneratedSuccess,
}: ExamGenerateTabProps) {
  const genIdPrefix = useId();

  // Grading rules state
  const [rules, setRules] = useState<RuleRowDraft[]>([]);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesError, setRulesError] = useState<unknown>(null);
  const [rulesSuccessMsg, setRulesSuccessMsg] = useState<string | null>(null);

  // Generation parameters state
  const [generationMode, setGenerationMode] = useState<ExamGenerationMode>(
    rootData?.has_root_variant ? 'FROM_ROOT' : 'FROM_MATRIX'
  );
  const [variantCount, setVariantCount] = useState('2');
  const [variantCodeStart, setVariantCodeStart] = useState('101');
  const [similarityThreshold, setSimilarityThreshold] = useState('0.75');
  const [strictTopicBalance, setStrictTopicBalance] = useState(false);
  const [preventDuplicateTopic, setPreventDuplicateTopic] = useState(false);

  // 2-step preview -> confirm state
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewData, setPreviewData] =
    useState<GeneratePreviewResponse | null>(null);
  const [genError, setGenError] = useState<unknown>(null);
  const [genSuccessMsg, setGenSuccessMsg] = useState<string | null>(null);
  const [previewQuestionModal, setPreviewQuestionModal] =
    useState<GeneratePreviewQuestion | null>(null);

  // Active question type IDs referenced by matrix or root
  const activeTypeIds = useMemo(() => {
    const ids = new Set<string>();
    matrixRows.forEach((row) => {
      if (row.question_type_id) ids.add(row.question_type_id);
    });
    rootData?.items?.forEach((item) => {
      if (item.type_id) ids.add(item.type_id);
    });
    return ids;
  }, [matrixRows, rootData]);

  // Initialize grading rules from sessionStorage or defaults
  useEffect(() => {
    if (questionTypes.length === 0) return;

    const saved = readDraftSession<RuleRowDraft[] | null>(
      makeRulesDraftKey(exam.id),
      null
    );
    if (saved && saved.length === questionTypes.length) {
      setRules(saved);
      return;
    }

    setRules(buildDefaultRuleRows(questionTypes));
  }, [exam.id, questionTypes]);

  useEffect(() => {
    if (rules.length > 0) {
      writeDraftSession(makeRulesDraftKey(exam.id), rules);
    }
  }, [exam.id, rules]);

  const updateRuleRow = (
    questionTypeId: string,
    patch: Partial<RuleRowDraft>
  ) => {
    setRules((prev) =>
      prev.map((row) =>
        row.question_type_id === questionTypeId ? { ...row, ...patch } : row
      )
    );
    setRulesSuccessMsg(null);
  };

  const handleResetDefaultRules = () => {
    setRules(buildDefaultRuleRows(questionTypes));
    setRulesError(null);
    setRulesSuccessMsg(
      'Đã khôi phục quy tắc mặc định. Bấm "Lưu quy tắc chấm điểm" để áp dụng lên hệ thống.'
    );
  };

  const handleSaveGradingRules = async () => {
    setRulesError(null);
    setRulesSuccessMsg(null);

    const enabledRules = rules.filter((r) => r.enabled);
    if (enabledRules.length === 0) {
      setRulesError(
        new Error('Vui lòng chọn ít nhất một dạng câu hỏi để lưu quy tắc chấm.')
      );
      return;
    }

    const payload: GradingRuleInput[] = enabledRules.map((r) => ({
      question_type_id: r.question_type_id,
      scoring_mode: r.scoring_mode,
      penalty_for_wrong: r.penalty_for_wrong,
      case_sensitive: r.case_sensitive,
      rounding_precision: r.rounding_precision,
      rounding_rule: r.rounding_rule,
      allow_negative_marking: false,
    }));

    setRulesSaving(true);
    try {
      await replaceGradingRulesApi(exam.id, payload);
      setRulesSuccessMsg(
        `Đã lưu quy tắc chấm điểm cho ${payload.length} dạng câu hỏi.`
      );
    } catch (err) {
      setRulesError(err);
    } finally {
      setRulesSaving(false);
    }
  };

  const validateGenerateParams = (): string | null => {
    const count = Number.parseInt(variantCount, 10);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      return 'Số lượng mã đề phải là số nguyên từ 1 đến 100.';
    }

    const trimmedStart = variantCodeStart.trim();
    if (!/^\d{3,10}$/.test(trimmedStart)) {
      return 'Mã đề bắt đầu phải gồm 3 đến 10 chữ số (ví dụ: 101).';
    }

    if (!computeVariantCodeRangePreview(trimmedStart, variantCount)) {
      return 'Dải mã đề sinh ra vượt quá giới hạn 10 chữ số.';
    }

    const threshold = Number.parseFloat(similarityThreshold);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      return 'Ngưỡng tương đồng phải nằm trong khoảng từ 0 đến 1.';
    }

    return null;
  };

  const invalidatePreviewOnParamChange = () => {
    if (previewData) {
      setPreviewData(null);
    }
    setGenSuccessMsg(null);
  };

  const handlePreviewGenerate = async () => {
    setGenError(null);
    setGenSuccessMsg(null);

    const validationErr = validateGenerateParams();
    if (validationErr) {
      setGenError(new Error(validationErr));
      return;
    }

    setIsPreviewing(true);
    try {
      const res = await previewExamVariantsApi(exam.id, {
        variant_count: Number.parseInt(variantCount, 10),
        variant_code_start: variantCodeStart.trim(),
        generation_mode: generationMode,
        strict_topic_balance: strictTopicBalance,
        prevent_duplicate_topic: preventDuplicateTopic,
        similarity_threshold: Number.parseFloat(similarityThreshold),
      });
      setPreviewData(res.data);
    } catch (err) {
      setGenError(err);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleConfirmGenerate = async () => {
    if (!previewData?.review_token) {
      setGenError(
        new Error('Vui lòng bấm "Xem trước đề gốc" trước khi xác nhận sinh mã đề.')
      );
      return;
    }

    setGenError(null);
    setGenSuccessMsg(null);
    setIsGenerating(true);

    try {
      const res = await generateExamVariantsApi(exam.id, {
        variant_count: Number.parseInt(variantCount, 10),
        variant_code_start: variantCodeStart.trim(),
        generation_mode: generationMode,
        strict_topic_balance: strictTopicBalance,
        prevent_duplicate_topic: preventDuplicateTopic,
        similarity_threshold: Number.parseFloat(similarityThreshold),
        confirmed_review_token: previewData.review_token,
      });

      await onGeneratedSuccess(exam.id);
      setPreviewData(null);
      setGenSuccessMsg(
        `Đã đóng băng đề gốc và sinh thành công ${res.data.variants.length} mã đề chính thức.`
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EXAM_PREVIEW_CHANGED') {
        setPreviewData(null);
      }
      setGenError(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const qtMap = new Map(questionTypes.map((qt) => [qt.id, qt]));
  const codeRangePreview = computeVariantCodeRangePreview(
    variantCodeStart,
    variantCount
  );

  return (
    <div className="space-y-6">
      {/* SECTION A: GRADING RULES */}
      <Card className="border-surface-border bg-surface-card shadow-sm">
        <CardHeader className="border-b border-surface-border pb-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <ShieldCheck
                  aria-hidden="true"
                  className="size-4 text-brand-600"
                />
                <span>Quy tắc chấm điểm theo dạng câu</span>
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Mọi dạng câu xuất hiện trong đề đều cần quy tắc chấm điểm trước khi sinh mã đề.
              </CardDescription>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-muted/50 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
              <Lock aria-hidden="true" className="size-3" />
              <span>Chính sách an toàn: Khóa điểm âm</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4 sm:p-5">
          {rulesError ? (
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
                  {rulesError instanceof ApiError
                    ? rulesError.message
                    : rulesError instanceof Error
                    ? rulesError.message
                    : 'Không thể lưu quy tắc chấm điểm.'}
                </p>
                {rulesError instanceof ApiError ? (
                  <TechnicalDetails
                    code={rulesError.code}
                    traceId={rulesError.traceId}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {rulesSuccessMsg ? (
            <div
              role="status"
              className="flex items-center gap-2 rounded-lg border border-semantic-success/30 bg-semantic-success-bg px-3.5 py-2.5 text-xs font-medium text-semantic-success"
            >
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
              <span>{rulesSuccessMsg}</span>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-surface-border">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-surface-border bg-surface-muted/50 text-[11px] font-semibold text-text-secondary">
                <tr>
                  <th scope="col" className="w-12 px-3 py-2.5">
                    Áp dụng
                  </th>
                  <th scope="col" className="min-w-[180px] px-3 py-2.5">
                    Dạng câu hỏi
                  </th>
                  <th scope="col" className="min-w-[180px] px-3 py-2.5">
                    Chế độ chấm điểm
                  </th>
                  <th scope="col" className="min-w-[160px] px-3 py-2.5">
                    Tùy chọn chấm
                  </th>
                  <th scope="col" className="w-28 px-3 py-2.5">
                    Làm tròn (số)
                  </th>
                  <th scope="col" className="min-w-[170px] px-3 py-2.5">
                    Quy tắc làm tròn
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rules.map((row) => {
                  const qt = qtMap.get(row.question_type_id);
                  if (!qt) return null;
                  const isUsedInExam = activeTypeIds.has(qt.id);

                  return (
                    <tr
                      key={qt.id}
                      className={!row.enabled ? 'opacity-55' : undefined}
                    >
                      <td className="px-3 py-2.5">
                        <Checkbox
                          checked={row.enabled}
                          disabled={!isDraft}
                          aria-label={`Áp dụng quy tắc cho ${KIND_LABELS[qt.code] || qt.name}`}
                          onCheckedChange={(v) =>
                            updateRuleRow(qt.id, { enabled: Boolean(v) })
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-text-primary">
                            {KIND_LABELS[qt.code] || qt.name}
                          </span>
                          {isUsedInExam ? (
                            <Badge variant="outline" className="text-[10px]">
                              Đang dùng trong đề
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Select
                          value={row.scoring_mode}
                          disabled={!isDraft || !row.enabled}
                          onValueChange={(val) =>
                            updateRuleRow(qt.id, {
                              scoring_mode: val as GradingScoringMode,
                            })
                          }
                        >
                          <SelectTrigger
                            aria-label={`Chế độ chấm ${KIND_LABELS[qt.code] || qt.name}`}
                            className="h-8 bg-surface-card text-xs"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              Object.keys(
                                SCORING_MODE_LABELS
                              ) as GradingScoringMode[]
                            ).map((mode) => (
                              <SelectItem key={mode} value={mode}>
                                {SCORING_MODE_LABELS[mode]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="space-y-1.5">
                          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-text-primary">
                            <Checkbox
                              checked={row.penalty_for_wrong}
                              disabled={!isDraft || !row.enabled}
                              onCheckedChange={(v) =>
                                updateRuleRow(qt.id, {
                                  penalty_for_wrong: Boolean(v),
                                })
                              }
                            />
                            <span>Trừ tỷ lệ chọn sai</span>
                          </label>
                          {qt.code === 'INPUT' ? (
                            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-text-primary">
                              <Checkbox
                                checked={row.case_sensitive}
                                disabled={!isDraft || !row.enabled}
                                onCheckedChange={(v) =>
                                  updateRuleRow(qt.id, {
                                    case_sensitive: Boolean(v),
                                  })
                                }
                              />
                              <span>Phân biệt HOA/thường</span>
                            </label>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Select
                          value={String(row.rounding_precision)}
                          disabled={!isDraft || !row.enabled}
                          onValueChange={(val) =>
                            updateRuleRow(qt.id, {
                              rounding_precision: Number.parseInt(val, 10),
                            })
                          }
                        >
                          <SelectTrigger
                            aria-label={`Số chữ số làm tròn ${KIND_LABELS[qt.code] || qt.name}`}
                            className="h-8 bg-surface-card text-xs tabular-nums"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2, 3, 4].map((digits) => (
                              <SelectItem key={digits} value={String(digits)}>
                                {digits} chữ số
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5">
                        <Select
                          value={row.rounding_rule}
                          disabled={!isDraft || !row.enabled}
                          onValueChange={(val) =>
                            updateRuleRow(qt.id, {
                              rounding_rule: val as GradingRoundingRule,
                            })
                          }
                        >
                          <SelectTrigger
                            aria-label={`Quy tắc làm tròn ${KIND_LABELS[qt.code] || qt.name}`}
                            className="h-8 bg-surface-card text-xs"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              Object.keys(
                                ROUNDING_RULE_LABELS
                              ) as GradingRoundingRule[]
                            ).map((ruleKey) => (
                              <SelectItem key={ruleKey} value={ruleKey}>
                                {ROUNDING_RULE_LABELS[ruleKey]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isDraft ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetDefaultRules}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
                <span>Khởi tạo quy tắc mặc định</span>
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={rulesSaving}
                onClick={handleSaveGradingRules}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                {rulesSaving ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                  />
                ) : (
                  <Save aria-hidden="true" className="size-3.5" />
                )}
                <span>Lưu quy tắc chấm điểm</span>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* SECTION B: 2-STEP VARIANT GENERATION */}
      {isDraft ? (
        <Card className="border-surface-border bg-surface-card shadow-sm">
          <CardHeader className="border-b border-surface-border pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Sparkles aria-hidden="true" className="size-4 text-brand-600" />
              <span>Sinh mã đề &amp; Đóng băng phiên bản câu hỏi</span>
            </CardTitle>
            <CardDescription className="text-xs text-text-secondary">
              Thực hiện 2 bước: Xem trước đề gốc trước, sau đó xác nhận để sinh bộ mã đề chính thức và khóa sửa ma trận.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 p-4 sm:p-5">
            {genError ? (
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
                    {genError instanceof ApiError
                      ? genError.message
                      : genError instanceof Error
                      ? genError.message
                      : 'Không thể sinh mã đề.'}
                  </p>
                  {genError instanceof ApiError ? (
                    <TechnicalDetails
                      code={genError.code}
                      traceId={genError.traceId}
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label
                  htmlFor={`${genIdPrefix}-mode`}
                  className="mb-1.5 block text-xs font-medium text-text-primary"
                >
                  Luồng sinh đề
                </label>
                <Select
                  value={generationMode}
                  onValueChange={(val) => {
                    setGenerationMode(val as ExamGenerationMode);
                    invalidatePreviewOnParamChange();
                  }}
                >
                  <SelectTrigger
                    id={`${genIdPrefix}-mode`}
                    className="h-9 bg-surface-card text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(
                        GENERATION_MODE_LABELS
                      ) as ExamGenerationMode[]
                    ).map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {GENERATION_MODE_LABELS[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor={`${genIdPrefix}-count`}
                  className="mb-1.5 block text-xs font-medium text-text-primary"
                >
                  Số lượng mã đề (1–100)
                </label>
                <Input
                  id={`${genIdPrefix}-count`}
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={variantCount}
                  onChange={(e) => {
                    setVariantCount(e.target.value);
                    invalidatePreviewOnParamChange();
                  }}
                  className="h-9 bg-surface-card text-xs tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor={`${genIdPrefix}-start`}
                  className="mb-1.5 block text-xs font-medium text-text-primary"
                >
                  Mã đề bắt đầu (3–10 số)
                </label>
                <Input
                  id={`${genIdPrefix}-start`}
                  value={variantCodeStart}
                  onChange={(e) => {
                    setVariantCodeStart(e.target.value);
                    invalidatePreviewOnParamChange();
                  }}
                  placeholder="101"
                  maxLength={10}
                  className="h-9 bg-surface-card font-mono text-xs tabular-nums"
                />
                {codeRangePreview ? (
                  <p className="mt-1 text-[11px] font-mono text-text-secondary tabular-nums">
                    Dự kiến sinh: {codeRangePreview}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor={`${genIdPrefix}-similarity`}
                  className="mb-1.5 block text-xs font-medium text-text-primary"
                >
                  Ngưỡng tương đồng (0–1)
                </label>
                <Input
                  id={`${genIdPrefix}-similarity`}
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={similarityThreshold}
                  onChange={(e) => {
                    setSimilarityThreshold(e.target.value);
                    invalidatePreviewOnParamChange();
                  }}
                  className="h-9 bg-surface-card text-xs tabular-nums"
                />
              </div>
            </div>

            {generationMode === 'FROM_MATRIX' ? (
              <div className="flex flex-wrap items-center gap-4 text-xs text-text-primary">
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <Checkbox
                    checked={strictTopicBalance}
                    onCheckedChange={(v) => {
                      setStrictTopicBalance(Boolean(v));
                      invalidatePreviewOnParamChange();
                    }}
                  />
                  <span>Cân bằng số câu theo chủ đề</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <Checkbox
                    checked={preventDuplicateTopic}
                    onCheckedChange={(v) => {
                      setPreventDuplicateTopic(Boolean(v));
                      invalidatePreviewOnParamChange();
                    }}
                  />
                  <span>Tránh lặp chủ đề trong cùng mã đề</span>
                </label>
              </div>
            ) : !rootData?.has_root_variant ? (
              <div className="rounded-lg border border-semantic-warning/35 bg-semantic-warning-bg px-3.5 py-2.5 text-xs text-semantic-warning">
                Chế độ <strong>Trộn đề từ đề gốc cố định</strong> yêu cầu bạn lưu Đề gốc (ROOT) ở tab &quot;Ma trận &amp; Đề gốc&quot; trước khi xem trước.
              </div>
            ) : null}

            {/* Preview & Confirm Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 border-t border-surface-border pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPreviewing || isGenerating}
                onClick={handlePreviewGenerate}
                className="h-9 gap-1.5 text-xs font-semibold"
              >
                {isPreviewing ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                  />
                ) : (
                  <Eye aria-hidden="true" className="size-3.5" />
                )}
                <span>Bước 1: Xem trước đề gốc</span>
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={!previewData || isPreviewing || isGenerating}
                onClick={handleConfirmGenerate}
                className="h-9 gap-1.5 text-xs font-semibold"
              >
                {isGenerating ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-3.5 animate-spin"
                  />
                ) : (
                  <FileCheck2 aria-hidden="true" className="size-3.5" />
                )}
                <span>Bước 2: Xác nhận sinh mã đề &amp; đóng băng</span>
              </Button>
            </div>

            {/* Preview Result List */}
            {previewData ? (
              <div className="space-y-3 rounded-lg border border-brand-500/30 bg-semantic-info-bg/40 p-4">
                <div className="flex flex-col justify-between gap-2 border-b border-surface-border pb-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs font-semibold text-text-primary">
                      Xem trước Đề gốc ({previewData.questions.length} câu hỏi)
                    </p>
                    <p className="text-[11px] text-text-secondary">
                      {previewData.message ||
                        'Vui lòng kiểm tra nội dung các câu hỏi trước khi xác nhận đóng băng phiên bản.'}
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit text-[10px]">
                    Phiên xác nhận sẵn sàng
                  </Badge>
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {previewData.questions.map((pq, idx) => (
                    <div
                      key={`${pq.question_id}-${idx}`}
                      className="flex items-start justify-between gap-3 rounded-md border border-surface-border bg-surface-card p-3 text-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] font-semibold text-text-secondary tabular-nums">
                            Câu {idx + 1}
                          </span>
                          {pq.answer_spec?.kind ? (
                            <Badge variant="outline" className="text-[10px]">
                              {KIND_LABELS[pq.answer_spec.kind] ||
                                pq.answer_spec.kind}
                            </Badge>
                          ) : null}
                          {pq.embedding_unavailable ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Chưa kiểm tra tương đồng ngữ nghĩa
                            </Badge>
                          ) : null}
                        </div>
                        <p className="line-clamp-2 leading-relaxed text-text-primary">
                          {pq.content}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewQuestionModal(pq)}
                        className="h-7 shrink-0 gap-1 px-2.5 text-[11px]"
                      >
                        <Eye aria-hidden="true" className="size-3" />
                        <span>Xem đề &amp; đáp án</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {genSuccessMsg ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-semantic-success/30 bg-semantic-success-bg px-4 py-3 text-xs font-medium text-semantic-success"
        >
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
          <span>{genSuccessMsg}</span>
        </div>
      ) : null}

      {/* SECTION C: GENERATED VARIANTS LIST */}
      <Card className="border-surface-border bg-surface-card shadow-sm">
        <CardHeader className="border-b border-surface-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <Layers aria-hidden="true" className="size-4 text-brand-600" />
                <span>Danh sách mã đề đã tạo</span>
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Đề gốc (ROOT) và các mã đề hoán vị phục vụ cấp phát cho thí sinh.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs tabular-nums">
              {variants.length} bộ đề
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {variants.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-text-secondary">
              Chưa có mã đề chính thức nào được sinh cho kỳ thi này.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-surface-border bg-surface-muted/50 text-[11px] font-semibold text-text-secondary">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">
                      Mã đề
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Loại đề
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Số lượng câu hỏi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {variants.map((variant) => (
                    <tr key={variant.id}>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-text-primary tabular-nums">
                        {variant.variant_code}
                      </td>
                      <td className="px-4 py-2.5">
                        {variant.is_root ? (
                          <Badge variant="secondary" className="text-[11px]">
                            Đề gốc đối chiếu
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px]">
                            Mã đề phát thí sinh
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs tabular-nums text-text-secondary">
                        {variant.questions_count} câu
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single Question Preview Modal */}
      <AccessibleModal
        isOpen={Boolean(previewQuestionModal)}
        onClose={() => setPreviewQuestionModal(null)}
        maxWidthClass="max-w-2xl"
        title="Xem chi tiết câu hỏi trong đề gốc"
      >
        {previewQuestionModal && previewQuestionModal.answer_spec ? (
          <QuestionPreview
            content={previewQuestionModal.content}
            mediaUrl={previewQuestionModal.media_url}
            difficultyLevel="MEDIUM"
            kind={previewQuestionModal.answer_spec.kind as QuestionKind}
            answerSpec={previewQuestionModal.answer_spec}
          />
        ) : (
          <p className="text-xs text-text-secondary">
            Không có dữ liệu đáp án để hiển thị xem trước.
          </p>
        )}
      </AccessibleModal>
    </div>
  );
}
