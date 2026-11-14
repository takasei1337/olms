import type { AnswerSpec, QuestionDifficulty } from '../questions/types';

export type ExamStatus =
  | 'DRAFT'
  | 'GENERATED'
  | 'PUBLISHED'
  | 'IN_PROGRESS'
  | 'ENDED'
  | 'RESULT_PUBLISHED'
  | 'ARCHIVED'
  | 'CANCELLED';

export type ExamDeliveryMode = 'ONLINE' | 'PAPER' | 'BOTH';

export type ExamResultVisibilityMode =
  | 'HIDDEN'
  | 'SCORE_ONLY'
  | 'SCORE_AND_STATUS'
  | 'FULL_REVIEW';

export type ExamGenerationMode = 'FROM_MATRIX' | 'FROM_ROOT';

export type GradingScoringMode = 'EXACT_MATCH' | 'PARTIAL_CREDIT';

export type GradingRoundingRule = 'ROUND_HALF_UP' | 'ROUND_DOWN' | 'NONE';

export type ParticipantStatus = 'REGISTERED' | 'IN_PROGRESS' | 'COMPLETED';

export type AttendanceStatus = 'NOT_MARKED' | 'PRESENT' | 'ABSENT';

export type ExportCredentialsFormat = 'XLSX' | 'PDF';

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  DRAFT: 'Bản nháp',
  GENERATED: 'Đã sinh mã đề',
  PUBLISHED: 'Đã phát hành',
  IN_PROGRESS: 'Đang diễn ra',
  ENDED: 'Đã kết thúc',
  RESULT_PUBLISHED: 'Đã công bố điểm',
  ARCHIVED: 'Đã lưu trữ',
  CANCELLED: 'Đã hủy',
};

export const DELIVERY_MODE_LABELS: Record<ExamDeliveryMode, string> = {
  ONLINE: 'Thi trực tuyến',
  PAPER: 'Thi giấy (OMR)',
  BOTH: 'Kết hợp (Trực tuyến & Giấy)',
};

export const VISIBILITY_MODE_LABELS: Record<ExamResultVisibilityMode, string> = {
  HIDDEN: 'Ẩn điểm & đáp án',
  SCORE_ONLY: 'Chỉ xem tổng điểm',
  SCORE_AND_STATUS: 'Xem điểm & trạng thái đúng/sai',
  FULL_REVIEW: 'Xem chi tiết điểm, đáp án & lời giải',
};

export const GENERATION_MODE_LABELS: Record<ExamGenerationMode, string> = {
  FROM_MATRIX: 'Sinh đề tự động từ ma trận',
  FROM_ROOT: 'Trộn đề từ đề gốc cố định',
};

export const SCORING_MODE_LABELS: Record<GradingScoringMode, string> = {
  EXACT_MATCH: 'Chính xác toàn phần',
  PARTIAL_CREDIT: 'Tính điểm thành phần',
};

export const ROUNDING_RULE_LABELS: Record<GradingRoundingRule, string> = {
  ROUND_HALF_UP: 'Làm tròn chuẩn (nửa lên)',
  ROUND_DOWN: 'Làm tròn xuống',
  NONE: 'Không làm tròn',
};

export const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatus, string> = {
  REGISTERED: 'Đã ghi danh',
  IN_PROGRESS: 'Đang làm bài',
  COMPLETED: 'Đã hoàn thành',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  NOT_MARKED: 'Chưa điểm danh',
  PRESENT: 'Có mặt',
  ABSENT: 'Vắng mặt',
};

export const PRE_START_PARTICIPANT_EXAM_STATUSES: readonly ExamStatus[] = [
  'DRAFT',
  'GENERATED',
  'PUBLISHED',
];

export const CANCELLABLE_EXAM_STATUSES: readonly ExamStatus[] = [
  'DRAFT',
  'GENERATED',
  'PUBLISHED',
  'IN_PROGRESS',
];

export interface ExamSubjectSummary {
  id: string;
  code: string;
  name: string;
}

export interface ExamRecord {
  id: string;
  code: string;
  name: string;
  subject_id: string;
  form_template_id: string | null;
  status: ExamStatus;
  delivery_mode: ExamDeliveryMode;
  total_questions: number;
  duration_minutes: number;
  opens_at: string;
  closes_at: string;
  total_score: number;
  result_visibility_mode: ExamResultVisibilityMode;
  result_published_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  subjects?: ExamSubjectSummary | null;
}

export interface ExamsPaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ExamsQueryParams {
  q?: string;
  subject_id?: string;
  status?: ExamStatus;
  page?: number;
  page_size?: number;
}

