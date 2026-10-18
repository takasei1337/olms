-- OLMS DB-02..DB-06 | PostgreSQL >=18 | companion to 01/02/03
-- Apply on fresh schema AFTER 03; on existing DB only AFTER approved legacy upgrade.
-- Never execute as a substitute for preflight or backup.

-- DB-02: generation must carry one coherent snapshot of exam configuration.
CREATE OR REPLACE FUNCTION olms_guard_exam_generation_config()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'DRAFT' AND NEW.status = 'GENERATED' AND
     (NEW.subject_id,NEW.delivery_mode,NEW.total_questions,NEW.duration_minutes,
      NEW.opens_at,NEW.closes_at,NEW.total_score,NEW.form_template_id,NEW.code)
     IS DISTINCT FROM
     (OLD.subject_id,OLD.delivery_mode,OLD.total_questions,OLD.duration_minutes,
      OLD.opens_at,OLD.closes_at,OLD.total_score,OLD.form_template_id,OLD.code) THEN
      RAISE EXCEPTION 'DB02: cannot edit configuration in generate transition';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_olms_guard_generation_config ON exams;
CREATE TRIGGER trg_olms_guard_generation_config BEFORE UPDATE OF status ON exams
FOR EACH ROW EXECUTE FUNCTION olms_guard_exam_generation_config();

-- DB-02: no duplicate question across an exam variant and no mismatched root membership.
-- Checked at atomic DRAFT -> GENERATED boundary, after the candidate variants exist.
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
    IF EXISTS (
      SELECT 1 FROM exam_variants v WHERE v.exam_id=NEW.id AND v.deleted_at IS NULL
      AND (
        EXISTS (
          SELECT qv.question_id FROM exam_variant_questions evq
             JOIN question_versions qv ON qv.id=evq.question_version_id WHERE evq.variant_id=v_root
          EXCEPT
          SELECT qv.question_id FROM exam_variant_questions evq
             JOIN question_versions qv ON qv.id=evq.question_version_id WHERE evq.variant_id=v.id
        ) OR EXISTS (
          SELECT qv.question_id FROM exam_variant_questions evq
             JOIN question_versions qv ON qv.id=evq.question_version_id WHERE evq.variant_id=v.id
          EXCEPT
          SELECT qv.question_id FROM exam_variant_questions evq
             JOIN question_versions qv ON qv.id=evq.question_version_id WHERE evq.variant_id=v_root
        )
      )
    ) THEN RAISE EXCEPTION 'DB02: variant differs from root question set'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_olms_validate_variant_membership ON exams;
CREATE TRIGGER trg_olms_validate_variant_membership BEFORE UPDATE OF status ON exams
FOR EACH ROW EXECUTE FUNCTION olms_validate_variant_membership();

-- DB-03: moving objects from a frozen exam to another DRAFT exam must not bypass guards.
CREATE OR REPLACE FUNCTION olms_reject_immutable_reparent()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original_exam uuid; original_status text;
BEGIN
  IF TG_TABLE_NAME = 'exam_variant_questions' THEN
    IF NEW.variant_id IS NOT DISTINCT FROM OLD.variant_id THEN RETURN NEW; END IF;
    SELECT exam_id INTO original_exam FROM exam_variants WHERE id=OLD.variant_id;
  ELSE
    IF NEW.exam_id IS NOT DISTINCT FROM OLD.exam_id THEN RETURN NEW; END IF;
    original_exam := OLD.exam_id;
  END IF;
  SELECT status INTO original_status FROM exams WHERE id=original_exam;
  IF original_status IS DISTINCT FROM 'DRAFT' THEN
     RAISE EXCEPTION 'DB03: cannot reparent immutable % from exam %',TG_TABLE_NAME,original_exam;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_olms_matrix_reparent ON exam_matrices;
