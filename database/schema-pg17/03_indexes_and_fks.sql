-- =====================================================================
-- OLMS - He thong thi trac nghiem
-- 03_indexes_and_fks.sql
-- Muc dich: ALTER TABLE ADD CONSTRAINT FOREIGN KEY (tach rieng de tranh loi
-- phu thuoc vong tron khi CREATE TABLE), CREATE INDEX cho toan bo cot FK,
-- va cac UNIQUE / PARTIAL INDEX phuc vu tra cuu du lieu chua xoa.
--
-- Quy uoc ON DELETE:
--   - CASCADE  : ap dung cho bang con thuoc so huu hoan toan boi bang cha
--                (cau hinh/ket cau de thi: matrix, grading rule, variant,
--                variant_question; du lieu phai sinh cua 1 bai lam: answers, 
--                submission_answer_grades, scan_images, detected_answers, grades) -> xoa cha thi xoa
--                theo, khong con y nghia doc lap.
--   - RESTRICT/NO ACTION : ap dung cho du lieu lich su / su kien thuc te
--                (participants, submissions) va cac bang danh muc dung
--                chung (subjects, lessons, question_types, questions,
--                question_versions) -> ngan xoa nham lam mat du lieu goc.
--   - SET NULL : ap dung cho cot tham chieu mang tinh phan loai / audit
--                khong bat buoc (created_by, deleted_by, form_template_id...).
-- Thu tu chay: 01 -> 02 -> 03
-- =====================================================================
 
-- ---------------------------------------------------------------------
-- 1. FOREIGN KEY CONSTRAINTS
-- ---------------------------------------------------------------------
 
-- ==== Phan vung 1: users / audit_logs ====
ALTER TABLE users        ADD CONSTRAINT fk_users_deleted_by            FOREIGN KEY (deleted_by)          REFERENCES users(id)            ON DELETE SET NULL;
ALTER TABLE audit_logs   ADD CONSTRAINT fk_audit_logs_actor_user_id    FOREIGN KEY (actor_user_id)        REFERENCES users(id)            ON DELETE SET NULL;
 
-- ==== Phan vung 2: ngan hang cau hoi ====
ALTER TABLE subjects ADD CONSTRAINT fk_subjects_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE subjects           ADD CONSTRAINT fk_subjects_deleted_by         FOREIGN KEY (deleted_by)        REFERENCES users(id)     ON DELETE SET NULL;
 
ALTER TABLE chapters           ADD CONSTRAINT fk_chapters_subject_id        FOREIGN KEY (subject_id)        REFERENCES subjects(id)  ON DELETE RESTRICT;
ALTER TABLE chapters           ADD CONSTRAINT fk_chapters_deleted_by        FOREIGN KEY (deleted_by)        REFERENCES users(id)     ON DELETE SET NULL;
 
ALTER TABLE lessons            ADD CONSTRAINT fk_lessons_chapter_id         FOREIGN KEY (chapter_id)        REFERENCES chapters(id)  ON DELETE RESTRICT;
ALTER TABLE lessons            ADD CONSTRAINT fk_lessons_deleted_by         FOREIGN KEY (deleted_by)        REFERENCES users(id)     ON DELETE SET NULL;
 
ALTER TABLE question_types     ADD CONSTRAINT fk_question_types_deleted_by  FOREIGN KEY (deleted_by)        REFERENCES users(id)     ON DELETE SET NULL;
 
ALTER TABLE questions          ADD CONSTRAINT fk_questions_lesson_id        FOREIGN KEY (lesson_id)         REFERENCES lessons(id)          ON DELETE SET NULL;
ALTER TABLE questions          ADD CONSTRAINT fk_questions_type_id          FOREIGN KEY (type_id)           REFERENCES question_types(id)  ON DELETE RESTRICT;
ALTER TABLE questions          ADD CONSTRAINT fk_questions_created_by       FOREIGN KEY (created_by)        REFERENCES users(id)            ON DELETE SET NULL;
ALTER TABLE questions          ADD CONSTRAINT fk_questions_deleted_by       FOREIGN KEY (deleted_by)        REFERENCES users(id)            ON DELETE SET NULL;
 
ALTER TABLE question_versions  ADD CONSTRAINT fk_question_versions_question_id FOREIGN KEY (question_id)   REFERENCES questions(id)        ON DELETE RESTRICT;
ALTER TABLE question_versions  ADD CONSTRAINT fk_question_versions_type_id     FOREIGN KEY (type_id)       REFERENCES question_types(id)   ON DELETE RESTRICT;
ALTER TABLE question_versions  ADD CONSTRAINT fk_question_versions_created_by  FOREIGN KEY (created_by)    REFERENCES users(id)            ON DELETE SET NULL;
 
ALTER TABLE answer_options     ADD CONSTRAINT fk_answer_options_question_id FOREIGN KEY (question_id)      REFERENCES questions(id)        ON DELETE CASCADE;
ALTER TABLE answer_options     ADD CONSTRAINT fk_answer_options_deleted_by  FOREIGN KEY (deleted_by)       REFERENCES users(id)            ON DELETE SET NULL;

ALTER TABLE exams ADD CONSTRAINT fk_exams_result_published_by FOREIGN KEY (result_published_by) REFERENCES users(id) ON DELETE RESTRICT;
 
-- ==== Phan vung 3: ky thi, ma tran, de trao ====
ALTER TABLE form_templates ADD CONSTRAINT fk_form_templates_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;
 
ALTER TABLE exams ADD CONSTRAINT fk_exams_subject_id       FOREIGN KEY (subject_id)       REFERENCES subjects(id)       ON DELETE RESTRICT;
ALTER TABLE exams ADD CONSTRAINT fk_exams_form_template_id FOREIGN KEY (form_template_id) REFERENCES form_templates(id) ON DELETE SET NULL;
ALTER TABLE exams ADD CONSTRAINT fk_exams_created_by       FOREIGN KEY (created_by)       REFERENCES users(id)          ON DELETE SET NULL;
ALTER TABLE exams ADD CONSTRAINT fk_exams_deleted_by       FOREIGN KEY (deleted_by)       REFERENCES users(id)          ON DELETE SET NULL;
 
ALTER TABLE exam_matrices ADD CONSTRAINT fk_exam_matrices_exam_id          FOREIGN KEY (exam_id)          REFERENCES exams(id)           ON DELETE CASCADE;
ALTER TABLE exam_matrices ADD CONSTRAINT fk_exam_matrices_chapter_id       FOREIGN KEY (chapter_id)       REFERENCES chapters(id)        ON DELETE SET NULL;
ALTER TABLE exam_matrices ADD CONSTRAINT fk_exam_matrices_lesson_id        FOREIGN KEY (lesson_id)        REFERENCES lessons(id)         ON DELETE SET NULL;
ALTER TABLE exam_matrices ADD CONSTRAINT fk_exam_matrices_question_type_id FOREIGN KEY (question_type_id) REFERENCES question_types(id)  ON DELETE RESTRICT;
ALTER TABLE exam_matrices ADD CONSTRAINT fk_exam_matrices_deleted_by       FOREIGN KEY (deleted_by)       REFERENCES users(id)           ON DELETE SET NULL;
 
ALTER TABLE exam_grading_rules ADD CONSTRAINT fk_egr_exam_id          FOREIGN KEY (exam_id)          REFERENCES exams(id)           ON DELETE CASCADE;
ALTER TABLE exam_grading_rules ADD CONSTRAINT fk_egr_question_type_id FOREIGN KEY (question_type_id) REFERENCES question_types(id) ON DELETE RESTRICT;
ALTER TABLE exam_grading_rules ADD CONSTRAINT fk_egr_deleted_by       FOREIGN KEY (deleted_by)       REFERENCES users(id)           ON DELETE SET NULL;
 
ALTER TABLE exam_variants ADD CONSTRAINT fk_exam_variants_exam_id    FOREIGN KEY (exam_id)    REFERENCES exams(id) ON DELETE CASCADE;
ALTER TABLE exam_variants ADD CONSTRAINT fk_exam_variants_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;
 
ALTER TABLE exam_variant_questions ADD CONSTRAINT fk_evq_variant_id          FOREIGN KEY (variant_id)          REFERENCES exam_variants(id)    ON DELETE CASCADE;
ALTER TABLE exam_variant_questions ADD CONSTRAINT fk_evq_question_version_id FOREIGN KEY (question_version_id) REFERENCES question_versions(id) ON DELETE RESTRICT;
 

-- ==== Phan vung 1 (bo sung): student_profiles ====
ALTER TABLE student_profiles ADD CONSTRAINT fk_student_profiles_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_student_profiles_deleted_by ON student_profiles (deleted_by);

-- ==== Phan vung 4: phong thi, bai lam, cham diem ====
ALTER TABLE participants ADD CONSTRAINT fk_participants_exam_id            FOREIGN KEY (exam_id)            REFERENCES exams(id)            ON DELETE RESTRICT;
ALTER TABLE participants ADD CONSTRAINT fk_participants_student_profile_id FOREIGN KEY (student_profile_id) REFERENCES student_profiles(id) ON DELETE RESTRICT;
ALTER TABLE participants ADD CONSTRAINT fk_participants_student_user_id    FOREIGN KEY (student_user_id)    REFERENCES users(id)            ON DELETE RESTRICT;
ALTER TABLE participants ADD CONSTRAINT fk_participants_variant_exam       FOREIGN KEY (variant_id, exam_id) REFERENCES exam_variants(id, exam_id) ON DELETE RESTRICT;
ALTER TABLE participants ADD CONSTRAINT fk_participants_deleted_by         FOREIGN KEY (deleted_by)         REFERENCES users(id)            ON DELETE SET NULL;

-- Khoa ngoai ghep bao dam submissions.exam_id luon khop tuyet doi voi participants.exam_id
ALTER TABLE submissions ADD CONSTRAINT fk_submissions_participant_exam FOREIGN KEY (participant_id, exam_id) REFERENCES participants(id, exam_id) ON DELETE RESTRICT;
ALTER TABLE submissions ADD CONSTRAINT fk_submissions_variant_exam FOREIGN KEY (variant_id, exam_id) REFERENCES exam_variants(id, exam_id) ON DELETE RESTRICT;

ALTER TABLE student_answers ADD CONSTRAINT fk_student_answers_submission_id       FOREIGN KEY (submission_id)       REFERENCES submissions(id)       ON DELETE CASCADE;
ALTER TABLE student_answers ADD CONSTRAINT fk_student_answers_evq_id FOREIGN KEY (exam_variant_question_id) REFERENCES exam_variant_questions(id) ON DELETE RESTRICT;