export interface CreateExamPayload {
  code: string;
  name: string;
  subject_id: string;
  delivery_mode: ExamDeliveryMode;
  total_questions: number;
  duration_minutes: number;
  opens_at: string;
  closes_at: string;
  total_score: number;
  result_visibility_mode: ExamResultVisibilityMode;
  form_template_id?: string | null;
}

export type PatchExamPayload = Partial<CreateExamPayload>;

export interface ExamMatrixRowInput {
  chapter_id: string | null;
  lesson_id?: string | null;
  question_type_id: string;
  difficulty_level: QuestionDifficulty;
  num_questions: number;
  score_per_question: number;
  max_questions_per_topic?: number | null;
}

export interface MatrixValidationIssue {
  row_index?: number;
  code: string;
  requested?: number;
  available?: number;
  message: string;
}

export interface MatrixValidationResult {
  valid: boolean;
  expected_questions: number;
  matrix_questions: number;
  expected_score: number;
  matrix_score: number;
  issues: MatrixValidationIssue[];
}

export interface GradingRuleInput {
  question_type_id: string;
  scoring_mode: GradingScoringMode;
  penalty_for_wrong?: boolean;
  case_sensitive?: boolean;
  rounding_precision?: number;
  rounding_rule?: GradingRoundingRule;
  allow_negative_marking: false;
}

export interface RootQuestionItem {
  position: number;
  question_id: string;
  question_version_id: string;
  type_id: string;
  difficulty_level: QuestionDifficulty;
  lesson_id: string | null;
  topic_tag: string | null;
  content: string;
  score: number;
  option_order?: unknown;
}

export interface RootQuestionsResponse {
  exam_id: string;
  has_root_variant: boolean;
  variant_id: string | null;
  variant_code: string | null;
  is_root: true;
  total_questions: number;
  total_score: number;
  items: RootQuestionItem[];
}

export interface ReplaceRootQuestionItemInput {
  question_id: string;
  score?: number;
}

export interface ReplaceRootQuestionsPayload {
  items: ReplaceRootQuestionItemInput[];
  variant_code?: string;
}

export interface GenerateFromMatrixPayload {
  strict_topic_balance?: boolean;
  prevent_duplicate_topic?: boolean;
}

export interface GenerateVariantsPayload {
  variant_count: number;
  variant_code_start: string;
  generation_mode?: ExamGenerationMode;
  strict_topic_balance?: boolean;
  prevent_duplicate_topic?: boolean;
  similarity_threshold?: number;
  preview_only?: boolean;
  confirmed_review_token?: string;
}

export interface GeneratePreviewQuestion {
  question_id: string;
  version_id: string;
  content: string;
  media_url: string | null;
  answer_spec: AnswerSpec | null;
  embedding_unavailable?: boolean;
}

export interface GeneratePreviewResponse {
  exam_id: string;
  generation_mode: ExamGenerationMode;
  variant_code: string;
  is_root: boolean;
  review_required: boolean;
  message: string;
  questions: GeneratePreviewQuestion[];
  review_token: string;
}

export interface ExamVariantSummary {
  id: string;
  variant_code: string;
  is_root: boolean;
  questions_count: number;
}

export interface GenerateCommitResponse {
  exam_id: string;
  generation_mode: ExamGenerationMode;
  status: ExamStatus;
  root_variant: ExamVariantSummary;
  variants: ExamVariantSummary[];
  generated_at: string;
}

export interface ParticipantRecord {
  id: string;
  exam_id: string;
  student_user_id: string;
  student_profile_id: string;
  student_code: string;
  full_name_snapshot: string;
  variant_id: string | null;
  status: ParticipantStatus;
  attendance_status: AttendanceStatus;
}

export interface ParticipantsQueryParams {
  q?: string;
  status?: ParticipantStatus;
  page?: number;
  page_size?: number;
}

export interface CreateParticipantPayload {
  student_code: string;
  full_name: string;
  email?: string | null;
}

export interface ParticipantCredentialOutcome {
  participant: ParticipantRecord;
  username?: string | null;
  initial_password?: string | null;
}

export interface ParticipantImportPreviewRow {
  row_no: number;
  student_code: string;
  full_name: string;
  valid: boolean;
  warning?: string | null;
}

export interface ParticipantImportPreviewResult {
  import_token: string;
  valid_count: number;
  duplicate_count: number;
  invalid_count: number;
  rows: ParticipantImportPreviewRow[];
}

export interface ParticipantImportCommitResult {
  created_count: number;
  skipped_duplicate_count: number;
  invalid_count: number;
}

export interface CredentialsExportResult {
  download_url: string;
  expires_at: string;
  file_name: string;
}
