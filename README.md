## 1. Tổng quan dự án

OLMS là hệ thống quản lý toàn diện khảo thí từ ngân hàng câu hỏi đến tạo đề thi và chấm thi, phục vụ cho giáo viên (teacher) và sinh viên (student), đồng thời tạo chức năng cho admin quản lý hệ thống. Hệ thống có 4 nhóm nghiệp vụ chính gồm: Quản lý ngân hàng câu hỏi, Tạo đề thi, Công tác thi và Công tác chấm thi. Hệ thống xây dựng nhằm khắc phục tình trạng câu hỏi chất lượng kém khi chọn random (trùng lặp ý tưởng), tạo đề thi có thể kiểm soát mức độ bao phủ kiến thức, chấm thi chính xác (có thể giải trình cho sinh viên về điểm thi), đồng thời phục vụ cho cả thi trực tuyến và thi giấy. MVP của dự án triển khai đầy đủ từ đưa câu hỏi vào hệ thống, sinh đề, tổ chức thi, chấm thi. Giai đoạn MVP, OMR trong khâu chấm thi được sử dụng trên server, OMR chạy offline trên di động được xem là hướng mở rộng trong giai đoạn sau.

## 2. Đặc tả yêu cầu hệ thống

### 2.1. Quản lý ngân hàng câu hỏi

Hệ thống quản lý câu hỏi theo phân cấp Môn -> Chương -> Bài -> Câu hỏi. Hệ thống hỗ trợ 5 dạng câu hỏi là 1-choice, multi-choice, dropdown, nhập đáp án, nối đáp án. Tích hợp AI Service để rà soát trùng lặp ý tưởng giữa các câu hỏi kể cả những câu hỏi chỉ thay số đổi chữ.

Khi AI phát hiện câu hỏi trùng lặp, hệ thống gửi cảnh báo trùng lặp cho giáo viên, giáo viên đối chiếu, giáo viên có thể hủy tạo câu hỏi hoặc nếu giáo viên có lý do hợp lệ để chấp nhận câu hỏi mới, giáo viên có thể lưu câu hỏi mà vẫn không thay đổi câu hỏi trước đó, tuy nhiên cần nhập lý do, và hệ thống lưu lại thông tin giáo viên đã lưu câu hỏi phục vụ đối soát. Nếu AI Service gặp lỗi, hệ thống đánh dấu câu hỏi là SKIPPED_TIMEOUT để biết câu hỏi này đã bị bỏ qua bước kiểm tra trùng lặp và câu hỏi được đưa vào hàng chờ để khi AI Service hoạt động trở lại, câu hỏi sẽ được kiểm tra trùng lặp.

### 2.2. Tạo đề thi

Giáo viên thiết lập ma trận đề, số câu dựa trên các tiêu chí chương -> bài -> dạng câu hỏi. Hệ thống sinh đề gốc và tự động trộn thứ tự câu hỏi và đáp án để tạo ra nhiều mã đề mới. Hệ thống lưu ánh xạ câu hỏi đến phiên bản câu hỏi gốc để giáo viên có thể dễ dàng chấm điểm và thống kê chính xác.

## 3. Luồng dữ liệu

### 3.1. Luồng tạo và lưu câu hỏi

Khi giáo viên nhập câu hỏi và nhấn Lưu, Frontend thu thập dữ liệu từ biểu mẫu và gửi yêu cầu đến Backend thông qua API. Backend xác thực người dùng, kiểm tra quyền truy cập, tính hợp lệ của dữ liệu và thực hiện các quy tắc nghiệp vụ trước khi lưu. Nếu yêu cầu hợp lệ, Backend ghi dữ liệu câu hỏi vào Database; trạng thái và khả năng sử dụng câu hỏi tiếp tục tuân theo quy trình kiểm tra trùng lặp bằng AI. Sau khi xử lý, Backend trả kết quả về Frontend để thông báo cho giáo viên biết thao tác thành công hoặc lỗi cần khắc phục.

## 4. Thiết kế cơ sở dữ liệu

