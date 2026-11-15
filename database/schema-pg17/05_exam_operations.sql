-- Balanced variant allocation and controlled exam timing operations.
-- These routines are server-only; end-user authorization remains in the Express API.

CREATE OR REPLACE FUNCTION public.olms_assign_balanced_exam_variant(p_participant_id uuid)
RETURNS TABLE(variant_id uuid, variant_code text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_participant public.participants%ROWTYPE;
  v_variant public.exam_variants%ROWTYPE;
BEGIN
  SELECT *
  INTO v_participant
  FROM public.participants
  WHERE id = p_participant_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTICIPANT_NOT_FOUND';
  END IF;

  -- Serialize allocation per exam so concurrent starts cannot observe the same counts.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_participant.exam_id::text, 0));

  IF NOT EXISTS (
    SELECT 1
    FROM public.exams e
    WHERE e.id = v_participant.exam_id
      AND e.deleted_at IS NULL
      AND e.status = 'IN_PROGRESS'
      AND e.closes_at > clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'INVALID_EXAM_STATUS';
  END IF;

  IF v_participant.variant_id IS NOT NULL THEN
    RETURN QUERY
    SELECT ev.id, ev.variant_code::text
    FROM public.exam_variants ev
    WHERE ev.id = v_participant.variant_id
      AND ev.deleted_at IS NULL;
    RETURN;
  END IF;

  SELECT ev.*
  INTO v_variant
  FROM public.exam_variants ev
  LEFT JOIN public.participants assigned
    ON assigned.variant_id = ev.id
   AND assigned.exam_id = v_participant.exam_id
   AND assigned.deleted_at IS NULL
  WHERE ev.exam_id = v_participant.exam_id
    AND ev.deleted_at IS NULL
    AND (
      ev.is_root = FALSE
      OR NOT EXISTS (
        SELECT 1
        FROM public.exam_variants non_root
        WHERE non_root.exam_id = v_participant.exam_id
          AND non_root.deleted_at IS NULL
          AND non_root.is_root = FALSE
      )
    )
  GROUP BY ev.id
  ORDER BY count(assigned.id), ev.variant_code, ev.id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VARIANTS_NOT_GENERATED';
  END IF;

  UPDATE public.participants
  SET variant_id = v_variant.id,
      attendance_status = 'PRESENT',
      updated_at = clock_timestamp()
  WHERE id = v_participant.id;

  RETURN QUERY SELECT v_variant.id, v_variant.variant_code::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.olms_control_exam_timing(
  p_exam_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_closes_at timestamptz,
  p_reason text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS SETOF public.exams
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_exam public.exams%ROWTYPE;
  v_new_closes_at timestamptz;
BEGIN
  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 5 OR char_length(btrim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'INVALID_TIMING_REASON';
  END IF;

  IF p_action NOT IN ('CHANGE_CLOSE', 'END_EARLY') THEN
    RAISE EXCEPTION 'INVALID_TIMING_ACTION';
  END IF;

  SELECT *
  INTO v_exam
  FROM public.exams
  WHERE id = p_exam_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EXAM_NOT_FOUND';
  END IF;

  IF p_action = 'CHANGE_CLOSE' THEN
    IF v_exam.status NOT IN ('PUBLISHED', 'IN_PROGRESS') THEN
      RAISE EXCEPTION 'INVALID_EXAM_STATUS';
    END IF;
    IF p_closes_at IS NULL OR p_closes_at <= clock_timestamp() OR p_closes_at <= v_exam.opens_at THEN
      RAISE EXCEPTION 'INVALID_CLOSE_TIME';
    END IF;
    v_new_closes_at := p_closes_at;
  ELSE
    IF v_exam.status <> 'IN_PROGRESS' THEN
      RAISE EXCEPTION 'INVALID_EXAM_STATUS';
    END IF;
    v_new_closes_at := clock_timestamp();
  END IF;

  -- The immutability trigger permits closes_at changes only inside this controlled routine.
  PERFORM set_config('olms.allow_exam_timing_change', 'on', true);
  UPDATE public.exams
  SET closes_at = v_new_closes_at,
      updated_at = clock_timestamp()
  WHERE id = v_exam.id;

  INSERT INTO public.audit_logs (
    actor_user_id,
    action,
    entity_name,
    entity_id,
    old_value,
    new_value,
    ip_address,
    user_agent
  ) VALUES (
    p_actor_user_id,
    CASE WHEN p_action = 'END_EARLY' THEN 'EXAM_END_EARLY_REQUESTED' ELSE 'EXAM_CLOSE_TIME_CHANGED' END,
    'exams',
    v_exam.id,
    jsonb_build_object('status', v_exam.status, 'closes_at', v_exam.closes_at),
    jsonb_build_object('status', v_exam.status, 'closes_at', v_new_closes_at, 'reason', btrim(p_reason)),
    NULLIF(p_ip_address, '')::inet,
    left(NULLIF(p_user_agent, ''), 255)
  );

  RETURN QUERY
  SELECT e.*
  FROM public.exams e
  WHERE e.id = v_exam.id;
END;
$$;

REVOKE ALL ON FUNCTION public.olms_assign_balanced_exam_variant(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.olms_control_exam_timing(uuid, uuid, text, timestamptz, text, text, text) FROM PUBLIC, anon, authenticated;