ALTER TABLE submission_answer_grades ADD CONSTRAINT fk_sag_submission_id FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE;
ALTER TABLE submission_answer_grades ADD CONSTRAINT fk_sag_evq_id FOREIGN KEY (exam_variant_question_id) REFERENCES exam_variant_questions(id) ON DELETE RESTRICT;
ALTER TABLE submission_answer_grades ADD CONSTRAINT fk_sag_graded_by FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_sag_graded_by ON submission_answer_grades (graded_by);
ALTER TABLE scan_images ADD CONSTRAINT fk_scan_images_submission_id FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE RESTRICT;
ALTER TABLE scan_images ADD CONSTRAINT fk_scan_images_exam_id FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE RESTRICT;
ALTER TABLE scan_images ADD CONSTRAINT fk_scan_images_submission_exam FOREIGN KEY (submission_id,exam_id) REFERENCES submissions(id,exam_id) ON DELETE RESTRICT;
ALTER TABLE scan_images ADD CONSTRAINT fk_scan_images_binding_actor FOREIGN KEY (binding_actor) REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX idx_scan_images_exam_status ON scan_images(exam_id,association_status,processing_status);
CREATE INDEX idx_scan_images_unbound_queue ON scan_images(exam_id,uploaded_at) WHERE submission_id IS NULL;
CREATE UNIQUE INDEX uq_submissions_submit_token ON submissions(submit_token) WHERE submit_token IS NOT NULL;
 
