-- ARC-01: per-question CAS on server revision + same-token immediate retry.
-- App service MUST authenticate STUDENT, check participant ownership and validate
-- response_kind/response_data against immutable QuestionVersion before invoking.
-- PostgreSQL 18; caller transaction. Never let Student connect to DB directly.
ALTER TABLE student_answers ADD COLUMN IF NOT EXISTS last_edit_token UUID;

CREATE OR REPLACE FUNCTION olms_autosave_online_cas(
 p_submission UUID, p_evq UUID, p_expected_sequence BIGINT, p_edit_token UUID,
 p_selected_options JSONB, p_answer_text TEXT, p_response_data JSONB
) RETURNS TABLE(accepted_sequence BIGINT, was_retry BOOLEAN, saved_at TIMESTAMPTZ)
LANGUAGE plpgsql AS $$
DECLARE s submissions%ROWTYPE; a student_answers%ROWTYPE;
 v_deadline TIMESTAMPTZ; v_saved TIMESTAMPTZ; v_answer_exists BOOLEAN;
BEGIN
 IF p_expected_sequence IS NULL OR p_expected_sequence < 0 OR p_edit_token IS NULL THEN
   RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='AUTOSAVE_INVALID_REVISION_OR_TOKEN';
 END IF;
 SELECT * INTO s FROM submissions WHERE id=p_submission FOR UPDATE;
 IF NOT FOUND OR s.source <> 'ONLINE' THEN
   RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='SUBMISSION_NOT_ONLINE';
 END IF;
 -- Variant validation before any retry acknowledgement; API must additionally authorize JWT ownership.
 IF s.variant_id IS NULL OR NOT EXISTS (
   SELECT 1 FROM exam_variant_questions q WHERE q.id=p_evq AND q.variant_id=s.variant_id
 ) THEN
   RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='ANSWER_NOT_IN_ASSIGNED_VARIANT';
 END IF;
 SELECT * INTO a FROM student_answers
   WHERE submission_id=p_submission AND exam_variant_question_id=p_evq FOR UPDATE;
 v_answer_exists := FOUND; -- Persist result before the next SELECT overwrites FOUND.
 -- Read-only ACK replay is legal after deadline or SUBMITTED, provided the last committed
 -- revision, token AND exact payload match. Never create or modify an answer here.
 IF v_answer_exists AND a.last_edit_token=p_edit_token THEN
   IF a.client_sequence=p_expected_sequence+1
       AND a.selected_options IS NOT DISTINCT FROM p_selected_options
       AND a.answer_text IS NOT DISTINCT FROM p_answer_text
       AND a.response_data IS NOT DISTINCT FROM p_response_data THEN
     RETURN QUERY SELECT a.client_sequence, TRUE, a.updated_at;
     RETURN;
   END IF;
   RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='EDIT_TOKEN_REUSED_DIFFERENT_PAYLOAD';
 END IF;
 IF s.status <> 'IN_PROGRESS' THEN
   RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='SUBMISSION_LOCKED';
 END IF;
 SELECT LEAST(s.started_at+e.duration_minutes*INTERVAL '1 minute',e.closes_at)
 INTO v_deadline FROM exams e WHERE e.id=s.exam_id;
 IF v_deadline IS NULL OR clock_timestamp() >= v_deadline THEN
   RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='SESSION_EXPIRED';
 END IF;
 IF p_expected_sequence <> COALESCE(a.client_sequence,0) THEN
   RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='ANSWER_REVISION_CONFLICT';
 END IF;
 v_saved := clock_timestamp();
 IF v_answer_exists THEN
   UPDATE student_answers SET client_sequence=p_expected_sequence+1,
     last_edit_token=p_edit_token,selected_options=p_selected_options,
     answer_text=p_answer_text,response_data=p_response_data,updated_at=v_saved
   WHERE id=a.id;
 ELSE
   INSERT INTO student_answers(submission_id,exam_variant_question_id,client_sequence,
     last_edit_token,selected_options,answer_text,response_data,created_at,updated_at)
   VALUES(p_submission,p_evq,1,p_edit_token,p_selected_options,p_answer_text,
     p_response_data,v_saved,v_saved);
 END IF;
 RETURN QUERY SELECT p_expected_sequence+1, FALSE, v_saved;
END $$;

-- Direct token-only changes are forbidden; token changes must accompany a new sequence.
CREATE OR REPLACE FUNCTION olms_guard_answer_edit_token()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.last_edit_token IS DISTINCT FROM OLD.last_edit_token THEN
   IF NEW.client_sequence <= OLD.client_sequence THEN
     RAISE EXCEPTION 'ARC01: edit token requires an increased client_sequence';
   END IF;
   IF (SELECT status FROM submissions WHERE id=NEW.submission_id)<>'IN_PROGRESS' THEN
     RAISE EXCEPTION 'ARC01: edit token frozen after submission';
   END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_olms_guard_answer_edit_token ON student_answers;
CREATE TRIGGER trg_olms_guard_answer_edit_token
 BEFORE UPDATE OF last_edit_token ON student_answers FOR EACH ROW
 EXECUTE FUNCTION olms_guard_answer_edit_token();
