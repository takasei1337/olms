import { apiRequest, type ApiEnvelope } from '../../api/client';
import type {
  CatalogPaginationMeta,
  Chapter,
  CreateChapterPayload,
  CreateLessonPayload,
  CreateSubjectPayload,
  Lesson,
  LessonTopic,
  PatchChapterPayload,
  PatchLessonPayload,
  PatchSubjectPayload,
  Subject,
} from './types';

// ==========================================
// 1. SUBJECTS API
// ==========================================

export async function getSubjectsApi(
  params: { q?: string; page?: number; page_size?: number } = {},
  signal?: AbortSignal
): Promise<ApiEnvelope<Subject[], CatalogPaginationMeta>> {
  return apiRequest<Subject[], CatalogPaginationMeta>('/subjects', {
    method: 'GET',
    query: {
      q: params.q || undefined,
      page: params.page ?? 1,
      page_size: params.page_size ?? 50,
    },
    signal,
  });
}

export async function createSubjectApi(
  payload: CreateSubjectPayload
): Promise<ApiEnvelope<Subject>> {
  return apiRequest<Subject>('/subjects', {
    method: 'POST',
    body: payload,
  });
}

export async function updateSubjectApi(
  subjectId: string,
  payload: PatchSubjectPayload
): Promise<ApiEnvelope<Subject>> {
  return apiRequest<Subject>(`/subjects/${encodeURIComponent(subjectId)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteSubjectApi(
  subjectId: string
): Promise<ApiEnvelope<Record<string, never>>> {
  return apiRequest<Record<string, never>>(
    `/subjects/${encodeURIComponent(subjectId)}`,
    {
      method: 'DELETE',
    }
  );
}

// ==========================================
// 2. CHAPTERS API
// ==========================================

export async function getChaptersBySubjectApi(
  subjectId: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<Chapter[]>> {
  return apiRequest<Chapter[]>(
    `/subjects/${encodeURIComponent(subjectId)}/chapters`,
    {
      method: 'GET',
      signal,
    }
  );
}

export async function createChapterApi(
  subjectId: string,
  payload: CreateChapterPayload
): Promise<ApiEnvelope<Chapter>> {
  return apiRequest<Chapter>(
    `/subjects/${encodeURIComponent(subjectId)}/chapters`,
    {
      method: 'POST',
      body: payload,
    }
  );
}

export async function updateChapterApi(
  chapterId: string,
  payload: PatchChapterPayload
): Promise<ApiEnvelope<Chapter>> {
  return apiRequest<Chapter>(`/chapters/${encodeURIComponent(chapterId)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteChapterApi(
  chapterId: string
): Promise<ApiEnvelope<{ id: string }>> {
  return apiRequest<{ id: string }>(
    `/chapters/${encodeURIComponent(chapterId)}`,
    {
      method: 'DELETE',
    }
  );
}

// ==========================================
// 3. LESSONS API
// ==========================================

export async function getLessonsByChapterApi(
  chapterId: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<Lesson[]>> {
  return apiRequest<Lesson[]>(
    `/chapters/${encodeURIComponent(chapterId)}/lessons`,
    {
      method: 'GET',
      signal,
    }
  );
}

export async function createLessonApi(
  chapterId: string,
  payload: CreateLessonPayload
): Promise<ApiEnvelope<Lesson>> {
  return apiRequest<Lesson>(
    `/chapters/${encodeURIComponent(chapterId)}/lessons`,
    {
      method: 'POST',
      body: payload,
    }
  );
}

export async function updateLessonApi(
  lessonId: string,
  payload: PatchLessonPayload
): Promise<ApiEnvelope<Lesson>> {
  return apiRequest<Lesson>(`/lessons/${encodeURIComponent(lessonId)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteLessonApi(
  lessonId: string
): Promise<ApiEnvelope<{ id: string }>> {
  return apiRequest<{ id: string }>(`/lessons/${encodeURIComponent(lessonId)}`, {
    method: 'DELETE',
  });
}

export async function getLessonTopicsApi(
  lessonId: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<LessonTopic[]>> {
  return apiRequest<LessonTopic[]>(
    `/lessons/${encodeURIComponent(lessonId)}/topics`,
    {
      method: 'GET',
      signal,
    }
  );
}