ALTER TABLE detected_answers ADD CONSTRAINT fk_detected_answers_submission_id FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE;
-- Khoa ngoai ghep ngan ngua ket noi cheo anh quet giua cac bai lam khac nhau
ALTER TABLE detected_answers ADD CONSTRAINT fk_detected_answers_scan_submission FOREIGN KEY (scan_image_id, submission_id) REFERENCES scan_images(id, submission_id) ON DELETE CASCADE;
ALTER TABLE detected_answers ADD CONSTRAINT fk_detected_answers_corrected_by FOREIGN KEY (corrected_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE grades ADD CONSTRAINT fk_grades_submission_id FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE;
ALTER TABLE grades ADD CONSTRAINT fk_grades_graded_by     FOREIGN KEY (graded_by)     REFERENCES users(id)       ON DELETE SET NULL;
 
-- ---------------------------------------------------------------------
-- 2. UNIQUE CONSTRAINTS DUA TREN DIEU KIEN WHERE deleted_at IS NULL
--    (Postgres khong ho tro UNIQUE constraint co WHERE -> dung UNIQUE INDEX)
-- ---------------------------------------------------------------------
 
CREATE UNIQUE INDEX uq_users_username_active            ON users (username)                      WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_subjects_code_active             ON subjects (code)                       WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_chapters_subject_code_active     ON chapters (subject_id, code)           WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_lessons_chapter_code_active      ON lessons (chapter_id, code)            WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_question_types_code_active       ON question_types (code)                 WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_exams_code_active                ON exams (code)                          WHERE deleted_at IS NULL;
-- Ma de khong bao gio duoc phep tai su dung trong cung mot ky thi ke ca khi bi xoa mem
CREATE UNIQUE INDEX uq_exam_variants_exam_code ON exam_variants (exam_id, variant_code);
CREATE UNIQUE INDEX uq_exam_variants_single_root_active ON exam_variants (exam_id) WHERE is_root = TRUE AND deleted_at IS NULL;
-- Mot thi sinh chi duoc gan 1 lan duy nhat trong 1 ky thi (khoa cung tuyet doi, ke ca khi bi xoa mem de ngan thi lai)
CREATE UNIQUE INDEX uq_participants_exam_student_user ON participants (exam_id, student_user_id);
-- Dam bao moi cau hoi chi co duy nhat 1 ban ghi la phien ban hien hanh
CREATE UNIQUE INDEX uq_question_versions_current ON question_versions (question_id) WHERE is_current = TRUE;
CREATE UNIQUE INDEX uq_form_templates_code_active   ON form_templates (code)                   WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_student_profiles_email_active ON student_profiles (email) WHERE deleted_at IS NULL AND email IS NOT NULL;

-- Tranh trung lap tieu chi ma tran de thi trong cung mot ky thi
CREATE UNIQUE INDEX uq_exam_matrices_criteria_active ON exam_matrices (
  exam_id, 
  COALESCE(chapter_id, '00000000-0000-0000-0000-000000000000'::uuid), 
  COALESCE(lesson_id, '00000000-0000-0000-0000-000000000000'::uuid), 
  question_type_id, 
  difficulty_level
) WHERE deleted_at IS NULL;

-- Moi dang cau hoi chi co dung mot quy tac cham trong ky thi
CREATE UNIQUE INDEX uq_egr_exam_type_active ON exam_grading_rules (exam_id, question_type_id) WHERE deleted_at IS NULL;

-- So bao danh la duy nhat trong mot ky thi
CREATE UNIQUE INDEX uq_participants_seat_active ON participants (exam_id, seat_no) WHERE deleted_at IS NULL AND seat_no IS NOT NULL;

-- Dam bao moi cau hoi trong bai nop chi co duy nhat 1 ket qua cham co hieu luc cuoi cung (is_final = TRUE)
CREATE UNIQUE INDEX uq_sag_sub_evq_final_active ON submission_answer_grades (submission_id, exam_variant_question_id) WHERE is_final = TRUE;

-- ---------------------------------------------------------------------
-- 3. B-TREE INDEX CHO TOAN BO COT KHOA NGOAI (FK)
-- ---------------------------------------------------------------------
 
CREATE INDEX idx_users_deleted_by                    ON users (deleted_by);
CREATE INDEX idx_audit_logs_actor_user_id            ON audit_logs (actor_user_id);
 
CREATE INDEX idx_subjects_created_by                 ON subjects (created_by);
CREATE INDEX idx_subjects_deleted_by                 ON subjects (deleted_by);
 
CREATE INDEX idx_chapters_subject_id                 ON chapters (subject_id);
CREATE INDEX idx_chapters_deleted_by                 ON chapters (deleted_by);
 
CREATE INDEX idx_lessons_chapter_id                  ON lessons (chapter_id);
CREATE INDEX idx_lessons_deleted_by                  ON lessons (deleted_by);
 
CREATE INDEX idx_question_types_deleted_by           ON question_types (deleted_by);
 
CREATE INDEX idx_questions_lesson_id                 ON questions (lesson_id);
CREATE INDEX idx_questions_type_id                   ON questions (type_id);
CREATE INDEX idx_questions_created_by                ON questions (created_by);
CREATE INDEX idx_questions_deleted_by                ON questions (deleted_by);
 
CREATE INDEX idx_question_versions_question_id       ON question_versions (question_id);
CREATE INDEX idx_question_versions_type_id ON question_versions (type_id);
CREATE INDEX idx_question_versions_created_by        ON question_versions (created_by);
 
CREATE INDEX idx_answer_options_question_id          ON answer_options (question_id);
CREATE INDEX idx_answer_options_deleted_by           ON answer_options (deleted_by);
 
CREATE INDEX idx_form_templates_deleted_by           ON form_templates (deleted_by);
 
CREATE INDEX idx_exams_subject_id                    ON exams (subject_id);
CREATE INDEX idx_exams_form_template_id              ON exams (form_template_id);
CREATE INDEX idx_exams_created_by                    ON exams (created_by);
CREATE INDEX idx_exams_deleted_by                    ON exams (deleted_by);
 
CREATE INDEX idx_exam_matrices_exam_id               ON exam_matrices (exam_id);
CREATE INDEX idx_exam_matrices_chapter_id            ON exam_matrices (chapter_id);
CREATE INDEX idx_exam_matrices_lesson_id             ON exam_matrices (lesson_id);
CREATE INDEX idx_exam_matrices_question_type_id      ON exam_matrices (question_type_id);
CREATE INDEX idx_exam_matrices_deleted_by            ON exam_matrices (deleted_by);

CREATE INDEX idx_exams_result_published_by ON exams (result_published_by);
 
CREATE INDEX idx_egr_exam_id                         ON exam_grading_rules (exam_id);
CREATE INDEX idx_egr_question_type_id                ON exam_grading_rules (question_type_id);
CREATE INDEX idx_egr_deleted_by                      ON exam_grading_rules (deleted_by);
 
CREATE INDEX idx_exam_variants_exam_id               ON exam_variants (exam_id);
CREATE INDEX idx_exam_variants_deleted_by            ON exam_variants (deleted_by);
 
CREATE INDEX idx_evq_variant_id                      ON exam_variant_questions (variant_id);
CREATE INDEX idx_evq_question_version_id             ON exam_variant_questions (question_version_id);
 
CREATE INDEX idx_participants_exam_id                ON participants (exam_id);
CREATE INDEX idx_participants_student_profile_id     ON participants (student_profile_id);
CREATE INDEX idx_participants_student_user_id        ON participants (student_user_id);
CREATE INDEX idx_participants_student_code           ON participants (student_code);
CREATE INDEX idx_participants_variant_id             ON participants (variant_id);
CREATE INDEX idx_participants_variant_exam        ON participants (variant_id, exam_id);
CREATE INDEX idx_participants_deleted_by             ON participants (deleted_by);
 
CREATE INDEX idx_submissions_participant_id          ON submissions (participant_id);
CREATE INDEX idx_submissions_exam_id        ON submissions (exam_id);
CREATE INDEX idx_submissions_variant_id     ON submissions (variant_id);
 
CREATE INDEX idx_student_answers_submission_id       ON student_answers (submission_id);
CREATE INDEX idx_student_answers_evq_id              ON student_answers (exam_variant_question_id);
CREATE INDEX idx_sag_submission_id                   ON submission_answer_grades (submission_id);
CREATE INDEX idx_sag_evq_id                          ON submission_answer_grades (exam_variant_question_id);
CREATE INDEX idx_scan_images_submission_id           ON scan_images (submission_id);

CREATE INDEX idx_detected_answers_submission_id      ON detected_answers (submission_id);
CREATE INDEX idx_detected_answers_scan_submission    ON detected_answers (scan_image_id, submission_id);
CREATE INDEX idx_detected_answers_status             ON detected_answers (detection_status);
CREATE INDEX idx_detected_answers_review_queue ON detected_answers (submission_id) WHERE detection_status IN ('AMBIGUOUS', 'MULTIPLE');
CREATE INDEX idx_detected_answers_corrected_by    ON detected_answers (corrected_by);
 
CREATE INDEX idx_grades_submission_id                ON grades (submission_id);
CREATE INDEX idx_grades_graded_by                    ON grades (graded_by);
 
-- DB-05: durable polling and retry queue, filter scans by processing/association status.
CREATE INDEX IF NOT EXISTS idx_scan_images_exam_status
 ON scan_images(exam_id,association_status,processing_status);
CREATE INDEX IF NOT EXISTS idx_scan_images_unbound_queue
 ON scan_images(exam_id,uploaded_at) WHERE submission_id IS NULL;

-- ---------------------------------------------------------------------
-- 4. PARTIAL INDEX PHUC VU TRA CUU DU LIEU CHUA XOA / DANG HOAT DONG
--    (bo sung ngoai vi du trong dac ta, ap dung cung mau hinh cho cac
--    bang tra cuu / truy van thuong xuyen nhat)
-- ---------------------------------------------------------------------
 
-- Vi du goc trong dac ta: tra cuu cau hoi con hieu luc theo loai cau hoi
CREATE INDEX idx_questions_active ON questions (type_id) WHERE deleted_at IS NULL AND status = 'ACTIVE';

-- Ho tro hang doi tien trinh AI check va danh sach can phe duyet ngoai le
CREATE INDEX idx_questions_ai_check_pending ON questions (ai_check_status) WHERE deleted_at IS NULL AND ai_check_status = 'PENDING';

-- Bo sung: tra cuu nguoi dung con hoat dong theo vai tro (man hinh quan tri)
CREATE INDEX idx_users_active_role ON users (role) WHERE deleted_at IS NULL AND status = 'ACTIVE';
 
-- Tra cuu ky thi dang mo / sap mo theo khung gio
CREATE INDEX idx_exams_active_status ON exams (status, opens_at, closes_at) WHERE deleted_at IS NULL;

-- Hang doi cham diem - quet cac bai lam can xu ly hoac nghi van
CREATE INDEX idx_submissions_pending_status ON submissions (status) WHERE status IN ('IN_PROGRESS', 'SUBMITTED', 'GRADING', 'FLAGGED');

-- Ho tro man hinh diem danh phong thi nhanh chong
CREATE INDEX idx_participants_attendance ON participants (exam_id, attendance_status) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- 4.1 TRIGGER KIEM SOAT PHAN CAP & TONG SO CAU CUA MA TRAN DE THI
-- ---------------------------------------------------------------------

-- Kiem tra rang buoc cay phan cap: exam -> subject -> chapter -> lesson
CREATE OR REPLACE FUNCTION trg_validate_exam_matrix_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  v_exam_subject_id UUID;
  v_chap_subject_id UUID;
  v_les_chapter_id  UUID;
BEGIN
  SELECT subject_id INTO v_exam_subject_id FROM exams WHERE id = NEW.exam_id;

  -- Kiem tra Chuong thuoc Mon hoc cua ky thi
  IF NEW.chapter_id IS NOT NULL THEN
    SELECT subject_id INTO v_chap_subject_id FROM chapters WHERE id = NEW.chapter_id;
    IF v_chap_subject_id <> v_exam_subject_id THEN
      RAISE EXCEPTION 'Chuong (ID: %) khong thuoc mon hoc cua ky thi (ID: %)', NEW.chapter_id, NEW.exam_id;
    END IF;
  END IF;

  -- Kiem tra Bai hoc bat buoc phai thuoc Chuong da chon va thuoc Mon hoc cua ky thi
  IF NEW.lesson_id IS NOT NULL THEN
    IF NEW.chapter_id IS NULL THEN
      RAISE EXCEPTION 'Khong the chon bai hoc khi chua chon chuong tuong ung';
    END IF;
    SELECT chapter_id INTO v_les_chapter_id FROM lessons WHERE id = NEW.lesson_id;
    IF v_les_chapter_id <> NEW.chapter_id THEN
      RAISE EXCEPTION 'Bai hoc (ID: %) khong thuoc chuong da chon (ID: %)', NEW.lesson_id, NEW.chapter_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_matrix_hierarchy
BEFORE INSERT OR UPDATE ON exam_matrices
FOR EACH ROW EXECUTE FUNCTION trg_validate_exam_matrix_hierarchy();

-- Trigger bao ve tinh bat bien append-only cua audit_logs (tuyet doi cam UPDATE va DELETE)
CREATE OR REPLACE FUNCTION trg_enforce_audit_logs_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Bang audit_logs la nhat ky bat bien (append-only), khong cho phep thao tac %', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_audit_logs_append_only
BEFORE UPDATE OR DELETE ON audit_logs 
FOR EACH ROW EXECUTE FUNCTION trg_enforce_audit_logs_append_only();

-- Role app_user is created by DBA outside schema deployment; skip if absent.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM app_user;
    GRANT SELECT, INSERT ON audit_logs TO app_user;
  END IF;
END $$;

-- Kiem tra tinh toan ven cua Ma tran de, Do day Ngan hang cau hoi, Root Variant va Tong diem tung ma de khi phat hanh ky thi
CREATE OR REPLACE FUNCTION trg_validate_exam_readiness_on_publish()
RETURNS TRIGGER AS $$
DECLARE
  v_matrix_sum          INT;
  v_matrix_score        NUMERIC(5,2);
  v_variant_rec         RECORD;
  v_variant_count       INT;
  v_root_count          INT;
  v_matrix_rec          RECORD;
  v_available_questions INT;
BEGIN
  -- Chi kiem tra khi ky thi bat dau duoc phat hanh (chuyen tu DRAFT sang GENERATED)
  IF NEW.status = 'GENERATED' AND OLD.status = 'DRAFT' THEN
    -- 1. Kiem tra tong so cau trong ma tran de thi
    SELECT COALESCE(SUM(num_questions), 0) INTO v_matrix_sum 
    FROM exam_matrices 
    WHERE exam_id = NEW.id AND deleted_at IS NULL;
    
    IF v_matrix_sum <> NEW.total_questions THEN
      RAISE EXCEPTION 'Tong so cau trong ma tran (%) khong khop voi tong so cau quy dinh cua ky thi (%)', v_matrix_sum, NEW.total_questions;
    END IF;

    -- 1b. Kiem tra tong diem quy dinh trong ma tran phai bang tong diem cua ky thi
    SELECT COALESCE(SUM(num_questions * score_per_question), 0) INTO v_matrix_score
    FROM exam_matrices
    WHERE exam_id = NEW.id AND deleted_at IS NULL;

    IF v_matrix_score <> NEW.total_score THEN
      RAISE EXCEPTION 'Tong diem theo ma tran (%) khong khop voi tong diem quy dinh cua ky thi (%)', v_matrix_score, NEW.total_score;
    END IF;

    -- 2. Kiem tra so luong cau hoi kha dung trong pool (Nreq <= Navailable) theo snapshot qv.type_id va qv.difficulty_level
    FOR v_matrix_rec IN (
      SELECT id, chapter_id, lesson_id, question_type_id, difficulty_level, num_questions
      FROM exam_matrices
      WHERE exam_id = NEW.id AND deleted_at IS NULL
    ) LOOP
      SELECT COUNT(DISTINCT q.id) INTO v_available_questions
      FROM questions q
      JOIN question_versions qv ON qv.question_id = q.id AND qv.is_current = TRUE
      LEFT JOIN lessons l ON l.id = q.lesson_id
      LEFT JOIN chapters c ON c.id = l.chapter_id
      WHERE q.deleted_at IS NULL
        AND q.status = 'ACTIVE'
        AND q.ai_check_status IN ('CHECKED', 'OVERRIDDEN')
        AND qv.type_id = v_matrix_rec.question_type_id
        AND qv.difficulty_level = v_matrix_rec.difficulty_level
        AND (
          (v_matrix_rec.lesson_id IS NOT NULL AND q.lesson_id = v_matrix_rec.lesson_id)
          OR
          (v_matrix_rec.lesson_id IS NULL AND v_matrix_rec.chapter_id IS NOT NULL AND c.id = v_matrix_rec.chapter_id)
          OR
          (v_matrix_rec.lesson_id IS NULL AND v_matrix_rec.chapter_id IS NULL AND c.subject_id = NEW.subject_id)
        );

      IF v_available_questions < v_matrix_rec.num_questions THEN
        RAISE EXCEPTION 'Ngan hang cau hoi khong du cau kha dung cho ma tran (ID: %): Yeu cau % cau, chi co % cau kha dung trong pool (dieu kien: status ACTIVE, AI CHECKED/OVERRIDDEN, qv.type_id %, qv.difficulty %)',
          v_matrix_rec.id, v_matrix_rec.num_questions, v_available_questions, v_matrix_rec.question_type_id, v_matrix_rec.difficulty_level;
      END IF;
    END LOOP;

    -- 3. Kiem tra ky thi phai co it nhat mot ma de
    SELECT COUNT(*) INTO v_variant_count FROM exam_variants WHERE exam_id = NEW.id AND deleted_at IS NULL;
    IF v_variant_count = 0 THEN
      RAISE EXCEPTION 'Ky thi (ID: %) chua duoc khoi tao bat ky ma de nao (exam_variants)', NEW.id;
    END IF;

    -- 4. Kiem tra bat buoc phai co dung 1 de thi goc (Root Variant, is_root = TRUE)
    SELECT COUNT(*) INTO v_root_count FROM exam_variants WHERE exam_id = NEW.id AND is_root = TRUE AND deleted_at IS NULL;
    IF v_root_count <> 1 THEN
      RAISE EXCEPTION 'Ky thi (ID: %) bat buoc phai co dung 1 de thi goc (Root Variant, is_root = TRUE). Hien co: % de goc', NEW.id, v_root_count;
    END IF;

    -- 5. Kiem tra tong diem va so cau tren tung ma de thi
    FOR v_variant_rec IN (
      SELECT ev.id, ev.variant_code, 
             COALESCE(SUM(evq.score), 0) AS actual_score,
             COUNT(evq.id) AS actual_questions
      FROM exam_variants ev
      LEFT JOIN exam_variant_questions evq ON evq.variant_id = ev.id
      WHERE ev.exam_id = NEW.id AND ev.deleted_at IS NULL
      GROUP BY ev.id, ev.variant_code
    ) LOOP
      IF v_variant_rec.actual_questions <> NEW.total_questions THEN
        RAISE EXCEPTION 'Ma de % co so cau hoi (%) khong bang quy dinh ky thi (%)', 
          v_variant_rec.variant_code, v_variant_rec.actual_questions, NEW.total_questions;
      END IF;

      IF v_variant_rec.actual_score <> NEW.total_score THEN
        RAISE EXCEPTION 'Tong diem cua ma de % (%) khong bang tong diem quy dinh cua ky thi (%)', 
          v_variant_rec.variant_code, v_variant_rec.actual_score, NEW.total_score;
      END IF;
    END LOOP;

    -- 6. Dong bang toan bo phien ban cau hoi (question_versions) thuoc cac ma de cua ky thi
    UPDATE question_versions qv
    SET frozen_at = now()
    FROM exam_variant_questions evq
    JOIN exam_variants ev ON ev.id = evq.variant_id
    WHERE ev.exam_id = NEW.id
      AND qv.id = evq.question_version_id
      AND qv.frozen_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_check_exam_publish_readiness
BEFORE UPDATE OF status, total_questions, total_score ON exams
FOR EACH ROW EXECUTE FUNCTION trg_validate_exam_readiness_on_publish();

-- Trigger kiem soat may trang thai hop le cua ky thi (State Machine)
CREATE OR REPLACE FUNCTION trg_enforce_exam_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status=OLD.status THEN RETURN NEW; END IF;
 IF NOT (
 (OLD.status='DRAFT' AND NEW.status IN ('GENERATED','CANCELLED')) OR
 (OLD.status='GENERATED' AND NEW.status IN ('PUBLISHED','CANCELLED')) OR
 (OLD.status='PUBLISHED' AND NEW.status IN ('IN_PROGRESS','CANCELLED')) OR
 (OLD.status='IN_PROGRESS' AND NEW.status='ENDED') OR
 (OLD.status='ENDED' AND NEW.status='RESULT_PUBLISHED') OR
 (OLD.status='RESULT_PUBLISHED' AND NEW.status='ARCHIVED')) THEN
   RAISE EXCEPTION 'Invalid exam state transition % -> %', OLD.status, NEW.status;
 END IF;
 IF NEW.status='CANCELLED' AND (clock_timestamp()>=OLD.opens_at OR EXISTS
   (SELECT 1 FROM submissions s WHERE s.exam_id=OLD.id)) THEN
    RAISE EXCEPTION 'Cannot cancel exam after opening or with submissions';
 END IF;
 RETURN NEW;
END $$;






















CREATE TRIGGER trg_check_exam_status_transition
BEFORE UPDATE OF status ON exams
FOR EACH ROW EXECUTE FUNCTION trg_enforce_exam_status_transition();

-- Trigger khoa bat bien cau hinh ky thi (exams) khi da roi khoi trang thai DRAFT
CREATE OR REPLACE FUNCTION trg_enforce_exam_configuration_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Chan xoa ky thi neu da roi khoi DRAFT
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'Khong the xoa ky thi khi dang o trang thai % (chi duoc phep xoa khi o trang thai DRAFT)', OLD.status;
    END IF;
    RETURN OLD;
  END IF;

  -- Chan sua doi cau hinh de thi khi da roi khoi DRAFT (GENERATED, PUBLISHED, IN_PROGRESS, ENDED, RESULT_PUBLISHED, ARCHIVED, CANCELLED)
  IF OLD.status <> 'DRAFT' THEN
    IF (NEW.subject_id IS DISTINCT FROM OLD.subject_id) OR
       (NEW.delivery_mode IS DISTINCT FROM OLD.delivery_mode) OR
       (NEW.total_questions IS DISTINCT FROM OLD.total_questions) OR
       (NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes) OR
       (NEW.opens_at IS DISTINCT FROM OLD.opens_at) OR
       (NEW.closes_at IS DISTINCT FROM OLD.closes_at) OR
       (NEW.total_score IS DISTINCT FROM OLD.total_score) OR
       (NEW.form_template_id IS DISTINCT FROM OLD.form_template_id) OR
       (NEW.code IS DISTINCT FROM OLD.code) THEN
      RAISE EXCEPTION 'Khong the thay doi cau hinh ky thi (subject_id, delivery_mode, total_questions, duration_minutes, opens_at, closes_at, total_score, form_template_id, code) khi ky thi dang o trang thai % (chi cho phep sua cau hinh o trang thai DRAFT)', OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_exam_configuration
BEFORE UPDATE OR DELETE ON exams
FOR EACH ROW EXECUTE FUNCTION trg_enforce_exam_configuration_immutability();


-- Khoa INSERT, UPDATE, DELETE tren exam_matrices khi ky thi da phat hanh (khong con o DRAFT)
CREATE OR REPLACE FUNCTION trg_enforce_exam_matrix_immutability()
RETURNS TRIGGER AS $$
DECLARE
  v_target_exam_id UUID;
  v_exam_status    VARCHAR(20);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_target_exam_id := OLD.exam_id;
  ELSE
    v_target_exam_id := NEW.exam_id;
  END IF;

  SELECT status INTO v_exam_status FROM exams WHERE id = v_target_exam_id;

  IF v_exam_status IS NOT NULL AND v_exam_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Khong the % ma tran de thi khi ky thi dang o trang thai % (chi cho phep chinh sua khi o trang thai DRAFT)', TG_OP, v_exam_status;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_exam_matrices
BEFORE INSERT OR UPDATE OR DELETE ON exam_matrices
FOR EACH ROW EXECUTE FUNCTION trg_enforce_exam_matrix_immutability();

-- Chan them, sua, xoa exam_grading_rules khi da is_frozen hoac ky thi thoat khoi DRAFT
CREATE OR REPLACE FUNCTION trg_enforce_exam_grading_rule_immutability()
RETURNS TRIGGER AS $$
DECLARE
  v_target_exam_id UUID;
  v_exam_status    VARCHAR(20);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_target_exam_id := OLD.exam_id;
  ELSE
    v_target_exam_id := NEW.exam_id;
  END IF;

  SELECT status INTO v_exam_status FROM exams WHERE id = v_target_exam_id;
  IF v_exam_status IS NOT NULL AND v_exam_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Khong the % quy tac cham diem khi ky thi dang o trang thai % (chi cho phep o trang thai DRAFT)', TG_OP, v_exam_status;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_protect_exam_grading_rules
BEFORE INSERT OR UPDATE OR DELETE ON exam_grading_rules
FOR EACH ROW EXECUTE FUNCTION trg_enforce_exam_grading_rule_immutability();

-- Chan sua doi hoac xoa form_templates khi da duoc su dung trong ky thi
CREATE OR REPLACE FUNCTION trg_protect_used_form_templates()
RETURNS TRIGGER AS $$
DECLARE
  v_used_count INT;
BEGIN
  SELECT COUNT(*) INTO v_used_count FROM exams WHERE form_template_id = OLD.id AND deleted_at IS NULL;
  IF v_used_count > 0 THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Khong the xoa mau phieu OMR (ID: %) vi da duoc su dung trong % ky thi', OLD.id, v_used_count;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.code IS DISTINCT FROM OLD.code OR
         NEW.version IS DISTINCT FROM OLD.version OR
         NEW.name IS DISTINCT FROM OLD.name OR
         NEW.num_questions IS DISTINCT FROM OLD.num_questions OR
         NEW.is_active IS DISTINCT FROM OLD.is_active OR
         NEW.layout_config IS DISTINCT FROM OLD.layout_config OR
         NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR
         NEW.deleted_by IS DISTINCT FROM OLD.deleted_by THEN
        RAISE EXCEPTION 'Mau phieu OMR (ID: %) da duoc su dung trong ky thi; khoa bat bien toan bo thong tin (code, version, name, layout_config, num_questions, is_active, deleted_at). Vui long tao mau phieu moi (version tiep theo)', OLD.id;
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_enforce_form_template_immutability
BEFORE UPDATE OR DELETE ON form_templates
FOR EACH ROW EXECUTE FUNCTION trg_protect_used_form_templates();

-- ---------------------------------------------------------------------
-- 5. TRIGGER ENFORCEMENT CHO TINH BAT BIEN (IMMUTABILITY)
-- ---------------------------------------------------------------------

-- Tu dong dong bang phien ban cau hoi khi duoc dua vao de thi
-- Trigger bao dam version_no cua question_versions tang dan don dieu nghiem ngat va chong race condition
CREATE OR REPLACE FUNCTION trg_check_question_version_sequence()
RETURNS TRIGGER AS $$
DECLARE
  v_max_version INT;
BEGIN
  -- Su dung Postgres Advisory Xact Lock theo question_id de serialize cac giao dich dong thoi tao phien ban
  PERFORM pg_advisory_xact_lock(hashtext(NEW.question_id::text));

  SELECT COALESCE(MAX(version_no), 0) INTO v_max_version
  FROM question_versions
  WHERE question_id = NEW.question_id;

  IF NEW.version_no IS NULL OR NEW.version_no <= 0 THEN
    NEW.version_no := v_max_version + 1;
  ELSIF NEW.version_no <> v_max_version + 1 THEN
    RAISE EXCEPTION 'So thu tu phien ban version_no (%) khong hop le. Phien ban tiep theo phai la % (max hien tai: %)',
      NEW.version_no, v_max_version + 1, v_max_version;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger chan sua noi dung / xoa QuestionVersion khi da dong bang (frozen)
-- Van cho phep toggle is_current de cap nhat phien ban hien hanh moi
CREATE OR REPLACE FUNCTION trg_enforce_question_version_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.frozen_at IS NOT NULL THEN
      RAISE EXCEPTION 'Khong the xoa QuestionVersion da duoc dong bang (ID: %)', OLD.id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.frozen_at IS NOT NULL THEN
      -- Neu da frozen, chi cho phep cap nhat duy nhat cot is_current
      IF NEW.question_id IS DISTINCT FROM OLD.question_id OR
         NEW.version_no IS DISTINCT FROM OLD.version_no OR
         NEW.type_id IS DISTINCT FROM OLD.type_id OR
         NEW.difficulty_level IS DISTINCT FROM OLD.difficulty_level OR
         NEW.content IS DISTINCT FROM OLD.content OR
         NEW.media_url IS DISTINCT FROM OLD.media_url OR
         NEW.explanation IS DISTINCT FROM OLD.explanation OR
         NEW.options_snapshot IS DISTINCT FROM OLD.options_snapshot OR
         NEW.frozen_at IS DISTINCT FROM OLD.frozen_at OR
         NEW.created_by IS DISTINCT FROM OLD.created_by OR
         NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'QuestionVersion da duoc dong bang (ID: %). Chi cho phep cap nhat trang thai is_current, cam sua doi noi dung va cau truc', OLD.id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_protect_frozen_question_versions
BEFORE UPDATE OR DELETE ON question_versions
FOR EACH ROW EXECUTE FUNCTION trg_enforce_question_version_immutability();

-- Chan INSERT, UPDATE, DELETE tren exam_variant_questions khi ky thi da phat hanh
CREATE OR REPLACE FUNCTION trg_enforce_exam_variant_question_immutability()
RETURNS TRIGGER AS $$
DECLARE
  v_target_variant_id UUID;
  v_exam_status       VARCHAR(20);
BEGIN
  -- Xac dinh variant_id tuy thuoc vao thao tac
  IF TG_OP = 'DELETE' THEN
    v_target_variant_id := OLD.variant_id;
  ELSE
    v_target_variant_id := NEW.variant_id;
  END IF;

  -- Lay trang thai cua ky thi cha tu exam_variants -> exams
  SELECT e.status INTO v_exam_status
  FROM exam_variants ev
  JOIN exams e ON e.id = ev.exam_id
  WHERE ev.id = v_target_variant_id;

  -- Chi cho phep them/sua/xoa cau hoi de thi khi ky thi o trang thai DRAFT
  IF v_exam_status IS NOT NULL AND v_exam_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Khong the % exam_variant_questions khi ky thi dang o trang thai % (chi cho phep khi DRAFT)', TG_OP, v_exam_status;
  END IF;

  -- Kiem tra tinh hop le cua cau hoi duoc rut vao ma de (pool check: ACTIVE va AI CHECKED/OVERRIDDEN)
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    DECLARE
      v_q_status    VARCHAR(20);
      v_ai_status   VARCHAR(20);
      v_q_deleted   TIMESTAMPTZ;
    BEGIN
      SELECT q.status, q.ai_check_status, q.deleted_at 
      INTO v_q_status, v_ai_status, v_q_deleted
      FROM question_versions qv
      JOIN questions q ON q.id = qv.question_id
      WHERE qv.id = NEW.question_version_id;

      IF v_q_deleted IS NOT NULL OR v_q_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Cau hoi (question_version_id: %) khong hop le: phai thuoc cau hoi dang hoat dong (status = ACTIVE) va chua bi xoa', NEW.question_version_id;
      END IF;

      IF v_ai_status NOT IN ('CHECKED', 'OVERRIDDEN') THEN
        RAISE EXCEPTION 'Cau hoi (question_version_id: %) chua vuot qua kiem tra AI (ai_check_status = %; yeu cau CHECKED hoac OVERRIDDEN)', NEW.question_version_id, v_ai_status;
      END IF;
    END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_exam_variant_questions
BEFORE INSERT OR UPDATE OR DELETE ON exam_variant_questions
FOR EACH ROW EXECUTE FUNCTION trg_enforce_exam_variant_question_immutability();

-- Chan INSERT, UPDATE, DELETE tren exam_variants khi ky thi da phat hanh (GENERATED, PUBLISHED, IN_PROGRESS, ENDED, RESULT_PUBLISHED, ARCHIVED)
CREATE OR REPLACE FUNCTION trg_enforce_exam_variant_immutability()
RETURNS TRIGGER AS $$
DECLARE
  v_target_exam_id UUID;
  v_exam_status    VARCHAR(20);
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_target_exam_id := OLD.exam_id;
  ELSE
    v_target_exam_id := NEW.exam_id;
  END IF;

  SELECT status INTO v_exam_status FROM exams WHERE id = v_target_exam_id;

  IF v_exam_status IS NOT NULL AND v_exam_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Khong the % exam_variants khi ky thi dang o trang thai % (chi cho phep thao tac tren ma de khi ky thi o trang thai DRAFT)', TG_OP, v_exam_status;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_exam_variants
BEFORE INSERT OR UPDATE OR DELETE ON exam_variants
FOR EACH ROW EXECUTE FUNCTION trg_enforce_exam_variant_immutability();

-- Kiem tra tinh dong nhat va bat buoc ma de cho bai lam
CREATE OR REPLACE FUNCTION trg_check_submission_variant_match()
RETURNS TRIGGER AS $$
DECLARE
  v_assigned_variant UUID;
BEGIN
  SELECT variant_id INTO v_assigned_variant FROM participants WHERE id = NEW.participant_id;

  -- Bat buoc phai co ma de khi bai lam bat dau hoac nop/cham
  IF NEW.status IN ('IN_PROGRESS', 'SUBMITTED', 'GRADING', 'GRADED', 'FLAGGED') AND NEW.variant_id IS NULL THEN
    RAISE EXCEPTION 'Bai lam (ID: %) o trang thai % bat buoc phai duoc gan ma de (variant_id khong duoc NULL)', NEW.id, NEW.status;
  END IF;

  -- Kiem tra khop ma de neu thi sinh da duoc phan cong truoc
  IF v_assigned_variant IS NOT NULL AND NEW.variant_id IS NOT NULL AND v_assigned_variant <> NEW.variant_id THEN
    RAISE EXCEPTION 'Ma de cua bai nop (%) khong khop voi ma de thi sinh da duoc phan cong (%)', NEW.variant_id, v_assigned_variant;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_submission_variant
BEFORE INSERT OR UPDATE OF variant_id, status ON submissions
FOR EACH ROW EXECUTE FUNCTION trg_check_submission_variant_match();

-- Trigger kiem soat may trang thai hop le cua bai lam (Submission State Machine)
CREATE OR REPLACE FUNCTION trg_enforce_submission_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Neu khong thay doi trang thai thi bo qua
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Kiem tra cac chuyen doi trang thai hop le theo State Machine
  CASE OLD.status
    WHEN 'IN_PROGRESS' THEN
      IF NEW.status NOT IN ('SUBMITTED', 'VOID') THEN
        RAISE EXCEPTION 'Trang thai IN_PROGRESS chi co the chuyen sang SUBMITTED hoac VOID, khong the sang %', NEW.status;
      END IF;

    WHEN 'SUBMITTED' THEN
      IF NEW.status NOT IN ('GRADING', 'GRADED', 'FLAGGED', 'VOID') THEN
        RAISE EXCEPTION 'Trang thai SUBMITTED chi co the chuyen sang GRADING, GRADED, FLAGGED hoac VOID, khong the sang %', NEW.status;
      END IF;

    WHEN 'GRADING' THEN
      IF NEW.status NOT IN ('GRADED', 'FLAGGED', 'VOID') THEN
        RAISE EXCEPTION 'Trang thai GRADING chi co the chuyen sang GRADED, FLAGGED hoac VOID, khong the sang %', NEW.status;
      END IF;

    WHEN 'FLAGGED' THEN
      IF NEW.status NOT IN ('GRADING', 'GRADED', 'VOID') THEN
        RAISE EXCEPTION 'Trang thai FLAGGED sau khi xu ly chi co the chuyen sang GRADING, GRADED hoac VOID, khong the sang %', NEW.status;
      END IF;

    WHEN 'GRADED' THEN
      IF NEW.status NOT IN ('FLAGGED') THEN
        RAISE EXCEPTION 'Bai thi da o trang thai GRADED (da chot diem), khong duoc phep thay doi sang %, chi cho phep chuyen sang FLAGGED khi can ra soat bat thuong', NEW.status;
      END IF;

    WHEN 'VOID' THEN
      RAISE EXCEPTION 'Bai thi da bi huy (VOID) la trang thai cuoi, khong duoc phep thay doi sang %', NEW.status;

    ELSE
      RAISE EXCEPTION 'Trang thai submission khong hop le: %', OLD.status;
  END CASE;

  -- Neu chuyen sang GRADED (bao gom ca cham truc tiep tu SUBMITTED hoac tu GRADING), bat buoc kiem tra day du dieu kien finalize
  IF NEW.status = 'GRADED' THEN
    DECLARE
      v_total_questions SMALLINT;
      v_final_count     INT;
      v_max_score       NUMERIC(5,2);
    BEGIN
      SELECT total_questions, total_score INTO v_total_questions, v_max_score
      FROM exams WHERE id = NEW.exam_id;

      SELECT COUNT(*) INTO v_final_count
      FROM submission_answer_grades
      WHERE submission_id = NEW.id AND is_final = TRUE;

      IF v_final_count <> v_total_questions THEN
        RAISE EXCEPTION 'Khong the chot diem GRADED cho submission (ID: %): moi cham %/% cau so voi quy dinh ky thi',
          NEW.id, v_final_count, v_total_questions;
      END IF;

      IF NEW.raw_score IS NOT NULL AND v_max_score IS NOT NULL AND NEW.raw_score > v_max_score THEN
        RAISE EXCEPTION 'Khong the chot diem GRADED cho submission (ID: %): diem raw_score (%) vuot qua thang diem toi da cua ky thi (%)',
          NEW.id, NEW.raw_score, v_max_score;
      END IF;
    END;
  END IF;

  -- Kiem tra tinh toan ven cua raw_score: khong am va khong vuot qua exams.total_score
  IF NEW.raw_score IS NOT NULL THEN
    DECLARE
      v_max_exam_score NUMERIC(5,2);
    BEGIN
      SELECT total_score INTO v_max_exam_score FROM exams WHERE id = NEW.exam_id;
      IF NEW.raw_score < 0 OR (v_max_exam_score IS NOT NULL AND NEW.raw_score > v_max_exam_score) THEN
        RAISE EXCEPTION 'Diem raw_score (%) khong hop le (phai nam trong khoang 0 den % cua ky thi)', NEW.raw_score, v_max_exam_score;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_submission_status_transition
BEFORE UPDATE OF status ON submissions
FOR EACH ROW EXECUTE FUNCTION trg_enforce_submission_status_transition();


-- Tu dong dong bo trang thai Participant sang COMPLETED khi Submission da nop bai
CREATE OR REPLACE FUNCTION trg_sync_participant_status_on_submission()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('SUBMITTED', 'GRADING', 'GRADED') THEN
    UPDATE participants
    SET status = 'COMPLETED',
        updated_at = now()
    WHERE id = NEW.participant_id
      AND status <> 'COMPLETED';
  ELSIF NEW.status = 'IN_PROGRESS' THEN
    UPDATE participants
    SET status = 'IN_PROGRESS',
        updated_at = now()
    WHERE id = NEW.participant_id
      AND status = 'REGISTERED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_submission_to_participant
AFTER INSERT OR UPDATE OF status ON submissions
FOR EACH ROW EXECUTE FUNCTION trg_sync_participant_status_on_submission();

-- Trigger kiem tra tinh nhat quan danh tinh thi sinh va bao ve snapshot bat bien
CREATE OR REPLACE FUNCTION trg_validate_participant_student_identity()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role     user_role_enum;
  v_profile_code  VARCHAR(30);
  v_profile_name  VARCHAR(150);
  v_sub_count     INT;
BEGIN
  -- 1. Kiem tra student_user_id bat buoc phai co role la STUDENT
  SELECT role INTO v_user_role FROM users WHERE id = NEW.student_user_id;
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'Khong tim thay tai khoan nguoi dung (ID: %)', NEW.student_user_id;
  ELSIF v_user_role <> 'STUDENT' THEN
    RAISE EXCEPTION 'Tai khoan (ID: %, role: %) khong phai la STUDENT, khong the dang ky thi sinh tham gia phong thi',
      NEW.student_user_id, v_user_role;
  END IF;

  -- 2. Kiem tra student_profile_id va dong bo/doi soat snapshot khi ghi danh
  SELECT student_code, full_name INTO v_profile_code, v_profile_name
  FROM student_profiles WHERE id = NEW.student_profile_id;
  
  IF v_profile_code IS NULL THEN
    RAISE EXCEPTION 'Khong tim thay ho so sinh vien (StudentProfile ID: %)', NEW.student_profile_id;
  END IF;

  -- Khi INSERT: Tu dong dien hoac kiem tra khop snapshot neu client truyen vao
  IF TG_OP = 'INSERT' THEN
    IF NEW.student_code IS NULL OR NEW.student_code = '' THEN
      NEW.student_code := v_profile_code;
    ELSIF NEW.student_code <> v_profile_code THEN
      RAISE EXCEPTION 'student_code snapshot (%) khong khop voi MSSV trong StudentProfile (%)',
        NEW.student_code, v_profile_code;
    END IF;

    IF NEW.full_name_snapshot IS NULL OR NEW.full_name_snapshot = '' THEN
      NEW.full_name_snapshot := v_profile_name;
    END IF;
  END IF;

  -- 3. Khi UPDATE: Bao ve tinh bat bien tuyet doi cua cac truong snapshot va danh tinh
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.student_user_id IS DISTINCT FROM OLD.student_user_id) OR
       (NEW.student_profile_id IS DISTINCT FROM OLD.student_profile_id) OR
       (NEW.student_code IS DISTINCT FROM OLD.student_code) OR
       (NEW.full_name_snapshot IS DISTINCT FROM OLD.full_name_snapshot) THEN
      RAISE EXCEPTION 'Khong duoc phep thay doi danh tinh hoac du lieu snapshot thi sinh (student_user_id, student_profile_id, student_code, full_name_snapshot) sau khi da ghi danh vao ky thi';
    END IF;

    -- Neu participant da co bai lam (submission), khoa bat bien them ma de variant_id
    IF NEW.variant_id IS DISTINCT FROM OLD.variant_id THEN
      SELECT COUNT(*) INTO v_sub_count FROM submissions WHERE participant_id = OLD.id;
      IF v_sub_count > 0 THEN
        RAISE EXCEPTION 'Thi sinh (ID: %) da co bai lam (submission); cấm tuyet doi sua doi ma de (variant_id) de tranh lech du lieu khao thi', OLD.id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_participant_student_identity
