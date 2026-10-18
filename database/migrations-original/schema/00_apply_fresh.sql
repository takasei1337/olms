-- psql -X -v ON_ERROR_STOP=1 -f OLMS_P08_Canonical_DDL/00_apply_fresh.sql
-- Must be executed only against empty, approved PostgreSQL 18+ database.
\set ON_ERROR_STOP on
BEGIN;
\ir 01_extensions_and_types.sql
\ir 02_tables.sql
\ir 03_indexes_and_fks.sql
\ir 04_integrity_hardening.sql
\ir ../OLMS_ARC01_Autosave_CAS.sql
\ir 05_submission_deadline_recovery.sql
\ir 06_roles_and_permissions.sql
COMMIT;
