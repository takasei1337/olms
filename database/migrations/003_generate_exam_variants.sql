-- =====================================================================
-- Migration: 003_generate_exam_variants.sql
-- Module: Exams - Atomic Generation of Exam Variants & Shuffled Options
-- Target: PostgreSQL 17 / Supabase
-- Description: Sinh đề gốc và các mã đề hoán vị bằng một transaction
--              nguyên tử, kiểm tra ma trận, điều kiện AI, đóng băng câu hỏi,
--              và chuyển trạng thái DRAFT -> GENERATED.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.olms_generate_exam_variants(
    p_exam_id UUID,
    p_variant_count INT,
    p_variant_code_start VARCHAR(10),
    p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_exam RECORD;
    v_matrix_questions INT;
    v_matrix_score NUMERIC(5,2);
    v_start_code_num BIGINT;
    v_curr_code_num BIGINT;
    v_max_code_num BIGINT;
    v_code_len INT;
    v_curr_str TEXT;
    v_root_variant_id UUID;
    v_child_variant_id UUID;
    v_code VARCHAR(10);
    v_all_codes VARCHAR(10)[] := ARRAY[]::VARCHAR(10)[];
    v_generated_at TIMESTAMPTZ := clock_timestamp();
    v_variants_json JSONB := '[]'::JSONB;
    v_row RECORD;
    v_q RECORD;
    v_pos INT;
    v_inserted_count INT;
    v_total_selected INT;
    v_distinct_selected INT;
    v_var_idx INT;
BEGIN
    -- 1. Kiểm tra tham số đầu vào và tránh tràn số nguyên / cắt xén mã đề
    IF p_variant_count IS NULL OR p_variant_count < 1 OR p_variant_count > 100 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: variant_count must be an integer between 1 and 100'
            USING ERRCODE = 'P0001';
    END IF;

    IF p_variant_code_start IS NULL OR p_variant_code_start !~ '^[0-9]{3,10}$' THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: variant_code_start must be a numeric string between 3 and 10 digits (e.g. "101")'
            USING ERRCODE = 'P0001';
    END IF;

    -- Dùng BIGINT để không tràn số nguyên khi parse chuỗi số đến 10 chữ số
    v_start_code_num := p_variant_code_start::BIGINT;
    v_max_code_num := v_start_code_num + p_variant_count - 1;
    v_code_len := length(p_variant_code_start);

    -- Kiểm tra nếu mã đề cuối cùng vượt quá độ dài tối đa VARCHAR(10) của cột variant_code
    IF length(v_max_code_num::TEXT) > 10 THEN
        RAISE EXCEPTION 'VARIANT_CODE_OVERFLOW: Last generated variant code (%) would exceed column limit of 10 characters', v_max_code_num
            USING ERRCODE = 'P0001';
    END IF;

    -- Mã đề gốc (v_all_codes[1]) luôn bằng CHÍNH XÁC variant_code_start ban đầu
    v_all_codes := array_append(v_all_codes, p_variant_code_start);

    -- Các mã đề tiếp theo (2..N): Giữ độ dài padding gốc, tự động mở rộng nếu số vượt chữ số (vd: "999" -> "1000", "009" -> "010")
    IF p_variant_count > 1 THEN
        FOR v_var_idx IN 2..p_variant_count LOOP
            v_curr_code_num := v_start_code_num + v_var_idx - 1;
            v_curr_str := v_curr_code_num::TEXT;
            IF length(v_curr_str) < v_code_len THEN
                v_code := lpad(v_curr_str, v_code_len, '0');
            ELSE
                v_code := v_curr_str;
            END IF;
            v_all_codes := array_append(v_all_codes, v_code);
        END LOOP;
    END IF;

    -- 2. Kiểm tra người thực hiện (nếu truyền vào)
    IF p_created_by IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_created_by AND deleted_at IS NULL AND status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'USER_NOT_FOUND: User % does not exist or is inactive', p_created_by
            USING ERRCODE = 'P0013';
    END IF;

    -- 3. Khóa hàng kỳ thi để chống Race Condition khi gọi đồng thời (Concurrency Control)
    SELECT id, code, name, subject_id, status, total_questions, total_score, opens_at, closes_at
    INTO v_exam
    FROM public.exams
    WHERE id = p_exam_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'EXAM_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    -- Kiểm tra trạng thái kỳ thi: Bắt buộc phải là DRAFT
    IF v_exam.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'EXAM_NOT_IN_DRAFT: Exam must be in DRAFT status to generate variants (current status: %)', v_exam.status
            USING ERRCODE = 'P0003';
    END IF;

    -- Kiểm tra nếu kỳ thi đã có biến thể trước đó
    IF EXISTS (
        SELECT 1 FROM public.exam_variants WHERE exam_id = p_exam_id AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'VARIANTS_ALREADY_EXIST: Exam already has generated variants'
            USING ERRCODE = 'P0008';
    END IF;

    -- Kiểm tra xung đột mã đề với các mã đề đã tồn tại trong kỳ thi này
    IF EXISTS (
        SELECT 1 FROM public.exam_variants ev
        WHERE ev.exam_id = p_exam_id AND ev.variant_code = ANY(v_all_codes)
    ) THEN
        RAISE EXCEPTION 'VARIANT_CODE_CONFLICT: One or more variant codes already exist for this exam'
            USING ERRCODE = 'P0009';
    END IF;

    -- 4. Kiểm tra tính toàn vẹn của Ma trận đề thi (exam_matrices) & Quy tắc chấm (exam_grading_rules)
    SELECT COALESCE(SUM(num_questions), 0), COALESCE(SUM(num_questions * score_per_question), 0)
    INTO v_matrix_questions, v_matrix_score
    FROM public.exam_matrices
    WHERE exam_id = p_exam_id AND deleted_at IS NULL;

    IF v_matrix_questions = 0 THEN
        RAISE EXCEPTION 'MATRIX_EMPTY: Exam matrix has no rows' USING ERRCODE = 'P0004';
    END IF;

    IF v_matrix_questions <> v_exam.total_questions THEN
        RAISE EXCEPTION 'TOTAL_QUESTIONS_MISMATCH: Matrix total questions (%) does not match exam requirement (%)', v_matrix_questions, v_exam.total_questions
            USING ERRCODE = 'P0005';
    END IF;

    IF ABS(v_matrix_score - v_exam.total_score) > 0.001 THEN
        RAISE EXCEPTION 'TOTAL_SCORE_MISMATCH: Matrix total score (%) does not match exam requirement (%)', v_matrix_score, v_exam.total_score
            USING ERRCODE = 'P0006';
    END IF;

    -- Kiểm tra chapter_id trong ma trận: phải thuộc đúng subject của kỳ thi và chưa bị soft-delete
    IF EXISTS (
        SELECT 1 FROM public.exam_matrices m
        WHERE m.exam_id = p_exam_id AND m.deleted_at IS NULL
          AND m.chapter_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.chapters c
              WHERE c.id = m.chapter_id
                AND c.subject_id = v_exam.subject_id
                AND c.deleted_at IS NULL
          )
    ) THEN
        RAISE EXCEPTION 'INVALID_MATRIX_CHAPTER: Matrix row references a chapter that does not belong to the exam subject or is deleted'
            USING ERRCODE = 'P0011';
    END IF;

    -- Kiểm tra lesson_id trong ma trận: phải thuộc chapter hợp lệ của subject và chưa bị soft-delete
    IF EXISTS (
        SELECT 1 FROM public.exam_matrices m
        WHERE m.exam_id = p_exam_id AND m.deleted_at IS NULL
          AND m.lesson_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.lessons l
              JOIN public.chapters c ON c.id = l.chapter_id
              WHERE l.id = m.lesson_id
                AND c.subject_id = v_exam.subject_id
                AND l.deleted_at IS NULL
                AND c.deleted_at IS NULL
                AND (m.chapter_id IS NULL OR m.chapter_id = l.chapter_id)
          )
    ) THEN
        RAISE EXCEPTION 'INVALID_MATRIX_LESSON: Matrix row references a lesson that does not belong to the exam subject/chapter or is deleted'
            USING ERRCODE = 'P0012';
    END IF;

    -- Kiểm tra quy tắc chấm điểm phải đầy đủ cho từng loại câu hỏi trong ma trận
    IF EXISTS (
        SELECT 1 FROM public.exam_matrices m
        WHERE m.exam_id = p_exam_id AND m.deleted_at IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.exam_grading_rules gr
              WHERE gr.exam_id = p_exam_id
                AND gr.question_type_id = m.question_type_id
                AND gr.deleted_at IS NULL
          )
    ) THEN
        RAISE EXCEPTION 'MISSING_GRADING_RULE: Grading rule missing for one or more matrix question types'
            USING ERRCODE = 'P0007';
    END IF;

    -- 5. Bảng tạm lưu trữ câu hỏi được rút từ ngân hàng (tự động xóa khi COMMIT/ROLLBACK)
    CREATE TEMPORARY TABLE _temp_selected_questions (
        matrix_id UUID,
        question_id UUID,
        question_version_id UUID,
        score NUMERIC(5,2),
        options_snapshot JSONB
    ) ON COMMIT DROP;

    -- 6. Rút câu hỏi theo từng dòng ma trận (đảm bảo ACTIVE, AI CHECKED/OVERRIDDEN, is_current = true và đúng môn học)
    FOR v_row IN
        SELECT id, chapter_id, lesson_id, question_type_id, difficulty_level, num_questions, score_per_question
        FROM public.exam_matrices
        WHERE exam_id = p_exam_id AND deleted_at IS NULL
        ORDER BY created_at
    LOOP
        -- Chọn câu hỏi và khóa FOR UPDATE câu hỏi/phiên bản được chọn để chống sửa đổi đồng thời
        INSERT INTO _temp_selected_questions (matrix_id, question_id, question_version_id, score, options_snapshot)
        SELECT v_row.id, q.id, qv.id, v_row.score_per_question, qv.options_snapshot
        FROM public.questions q
        JOIN public.question_versions qv ON qv.question_id = q.id AND qv.is_current = TRUE
        JOIN public.lessons l ON l.id = q.lesson_id AND l.deleted_at IS NULL
        JOIN public.chapters c ON c.id = l.chapter_id AND c.deleted_at IS NULL
        WHERE q.status = 'ACTIVE'
          AND q.deleted_at IS NULL
          AND q.ai_check_status IN ('CHECKED', 'OVERRIDDEN')
          AND qv.type_id = v_row.question_type_id
          AND qv.difficulty_level = v_row.difficulty_level
          AND c.subject_id = v_exam.subject_id
          AND (v_row.chapter_id IS NULL OR c.id = v_row.chapter_id)
          AND (v_row.lesson_id IS NULL OR l.id = v_row.lesson_id)
          AND q.id NOT IN (SELECT question_id FROM _temp_selected_questions)
        ORDER BY random()
        LIMIT v_row.num_questions
        FOR UPDATE OF q, qv;

        -- Xác minh số bản ghi thực sự được chèn vào đúng bằng num_questions
        GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
        IF v_inserted_count <> v_row.num_questions THEN
            RAISE EXCEPTION 'INSUFFICIENT_QUESTIONS: Matrix row (ID: %) expected % questions, but only % available in question bank meeting all active, AI-check, and subject criteria',
                v_row.id, v_row.num_questions, v_inserted_count
                USING ERRCODE = 'P0010';
        END IF;
    END LOOP;

    -- Xác minh tổng số câu hỏi được chọn phải khớp chính xác với total_questions của kỳ thi
    SELECT count(*), count(DISTINCT question_id)
    INTO v_total_selected, v_distinct_selected
    FROM _temp_selected_questions;

    IF v_total_selected <> v_exam.total_questions OR v_distinct_selected <> v_exam.total_questions THEN
        RAISE EXCEPTION 'QUESTION_SELECTION_MISMATCH: Total selected questions (%) does not match exam requirement (%)',
            v_total_selected, v_exam.total_questions
            USING ERRCODE = 'P0010';
    END IF;

    -- 7. Đóng băng các phiên bản câu hỏi (frozen_at)
    UPDATE public.question_versions
    SET frozen_at = v_generated_at
    WHERE id IN (SELECT question_version_id FROM _temp_selected_questions)
      AND frozen_at IS NULL;

    -- 8. Sinh Đề Gốc (Root Variant - is_root = true)
    v_code := v_all_codes[1];
    v_root_variant_id := gen_random_uuid();

    INSERT INTO public.exam_variants (
        id, exam_id, variant_code, is_root, created_at, updated_at
    ) VALUES (
        v_root_variant_id, p_exam_id, v_code, TRUE, v_generated_at, v_generated_at
    );

    v_pos := 1;
    FOR v_q IN
        SELECT question_version_id, score, options_snapshot
        FROM _temp_selected_questions
        ORDER BY matrix_id, question_id
    LOOP
        INSERT INTO public.exam_variant_questions (
            id, variant_id, question_version_id, position_in_variant, option_order, score, created_at
        ) VALUES (
            gen_random_uuid(),
            v_root_variant_id,
            v_q.question_version_id,
            v_pos,
            CASE
                WHEN v_q.options_snapshot ? 'choices' 
                 AND jsonb_typeof(v_q.options_snapshot->'choices') = 'array' 
                 AND jsonb_array_length(v_q.options_snapshot->'choices') > 0 THEN
                    (
                        SELECT COALESCE(
                            jsonb_agg(
                                jsonb_build_object(
                                    'display_label', 
                                    CASE 
                                        WHEN orig.idx <= 26 THEN chr(64 + orig.idx::int)
                                        ELSE chr(64 + ((orig.idx - 1) / 26)::int) || chr(65 + ((orig.idx - 1) % 26)::int)
                                    END,
                                    'choice_id', orig.value->>'id',
                                    'option_id', orig.value->>'id'
                                )
                                ORDER BY orig.idx
                            ),
                            '[]'::jsonb
                        )
                        FROM (
                            SELECT value, row_number() OVER (ORDER BY COALESCE((value->>'order_no')::int, 0), value->>'id') AS idx
                            FROM jsonb_array_elements(v_q.options_snapshot->'choices')
                        ) orig
                    )
                ELSE '[]'::jsonb
            END,
            v_q.score,
            v_generated_at
        );
        v_pos := v_pos + 1;
    END LOOP;

    v_variants_json := v_variants_json || jsonb_build_array(
        jsonb_build_object(
            'id', v_root_variant_id,
            'variant_code', v_code,
            'is_root', TRUE,
            'questions_count', v_exam.total_questions
        )
    );

    -- 9. Sinh các Mã Đề Hoán Vị (Candidate Variants - is_root = false)
    IF p_variant_count > 1 THEN
        FOR v_var_idx IN 2..p_variant_count LOOP
            v_code := v_all_codes[v_var_idx];
            v_child_variant_id := gen_random_uuid();

            INSERT INTO public.exam_variants (
                id, exam_id, variant_code, is_root, created_at, updated_at
            ) VALUES (
                v_child_variant_id, p_exam_id, v_code, FALSE, v_generated_at, v_generated_at
            );

            v_pos := 1;
            FOR v_q IN
                SELECT question_version_id, score, options_snapshot
                FROM _temp_selected_questions
                ORDER BY random()
            LOOP
                INSERT INTO public.exam_variant_questions (
                    id, variant_id, question_version_id, position_in_variant, option_order, score, created_at
                ) VALUES (
                    gen_random_uuid(),
                    v_child_variant_id,
                    v_q.question_version_id,
                    v_pos,
                    CASE
                        WHEN v_q.options_snapshot ? 'choices' 
                         AND jsonb_typeof(v_q.options_snapshot->'choices') = 'array'
                         AND jsonb_array_length(v_q.options_snapshot->'choices') > 0 THEN
                            (
                                SELECT COALESCE(
                                    jsonb_agg(
                                        jsonb_build_object(
                                            'display_label', 
                                            CASE 
                                                WHEN shuffled.idx <= 26 THEN chr(64 + shuffled.idx::int)
                                                ELSE chr(64 + ((shuffled.idx - 1) / 26)::int) || chr(65 + ((shuffled.idx - 1) % 26)::int)
                                            END,
                                            'choice_id', shuffled.value->>'id',
                                            'option_id', shuffled.value->>'id'
                                        )
                                        ORDER BY shuffled.idx
                                    ),
                                    '[]'::jsonb
                                )
                                FROM (
                                    SELECT value, row_number() OVER (ORDER BY random()) AS idx
                                    FROM jsonb_array_elements(v_q.options_snapshot->'choices')
                                ) shuffled
                            )
                        ELSE '[]'::jsonb
                    END,
                    v_q.score,
                    v_generated_at
                );
                v_pos := v_pos + 1;
            END LOOP;

            v_variants_json := v_variants_json || jsonb_build_array(
                jsonb_build_object(
                    'id', v_child_variant_id,
                    'variant_code', v_code,
                    'is_root', FALSE,
                    'questions_count', v_exam.total_questions
                )
            );
        END LOOP;
    END IF;

    -- 10. Chuyển trạng thái kỳ thi DRAFT -> GENERATED (kích hoạt các trigger bảo vệ toàn vẹn)
    UPDATE public.exams
    SET status = 'GENERATED',
        updated_at = v_generated_at
    WHERE id = p_exam_id;

    -- 11. Trả về đối tượng kết quả chuẩn GeneratedExam theo OpenAPI
    RETURN jsonb_build_object(
        'exam_id', p_exam_id,
        'status', 'GENERATED',
        'variants', v_variants_json,
        'generated_at', v_generated_at
    );
END;
$$;

-- Chỉ cấp quyền thực thi cho service_role của backend, thu hồi toàn bộ quyền từ PUBLIC/anon/authenticated
REVOKE ALL ON FUNCTION public.olms_generate_exam_variants(UUID, INT, VARCHAR, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.olms_generate_exam_variants(UUID, INT, VARCHAR, UUID) TO service_role;