BEFORE INSERT OR UPDATE OF student_user_id, student_profile_id, student_code, full_name_snapshot, variant_id ON participants
FOR EACH ROW EXECUTE FUNCTION trg_validate_participant_student_identity();


-- Trigger kiem tra tinh tuong thich va khoa bat bien source cua submission khi da co du lieu con
-- Trigger kiem tra tinh tuong thich va khoa bat bien danh tinh (participant_id, exam_id), source va variant_id cua submission
CREATE OR REPLACE FUNCTION trg_validate_submission_source()
RETURNS TRIGGER AS $$
DECLARE
  v_delivery_mode VARCHAR(20);
BEGIN
  -- Khoa bat bien tuyet doi danh tinh participant_id va exam_id sau khi tao submission
  IF TG_OP = 'UPDATE' THEN
    IF NEW.participant_id IS DISTINCT FROM OLD.participant_id THEN
      RAISE EXCEPTION 'Khong duoc phep thay doi thi sinh (participant_id) cua bai lam (submission ID: %)', OLD.id;
    END IF;
    IF NEW.exam_id IS DISTINCT FROM OLD.exam_id THEN
      RAISE EXCEPTION 'Khong duoc phep thay doi ky thi (exam_id) cua bai lam (submission ID: %)', OLD.id;
    END IF;

    -- Khoa bat bien ma de variant_id khi da nop bai hoac da co du lieu tra loi
    IF NEW.variant_id IS DISTINCT FROM OLD.variant_id THEN
      IF OLD.status <> 'IN_PROGRESS' THEN
        RAISE EXCEPTION 'Khong the thay doi ma de (variant_id) khi bai lam da o trang thai %', OLD.status;
      END IF;
      IF EXISTS (SELECT 1 FROM student_answers WHERE submission_id = OLD.id) OR
         EXISTS (SELECT 1 FROM scan_images WHERE submission_id = OLD.id) OR
         EXISTS (SELECT 1 FROM detected_answers WHERE submission_id = OLD.id) THEN
        RAISE EXCEPTION 'Khong the thay doi ma de (variant_id) cua submission (ID: %) khi da phat sinh cau tra loi hoac anh quet', OLD.id;
      END IF;
    END IF;
  END IF;

  -- 1. Khi UPDATE source tren submission: Khoa bat bien neu bai lam da co du lieu con hoac da roi IN_PROGRESS
  IF TG_OP = 'UPDATE' AND (NEW.source IS DISTINCT FROM OLD.source) THEN
    IF OLD.status <> 'IN_PROGRESS' THEN
      RAISE EXCEPTION 'Khong the thay doi nguon bai lam (source) khi submission da o trang thai % (source la bat bien sau khi nop/dong phien)', OLD.status;
    END IF;

    IF EXISTS (SELECT 1 FROM student_answers WHERE submission_id = OLD.id) OR
       EXISTS (SELECT 1 FROM scan_images WHERE submission_id = OLD.id) OR
       EXISTS (SELECT 1 FROM detected_answers WHERE submission_id = OLD.id) THEN
      RAISE EXCEPTION 'Khong the thay doi nguon bai lam (source) cua submission (ID: %) khi da phat sinh du lieu con (student_answers, scan_images, hoac detected_answers)', OLD.id;
    END IF;
  END IF;

  -- 2. Kiem tra tinh tuong thich giua submission source va delivery_mode cua ky thi
  SELECT delivery_mode INTO v_delivery_mode FROM exams WHERE id = NEW.exam_id;
  
  IF v_delivery_mode = 'ONLINE' AND NEW.source <> 'ONLINE' THEN
    RAISE EXCEPTION 'Ky thi (ID: %) chi to chuc thi ONLINE, khong chap nhan bai lam nguon %', NEW.exam_id, NEW.source;
  ELSIF v_delivery_mode = 'PAPER' AND NEW.source <> 'PAPER' THEN
    RAISE EXCEPTION 'Ky thi (ID: %) chi to chuc thi tren giay (PAPER), khong chap nhan bai lam nguon %', NEW.exam_id, NEW.source;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_submission_source
