import type {
  ExamDeliveryMode,
  ExamResultVisibilityMode,
  ExamStatus,
} from '../exams/types';
import type { QuestionKind } from '../questions/types';

export type { QuestionKind };

export interface StudentExamListItem {
  id: string;
  code: string;
  name: string;
  subject_id: string;
  status: ExamStatus;
  delivery_mode: ExamDeliveryMode;
  total_questions: number;
  duration_minutes: number;
  opens_at: string;
  closes_at: string;
  total_score: number | null;
  result_visibility_mode: ExamResultVisibilityMode;
  created_by: string;
}

export interface StudentChoiceOption {
  display_label: string;
  text: string;
}

export interface StudentDropdownBlankChoice {
  value_id: string;
  label: string;
}

export interface StudentDropdownBlank {
  blank_id: string;
  choices: StudentDropdownBlankChoice[];
}

export interface StudentMatchingItem {
  id: string;
  label: string;
}

export type QuestionRenderSpec =
  | {
      schema_version: number;
      kind: 'SINGLE_CHOICE' | 'MULTI_CHOICE';
      choices: StudentChoiceOption[];
    }
  | {
      schema_version: number;
      kind: 'DROPDOWN';
      blanks: StudentDropdownBlank[];
    }
  | {
      schema_version: number;
      kind: 'INPUT';
      input_hint: string | null;
    }
  | {
      schema_version: number;
      kind: 'MATCHING';
      left_items: StudentMatchingItem[];
      right_items: StudentMatchingItem[];
    };

export interface StudentSessionQuestion {
  exam_variant_question_id: string;
  position: number;
  type_code: QuestionKind;
  content: string;
  media_url: string | null;
  render_spec: QuestionRenderSpec | null;
}

export interface DropdownSelection {
  blank_id: string;
  value_id: string;
}

export interface MatchingPair {
  left_id: string;
  right_id: string;
}

export interface DropdownResponseData {
  kind: 'DROPDOWN';
  selections: DropdownSelection[];
}

export interface MatchingResponseData {
  kind: 'MATCHING';
  pairs: MatchingPair[];
}

export interface SavedAnswerItem {
  exam_variant_question_id: string;
  client_sequence: number;
  response_kind: QuestionKind;
  selected_options?: string[];
  answer_text?: string;
  response_data?: DropdownResponseData | MatchingResponseData;
}

export interface StudentExamSessionData {
  submission_id: string;
  exam_id: string;
  variant_code: string;
  status: string;
  started_at: string;
  deadline_at: string;
  server_time: string;
  remaining_seconds: number;
  questions: StudentSessionQuestion[];
  saved_answers: SavedAnswerItem[];
}

export interface LocalAnswerDraft {
  kind: QuestionKind;
  selectedOptions: string[];
  answerText: string;
  dropdownSelections: DropdownSelection[];
  matchingPairs: MatchingPair[];
}

export type AutosavePayload =
  | {
      response_kind: 'SINGLE_CHOICE' | 'MULTI_CHOICE';
      expected_client_sequence: number;
      client_sequence: number;
      edit_token: string;
      selected_options: string[];
    }
  | {
      response_kind: 'DROPDOWN';
      expected_client_sequence: number;
      client_sequence: number;
      edit_token: string;
      response_data: DropdownResponseData;
    }
  | {
      response_kind: 'INPUT';
      expected_client_sequence: number;
      client_sequence: number;
      edit_token: string;
      answer_text: string;
    }
  | {
      response_kind: 'MATCHING';
      expected_client_sequence: number;
      client_sequence: number;
      edit_token: string;
      response_data: MatchingResponseData;
    };

export interface AutosaveAckData {
  submission_id: string;
  exam_variant_question_id: string;
  accepted_sequence: number;
  saved_at: string;
  edit_token: string;
  server_time: string;
  was_retry: boolean;
}

export interface CasConflictErrorData {
  current_sequence?: number;
  server_time?: string;
  server_answer?: unknown;
  can_retry?: boolean;
}

export interface SubmitReceiptData {
  submission_id: string;
  submission_status: string;
  participant_status: string;
  submitted_at: string;
  grade_available: boolean;
  visibility: ExamResultVisibilityMode;
  score: number | null;
}

export type QuestionSaveStatus =
  | 'idle'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'retrying'
  | 'error';

export interface QuestionRuntimeState {
  draft: LocalAnswerDraft;
  confirmedSeq: number;
  status: QuestionSaveStatus;
  savedAt: string | null;
  errorMessage: string | null;
}
