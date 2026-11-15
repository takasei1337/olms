-- Run only after fresh DDL (or V006), with role setup complete.
DO $$ BEGIN
 IF NOT has_function_privilege('olms_api_role','olms_autosave_online_cas(uuid,uuid,bigint,uuid,jsonb,text,jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'API role needs CAS permission'; END IF;
 IF has_function_privilege('olms_readonly_role','olms_autosave_online_cas(uuid,uuid,bigint,uuid,jsonb,text,jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'read-only role must not execute CAS'; END IF;
 IF has_function_privilege('olms_api_role','olms_force_submit_expired_online(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'API must not run worker auto-close'; END IF;
 IF NOT has_function_privilege('olms_api_role','olms_assign_balanced_exam_variant(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'API role needs balanced variant allocation permission'; END IF;
 IF NOT has_function_privilege('olms_api_role','olms_control_exam_timing(uuid,uuid,text,timestamptz,text,text,text)','EXECUTE') THEN
  RAISE EXCEPTION 'API role needs controlled exam timing permission'; END IF;
 IF has_function_privilege('olms_readonly_role','olms_control_exam_timing(uuid,uuid,text,timestamptz,text,text,text)','EXECUTE') THEN
  RAISE EXCEPTION 'read-only role must not control exam timing'; END IF;
 IF has_table_privilege('olms_readonly_role','student_answers','UPDATE') THEN
  RAISE EXCEPTION 'Read-only role cannot update answers'; END IF;
 IF has_table_privilege('olms_api_role','audit_logs','DELETE') THEN
  RAISE EXCEPTION 'API must not delete audit'; END IF;
END $$;
