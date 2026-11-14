import { apiRequest, type ApiEnvelope } from '../../api/client';
import type {
  CreateQuestionPayload,
  PatchQuestionPayload,
  QuestionRecord,
  QuestionsPaginationMeta,
  QuestionsQueryParams,
  QuestionStatus,
  QuestionType,
  QuestionVersion,
} from './types';

export async function getQuestionTypesApi(
  signal?: AbortSignal
): Promise<ApiEnvelope<QuestionType[]>> {
  return apiRequest<QuestionType[]>('/question-types', {
    method: 'GET',
    signal,
  });
}

export async function getQuestionsApi(
  params: QuestionsQueryParams = {},
  signal?: AbortSignal
): Promise<ApiEnvelope<QuestionRecord[], QuestionsPaginationMeta>> {
  return apiRequest<QuestionRecord[], QuestionsPaginationMeta>('/questions', {
    method: 'GET',
    query: {
      q: params.q || undefined,
      subject_id: params.subject_id || undefined,
      chapter_id: params.chapter_id || undefined,
      lesson_id: params.lesson_id || undefined,
      topic_tag: params.topic_tag || undefined,
      type_id: params.type_id || undefined,
      difficulty_level: params.difficulty_level || undefined,
      status: params.status || undefined,
      page: params.page ?? 1,
      page_size: params.page_size ?? 20,
    },
    signal,
  });
}

export async function getQuestionByIdApi(
  questionId: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<QuestionRecord>> {
  return apiRequest<QuestionRecord>(
    `/questions/${encodeURIComponent(questionId)}`,
    {
      method: 'GET',
      signal,
    }
  );
}

export async function createQuestionApi(
  payload: CreateQuestionPayload
): Promise<ApiEnvelope<QuestionRecord>> {
  return apiRequest<QuestionRecord>('/questions', {
    method: 'POST',
    body: payload,
  });
}

export async function updateQuestionApi(
  questionId: string,
  payload: PatchQuestionPayload
): Promise<ApiEnvelope<QuestionRecord>> {
  return apiRequest<QuestionRecord>(
    `/questions/${encodeURIComponent(questionId)}`,
    {
      method: 'PATCH',
      body: payload,
    }
  );
}

export async function updateQuestionStatusApi(
  questionId: string,
  status: QuestionStatus
): Promise<ApiEnvelope<QuestionRecord>> {
  return apiRequest<QuestionRecord>(
    `/questions/${encodeURIComponent(questionId)}/status`,
    {
      method: 'PATCH',
      body: { status },
    }
  );
}

export async function cloneQuestionApi(
  questionId: string
): Promise<ApiEnvelope<QuestionRecord>> {
  return apiRequest<QuestionRecord>(
    `/questions/${encodeURIComponent(questionId)}/clone`,
    {
      method: 'POST',
    }
  );
}

export async function getQuestionVersionsApi(
  questionId: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<QuestionVersion[]>> {
  return apiRequest<QuestionVersion[]>(
    `/questions/${encodeURIComponent(questionId)}/versions`,
    {
      method: 'GET',
      signal,
    }
  );
}

export async function deleteQuestionApi(
  questionId: string
): Promise<ApiEnvelope<Record<string, never>>> {
  return apiRequest<Record<string, never>>(
    `/questions/${encodeURIComponent(questionId)}`,
    {
      method: 'DELETE',
    }
  );
}
