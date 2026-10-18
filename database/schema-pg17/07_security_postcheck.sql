-- Run only after fresh DDL (or V006), with role setup complete.
DO $$ BEGIN
 IF NOT has_function_privilege('olms_api_role','olms_autosave_online_cas(uuid,uuid,bigint,uuid,jsonb,text,jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'API role needs CAS permission'; END IF;
 IF has_function_privilege('olms_readonly_role','olms_autosave_online_cas(uuid,uuid,bigint,uuid,jsonb,text,jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'read-only role must not execute CAS'; END IF;
 IF has_function_privilege('olms_api_role','olms_force_submit_expired_online(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'API must not run worker auto-close'; END IF;
 IF has_table_privilege('olms_readonly_role','student_answers','UPDATE') THEN
  RAISE EXCEPTION 'Read-only role cannot update answers'; END IF;
 IF has_table_privilege('olms_api_role','audit_logs','DELETE') THEN
  RAISE EXCEPTION 'API must not delete audit'; END IF;
END $$;
