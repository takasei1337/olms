-- SEC-01 / v1: DBA executes as non-superuser schema owner with CREATEROLE.
-- Roles have NOLOGIN; attach an independently managed service login explicitly.
-- Application user JWT/ownership MUST still be checked in Backend (roles != end-user RBAC).
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='olms_api_role') THEN
   CREATE ROLE olms_api_role NOLOGIN;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='olms_worker_role') THEN
   CREATE ROLE olms_worker_role NOLOGIN;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='olms_readonly_role') THEN
   CREATE ROLE olms_readonly_role NOLOGIN;
 END IF;
END $$;

-- Supabase security: deny direct Client execution of OLMS routines.
-- Keep existing service_role grants unchanged.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS routine_signature
        FROM pg_proc p
        JOIN pg_namespace n
            ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND (
              p.proname LIKE 'olms\_%'
              OR p.proname LIKE 'trg\_%'
              OR p.proname LIKE 'sp\_%'
          )
    LOOP
        EXECUTE format(
            'REVOKE EXECUTE ON ROUTINE %s
             FROM PUBLIC, anon, authenticated',
            r.routine_signature
        );
    END LOOP;
END $$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO olms_api_role,olms_worker_role,olms_readonly_role;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO olms_api_role,olms_worker_role,olms_readonly_role;
GRANT INSERT, UPDATE ON users,student_profiles,subjects,chapters,lessons,question_types,
 questions,question_versions,answer_options,form_templates,exams,exam_matrices,
 exam_grading_rules,exam_variants,exam_variant_questions,participants,submissions,
 scan_images TO olms_api_role;
-- Soft-delete is implemented by UPDATE; API role does not receive blanket hard DELETE.
GRANT INSERT ON audit_logs TO olms_api_role,olms_worker_role;
GRANT INSERT, UPDATE ON scan_images,submissions,questions TO olms_worker_role;
GRANT INSERT, UPDATE ON detected_answers,grades,submission_answer_grades TO olms_worker_role;
-- student_answers is writeable only through CAS security-definer routine.
-- Grading synchronization uses internal database triggers with definer ownership where needed.
REVOKE INSERT, UPDATE, DELETE ON student_answers FROM olms_api_role,olms_worker_role,olms_readonly_role;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM olms_api_role,olms_worker_role,olms_readonly_role;
-- Privileged routines run with fixed safe search_path, owned by the trusted migration owner.
-- REVOKE PUBLIC EXECUTE explicitly (PostgreSQL default grants it on newly created functions).
ALTER FUNCTION olms_autosave_online_cas(uuid,uuid,bigint,uuid,jsonb,text,jsonb)
  SECURITY DEFINER;
ALTER FUNCTION olms_autosave_online_cas(uuid,uuid,bigint,uuid,jsonb,text,jsonb)
  SET search_path=pg_catalog,public,pg_temp;
ALTER FUNCTION olms_submit_online(uuid,uuid) SECURITY DEFINER;
ALTER FUNCTION olms_submit_online(uuid,uuid) SET search_path=pg_catalog,public,pg_temp;
ALTER FUNCTION olms_force_submit_expired_online(uuid) SECURITY DEFINER;
ALTER FUNCTION olms_force_submit_expired_online(uuid) SET search_path=pg_catalog,public,pg_temp;
ALTER FUNCTION olms_bind_omr_scan(uuid,uuid,uuid,uuid,text) SECURITY DEFINER;
ALTER FUNCTION olms_bind_omr_scan(uuid,uuid,uuid,uuid,text) SET search_path=pg_catalog,public,pg_temp;
ALTER PROCEDURE sp_finalize_submission_grading(uuid,uuid) SECURITY DEFINER;
ALTER PROCEDURE sp_finalize_submission_grading(uuid,uuid) SET search_path=pg_catalog,public,pg_temp;
REVOKE ALL ON FUNCTION olms_autosave_online_cas(uuid,uuid,bigint,uuid,jsonb,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION olms_submit_online(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION olms_force_submit_expired_online(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION olms_bind_omr_scan(uuid,uuid,uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON PROCEDURE sp_finalize_submission_grading(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION olms_autosave_online_cas(uuid,uuid,bigint,uuid,jsonb,text,jsonb) TO olms_api_role;
GRANT EXECUTE ON FUNCTION olms_submit_online(uuid,uuid) TO olms_api_role;
GRANT EXECUTE ON FUNCTION olms_bind_omr_scan(uuid,uuid,uuid,uuid,text) TO olms_api_role;
GRANT EXECUTE ON FUNCTION olms_force_submit_expired_online(uuid) TO olms_worker_role;
GRANT EXECUTE ON PROCEDURE sp_finalize_submission_grading(uuid,uuid) TO olms_worker_role;
-- Required DB assertions: pg_has_role/has_function_privilege and explicit denied calls.
-- Do not GRANT roles to PUBLIC or to interactive student connections.
