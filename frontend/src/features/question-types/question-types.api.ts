import { apiRequest, type ApiEnvelope } from '../../api/client';
import type {
  CreateQuestionTypePayload,
  QuestionTypeAdminRecord,
  UpdateQuestionTypePayload,
} from './types';

export async function getQuestionTypesAdminApi(
  signal?: AbortSignal
): Promise<ApiEnvelope<QuestionTypeAdminRecord[]>> {
  return apiRequest<QuestionTypeAdminRecord[]>('/question-types', {
    method: 'GET',
    signal,
  });
}

export async function createQuestionTypeApi(
  payload: CreateQuestionTypePayload
): Promise<ApiEnvelope<QuestionTypeAdminRecord>> {
  return apiRequest<QuestionTypeAdminRecord>('/question-types', {
    method: 'POST',
    body: payload,
  });
}

export async function updateQuestionTypeApi(
  typeId: string,
  payload: UpdateQuestionTypePayload
): Promise<ApiEnvelope<QuestionTypeAdminRecord>> {
  return apiRequest<QuestionTypeAdminRecord>(
    `/question-types/${encodeURIComponent(typeId)}`,
    {
      method: 'PATCH',
      body: payload,
    }
  );
}

export async function deleteQuestionTypeApi(
  typeId: string
): Promise<ApiEnvelope<Record<string, never>>> {
  return apiRequest<Record<string, never>>(
    `/question-types/${encodeURIComponent(typeId)}`,
    {
      method: 'DELETE',
    }
  );
}
