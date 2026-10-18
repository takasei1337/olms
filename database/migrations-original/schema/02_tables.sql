-- =====================================================================
-- OLMS - He thong thi trac nghiem
-- 02_tables.sql
-- Muc dich: CREATE TABLE day du khoa chinh, kieu du lieu, DEFAULT, CHECK.
-- Khong khai bao FOREIGN KEY o day (xem 03_indexes_and_fks.sql) de tranh
-- loi phu thuoc vong tron / thu tu tao bang khi chay script lan dau.
-- Thu tu chay: 01 -> 02 -> 03
-- =====================================================================
 
-- =====================================================================
-- PHAN VUNG 1: XAC THUC & NGUOI DUNG (Identity & Access Management)
-- =====================================================================
 
-- PostgreSQL 18 native uuidv7() is used for all primary keys.
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuidv7(),
  username        VARCHAR(50)  NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  full_name       VARCHAR(150) NOT NULL,
  email           VARCHAR(150),
  phone           VARCHAR(20),
  role            user_role_enum NOT NULL DEFAULT 'STUDENT',
  status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'LOCKED', 'INACTIVE'))
);
 
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuidv7(),
  actor_user_id   UUID,
  action          VARCHAR(50)  NOT NULL,
  entity_name     VARCHAR(100) NOT NULL,
  entity_id       UUID,
  old_value       JSONB,
  new_value       JSONB,
  ip_address      INET,
  user_agent      VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  -- Bang append-only: khong updated_at / soft delete (nhat ky khong duoc sua/xoa)
);
 

CREATE TABLE student_profiles (
  id              UUID PRIMARY KEY DEFAULT uuidv7(),
  student_code    VARCHAR(30)  NOT NULL,
  full_name       VARCHAR(150) NOT NULL,
  email           VARCHAR(150),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  CONSTRAINT uq_student_profiles_code UNIQUE (student_code)
);

-- =====================================================================
-- PHAN VUNG 2: NGAN HANG CAU HOI & PHIEN BAN (Question Bank & Versioning)
-- =====================================================================
 
CREATE TABLE subjects (
  id              UUID PRIMARY KEY DEFAULT uuidv7(),
  code            VARCHAR(20)  NOT NULL,
  name            VARCHAR(150) NOT NULL,
  description     TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID
);

CREATE TABLE chapters (
  id              UUID PRIMARY KEY DEFAULT uuidv7(),
  subject_id      UUID NOT NULL,
  code            VARCHAR(20),
  name            VARCHAR(150) NOT NULL,
  order_no        SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID
);
 
CREATE TABLE lessons (
  id              UUID PRIMARY KEY DEFAULT uuidv7(),
  chapter_id      UUID NOT NULL,
  code            VARCHAR(20),
  name            VARCHAR(150) NOT NULL,
  order_no        SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID
);
 
CREATE TABLE question_types (
  id              UUID PRIMARY KEY DEFAULT uuidv7(),
  code            VARCHAR(30)  NOT NULL,  -- vd: SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE, FILL_BLANK
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID
);
 
CREATE TABLE questions (
  id                      UUID PRIMARY KEY DEFAULT uuidv7(),
  lesson_id               UUID,
  type_id                 UUID NOT NULL,
  status                  VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  ai_similarity_score     NUMERIC(5,4),
  ai_check_status         VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  is_duplicate_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  ai_audit_metadata       JSONB,
  created_by              UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at              TIMESTAMPTZ,
  deleted_by              UUID,
  CONSTRAINT chk_questions_status CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED')),
  CONSTRAINT chk_questions_ai_check_status CHECK (ai_check_status IN ('PENDING', 'CHECKED', 'OVERRIDDEN', 'SKIPPED_TIMEOUT')),
  CONSTRAINT chk_questions_ai_similarity_score CHECK (ai_similarity_score IS NULL OR (ai_similarity_score >= 0 AND ai_similarity_score <= 1))
);

