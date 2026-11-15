export const CORE_QUESTION_TYPE_CODES = [
  'SINGLE_CHOICE',
  'MULTI_CHOICE',
  'DROPDOWN',
  'INPUT',
  'MATCHING',
] as const;

export interface QuestionTypeAdminRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export interface CreateQuestionTypePayload {
  code: string;
  name: string;
  description?: string | null;
}

export interface UpdateQuestionTypePayload {
  code?: string;
  name?: string;
  description?: string | null;
}
