-- V005 / fresh schema: server-side close of expired ONLINE attempt.
-- Database role executing this routine MUST be limited to trusted Backend worker.
-- No public/student SQL execution grant; service layer must authorize the operation.
CREATE OR REPLACE FUNCTION olms_force_submit_expired_online(p_submission uuid)
RETURNS TABLE(submission_id uuid, submission_status text, was_retry boolean)
LANGUAGE plpgsql AS $$
DECLARE s submissions%ROWTYPE; deadline_at timestamptz; stable_token uuid;
BEGIN
 SELECT * INTO s FROM submissions WHERE id=p_submission FOR UPDATE;
 IF NOT FOUND OR s.source<>'ONLINE' THEN
   RAISE EXCEPTION 'DB04: online submission missing';
 END IF;
 IF s.status <> 'IN_PROGRESS' THEN
   -- Idempotent repeat of an already closed submission: do NOT enqueue another job.
   RETURN QUERY SELECT s.id,s.status::text,true;
   RETURN;
 END IF;
 SELECT LEAST(s.started_at + e.duration_minutes * interval '1 minute',e.closes_at)
 INTO deadline_at FROM exams e WHERE e.id=s.exam_id;
 IF deadline_at IS NULL OR clock_timestamp()<deadline_at THEN
   RAISE EXCEPTION 'DB04: auto-close only when expired';
 END IF;
 -- Serialize on submissions row: exactly one transaction chooses the stable token.
 stable_token:=gen_random_uuid();
 UPDATE submissions SET submit_token=stable_token,submitted_at=clock_timestamp(),
  status='SUBMITTED',updated_at=clock_timestamp() WHERE id=s.id;
 RETURN QUERY SELECT s.id,'SUBMITTED'::text,false;
END $$;

-- Defense-in-depth: by default deny public role from executing either function.
-- Project DBA must also grant appropriate schemas/functions only to the Backend role.
REVOKE ALL ON FUNCTION olms_submit_online(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION olms_force_submit_expired_online(uuid) FROM PUBLIC;
