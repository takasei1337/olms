import { apiRequest } from '../../api/client';
import type {
  AutosaveAckData,
  AutosavePayload,
  StudentExamListItem,
  StudentExamSessionData,
  SubmitReceiptData,
} from './types';

export async function listMyExams(): Promise<StudentExamListItem[]> {
  const res = await apiRequest<StudentExamListItem[]>('/me/exams', {
    method: 'GET',
  });
  return Array.isArray(res.data) ? res.data : [];
}

export async function startOrResumeExamSession(
  examId: string
): Promise<StudentExamSessionData> {
  const res = await apiRequest<StudentExamSessionData>(`/me/exams/${examId}/session`, {
    method: 'POST',
  });
  return res.data;
}

export async function getActiveExamSession(
  examId: string
): Promise<StudentExamSessionData> {
  const res = await apiRequest<StudentExamSessionData>(`/me/exams/${examId}/session`, {
    method: 'GET',
  });
  return res.data;
}

export async function autosaveQuestionAnswer(
  submissionId: string,
  variantQuestionId: string,
  payload: AutosavePayload
): Promise<AutosaveAckData> {
  const res = await apiRequest<AutosaveAckData>(
    `/me/submissions/${submissionId}/answers/${variantQuestionId}`,
    {
      method: 'PUT',
      body: payload,
    }
  );
  return res.data;
}

export async function submitExamSubmission(
  submissionId: string,
  idempotencyKey: string
): Promise<SubmitReceiptData> {
  const res = await apiRequest<SubmitReceiptData>(
    `/me/submissions/${submissionId}/submit`,
    {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    }
  );
  return res.data;
}
