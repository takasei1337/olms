# OLMS Database

Thư mục này chứa mã SQL phục vụ xây dựng cơ sở dữ liệu của hệ thống OLMS.

## Cấu trúc thư mục

### `migrations-original/`

Lưu bộ SQL gốc từ tài liệu thiết kế, dùng để tham khảo và đối chiếu.

Không chỉnh sửa trực tiếp các file trong thư mục này khi cần thay đổi cấu hình triển khai.

### `schema-pg17/`

Chứa bộ SQL đã điều chỉnh để triển khai trên PostgreSQL 17 thông qua Supabase (bao gồm cả cập nhật ARC-02 chống lệch tủ đề thi).

Các điều chỉnh hiện tại bao gồm:

- Sử dụng `gen_random_uuid()` thay cho `uuidv7()` để tương thích với PostgreSQL 17.
- Bổ sung cột `questions.topic_tag`, `exam_matrices.max_questions_per_topic` và index/constraint đi kèm (`ARC-02`).
- Bổ sung cấu hình thu hồi quyền thực thi routine trực tiếp của `anon` và `authenticated`.
- Giữ các cấu hình phân quyền dành cho API, Worker và Readonly.

### `migrations/`

Chứa các file migration gia tăng áp dụng trên môi trường Supabase/PostgreSQL 17:

- `001_create_refresh_tokens.sql`: Tạo bảng `public.refresh_tokens` phục vụ xoay vòng phiên đăng nhập (IAM) kèm RLS.
- `002_rotate_refresh_token.sql`: Hàm `public.rotate_refresh_token` xử lý xoay vòng refresh token an toàn chống race condition.
- `003_arc02_topic_balancing.sql`: Migration bổ sung `questions.topic_tag`, `exam_matrices.max_questions_per_topic` và cập nhật hàm `get_exam_publish_readiness` theo ARC-02.
- `004_generate_exam_variants.sql`: Định nghĩa hàm sinh mã đề nguyên tử. Service Express hiện chưa gọi RPC này; luồng JavaScript vẫn ghi nhiều request riêng và cần kiểm thử atomicity/rollback.

Bộ fresh schema có 23 bảng nghiệp vụ; migration 001 bổ sung `refresh_tokens`, tổng cộng 24 bảng. `00_apply_fresh.sql` không tự chạy các migration 001–004 hoặc file `07_security_postcheck.sql`; phải đối chiếu môi trường và chạy postcheck riêng. Các cột ARC-02 đã nằm trong fresh schema, migration 003 phục vụ nâng cấp database cũ.

## Môi trường phát triển

- Nền tảng cơ sở dữ liệu: Supabase
- Hệ quản trị cơ sở dữ liệu: PostgreSQL 17
- Supabase project: `olms-dev`

## Lưu ý triển khai

- `00_apply_fresh.sql` sử dụng lệnh `\ir` dành cho `psql`, không chạy trực tiếp toàn bộ file này trong Supabase SQL Editor.
- Khi sử dụng Supabase SQL Editor, cần thực thi các file SQL thành phần theo đúng thứ tự và xử lý các phụ thuộc giữa chúng.
- File `07_security_postcheck.sql` được sử dụng để kiểm tra một số điều kiện phân quyền sau triển khai.
- Không đưa database password, connection string chứa mật khẩu hoặc Supabase service role key vào Git.

## Trạng thái

Cấu trúc cơ sở dữ liệu và phân quyền ban đầu đã được triển khai trên môi trường phát triển. Các kiểm thử nghiệp vụ và bảo mật toàn diện vẫn cần được thực hiện trước khi sử dụng trong production.