CREATE TRIGGER trg_olms_matrix_reparent BEFORE UPDATE OF exam_id ON exam_matrices
FOR EACH ROW EXECUTE FUNCTION olms_reject_immutable_reparent();
DROP TRIGGER IF EXISTS trg_olms_rule_reparent ON exam_grading_rules;
CREATE TRIGGER trg_olms_rule_reparent BEFORE UPDATE OF exam_id ON exam_grading_rules
FOR EACH ROW EXECUTE FUNCTION olms_reject_immutable_reparent();
DROP TRIGGER IF EXISTS trg_olms_variant_reparent ON exam_variants;
CREATE TRIGGER trg_olms_variant_reparent BEFORE UPDATE OF exam_id ON exam_variants
FOR EACH ROW EXECUTE FUNCTION olms_reject_immutable_reparent();
DROP TRIGGER IF EXISTS trg_olms_evq_reparent ON exam_variant_questions;
CREATE TRIGGER trg_olms_evq_reparent BEFORE UPDATE OF variant_id ON exam_variant_questions
FOR EACH ROW EXECUTE FUNCTION olms_reject_immutable_reparent();

-- DB-04: submit_token never changes once chosen. Require token on new online submit.
-- Existing historical rows without token are left untouched (no forged backfill).
CREATE OR REPLACE FUNCTION olms_protect_submit_token()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.submit_token IS NOT NULL AND NEW.submit_token IS DISTINCT FROM OLD.submit_token THEN
   RAISE EXCEPTION 'DB04: submit token immutable';
 END IF;
 IF OLD.source='ONLINE' AND OLD.status='IN_PROGRESS' AND NEW.status='SUBMITTED'
    AND NEW.submit_token IS NULL THEN
   RAISE EXCEPTION 'DB04: online submit requires token';
 END IF;
 IF NEW.participant_id IS DISTINCT FROM OLD.participant_id OR
    NEW.exam_id IS DISTINCT FROM OLD.exam_id OR
    NEW.source IS DISTINCT FROM OLD.source OR
    NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    RAISE EXCEPTION 'DB04: submission identity/start immutable';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_olms_protect_submit_token ON submissions;
CREATE TRIGGER trg_olms_protect_submit_token BEFORE UPDATE ON submissions
FOR EACH ROW EXECUTE FUNCTION olms_protect_submit_token();

-- Token-based exactly-once semantic: row lock guarantees sequential retry behavior.
-- The service validates JWT/owner before calling; never trust client participant_id.
-- Explicit deadline boundary: manual Student submit only before deadline.
CREATE OR REPLACE FUNCTION olms_submit_online(p_submission uuid,p_token uuid)
RETURNS TABLE(submission_id uuid, submission_status text, was_retry boolean)
LANGUAGE plpgsql AS $$
DECLARE s submissions%ROWTYPE; deadline_at timestamptz;
BEGIN
 IF p_token IS NULL THEN RAISE EXCEPTION 'DB04: missing idempotency key'; END IF;
 SELECT * INTO s FROM submissions WHERE id=p_submission FOR UPDATE;
 IF NOT FOUND OR s.source<>'ONLINE' THEN RAISE EXCEPTION 'DB04: online submission missing'; END IF;
 IF s.submit_token IS NOT NULL THEN
   IF s.submit_token<>p_token THEN RAISE EXCEPTION 'DB04: conflicting submit token'; END IF;
   RETURN QUERY SELECT s.id,s.status::text,true;
   RETURN;
 END IF;
 IF s.status<>'IN_PROGRESS' THEN RAISE EXCEPTION 'DB04: submission already closed'; END IF;
 SELECT LEAST(s.started_at + e.duration_minutes * INTERVAL '1 minute',e.closes_at)
   INTO deadline_at FROM exams e WHERE e.id=s.exam_id;
 IF deadline_at IS NULL OR clock_timestamp()>=deadline_at THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SESSION_EXPIRED';
 END IF;
 UPDATE submissions SET submit_token=p_token,submitted_at=clock_timestamp(),status='SUBMITTED',
   updated_at=clock_timestamp() WHERE id=s.id;
 RETURN QUERY SELECT s.id,'SUBMITTED'::text,false;
END $$;

-- DB-04: serialize autosave against submit by locking submission BEFORE deadline read.
-- clock_timestamp (not transaction-start now()) is authoritative.
CREATE OR REPLACE FUNCTION olms_check_answer_deadline()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s submissions%ROWTYPE; deadline_at timestamptz;
BEGIN
 SELECT * INTO s FROM submissions WHERE id=NEW.submission_id FOR UPDATE;
 IF NOT FOUND OR s.source <> 'ONLINE' OR s.status <> 'IN_PROGRESS' THEN
   RAISE EXCEPTION 'DB04: autosave forbidden for closed/non-online submission';
 END IF;
 SELECT LEAST(s.started_at + (e.duration_minutes * INTERVAL '1 minute'),e.closes_at)
 INTO deadline_at FROM exams e WHERE e.id=s.exam_id;
 IF clock_timestamp() >= deadline_at THEN
   RAISE EXCEPTION 'DB04: autosave deadline passed';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_olms_answer_deadline ON student_answers;