CREATE TABLE question_versions (
  id                UUID PRIMARY KEY DEFAULT uuidv7(),
  question_id       UUID NOT NULL,
  version_no        INT  NOT NULL,
  type_id           UUID NOT NULL,
  difficulty_level  difficulty_level_enum NOT NULL,
  content           TEXT NOT NULL,
  media_url         VARCHAR(500),
  explanation       TEXT,
  options_snapshot  JSONB NOT NULL,
  is_current        BOOLEAN NOT NULL DEFAULT TRUE,
  frozen_at         TIMESTAMPTZ,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ban ghi bat bien sau khi dong bang cho de thi: khong updated_at / soft delete
  CONSTRAINT uq_question_versions_question_version UNIQUE (question_id, version_no),
  CONSTRAINT chk_qv_options_snapshot_type CHECK (jsonb_typeof(options_snapshot) IN ('array', 'object'))
);
 
CREATE TABLE answer_options (
  id              UUID PRIMARY KEY DEFAULT uuidv7(),
  question_id     UUID NOT NULL,
  content         TEXT NOT NULL,
is_correct      BOOLEAN NOT NULL DEFAULT FALSE,
match_key       VARCHAR(50),
  order_no        SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID
);
 
-- =====================================================================
-- PHAN VUNG 3: KY THI, MA TRAN & DE TRAO (Exam & Variants)
-- =====================================================================
 
CREATE TABLE form_templates (
  id              UUID PRIMARY KEY DEFAULT uuidv7(),
  code            VARCHAR(50)  NOT NULL,
  version         VARCHAR(20)  NOT NULL DEFAULT '1.0',
  name            VARCHAR(150) NOT NULL,
  num_questions   SMALLINT     NOT NULL,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  layout_config   JSONB        NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  CONSTRAINT chk_form_templates_num_questions CHECK (num_questions > 0),
  CONSTRAINT chk_form_templates_layout_config_obj CHECK (jsonb_typeof(layout_config) = 'object'),
  CONSTRAINT chk_form_templates_layout_config CHECK (
    layout_config ? 'markers' AND 
    layout_config ? 'roi' AND 
    layout_config ? 'bubble_dimensions'
  )
);

CREATE TABLE exams (
  id                      UUID PRIMARY KEY DEFAULT uuidv7(),
  code                    VARCHAR(30)  NOT NULL,
  name                    VARCHAR(200) NOT NULL,
  subject_id              UUID NOT NULL,
  form_template_id        UUID,
  status                  VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
  delivery_mode           VARCHAR(20)  NOT NULL DEFAULT 'ONLINE',
  total_questions         SMALLINT     NOT NULL,
  duration_minutes        SMALLINT     NOT NULL,
  opens_at                TIMESTAMPTZ  NOT NULL,
  closes_at               TIMESTAMPTZ  NOT NULL,
  total_score             NUMERIC(5,2) NOT NULL DEFAULT 10,
  result_visibility_mode  VARCHAR(20)  NOT NULL DEFAULT 'HIDDEN',
  result_published_at     TIMESTAMPTZ,
  result_published_by     UUID,
  created_by              UUID,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at              TIMESTAMPTZ,
  deleted_by              UUID,
  CONSTRAINT chk_exams_status CHECK (status IN ('DRAFT', 'GENERATED', 'PUBLISHED', 'IN_PROGRESS', 'ENDED', 'RESULT_PUBLISHED', 'ARCHIVED', 'CANCELLED')),
  CONSTRAINT chk_exams_delivery_mode   CHECK (delivery_mode IN ('ONLINE', 'PAPER', 'BOTH')),
  CONSTRAINT chk_exams_result_mode     CHECK (result_visibility_mode IN ('HIDDEN', 'SCORE_ONLY', 'SCORE_AND_STATUS', 'FULL_REVIEW')),
  CONSTRAINT chk_exams_total_questions CHECK (total_questions > 0),
  CONSTRAINT chk_exams_total_score     CHECK (total_score > 0),
  CONSTRAINT chk_exams_duration        CHECK (duration_minutes > 0),
  CONSTRAINT chk_exams_time_range      CHECK (closes_at > opens_at),
  CONSTRAINT chk_exams_paper_form_template CHECK (
    delivery_mode='ONLINE' OR (delivery_mode IN ('PAPER','BOTH') AND form_template_id IS NOT NULL)
  ),
  CONSTRAINT chk_exams_result_published CHECK (
     (result_published_at IS NULL AND result_published_by IS NULL AND status NOT IN ('RESULT_PUBLISHED','ARCHIVED'))
     OR (result_published_at IS NOT NULL AND result_published_by IS NOT NULL AND status IN ('RESULT_PUBLISHED','ARCHIVED'))
  )
);

