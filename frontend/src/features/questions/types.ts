export type QuestionKind =
  | 'SINGLE_CHOICE'
  | 'MULTI_CHOICE'
  | 'DROPDOWN'
  | 'INPUT'
  | 'MATCHING';

export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type QuestionStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
};

export const STATUS_LABELS: Record<QuestionStatus, string> = {
  DRAFT: 'Bản nháp',
  ACTIVE: 'Đang sử dụng',
  INACTIVE: 'Tạm ngưng',
  ARCHIVED: 'Lưu trữ',
};

export const KIND_LABELS: Record<QuestionKind, string> = {
  SINGLE_CHOICE: 'Một đáp án đúng',
  MULTI_CHOICE: 'Nhiều đáp án đúng',
  DROPDOWN: 'Chọn vào chỗ trống',
  INPUT: 'Điền đáp án',
  MATCHING: 'Ghép cặp',
};

export interface QuestionType {
  id: string;
  code: QuestionKind;
  name: string;
  description: string | null;
}

// ==========================================
// CANONICAL ANSWER SPEC V1
// ==========================================

export interface SingleChoiceOption {
  id: string; // UUID
  text: string;
  order_no: number;
  is_correct: boolean;
}

export interface AnswerSpecSingleChoice {
  schema_version: 1;
  kind: 'SINGLE_CHOICE';
  choices: SingleChoiceOption[];
}

export interface MultiChoiceOption {
  id: string; // UUID
  text: string;
  order_no: number;
  is_correct: boolean;
}

export interface AnswerSpecMultiChoice {
  schema_version: 1;
  kind: 'MULTI_CHOICE';
  choices: MultiChoiceOption[];
}

export interface DropdownChoice {
  value_id: string;
  label: string;
}

export interface DropdownBlank {
  blank_id: string;
  choices: DropdownChoice[];
  correct_value_id: string;
}

export interface AnswerSpecDropdown {
  schema_version: 1;
  kind: 'DROPDOWN';
  blanks: DropdownBlank[];
}

export interface AnswerSpecInput {
  schema_version: 1;
  kind: 'INPUT';
  equivalent_answers: string[];
}

export interface MatchingItem {
  id: string;
  label: string;
}

export interface MatchingPair {
  left_id: string;
  right_id: string;
}

export interface AnswerSpecMatching {
  schema_version: 1;
  kind: 'MATCHING';
  left_items: MatchingItem[];
  right_items: MatchingItem[];
  pairs: MatchingPair[];
}

export type AnswerSpec =
  | AnswerSpecSingleChoice
  | AnswerSpecMultiChoice
  | AnswerSpecDropdown
  | AnswerSpecInput
  | AnswerSpecMatching;

// ==========================================
// QUESTION RECORD & DTOs
// ==========================================

export interface QuestionRecord {
  id: string;
  lesson_id: string | null;
  type_id: string;
  status: QuestionStatus;
  ai_check_status: string;
  ai_similarity_score: number | null;
  ai_review_state: string | null;
  is_duplicate_overridden: boolean;
  current_version_no: number;
  version_id: string | null;
  difficulty_level: QuestionDifficulty;
  topic_tag: string | null;
  content: string;
  media_url: string | null;
  explanation: string | null;
  created_by: string;
  answer_spec: AnswerSpec | null;
}

export interface QuestionVersion {
  id: string;
  question_id: string;
  version_no: number;
  frozen_at: string | null;
  is_current: boolean;
  answer_spec: AnswerSpec | null;
}

export interface QuestionsQueryParams {
  q?: string;
  subject_id?: string;
  chapter_id?: string;
  lesson_id?: string;
  topic_tag?: string;
  type_id?: string;
  difficulty_level?: QuestionDifficulty;
  status?: QuestionStatus;
  page?: number;
  page_size?: number;
}

export interface CreateQuestionPayload {
  lesson_id?: string | null;
  type_id: string;
  difficulty_level: QuestionDifficulty;
  topic_tag?: string | null;
  content: string;
  media_url?: string | null;
  explanation?: string | null;
  requested_status?: 'DRAFT' | 'ACTIVE';
  answer_spec: AnswerSpec;
}

export interface PatchQuestionPayload {
  lesson_id?: string | null;
  type_id?: string;
  difficulty_level?: QuestionDifficulty;
  topic_tag?: string | null;
  content?: string;
  media_url?: string | null;
  explanation?: string | null;
  requested_status?: 'DRAFT' | 'ACTIVE';
  answer_spec?: AnswerSpec;
}

export interface QuestionsPaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}