CREATE TRIGGER trg_olms_answer_deadline BEFORE INSERT OR UPDATE OF
 client_sequence,selected_options,answer_text,response_data ON student_answers
FOR EACH ROW EXECUTE FUNCTION olms_check_answer_deadline();

-- DB-05/DB-03: audit trail is append-only even under TRUNCATE.
CREATE OR REPLACE FUNCTION olms_no_truncate_audit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'DB03: audit_logs TRUNCATE forbidden';
END $$;
DROP TRIGGER IF EXISTS trg_protect_audit_logs_truncate ON audit_logs;
CREATE TRIGGER trg_protect_audit_logs_truncate BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION olms_no_truncate_audit();

-- DB-06: P-03 composite FK must preserve the NOT NULL exam_id.
-- This block verifies that canonical FKs exist and have RESTRICT/NO ACTION semantics.
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint k WHERE k.conname='fk_participants_variant_exam'
   AND k.conrelid='participants'::regclass AND k.confdeltype IN ('a','r')) OR
    NOT EXISTS (
  SELECT 1 FROM pg_constraint k WHERE k.conname='fk_submissions_variant_exam'
   AND k.conrelid='submissions'::regclass AND k.confdeltype IN ('a','r'))
 THEN RAISE EXCEPTION 'DB06: composite variant/exam FK must be RESTRICT or NO ACTION'; END IF;
END $$;


-- DB-04: Grade is a projection of final per-question SAG entries; do not edit history by SQL.
CREATE OR REPLACE FUNCTION olms_validate_grade_totals()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n_expected integer; n_final integer; computed_total numeric;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'DB04: grade delete prohibited'; END IF;
 SELECT total_questions INTO n_expected FROM exams e
  JOIN submissions s ON s.exam_id=e.id WHERE s.id=NEW.submission_id;
 SELECT count(*),COALESCE(sum(earned_score),0) INTO n_final,computed_total
 FROM submission_answer_grades
 WHERE submission_id=NEW.submission_id AND is_final;
 IF n_expected IS NULL OR n_final<>n_expected OR NEW.total_score<>computed_total THEN
  RAISE EXCEPTION 'DB04: Grade requires full final answer grades and exact total';
 END IF;
 IF NEW.correct_count + NEW.wrong_count + NEW.blank_count > n_expected THEN
   RAISE EXCEPTION 'DB04: grade question count exceeds exam length';
 END IF;
 IF TG_OP='UPDATE' AND NEW.submission_id IS DISTINCT FROM OLD.submission_id THEN
   RAISE EXCEPTION 'DB04: grade submission_id immutable';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_olms_grade_totals ON grades;
CREATE TRIGGER trg_olms_grade_totals BEFORE INSERT OR UPDATE OR DELETE ON grades
FOR EACH ROW EXECUTE FUNCTION olms_validate_grade_totals();

CREATE OR REPLACE FUNCTION olms_audit_grade_regrade()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.total_score IS DISTINCT FROM OLD.total_score OR
    NEW.correct_count IS DISTINCT FROM OLD.correct_count OR
    NEW.wrong_count IS DISTINCT FROM OLD.wrong_count OR
    NEW.blank_count IS DISTINCT FROM OLD.blank_count THEN
  INSERT INTO audit_logs(actor_user_id,action,entity_name,entity_id,old_value,new_value)
   VALUES(NEW.graded_by,'GRADE_RECALCULATED','grades',NEW.id,
      to_jsonb(OLD),to_jsonb(NEW));
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_olms_audit_grade_regrade ON grades;
CREATE TRIGGER trg_olms_audit_grade_regrade AFTER UPDATE ON grades
FOR EACH ROW EXECUTE FUNCTION olms_audit_grade_regrade();

-- CAS belongs to V004 and to the fresh-install entrypoint, not V003.