BEFORE INSERT OR UPDATE OF participant_id, exam_id, variant_id, source ON submissions
FOR EACH ROW EXECUTE FUNCTION trg_validate_submission_source();

-- Kiem tra rang buoc: cau tra loi phai thuoc dung ma de cua bai lam
CREATE OR REPLACE FUNCTION trg_check_student_answer_variant()
RETURNS TRIGGER AS $$
DECLARE
  v_sub_variant_id UUID;
  v_q_variant_id   UUID;
BEGIN
  SELECT variant_id INTO v_sub_variant_id FROM submissions WHERE id = NEW.submission_id;
  SELECT variant_id INTO v_q_variant_id FROM exam_variant_questions WHERE id = NEW.exam_variant_question_id;

  IF v_sub_variant_id IS NULL THEN
    RAISE EXCEPTION 'Khong the luu cau tra loi: Bai lam (ID: %) chua duoc gan ma de hop le', NEW.submission_id;
  END IF;

  IF v_q_variant_id IS NULL OR v_sub_variant_id <> v_q_variant_id THEN
    RAISE EXCEPTION 'Cau hoi (ID: %) khong thuoc ma de (%) cua bai lam (ID: %)', NEW.exam_variant_question_id, v_sub_variant_id, NEW.submission_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_student_answer_variant
