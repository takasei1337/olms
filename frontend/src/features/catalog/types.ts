export interface Subject {
  id: string;
  code: string;
  name: string;
  description: string | null;
  created_by?: string;
}

export interface Chapter {
  id: string;
  subject_id: string;
  code: string | null;
  name: string;
  order_no: number;
  created_at?: string;
  updated_at?: string;
}

export interface Lesson {
  id: string;
  chapter_id: string;
  code: string | null;
  name: string;
  order_no: number;
  created_at?: string;
  updated_at?: string;
}

export interface LessonTopic {
  topic_tag: string;
  total_questions: number;
  active_questions: number;
}

export interface CreateSubjectPayload {
  code: string;
  name: string;
  description?: string | null;
}

export interface PatchSubjectPayload {
  code?: string;
  name?: string;
  description?: string | null;
}

export interface CreateChapterPayload {
  name: string;
  code?: string | null;
  order_no?: number;
}

export interface PatchChapterPayload {
  name?: string;
  code?: string | null;
  order_no?: number;
}

export interface CreateLessonPayload {
  name: string;
  code?: string | null;
  order_no?: number;
}

export interface PatchLessonPayload {
  name?: string;
  code?: string | null;
  order_no?: number;
}

export interface CatalogPaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}
