-- Allow exam variants generated for the same exam to select distinct or overlapping question subsets
-- from the question bank (e.g. preferring least-used questions first while allowing cross-variant reuse
-- when bank capacity is smaller than variant_count * total_questions).
-- Duplicate questions within the same variant are still strictly forbidden.

CREATE OR REPLACE FUNCTION olms_validate_variant_membership()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_root uuid;
BEGIN
  IF OLD.status='DRAFT' AND NEW.status='GENERATED' THEN
    SELECT id INTO v_root FROM exam_variants
     WHERE exam_id=NEW.id AND is_root AND deleted_at IS NULL;
    IF v_root IS NULL THEN RAISE EXCEPTION 'DB02: missing root variant'; END IF;
    IF EXISTS (
      SELECT 1 FROM exam_matrices m
      WHERE m.exam_id=NEW.id AND m.deleted_at IS NULL
      AND NOT EXISTS (
       SELECT 1 FROM exam_grading_rules gr WHERE gr.exam_id=m.exam_id
         AND gr.question_type_id=m.question_type_id AND gr.deleted_at IS NULL)
    ) THEN RAISE EXCEPTION 'DB02: grading rule missing for exam matrix question type'; END IF;
    IF EXISTS (
       SELECT 1 FROM exam_variant_questions q
       JOIN exam_variants v ON v.id=q.variant_id
       JOIN question_versions qv ON qv.id=q.question_version_id
       WHERE v.exam_id=NEW.id AND v.deleted_at IS NULL
       GROUP BY v.id,qv.question_id HAVING count(*)>1
    ) THEN RAISE EXCEPTION 'DB02: duplicate question in exam variant'; END IF;
  END IF;
  RETURN NEW;
END $$;
