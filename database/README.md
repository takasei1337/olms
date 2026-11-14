# OLMS Database

SQL dùng cho Supabase/PostgreSQL 17. `schema-pg17/` là schema triển khai; `migrations/` chứa thay đổi gia tăng. `migrations-original/` là nguồn tham khảo, không phải entry point để cài database mới.

## Database mới

Dùng database trống dành riêng cho OLMS. Với `psql` đã cấu hình kết nối tới database đích:

```bash
psql -X -v ON_ERROR_STOP=1 -f database/schema-pg17/00_apply_fresh.sql
psql -X -v ON_ERROR_STOP=1 -f database/migrations/001_create_refresh_tokens.sql
psql -X -v ON_ERROR_STOP=1 -f database/migrations/002_rotate_refresh_token.sql
psql -X -v ON_ERROR_STOP=1 -f database/migrations/003_arc02_topic_balancing.sql
psql -X -v ON_ERROR_STOP=1 -f database/migrations/004_generate_exam_variants.sql
psql -X -v ON_ERROR_STOP=1 -f database/migrations/005_allow_variant_question_pool_selection.sql
psql -X -v ON_ERROR_STOP=1 -f database/migrations/006_create_participant_import_previews.sql
psql -X -v ON_ERROR_STOP=1 -f database/schema-pg17/07_security_postcheck.sql
```

Các lệnh sử dụng cấu hình kết nối PostgreSQL của bạn; không đưa connection string chứa mật khẩu vào repository. Kiểm tra kết quả từng lệnh và dừng khi có lỗi. Fresh schema không tự chạy migration hoặc postcheck.

Nếu dùng Supabase SQL Editor, chạy nội dung các file thành phần theo thứ tự trong `00_apply_fresh.sql`, sau đó các migration và postcheck. SQL Editor không thực thi lệnh `\ir` của psql.

## Database đã có dữ liệu

Không chạy lại fresh schema. Đối chiếu migration đã áp dụng, backup trước khi nâng cấp và chỉ chạy các migration còn thiếu theo thứ tự. Kiểm chứng trên database test trước khi áp dụng cho dữ liệu đang sử dụng.

## Cấu hình ứng dụng

Điền `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` trong `backend/.env`. Backend sử dụng JWT riêng của OLMS; tài khoản ứng dụng không phải Supabase Auth user.

Database password, connection string, service-role key và dump dữ liệu chỉ lưu local. Bộ kiểm thử API cần database test riêng vì có tạo tài khoản và dữ liệu nghiệp vụ.