CREATE TABLE exam_matrices (
  id                  UUID PRIMARY KEY DEFAULT uuidv7(),
  exam_id             UUID NOT NULL,
  chapter_id          UUID,
  lesson_id           UUID,
  question_type_id    UUID NOT NULL,
  difficulty_level    difficulty_level_enum NOT NULL,
  num_questions       SMALLINT NOT NULL,
  score_per_question  NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  deleted_by          UUID,
CONSTRAINT chk_exam_matrices_num_questions CHECK (num_questions > 0), 
CONSTRAINT chk_exam_matrices_lesson_chapter CHECK (lesson_id IS NULL OR chapter_id IS NOT NULL),
  CONSTRAINT chk_exam_matrices_score_per_question CHECK (score_per_question > 0)
);
 
CREATE TABLE exam_grading_rules (
  id                     UUID PRIMARY KEY DEFAULT uuidv7(),
  exam_id                UUID NOT NULL,
  question_type_id       UUID NOT NULL,
  scoring_mode           VARCHAR(20)  NOT NULL DEFAULT 'EXACT_MATCH',
  allow_negative_marking BOOLEAN      NOT NULL DEFAULT FALSE,
  penalty_for_wrong      BOOLEAN      NOT NULL DEFAULT TRUE,
  case_sensitive         BOOLEAN      NOT NULL DEFAULT FALSE,
rounding_precision     SMALLINT     NOT NULL DEFAULT 2,
rounding_rule          VARCHAR(20)  NOT NULL DEFAULT 'ROUND_HALF_UP',

  created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ,
  deleted_by             UUID,
CONSTRAINT chk_egr_scoring_mode CHECK (scoring_mode IN ('EXACT_MATCH', 'PARTIAL_CREDIT')),
CONSTRAINT chk_egr_rounding_rule CHECK (rounding_rule IN ('ROUND_HALF_UP', 'ROUND_DOWN', 'NONE'))
);

CREATE TABLE exam_variants (
  id              UUID PRIMARY KEY DEFAULT uuidv7(),
  exam_id         UUID NOT NULL,
  variant_code    VARCHAR(10) NOT NULL,  -- vd: "132", "209"
  is_root         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  deleted_by      UUID,
  CONSTRAINT uq_exam_variants_id_exam UNIQUE (id, exam_id)
);

CREATE TABLE exam_variant_questions (
  id                   UUID PRIMARY KEY DEFAULT uuidv7(),
  variant_id           UUID NOT NULL,
  question_version_id  UUID NOT NULL,
  position_in_variant  SMALLINT NOT NULL,
  option_order         JSONB NOT NULL,
  score                NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_evq_variant_position UNIQUE (variant_id, position_in_variant),
  CONSTRAINT uq_evq_variant_question UNIQUE (variant_id, question_version_id),
  CONSTRAINT chk_evq_position_positive CHECK (position_in_variant > 0),
  CONSTRAINT chk_evq_score CHECK (score >= 0),
  CONSTRAINT chk_evq_option_order_array CHECK (jsonb_typeof(option_order) = 'array')
);

