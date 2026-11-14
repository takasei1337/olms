import { apiRequest, type ApiEnvelope } from '../../api/client';
import type {
  ChangeVisibilityPayload,
  ExamMutationRecord,
  ExamStatisticsData,
  PublishResultsPayload,
  ResultSummary,
  SubmissionReviewDetail,
  TeacherExamResultRow,
  TeacherExamResultsMeta,
  TeacherExamResultsQuery,
} from './types';

export async function getExamStatisticsApi(
  examId: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<ExamStatisticsData>> {
  return apiRequest<ExamStatisticsData>(`/exams/${encodeURIComponent(examId)}/statistics`, {
    method: 'GET',
    signal,
  });
}

export async function getExamResultsApi(
  examId: string,
  params: TeacherExamResultsQuery = {},
  signal?: AbortSignal
): Promise<ApiEnvelope<TeacherExamResultRow[], TeacherExamResultsMeta>> {
  return apiRequest<TeacherExamResultRow[], TeacherExamResultsMeta>(
    `/exams/${encodeURIComponent(examId)}/results`,
    {
      method: 'GET',
      query: {
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
        status: params.status || undefined,
        student_code: params.student_code?.trim() || undefined,
      },
      signal,
    }
  );
}

export async function getSubmissionResultDetailApi(
  examId: string,
  submissionId: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<SubmissionReviewDetail>> {
  return apiRequest<SubmissionReviewDetail>(
    `/exams/${encodeURIComponent(examId)}/results/${encodeURIComponent(submissionId)}`,
    {
      method: 'GET',
      signal,
    }
  );
}

export async function publishExamResultsApi(
  examId: string,
  payload: PublishResultsPayload
): Promise<ApiEnvelope<ExamMutationRecord>> {
  return apiRequest<ExamMutationRecord>(`/exams/${encodeURIComponent(examId)}/results/publish`, {
    method: 'POST',
    body: payload,
  });
}

export async function changeResultVisibilityApi(
  examId: string,
  payload: ChangeVisibilityPayload
): Promise<ApiEnvelope<ExamMutationRecord>> {
  return apiRequest<ExamMutationRecord>(`/exams/${encodeURIComponent(examId)}/results/visibility`, {
    method: 'POST',
    body: payload,
  });
}

export async function getMyResultsApi(
  signal?: AbortSignal
): Promise<ApiEnvelope<ResultSummary[]>> {
  return apiRequest<ResultSummary[]>('/me/results', {
    method: 'GET',
    signal,
  });
}

export async function getMyResultByExamApi(
  examId: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<ResultSummary>> {
  return apiRequest<ResultSummary>(`/me/results/${encodeURIComponent(examId)}`, {
    method: 'GET',
    signal,
  });
}

export async function getMyResultReviewApi(
  examId: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<SubmissionReviewDetail>> {
  return apiRequest<SubmissionReviewDetail>(`/me/results/${encodeURIComponent(examId)}/review`, {
    method: 'GET',
    signal,
  });
}
