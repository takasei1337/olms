# OLMS Database

Thư mục này chứa mã SQL phục vụ xây dựng cơ sở dữ liệu của hệ thống OLMS.

## Cấu trúc thư mục

### `migrations-original/`

Lưu bộ SQL gốc từ tài liệu thiết kế, dùng để tham khảo và đối chiếu.

Không chỉnh sửa trực tiếp các file trong thư mục này khi cần thay đổi cấu hình triển khai.

### `schema-pg17/`

Chứa bộ SQL đã điều chỉnh để triển khai trên PostgreSQL 17 thông qua Supabase.

Các điều chỉnh hiện tại bao gồm:

- Sử dụng `gen_random_uuid()` thay cho `uuidv7()` để tương thích với môi trường PostgreSQL hiện tại.
- Bổ sung cấu hình thu hồi quyền thực thi routine trực tiếp của `anon` và `authenticated`.
- Giữ các cấu hình phân quyền dành cho API, Worker và Readonly.

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