-- =====================================================================
-- PHAN VUNG 4: PHONG THI, BAI LAM & CHAM DIEM (Examination & Grading Engine)
-- =====================================================================
 
CREATE TABLE participants (
  id                       UUID PRIMARY KEY DEFAULT uuidv7(),
  exam_id                  UUID NOT NULL,
  student_user_id          UUID NOT NULL,
  student_profile_id       UUID NOT NULL,
  student_code             VARCHAR(30)  NOT NULL,
  full_name_snapshot       VARCHAR(150) NOT NULL,
  variant_id               UUID,
  seat_no                  VARCHAR(10),
  status                   VARCHAR(20)  NOT NULL DEFAULT 'REGISTERED',
  attendance_status        VARCHAR(20)  NOT NULL DEFAULT 'NOT_MARKED',
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at               TIMESTAMPTZ,
  deleted_by               UUID,
  CONSTRAINT uq_participants_id_exam UNIQUE (id, exam_id),
  CONSTRAINT uq_participants_exam_profile UNIQUE (exam_id, student_profile_id),
  CONSTRAINT uq_participants_exam_code UNIQUE (exam_id, student_code),
  CONSTRAINT chk_participants_status CHECK (status IN ('REGISTERED', 'IN_PROGRESS', 'COMPLETED')),
  CONSTRAINT chk_participants_attendance CHECK (attendance_status IN ('NOT_MARKED', 'PRESENT', 'ABSENT'))
);

CREATE TABLE submissions (
  id               UUID PRIMARY KEY DEFAULT uuidv7(),
participant_id   UUID NOT NULL,
exam_id          UUID NOT NULL,
variant_id       UUID,
source           VARCHAR(10)  NOT NULL DEFAULT 'ONLINE',
started_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  submitted_at     TIMESTAMPTZ,
  status           VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
  raw_score        NUMERIC(5,2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  submit_token UUID,
  CONSTRAINT uq_submissions_id_exam UNIQUE(id,exam_id),
  CONSTRAINT uq_submissions_participant UNIQUE(participant_id),
CONSTRAINT chk_submissions_source CHECK (source IN ('ONLINE', 'PAPER')),
CONSTRAINT chk_submissions_status CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'GRADING', 'GRADED', 'FLAGGED', 'VOID')),
  CONSTRAINT chk_submissions_submitted_started CHECK (submitted_at IS NULL OR submitted_at >= started_at),
  CONSTRAINT chk_submissions_status_submitted_at CHECK (
    (status = 'IN_PROGRESS' AND submitted_at IS NULL) OR
    (status IN ('SUBMITTED', 'GRADING', 'GRADED') AND submitted_at IS NOT NULL) OR
    (status IN ('FLAGGED', 'VOID'))
  ),
  CONSTRAINT chk_submissions_raw_score CHECK (raw_score IS NULL OR raw_score >= 0)
);
 
CREATE TABLE student_answers (
  id                    UUID PRIMARY KEY DEFAULT uuidv7(),
  submission_id         UUID NOT NULL,
  exam_variant_question_id    UUID NOT NULL,
  client_sequence       BIGINT NOT NULL DEFAULT 0,
  last_edit_token       UUID,  -- ARC-01: last accepted mutation id for per-answer CAS retry
  selected_options      JSONB,       -- vd: '["B"]' hoac '["A", "C"]'
  answer_text           TEXT,        -- Duyen cho cau Input
  response_data         JSONB,       -- Du lieu cau Dropdown / Matching
  grading_status        VARCHAR(20)  NOT NULL DEFAULT 'UNGRADED',
  score                 NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
CONSTRAINT chk_student_answers_score CHECK (score >= 0),
  CONSTRAINT chk_student_answers_status CHECK (grading_status IN ('UNGRADED', 'CORRECT', 'PARTIAL', 'WRONG', 'BLANK')),
CONSTRAINT uq_student_answers_sub_evq UNIQUE (submission_id, exam_variant_question_id)
); 

