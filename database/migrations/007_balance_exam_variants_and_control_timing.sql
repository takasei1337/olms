-- Balance exam variants under concurrency and add audited timing controls.
\ir ../schema-pg17/05_exam_operations.sql

CREATE OR REPLACE FUNCTION public.trg_enforce_exam_configuration_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'Khong the xoa ky thi khi dang o trang thai % (chi duoc phep xoa khi o trang thai DRAFT)', OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status <> 'DRAFT' THEN
    IF (NEW.subject_id IS DISTINCT FROM OLD.subject_id) OR
       (NEW.delivery_mode IS DISTINCT FROM OLD.delivery_mode) OR
       (NEW.total_questions IS DISTINCT FROM OLD.total_questions) OR
       (NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes) OR
       (NEW.opens_at IS DISTINCT FROM OLD.opens_at) OR
       ((NEW.closes_at IS DISTINCT FROM OLD.closes_at) AND
        COALESCE(current_setting('olms.allow_exam_timing_change', true), '') <> 'on') OR
       (NEW.total_score IS DISTINCT FROM OLD.total_score) OR
       (NEW.form_template_id IS DISTINCT FROM OLD.form_template_id) OR
       (NEW.code IS DISTINCT FROM OLD.code) THEN
      RAISE EXCEPTION 'Khong the thay doi cau hinh ky thi khi ky thi dang o trang thai %', OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.olms_assign_balanced_exam_variant(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.olms_control_exam_timing(uuid, uuid, text, timestamptz, text, text, text) TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'olms_api_role') THEN
    GRANT EXECUTE ON FUNCTION public.olms_assign_balanced_exam_variant(uuid) TO olms_api_role;
    GRANT EXECUTE ON FUNCTION public.olms_control_exam_timing(uuid, uuid, text, timestamptz, text, text, text) TO olms_api_role;
  END IF;
END $$;

