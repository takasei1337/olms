import { apiRequest, type ApiEnvelope } from '../../api/client';
import type {
  CreateExamPayload,
  CreateParticipantPayload,
  CredentialsExportResult,
  ExamMatrixRowInput,
  ExamRecord,
  ExamsPaginationMeta,
  ExamsQueryParams,
  ExamVariantSummary,
  ExportCredentialsFormat,
  GenerateCommitResponse,
  GenerateFromMatrixPayload,
  GeneratePreviewResponse,
  GenerateVariantsPayload,
  GradingRuleInput,
  MatrixValidationResult,
  ParticipantCredentialOutcome,
  ParticipantImportCommitResult,
  ParticipantImportPreviewResult,
  ParticipantRecord,
  ParticipantsQueryParams,
  PatchExamPayload,
  ReplaceRootQuestionsPayload,
  RootQuestionsResponse,
} from './types';

// ==========================================
// 1. EXAM CRUD & LIFECYCLE
// ==========================================

export async function getExamsApi(
  params: ExamsQueryParams = {},
  signal?: AbortSignal
): Promise<ApiEnvelope<ExamRecord[], ExamsPaginationMeta>> {
  return apiRequest<ExamRecord[], ExamsPaginationMeta>('/exams', {
    method: 'GET',
    query: {
      q: params.q?.trim() || undefined,
      subject_id: params.subject_id || undefined,
      status: params.status || undefined,
      page: params.page ?? 1,
      page_size: params.page_size ?? 20,
    },
    signal,
  });
}