BEFORE INSERT OR UPDATE ON student_answers
FOR EACH ROW EXECUTE FUNCTION trg_check_student_answer_variant();

-- Trigger chong xung dot Autosave dua tren client_sequence
-- Chi kiem tra khi co thay doi ve phuong an tra loi hoac client gui sequence moi, tranh xung dot voi tien trinh cham diem (cap nhat score, grading_status)
CREATE OR REPLACE FUNCTION trg_enforce_student_answer_client_sequence()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.client_sequence IS DISTINCT FROM OLD.client_sequence) OR
       (NEW.selected_options IS DISTINCT FROM OLD.selected_options) OR
       (NEW.answer_text IS DISTINCT FROM OLD.answer_text) OR
       (NEW.response_data IS DISTINCT FROM OLD.response_data) THEN
      IF NEW.client_sequence <= OLD.client_sequence THEN
        RAISE EXCEPTION 'Xung dot Autosave: client_sequence moi (%) phai lon hon sequence hien tai (%)', NEW.client_sequence, OLD.client_sequence;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_student_answer_sequence
BEFORE UPDATE OF client_sequence, selected_options, answer_text, response_data
ON student_answers
FOR EACH ROW EXECUTE FUNCTION trg_enforce_student_answer_client_sequence();

-- Khoa bat bien cau tra loi student_answers va kiem soat cap nhat diem chi qua grading engine
CREATE OR REPLACE FUNCTION trg_enforce_student_answer_immutability()
RETURNS TRIGGER AS $$
DECLARE
  v_submission_status VARCHAR(20);
  v_target_sub_id     UUID;
  v_valid_sag_exists  BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_target_sub_id := OLD.submission_id;
  ELSE
    v_target_sub_id := NEW.submission_id;
  END IF;

  -- 1. Danh tinh ban ghi (submission_id, exam_variant_question_id) la bat bien tuyet doi
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.submission_id IS DISTINCT FROM OLD.submission_id) OR
       (NEW.exam_variant_question_id IS DISTINCT FROM OLD.exam_variant_question_id) THEN
      RAISE EXCEPTION 'Khong duoc phep thay doi danh tinh ban ghi (submission_id, exam_variant_question_id) tren student_answers';
    END IF;
  END IF;

  SELECT status INTO v_submission_status FROM submissions WHERE id = v_target_sub_id;

  -- 2. Khi bai lam da nop hoac ket thuc phien
  IF v_submission_status IN ('SUBMITTED', 'GRADING', 'GRADED', 'FLAGGED', 'VOID') THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Khong the xoa cau tra loi khi bai lam (ID: %) da o trang thai %', v_target_sub_id, v_submission_status;
    ELSIF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Khong the them moi cau tra loi khi bai lam (ID: %) da o trang thai %', v_target_sub_id, v_submission_status;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Khoa tuyet doi noi dung tra loi va sequence autosave
      IF (NEW.selected_options IS DISTINCT FROM OLD.selected_options) OR
         (NEW.answer_text IS DISTINCT FROM OLD.answer_text) OR
         (NEW.response_data IS DISTINCT FROM OLD.response_data) OR
         (NEW.client_sequence IS DISTINCT FROM OLD.client_sequence) THEN
        RAISE EXCEPTION 'Khong the sua doi cau tra loi: Bai lam (ID: %) da o trang thai %', v_target_sub_id, v_submission_status;
      END IF;

      -- Kiem soat chat che viec cap nhat diem va trang thai cham
      IF (NEW.score IS DISTINCT FROM OLD.score) OR
         (NEW.grading_status IS DISTINCT FROM OLD.grading_status) THEN
        -- Chi cho phep cap nhat khi duoc kich hoat tu trigger cham thi dong bo tu submission_answer_grades
        IF pg_trigger_depth() <= 1 THEN
          RAISE EXCEPTION 'Diem so (score) va grading_status chi duoc phep cap nhat tu dong qua tien trinh cham thi he thong (submission_answer_grades), cam cap nhat truc tiep tren student_answers';
        END IF;

        SELECT EXISTS (
          SELECT 1 FROM submission_answer_grades sag
          WHERE sag.submission_id = NEW.submission_id
            AND sag.exam_variant_question_id = NEW.exam_variant_question_id
            AND sag.is_final = TRUE
            AND sag.earned_score = NEW.score
            AND sag.grading_status = NEW.grading_status
        ) INTO v_valid_sag_exists;

        IF NOT v_valid_sag_exists THEN
          RAISE EXCEPTION 'Diem so (%) hoac grading_status (%) cap nhat vao student_answers khong khop voi ket qua cham hop le (is_final = TRUE) trong submission_answer_grades',
            NEW.score, NEW.grading_status;
        END IF;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_student_answers
BEFORE INSERT OR UPDATE OR DELETE ON student_answers
FOR EACH ROW EXECUTE FUNCTION trg_enforce_student_answer_immutability();

