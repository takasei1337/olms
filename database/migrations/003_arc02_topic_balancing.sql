-- ARC-02: Hybrid Exam Topic Balancing ("Chống lệch tủ")
-- Additive migration for questions.topic_tag & exam_matrices.max_questions_per_topic

BEGIN;

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS topic_tag VARCHAR(100);

ALTER TABLE exam_matrices
  ADD COLUMN IF NOT EXISTS max_questions_per_topic SMALLINT DEFAULT 2;

ALTER TABLE exam_matrices
  DROP CONSTRAINT IF EXISTS chk_exam_matrices_topic_cap;

ALTER TABLE exam_matrices
  ADD CONSTRAINT chk_exam_matrices_topic_cap
  CHECK (max_questions_per_topic IS NULL OR max_questions_per_topic > 0);

CREATE INDEX IF NOT EXISTS idx_questions_topic_active
  ON questions (lesson_id, topic_tag, status)
  WHERE deleted_at IS NULL;

COMMIT;