export async function getExamByIdApi(
  examId: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<ExamRecord>> {
  return apiRequest<ExamRecord>(`/exams/${encodeURIComponent(examId)}`, {
    method: 'GET',
    signal,
  });
}

export async function createExamApi(
  payload: CreateExamPayload
): Promise<ApiEnvelope<ExamRecord>> {
  return apiRequest<ExamRecord>('/exams', {
    method: 'POST',
    body: payload,
  });
}

export async function updateExamApi(
  examId: string,
  payload: PatchExamPayload
): Promise<ApiEnvelope<ExamRecord>> {
  return apiRequest<ExamRecord>(`/exams/${encodeURIComponent(examId)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteExamApi(
  examId: string
): Promise<ApiEnvelope<{ id: string }>> {
  return apiRequest<{ id: string }>(`/exams/${encodeURIComponent(examId)}`, {
    method: 'DELETE',
  });
}

export async function publishExamApi(
  examId: string
): Promise<ApiEnvelope<ExamRecord>> {
  return apiRequest<ExamRecord>(
    `/exams/${encodeURIComponent(examId)}/publish`,
    { method: 'POST' }
  );
}

export async function startExamApi(
  examId: string
): Promise<ApiEnvelope<ExamRecord>> {
  return apiRequest<ExamRecord>(`/exams/${encodeURIComponent(examId)}/start`, {
    method: 'POST',
  });
}

export async function archiveExamApi(
  examId: string
): Promise<ApiEnvelope<ExamRecord>> {
  return apiRequest<ExamRecord>(
    `/exams/${encodeURIComponent(examId)}/archive`,
    { method: 'POST' }
  );
}

export async function cancelExamApi(
  examId: string,
  reason?: string
): Promise<ApiEnvelope<ExamRecord>> {
  return apiRequest<ExamRecord>(`/exams/${encodeURIComponent(examId)}/cancel`, {
    method: 'POST',
    body: reason?.trim() ? { reason: reason.trim() } : {},
  });
}

// ==========================================
// 2. MATRIX, GRADING RULES, ROOT & VARIANTS
// ==========================================

export async function replaceExamMatrixApi(
  examId: string,
  rows: ExamMatrixRowInput[]
): Promise<ApiEnvelope<Record<string, never>>> {
  return apiRequest<Record<string, never>>(
    `/exams/${encodeURIComponent(examId)}/matrix`,
    {
      method: 'PUT',
      body: { rows },
    }
  );
}

export async function validateExamMatrixApi(
  examId: string
): Promise<ApiEnvelope<MatrixValidationResult>> {
  return apiRequest<MatrixValidationResult>(
    `/exams/${encodeURIComponent(examId)}/matrix/validate`,
    {
      method: 'POST',
    }
  );
}

export async function replaceGradingRulesApi(
  examId: string,
  rules: GradingRuleInput[]
): Promise<ApiEnvelope<Record<string, never>>> {
  return apiRequest<Record<string, never>>(
    `/exams/${encodeURIComponent(examId)}/grading-rules`,
    {
      method: 'PUT',
      body: { rules },
    }
  );
}

export async function getRootQuestionsApi(
  examId: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<RootQuestionsResponse>> {
  return apiRequest<RootQuestionsResponse>(
    `/exams/${encodeURIComponent(examId)}/root-questions`,
    {
      method: 'GET',
      signal,
    }
  );
}

export async function replaceRootQuestionsApi(
  examId: string,
  payload: ReplaceRootQuestionsPayload
): Promise<ApiEnvelope<RootQuestionsResponse>> {
  return apiRequest<RootQuestionsResponse>(
    `/exams/${encodeURIComponent(examId)}/root-questions`,
    {
      method: 'PUT',
      body: payload,
    }
  );
}

export async function generateDraftRootFromMatrixApi(
  examId: string,
  payload: GenerateFromMatrixPayload = {}
): Promise<ApiEnvelope<RootQuestionsResponse>> {
  return apiRequest<RootQuestionsResponse>(
    `/exams/${encodeURIComponent(examId)}/root-questions/from-matrix`,
    {
      method: 'POST',
      body: payload,
    }
  );
}

export async function previewExamVariantsApi(
  examId: string,
  payload: GenerateVariantsPayload
): Promise<ApiEnvelope<GeneratePreviewResponse>> {
  return apiRequest<GeneratePreviewResponse>(
    `/exams/${encodeURIComponent(examId)}/generate`,
    {
      method: 'POST',
      body: {
        ...payload,
        preview_only: true,
      },
    }
  );
}

export async function generateExamVariantsApi(
  examId: string,
  payload: GenerateVariantsPayload
): Promise<ApiEnvelope<GenerateCommitResponse>> {
  return apiRequest<GenerateCommitResponse>(
    `/exams/${encodeURIComponent(examId)}/generate`,
    {
      method: 'POST',
      body: {
        ...payload,
        preview_only: false,
      },
    }
  );
}

export async function getExamVariantsApi(
  examId: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<ExamVariantSummary[]>> {
  return apiRequest<ExamVariantSummary[]>(
    `/exams/${encodeURIComponent(examId)}/variants`,
    {
      method: 'GET',
      signal,
    }
  );
}

// ==========================================
// 3. PARTICIPANTS & CREDENTIALS
// ==========================================

export async function getParticipantsApi(
  examId: string,
  params: ParticipantsQueryParams = {},
  signal?: AbortSignal
): Promise<ApiEnvelope<ParticipantRecord[], ExamsPaginationMeta>> {
  return apiRequest<ParticipantRecord[], ExamsPaginationMeta>(
    `/exams/${encodeURIComponent(examId)}/participants`,
    {
      method: 'GET',
      query: {
        q: params.q?.trim() || undefined,
        status: params.status || undefined,
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      },
      signal,
    }
  );
}

export async function createParticipantApi(
  examId: string,
  payload: CreateParticipantPayload
): Promise<ApiEnvelope<ParticipantCredentialOutcome>> {
  return apiRequest<ParticipantCredentialOutcome>(
    `/exams/${encodeURIComponent(examId)}/participants`,
    {
      method: 'POST',
      body: payload,
    }
  );
}

export async function deleteParticipantApi(
  examId: string,
  participantId: string
): Promise<ApiEnvelope<Record<string, never>>> {
  return apiRequest<Record<string, never>>(
    `/exams/${encodeURIComponent(examId)}/participants/${encodeURIComponent(participantId)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function resetParticipantCredentialsApi(
  examId: string,
  participantId: string,
  reason: string
): Promise<ApiEnvelope<ParticipantCredentialOutcome>> {
  return apiRequest<ParticipantCredentialOutcome>(
    `/exams/${encodeURIComponent(examId)}/participants/${encodeURIComponent(participantId)}/credentials/reset`,
    {
      method: 'POST',
      body: { reason: reason.trim() },
    }
  );
}

export async function previewParticipantsImportApi(
  examId: string,
  file: File
): Promise<ApiEnvelope<ParticipantImportPreviewResult>> {
  const formData = new FormData();
  formData.append('file', file);

  return apiRequest<ParticipantImportPreviewResult>(
    `/exams/${encodeURIComponent(examId)}/participants/import/preview`,
    {
      method: 'POST',
      body: formData,
    }
  );
}

export async function commitParticipantsImportApi(
  examId: string,
  importToken: string
): Promise<ApiEnvelope<ParticipantImportCommitResult>> {
  return apiRequest<ParticipantImportCommitResult>(
    `/exams/${encodeURIComponent(examId)}/participants/import/commit`,
    {
      method: 'POST',
      body: { import_token: importToken },
    }
  );
}

export async function exportParticipantsCredentialsApi(
  examId: string,
  format: ExportCredentialsFormat
): Promise<ApiEnvelope<CredentialsExportResult>> {
  return apiRequest<CredentialsExportResult>(
    `/exams/${encodeURIComponent(examId)}/participants/credentials/export`,
    {
      method: 'POST',
      body: { format },
    }
  );
}
