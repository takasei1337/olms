-- Persist participant Excel import preview sessions in PostgreSQL instead of Node.js RAM
-- so previews survive server restarts and work across multiple backend instances.

CREATE TABLE IF NOT EXISTS public.participant_import_previews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id       UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rows          JSONB NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  expires_at    TIMESTAMPTZ NOT NULL,
  committed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_participant_import_previews_rows_array CHECK (jsonb_typeof(rows) = 'array'),
  CONSTRAINT chk_participant_import_previews_status CHECK (status IN ('PENDING', 'COMMITTING', 'COMMITTED'))
);

CREATE INDEX IF NOT EXISTS idx_participant_import_previews_exam_expires
  ON public.participant_import_previews (exam_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_participant_import_previews_pending_expires
  ON public.participant_import_previews (expires_at)
  WHERE status = 'PENDING';