CREATE TABLE submission_answer_grades (
  id                        UUID PRIMARY KEY DEFAULT uuidv7(),
  submission_id             UUID NOT NULL,
  exam_variant_question_id  UUID NOT NULL,
  answer_snapshot           JSONB,
  correct_answer_snapshot   JSONB NOT NULL,
  grading_rule_snapshot     JSONB,
  grading_status            VARCHAR(20) NOT NULL DEFAULT 'UNGRADED',
  max_score                 NUMERIC(5,2) NOT NULL,
  earned_score              NUMERIC(5,2) NOT NULL,
  grading_details           JSONB,
  iteration                 SMALLINT NOT NULL DEFAULT 1,
  is_final                  BOOLEAN NOT NULL DEFAULT TRUE,
  graded_by                 UUID,
  graded_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_sag_grading_status CHECK (grading_status IN ('UNGRADED', 'CORRECT', 'PARTIAL', 'WRONG', 'BLANK')),
  CONSTRAINT chk_sag_max_score CHECK (max_score >= 0),
  CONSTRAINT chk_sag_earned_score_range CHECK (earned_score >= 0 AND earned_score <= max_score),
  CONSTRAINT chk_sag_iteration CHECK (iteration > 0),
  CONSTRAINT uq_sag_sub_evq_iteration UNIQUE (submission_id, exam_variant_question_id, iteration)
);

CREATE TABLE scan_images (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  exam_id UUID NOT NULL,
  submission_id UUID,
  page_no SMALLINT NOT NULL DEFAULT 1,
  file_path VARCHAR(500) NOT NULL,
  checksum VARCHAR(64),
  sharpness_score NUMERIC(6,2),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  association_status VARCHAR(24) NOT NULL DEFAULT 'UNMATCHED',
  processing_status VARCHAR(24) NOT NULL DEFAULT 'QUEUED',
  image_revision INTEGER NOT NULL DEFAULT 1,
  error_code VARCHAR(50), error_detail TEXT,
  last_attempt_at TIMESTAMPTZ, processed_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0, lease_until TIMESTAMPTZ,
  observed_student_code VARCHAR(30), observed_variant_code VARCHAR(30),
  recognition_payload JSONB,
  binding_actor UUID, binding_at TIMESTAMPTZ, binding_note TEXT,
  CONSTRAINT uq_scan_images_id_submission UNIQUE(id, submission_id),
  CONSTRAINT uq_scan_images_submission_page UNIQUE(submission_id,page_no),
  CONSTRAINT chk_scan_images_sharpness_score CHECK(sharpness_score IS NULL OR (sharpness_score>=0 AND sharpness_score<=1)),
  CONSTRAINT chk_scan_images_assoc CHECK (
     association_status IN ('UNMATCHED','NEEDS_REVIEW','LINKED','REJECTED')
     AND ((association_status='LINKED') = (submission_id IS NOT NULL))),
  CONSTRAINT chk_scan_images_processing_status CHECK (processing_status IN (
     'QUEUED','PROCESSING','REJECTED','NEEDS_RESCAN','NEEDS_REVIEW','PROCESSED','FAILED_RETRYABLE')),
  CONSTRAINT chk_scan_images_retry_revision CHECK(image_revision>=1 AND retry_count>=0),
  CONSTRAINT chk_scan_images_payload CHECK(recognition_payload IS NULL OR jsonb_typeof(recognition_payload)='object')
);