-- Trigger tu dong ghi audit_logs khi giao vien sua tay ket qua nhan dien OMR
CREATE OR REPLACE FUNCTION trg_audit_detected_answer_correction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.manually_corrected = TRUE AND (OLD.manually_corrected = FALSE OR OLD.manually_corrected IS NULL OR NEW.corrected_options IS DISTINCT FROM OLD.corrected_options) THEN
    INSERT INTO audit_logs (
      id, actor_user_id, action, entity_name, entity_id, 
      old_value, new_value, created_at
    ) VALUES (
      gen_random_uuid(),
      NEW.corrected_by,
      'MANUAL_OMR_CORRECTION',
      'detected_answers',
      NEW.id,
      jsonb_build_object('detected_options', OLD.detected_options, 'detection_status', OLD.detection_status),
      jsonb_build_object('corrected_options', NEW.corrected_options, 'corrected_at', NEW.corrected_at),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_detected_answer_correction
AFTER UPDATE ON detected_answers
FOR EACH ROW EXECUTE FUNCTION trg_audit_detected_answer_correction();

-- Trigger tu dong ghi audit_logs khi ky thi doi trang thai hoac cong bo ket qua
CREATE OR REPLACE FUNCTION trg_audit_exam_sensitive_actions()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Ghi log khi chuyen trang thai ky thi
  IF OLD.status <> NEW.status THEN
    INSERT INTO audit_logs (id, actor_user_id, action, entity_name, entity_id, old_value, new_value, created_at)
    VALUES (
      gen_random_uuid(), COALESCE(NULLIF(current_setting('olms.current_user_id', true), '')::uuid, NEW.created_by), 'EXAM_STATUS_CHANGE', 'exams', NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      now()
    );
  END IF;

  -- 2. Ghi log khi cong bo ket qua
  IF OLD.result_published_at IS NULL AND NEW.result_published_at IS NOT NULL THEN
    INSERT INTO audit_logs (id, actor_user_id, action, entity_name, entity_id, old_value, new_value, created_at)
    VALUES (
      gen_random_uuid(), NEW.result_published_by, 'PUBLISH_RESULTS', 'exams', NEW.id,
      jsonb_build_object('result_visibility_mode', OLD.result_visibility_mode),
      jsonb_build_object('result_visibility_mode', NEW.result_visibility_mode, 'result_published_at', NEW.result_published_at),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_exam_sensitive_actions
AFTER UPDATE OF status, result_published_at ON exams
FOR EACH ROW EXECUTE FUNCTION trg_audit_exam_sensitive_actions();

-- Xac thuc question_position nam trong danh sach cau hoi cua ma de
CREATE OR REPLACE FUNCTION trg_validate_detected_answer_position()
RETURNS TRIGGER AS $$
DECLARE
  v_variant_id UUID;
  v_exists     BOOLEAN;
BEGIN
  SELECT variant_id INTO v_variant_id FROM submissions WHERE id = NEW.submission_id;
  
  IF v_variant_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM exam_variant_questions 
      WHERE variant_id = v_variant_id AND position_in_variant = NEW.question_position
    ) INTO v_exists;

    IF NOT v_exists THEN
      RAISE EXCEPTION 'Vi tri cau hoi (%) tren phieu OMR khong ton tai trong ma de (ID: %)', NEW.question_position, v_variant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_detected_answer_position
BEFORE INSERT OR UPDATE OF question_position, submission_id ON detected_answers
FOR EACH ROW EXECUTE FUNCTION trg_validate_detected_answer_position();

-- Rang buoc: student_answers chi danh cho ONLINE, detected_answers/scan_images chi danh cho PAPER
CREATE OR REPLACE FUNCTION trg_validate_answer_source_type()
RETURNS TRIGGER AS $$
DECLARE
  v_source VARCHAR(10);
BEGIN
  SELECT source INTO v_source FROM submissions WHERE id = NEW.submission_id;

  IF TG_TABLE_NAME = 'student_answers' AND v_source <> 'ONLINE' THEN
    RAISE EXCEPTION 'student_answers chi chap nhan bai lam ONLINE (Bai lam ID: % co source = %)', NEW.submission_id, v_source;
  ELSIF TG_TABLE_NAME IN ('detected_answers', 'scan_images') AND v_source <> 'PAPER' THEN
    RAISE EXCEPTION '% chi chap nhan bai lam giay PAPER (Bai lam ID: % co source = %)', TG_TABLE_NAME, NEW.submission_id, v_source;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_student_answers_source
BEFORE INSERT OR UPDATE OF submission_id ON student_answers
FOR EACH ROW EXECUTE FUNCTION trg_validate_answer_source_type();

CREATE TRIGGER trg_check_detected_answers_source
BEFORE INSERT OR UPDATE OF submission_id ON detected_answers
FOR EACH ROW EXECUTE FUNCTION trg_validate_answer_source_type();

CREATE TRIGGER trg_check_scan_images_source
BEFORE INSERT OR UPDATE OF submission_id ON scan_images
FOR EACH ROW EXECUTE FUNCTION trg_validate_answer_source_type();

-- Tu dong dong bo diem sang student_answers va tinh lai tong diem trong grades
CREATE OR REPLACE FUNCTION trg_sync_grade_and_student_answer()
RETURNS TRIGGER AS $$
DECLARE
  v_total_score   NUMERIC(5,2);
  v_correct_count SMALLINT;
  v_wrong_count   SMALLINT;
  v_blank_count   SMALLINT;
BEGIN
  IF NEW.is_final = TRUE THEN
    -- 1. Dong bo diem va trang thai cham vao student_answers
    UPDATE student_answers
    SET score          = NEW.earned_score,
        grading_status = NEW.grading_status,
        updated_at     = now()
    WHERE submission_id = NEW.submission_id
      AND exam_variant_question_id = NEW.exam_variant_question_id;

    -- 2. Tinh toan lai thong so tu grading_status cua cac cau is_final = TRUE
    SELECT 
      GREATEST(0, COALESCE(SUM(earned_score), 0)),
      COUNT(*) FILTER (WHERE grading_status = 'CORRECT'),
      COUNT(*) FILTER (WHERE grading_status IN ('WRONG', 'PARTIAL')),
      COUNT(*) FILTER (WHERE grading_status = 'BLANK')
    INTO v_total_score, v_correct_count, v_wrong_count, v_blank_count
    FROM submission_answer_grades
    WHERE submission_id = NEW.submission_id AND is_final = TRUE;

    -- 3. Upsert vao bang grades (khoa san >= 0 nho ham GREATEST)
    INSERT INTO grades (submission_id, total_score, correct_count, wrong_count, blank_count, graded_by, graded_at, updated_at)
    VALUES (NEW.submission_id, v_total_score, v_correct_count, v_wrong_count, v_blank_count, NEW.graded_by, now(), now())
    ON CONFLICT (submission_id) DO UPDATE
    SET total_score   = EXCLUDED.total_score,
        correct_count = EXCLUDED.correct_count,
        wrong_count   = EXCLUDED.wrong_count,
        blank_count   = EXCLUDED.blank_count,
        graded_by     = EXCLUDED.graded_by,
        graded_at     = EXCLUDED.graded_at,
        updated_at    = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_after_sag_sync_scores
AFTER INSERT OR UPDATE OF earned_score, grading_status, is_final ON submission_answer_grades
FOR EACH ROW EXECUTE FUNCTION trg_sync_grade_and_student_answer();

-- Trigger bao ve tinh bat bien tuyet doi cua lich su cham thi (submission_answer_grades)
CREATE OR REPLACE FUNCTION trg_enforce_sag_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Cam tuyet doi thao tac DELETE tren bang lich su cham (nguyen tac append-only)
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Khong duoc phep xoa ban ghi lich su cham thi trong submission_answer_grades (nguyen tac append-only).';
  END IF;

  -- Tren thao tac UPDATE: Khoa bat bien tuyet doi moi truong du lieu lich su goc
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.id IS DISTINCT FROM OLD.id) OR
       (NEW.submission_id IS DISTINCT FROM OLD.submission_id) OR
       (NEW.exam_variant_question_id IS DISTINCT FROM OLD.exam_variant_question_id) OR
       (NEW.iteration IS DISTINCT FROM OLD.iteration) OR
       (NEW.earned_score IS DISTINCT FROM OLD.earned_score) OR
       (NEW.max_score IS DISTINCT FROM OLD.max_score) OR
       (NEW.grading_status IS DISTINCT FROM OLD.grading_status) OR
       (NEW.answer_snapshot IS DISTINCT FROM OLD.answer_snapshot) OR
       (NEW.correct_answer_snapshot IS DISTINCT FROM OLD.correct_answer_snapshot) OR
       (NEW.grading_rule_snapshot IS DISTINCT FROM OLD.grading_rule_snapshot) OR
       (NEW.graded_by IS DISTINCT FROM OLD.graded_by) OR
       (NEW.graded_at IS DISTINCT FROM OLD.graded_at) THEN
      RAISE EXCEPTION 'Khong duoc phep sua doi du lieu lich su cham thi trong submission_answer_grades (ID: %). Khi cham lai (regrade), he thong bat buoc phai INSERT ban ghi moi voi iteration cao hon.', OLD.id;
    END IF;

    -- Khoa cap nhat truc tiep is_final: chi cho phep ha co noi bo thong qua grading trigger (pg_trigger_depth() > 1)
    IF NEW.is_final IS DISTINCT FROM OLD.is_final AND pg_trigger_depth() <= 1 THEN
      RAISE EXCEPTION 'Co is_final chi duoc phep thay doi tu dong thong qua Grading Engine (trigger trg_sync_sag_is_final), cam cap nhat truc tiep tu ung dung/SQL client.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_submission_answer_grades
BEFORE UPDATE OR DELETE ON submission_answer_grades
FOR EACH ROW EXECUTE FUNCTION trg_enforce_sag_immutability();


