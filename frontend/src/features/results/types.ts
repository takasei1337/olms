import type {
  ExamRecord,
  ExamResultVisibilityMode,
  ExamsPaginationMeta,
} from '../exams/types';
import type { QuestionRenderSpec } from '../student-exams/types';

export type ResultVisibilityMode = ExamResultVisibilityMode;

export type QuestionGradingStatus = 'CORRECT' | 'PARTIAL' | 'WRONG' | 'BLANK';

export type ExamResultParticipantStatus =
  | 'NOT_STARTED'
  | 'REGISTERED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'GRADING'
  | 'GRADED'
  | 'FLAGGED';

export type PublishableVisibilityMode = Exclude<ResultVisibilityMode, 'HIDDEN'>;

export interface ExamStatisticsBucket {
  range: string;
  min_score: number;
  max_score: number;
  count: number;
}

export interface ExamStatisticsData {
  exam_id: string;
  participant_count: number;
  graded_count: number;
  average_score: number | null;
  distribution: ExamStatisticsBucket[];
}

export interface TeacherExamResultRow {
  participant_id: string;
  student_code: string;
  full_name: string;
  submission_id: string | null;
  status: ExamResultParticipantStatus;
  score: number | null;
}

export interface TeacherExamResultsQuery {
  page?: number;
  page_size?: number;
  status?: ExamResultParticipantStatus | '';
  student_code?: string;
}

export type TeacherExamResultsMeta = ExamsPaginationMeta;

export interface ResultSummary {
  exam_id: string;
  exam_code?: string | null;
  exam_name: string;
  visibility: ResultVisibilityMode;
  result_published: boolean;
  result_available: boolean;
  submission_status: string;
  total_score?: number | null;
  max_score?: number;
  correct_count?: number | null;
  wrong_count?: number | null;
  blank_count?: number | null;
  submitted_at?: string | null;
  graded_at?: string | null;
  exam_status?: string | null;
  subject_name?: string | null;
  subject_code?: string | null;
  variant_code?: string | null;
}

export type StudentResponseSnapshot =
  | { selected_options?: string[] }
  | { selections?: Array<{ blank_id: string; value_id: string }> }
  | { answer_text?: string | null }
  | { pairs?: Array<{ left_id: string; right_id: string }> }
  | Record<string, unknown>;

export type CorrectAnswerSnapshot =
  | { correct_options?: string[] }
  | { blanks?: Array<{ blank_id: string; correct_value_id: string }> }
  | { equivalent_answers?: string[] }
  | { pairs?: Array<{ left_id: string; right_id: string }> }
  | Record<string, unknown>;

export interface SubmissionReviewAnswer {
  position: number;
  content?: string | null;
  media_url?: string | null;
  render_spec?: QuestionRenderSpec | null;
  grading_status: QuestionGradingStatus;
  earned_score?: number | null;
  max_score?: number | null;
  student_response?: StudentResponseSnapshot | null;
  correct_answer?: CorrectAnswerSnapshot | null;
  explanation?: string | null;
}

export interface SubmissionReviewDetail {
  summary: ResultSummary;
  answers: SubmissionReviewAnswer[];
}

export interface PublishResultsPayload {
  result_visibility_mode: PublishableVisibilityMode;
}

export interface ChangeVisibilityPayload {
  result_visibility_mode: ResultVisibilityMode;
  reason: string;
}

export type ExamMutationRecord = ExamRecord;