CREATE TABLE detected_answers (
  id                  UUID PRIMARY KEY DEFAULT uuidv7(),
  submission_id       UUID NOT NULL,
  scan_image_id       UUID NOT NULL,
  question_position   SMALLINT NOT NULL,
  detected_options    JSONB,        -- vd: '["B"]' hoac '["A", "C"]'
  fill_scores         JSONB NOT NULL,
  confidence          NUMERIC(4,3),
  detection_status    VARCHAR(20) NOT NULL,
  manually_corrected  BOOLEAN NOT NULL DEFAULT FALSE,
  original_detection  JSONB,
  corrected_options   JSONB,
  corrected_by        UUID,
corrected_at        TIMESTAMPTZ,
created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_detected_status CHECK (detection_status IN ('BLANK', 'SELECTED', 'MULTIPLE', 'AMBIGUOUS')),
  CONSTRAINT uq_detected_answers_submission_pos UNIQUE (submission_id, question_position),
  CONSTRAINT chk_detected_answers_options_array CHECK (detected_options IS NULL OR jsonb_typeof(detected_options) = 'array'),
  CONSTRAINT chk_detected_answers_fill_scores_obj CHECK (jsonb_typeof(fill_scores) = 'object'),
  CONSTRAINT chk_detected_answers_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE TABLE grades (
  id               UUID PRIMARY KEY DEFAULT uuidv7(),
  submission_id    UUID NOT NULL,
  total_score      NUMERIC(5,2) NOT NULL,
  correct_count    SMALLINT NOT NULL DEFAULT 0,
  wrong_count      SMALLINT NOT NULL DEFAULT 0,
  blank_count      SMALLINT NOT NULL DEFAULT 0,
  graded_by        UUID,
  graded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_grades_total_score CHECK (total_score >= 0),
  CONSTRAINT chk_grades_counts CHECK (correct_count >= 0 AND wrong_count >= 0 AND blank_count >= 0),
  CONSTRAINT uq_grades_submission UNIQUE (submission_id)
);
 
-- =====================================================================
-- COMMENTS: lam ro cac quyet dinh thiet ke quan trong (JSONB, bat bien...)
-- =====================================================================
 
COMMENT ON COLUMN exam_variant_questions.option_order IS
  'JSONB anh xa chi tiet phuong an da hoan vi bao gom display_label ("A","B",...) va option_id goc trong options_snapshot de tranh lech dap an khi ngan hang thay doi hoac cham OMR.';

COMMENT ON COLUMN student_answers.selected_options IS
  'JSONB luu danh sach nhan phuong an thi sinh lua chon theo ma de hien tai (vd: ["A"], ["B", "D"]). Khi cham bai, Engine cham bat buoc phai anh xa cac nhan nay sang option_id goc thong qua exam_variant_questions.option_order va question_versions.options_snapshot.';

COMMENT ON COLUMN question_versions.options_snapshot IS
  'Snapshot JSONB toan bo cau truc dap an (noi dung + dap an dung) tai thoi diem dong bang de thi. Bat bien sau khi da dung trong mot exam_variant_questions, dam bao de thi khong doi du ngan hang cau hoi goc thay doi sau nay.';
 
COMMENT ON COLUMN detected_answers.fill_scores IS
'JSONB luu ty le diem anh toi (0..1) cua tung phuong an (vd {"A":0.92,"B":0.05,"C":0.03,"D":0.01}) do he thong cham OMR tra ve, phuc vu doi soat khi ket qua nghi ngo (detection_status IN (''AMBIGUOUS'', ''MULTIPLE'')).';

COMMENT ON COLUMN form_templates.layout_config IS
  'JSONB mo ta bo cuc phieu tra loi trac nghiem (so cot, so hang, toa do vung to, marker can chinh) dung boi module nhan dang anh quet (OMR).';
 
COMMENT ON COLUMN audit_logs.old_value IS 'Snapshot JSONB trang thai truoc khi thay doi (phuc vu truy vet / rollback thu cong).';
COMMENT ON COLUMN audit_logs.new_value IS 'Snapshot JSONB trang thai sau khi thay doi.';
 
COMMENT ON COLUMN users.deleted_at IS 'Soft delete: khac NULL nghia la ban ghi da bi xoa mem, van giu de tra cuu lich su / bao cao.';
 