-- Thu tuc chot ket qua cham thi chinh thuc trong mot Transaction
CREATE OR REPLACE PROCEDURE sp_finalize_submission_grading(
  p_submission_id UUID,
  p_graded_by     UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_sub_status      VARCHAR(20);
  v_exam_id         UUID;
  v_total_questions SMALLINT;
  v_exam_max_score  NUMERIC(5,2);
  v_final_count     INT;
  v_total_score     NUMERIC(5,2);
  v_correct_count   SMALLINT;
  v_wrong_count     SMALLINT;
  v_blank_count     SMALLINT;
BEGIN
  -- 1. Kiem tra su ton tai va trang thai cua Submission
  SELECT s.status, s.exam_id, e.total_questions, e.total_score
  INTO v_sub_status, v_exam_id, v_total_questions, v_exam_max_score
  FROM submissions s
  JOIN exams e ON e.id = s.exam_id
  WHERE s.id = p_submission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Khong tim thay bai lam co ID: %', p_submission_id;
  END IF;

  IF v_sub_status NOT IN ('SUBMITTED', 'GRADING') THEN
    RAISE EXCEPTION 'Chi co the chot diem cho bai thi o trang thai SUBMITTED hoac GRADING (hien tai: %)', v_sub_status;
  END IF;

  -- 2. Tinh toan thong nhat theo grading_status tu cac ban ghi is_final = TRUE va kiem tra so luong cau da cham
  SELECT 
    COUNT(*),
    GREATEST(0, COALESCE(SUM(earned_score), 0)),
    COUNT(*) FILTER (WHERE grading_status = 'CORRECT'),
    COUNT(*) FILTER (WHERE grading_status IN ('WRONG', 'PARTIAL')),
    COUNT(*) FILTER (WHERE grading_status = 'BLANK')
  INTO v_final_count, v_total_score, v_correct_count, v_wrong_count, v_blank_count
  FROM submission_answer_grades
  WHERE submission_id = p_submission_id AND is_final = TRUE;

  -- Kiem tra da cham du tat ca cac cau theo quy dinh ky thi
  IF v_final_count <> v_total_questions THEN
    RAISE EXCEPTION 'Bai thi chua duoc cham du so cau: da cham %/% cau theo quy dinh cua ky thi (submission_id: %)', 
      v_final_count, v_total_questions, p_submission_id;
  END IF;

  -- Kiem tra tong diem khong duoc vuot qua thang diem toi da cua ky thi
  IF v_total_score > v_exam_max_score THEN
    RAISE EXCEPTION 'Tong diem cham duoc (%) vuot qua thang diem toi da cua ky thi (%)', 
      v_total_score, v_exam_max_score;
  END IF;

  -- 3. Ghi nhan hoac cap nhat vao grades
  INSERT INTO grades (
    id, submission_id, total_score, correct_count, wrong_count, blank_count, 
    graded_by, graded_at, updated_at
  ) VALUES (
    gen_random_uuid(), p_submission_id, v_total_score, v_correct_count, v_wrong_count, v_blank_count, 
    p_graded_by, now(), now()
  )
  ON CONFLICT (submission_id) DO UPDATE
  SET total_score   = EXCLUDED.total_score,
      correct_count = EXCLUDED.correct_count,
      wrong_count   = EXCLUDED.wrong_count,
      blank_count   = EXCLUDED.blank_count,
      graded_by     = EXCLUDED.graded_by,
      graded_at     = EXCLUDED.graded_at,
      updated_at    = now();

  -- 4. Cap nhat trang thai bai nop sang GRADED
  UPDATE submissions 
  SET status = 'GRADED', 
      raw_score = v_total_score,
      updated_at = now() 
  WHERE id = p_submission_id;
END;
$$;

-- Tu dong ha co is_final cua cac lan cham cu khi xuat hien lan cham moi is_final = TRUE
CREATE OR REPLACE FUNCTION trg_manage_sag_is_final()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_final = TRUE THEN
    UPDATE submission_answer_grades
    SET is_final = FALSE
    WHERE submission_id = NEW.submission_id
      AND exam_variant_question_id = NEW.exam_variant_question_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND is_final = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_sag_is_final
BEFORE INSERT OR UPDATE OF is_final ON submission_answer_grades
FOR EACH ROW EXECUTE FUNCTION trg_manage_sag_is_final();

-- Kiem tra rang buoc: ket qua cham phai thuoc dung ma de cua bai lam
CREATE OR REPLACE FUNCTION trg_check_submission_answer_grade_variant()
RETURNS TRIGGER AS $$
DECLARE
  v_sub_variant_id UUID;
  v_q_variant_id   UUID;
BEGIN
  SELECT variant_id INTO v_sub_variant_id FROM submissions WHERE id = NEW.submission_id;
  SELECT variant_id INTO v_q_variant_id FROM exam_variant_questions WHERE id = NEW.exam_variant_question_id;

  IF v_sub_variant_id IS NULL OR v_q_variant_id IS NULL OR v_sub_variant_id <> v_q_variant_id THEN
    RAISE EXCEPTION 'Loi ma de: Cau hoi (ID: %, variant: %) khong khop voi ma de cua bai lam (ID: %, variant: %)',
      NEW.exam_variant_question_id, v_q_variant_id, NEW.submission_id, v_sub_variant_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_submission_answer_grade_variant
BEFORE INSERT OR UPDATE OF submission_id, exam_variant_question_id
ON submission_answer_grades
FOR EACH ROW EXECUTE FUNCTION trg_check_submission_answer_grade_variant();
-- P-07: trigger kiểm tra liên kết scan_images
-- DB guard against cross-exam/misassigned PAPER images even if API validation is bypassed.
CREATE OR REPLACE FUNCTION trg_validate_olms_scan_binding()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
 v_source VARCHAR(10);
 v_variant UUID;
 v_participant UUID;
 v_participant_variant UUID;
 v_participant_exam UUID;
 v_submission_exam UUID;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.exam_id IS DISTINCT FROM OLD.exam_id THEN
     RAISE EXCEPTION 'SCAN_EXAM_IMMUTABLE';
   END IF;
   IF OLD.association_status='LINKED' AND (
      NEW.submission_id IS DISTINCT FROM OLD.submission_id OR
      NEW.association_status IS DISTINCT FROM OLD.association_status OR
      NEW.page_no IS DISTINCT FROM OLD.page_no OR
      NEW.binding_actor IS DISTINCT FROM OLD.binding_actor OR
      NEW.binding_at IS DISTINCT FROM OLD.binding_at OR
      NEW.binding_note IS DISTINCT FROM OLD.binding_note) THEN
     RAISE EXCEPTION 'LINKED_SCAN_BINDING_IMMUTABLE';
   END IF;
 END IF;
 IF NEW.association_status='LINKED' THEN
   IF NEW.submission_id IS NULL OR NEW.binding_actor IS NULL OR NEW.binding_at IS NULL
      OR NEW.binding_note IS NULL OR length(btrim(NEW.binding_note))<8 THEN
     RAISE EXCEPTION 'SCAN_LINK_REQUIRES_AUDIT';
   END IF;
   SELECT source,variant_id,participant_id,exam_id
     INTO v_source,v_variant,v_participant,v_submission_exam
     FROM submissions WHERE id=NEW.submission_id;
   IF v_source IS DISTINCT FROM 'PAPER' OR v_submission_exam IS DISTINCT FROM NEW.exam_id THEN
     RAISE EXCEPTION 'SCAN_SUBMISSION_SOURCE_OR_EXAM_MISMATCH';
   END IF;
   SELECT variant_id,exam_id INTO v_participant_variant,v_participant_exam
      FROM participants WHERE id=v_participant AND deleted_at IS NULL;
   IF v_participant_exam IS DISTINCT FROM NEW.exam_id OR
      v_participant_variant IS DISTINCT FROM v_variant THEN
      RAISE EXCEPTION 'SCAN_PARTICIPANT_VARIANT_MISMATCH';
   END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_check_olms_scan_binding ON scan_images;
CREATE TRIGGER trg_check_olms_scan_binding
 BEFORE INSERT OR UPDATE ON scan_images
 FOR EACH ROW EXECUTE FUNCTION trg_validate_olms_scan_binding();



-- P07 late-binding transaction helper
-- P07 transactional binding helper. Must be called inside an API transaction.
-- API is responsible for validating teacher JWT/ownership, detected answers, audit events, and object ACL.
CREATE OR REPLACE FUNCTION olms_bind_omr_scan(
 p_scan_id UUID, p_participant_id UUID, p_variant_id UUID, p_actor_id UUID, p_reason TEXT
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
 v_scan scan_images%ROWTYPE;
 v_participant participants%ROWTYPE;
 v_variant exam_variants%ROWTYPE;
 v_submissions submissions%ROWTYPE;
 v_submission_id UUID;
 v_exam_mode TEXT;
 v_exam_owner UUID;
BEGIN
 SELECT * INTO v_scan FROM scan_images WHERE id=p_scan_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OMR_SCAN_NOT_FOUND'; END IF;
 IF v_scan.association_status='LINKED' THEN
   IF EXISTS (SELECT 1 FROM submissions s WHERE s.id=v_scan.submission_id
      AND s.participant_id=p_participant_id AND s.variant_id=p_variant_id) THEN
     RETURN v_scan.submission_id;
   END IF;
   RAISE EXCEPTION 'SCAN_ALREADY_LINKED';
 END IF;
 IF v_scan.association_status='REJECTED' OR
    v_scan.processing_status IN ('REJECTED','NEEDS_RESCAN') THEN
   RAISE EXCEPTION 'SCAN_NEEDS_REVIEW_OR_RESCAN';
 END IF;
 IF p_reason IS NULL OR length(btrim(p_reason))<8 THEN
   RAISE EXCEPTION 'BINDING_REASON_REQUIRED';
 END IF;
 SELECT delivery_mode, created_by INTO v_exam_mode,v_exam_owner FROM exams WHERE id=v_scan.exam_id;
 IF v_exam_mode NOT IN ('PAPER','BOTH') THEN RAISE EXCEPTION 'EXAM_NOT_PAPER'; END IF;
 IF v_exam_owner IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'EXAM_OWNERSHIP_DENIED'; END IF;
 SELECT * INTO v_participant FROM participants
   WHERE id=p_participant_id AND exam_id=v_scan.exam_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PARTICIPANT_NOT_IN_EXAM'; END IF;
 IF v_participant.variant_id IS NULL OR v_participant.variant_id<>p_variant_id THEN
   RAISE EXCEPTION 'ASSIGNED_VARIANT_MISMATCH';
 END IF;
 SELECT * INTO v_variant FROM exam_variants
  WHERE id=p_variant_id AND exam_id=v_scan.exam_id AND deleted_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'VARIANT_NOT_IN_EXAM'; END IF;
 SELECT * INTO v_submissions FROM submissions WHERE participant_id=p_participant_id FOR UPDATE;
 IF FOUND THEN
   IF v_submissions.source<>'PAPER' OR v_submissions.exam_id<>v_scan.exam_id
      OR v_submissions.variant_id<>p_variant_id OR v_submissions.status<>'SUBMITTED' THEN
      RAISE EXCEPTION 'EXISTING_SUBMISSION_CONFLICT';
   END IF;
   v_submission_id := v_submissions.id;
 ELSE
   INSERT INTO submissions(participant_id,exam_id,variant_id,source,started_at,
                            submitted_at,status)
      VALUES(p_participant_id,v_scan.exam_id,p_variant_id,'PAPER',now(),now(),'SUBMITTED')
      RETURNING id INTO v_submission_id;
 END IF;
 IF EXISTS (SELECT 1 FROM scan_images
             WHERE submission_id=v_submission_id AND page_no=v_scan.page_no AND id<>p_scan_id) THEN
    RAISE EXCEPTION 'DUPLICATE_PAPER_PAGE';
 END IF;
 UPDATE scan_images SET submission_id=v_submission_id, association_status='LINKED',
      binding_actor=p_actor_id,binding_at=now(),binding_note=p_reason
   WHERE id=p_scan_id AND association_status IN ('UNMATCHED','NEEDS_REVIEW');
 IF NOT FOUND THEN RAISE EXCEPTION 'CONCURRENT_SCAN_BINDING'; END IF;
 -- Insert detected_answers using the recognition snapshot only after this point,
 -- in the SAME API transaction before commit; grade/approve is a later operation.
 RETURN v_submission_id;
END $$;