- **Hệ quản trị mục tiêu**: PostgreSQL 18 (bộ DDL chuẩn tại `docs/11_SQL_DDL_Migrations.zip`) và PostgreSQL 17 trên Supabase (bộ thích ứng `database/schema-pg17/` + migration gia tăng `database/migrations/`).
- **Quy mô bảng**: 23 bảng nghiệp vụ cốt lõi (`users`, `student_profiles`, `audit_logs`, `subjects`, `chapters`, `lessons`, `question_types`, `questions`, `question_versions`, `answer_options`, `form_templates`, `exams`, `exam_matrices`, `exam_grading_rules`, `exam_variants`, `exam_variant_questions`, `participants`, `submissions`, `student_answers`, `scan_images`, `detected_answers`, `grades`, `submission_answer_grades`) cùng bảng `refresh_tokens` cho IAM Token Rotation.
- **Tính toàn vẹn & Quyết định thiết kế**:
  - Soft Delete chuẩn hóa (`deleted_at`, `deleted_by`) kết hợp khóa ngoại `RESTRICT` (`P-03`) và bảng `audit_logs` append-only.
  - Snapshot đề thi bất biến tại `question_versions.options_snapshot` (`P-06`) với 5 dạng câu hỏi chuẩn (`SINGLE_CHOICE`, `MULTI_CHOICE`, `DROPDOWN`, `INPUT`, `MATCHING`).
  - CSDL là nguồn chân lý cho đồng hồ/hạn nộp (`P-04`: `min(started_at + duration, closes_at)`), Autosave CAS theo từng câu (`ARC-01`: `olms_autosave_online_cas`), OMR staging (`P-07`), vòng đời kỳ thi 8 trạng thái (`P-08`) và cột cân bằng chủ đề `questions.topic_tag` / `exam_matrices.max_questions_per_topic` (`ARC-02`).
  - Xem chi tiết ERD tại `docs/07_CSDL_ERD.dbml` và hướng dẫn triển khai SQL tại `database/README.md`.

## 5. Kiến trúc hệ thống

- **Phong cách kiến trúc**: RESTful Modular Backend (`backend/`, Node.js + Express 5 + Supabase/PostgreSQL) tách biệt với Async Workers (AI Semantic Check & OMR Server-side Processing) và chuẩn hóa giao diện bằng hệ thống Design Tokens 3 tầng (`design-tokens/`).
- **Xác thực & Phân quyền (`JWT + RBAC`)**:
  - Access Token JWT thời hạn **15 phút (`expires_in: 900`)** gửi qua Header `Authorization: Bearer <token>`, kết hợp Refresh Token HttpOnly Cookie có xoay vòng & phát hiện tái sử dụng.
  - Phân quyền RBAC (`P-02`): `ADMIN` có toàn quyền quản trị hệ thống và điều hành nghiệp vụ (trừ `/me/*` của thí sinh); `TEACHER` toàn quyền trên cây tri thức, câu hỏi, kỳ thi, thí sinh và OMR **do mình sở hữu** (riêng `POST/PATCH/DELETE /question-types` chỉ dành cho `ADMIN`); `STUDENT` thao tác phiên thi và xem kết quả cá nhân theo chính sách hiển thị `P-05`.
- **Cân bằng đề thi & Bảo toàn phiên thi**:
  - Sinh đề Hybrid 2 lớp **ARC-02** (`Lớp 1`: giới hạn cứng ≤ 2 câu/`topic_tag`; `Lớp 2`: AI Semantic Guardrail lọc câu trùng ý tưởng > 0.70).
  - Lưu bài trực tuyến dùng **Compare-And-Swap (`ARC-01`)** chống xung đột đa tab và cho phép retry ACK idempotent.

## 6. Cấu trúc dự án & Khởi chạy phát triển

- `backend/`: REST API server mặc định tại `http://localhost:3000/api/v1` (36/82 OpenAPI endpoints đã triển khai + `GET /health`, 46 endpoints trả `501 NOT_IMPLEMENTED` chờ các giai đoạn tiếp theo). Chạy kiểm thử đơn vị và kiểm thử bảo mật OWASP:
  ```bash
  npm --prefix backend test
  npm --prefix backend run test:security
  ```
- `database/`: Schema PostgreSQL 17/Supabase và migrations.
- `design-tokens/`: Primitive → Semantic → Component tokens (`tokens.json`, `tokens.css`, `tailwind.tokens.js`).
- `api-tests/`: Hợp đồng OpenAPI `06_OpenAPI_3.0.yaml` (82 operations) và bộ Bruno `api-tests/OLMS Backend/` (36 file `.yml` gồm 35 kịch bản request + `opencollection.yml`).
- `docs/`: Tài liệu SRS/SAD/CSDL/API/Test Plan, sơ đồ tuần tự, JSON Schemas và báo cáo tiến độ (`docs/agents/tien-do.md`).