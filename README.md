# OLMS

Hệ thống quản lý ngân hàng câu hỏi, tạo đề, tổ chức thi trực tuyến và chấm điểm. Backend dùng Node.js, Express và Supabase/PostgreSQL; xác thực bằng JWT của ứng dụng.

Có các luồng quản lý tài khoản, môn/chương/bài, câu hỏi, kỳ thi, thí sinh, làm bài và xem kết quả. Frontend sử dụng React + Vite, chưa được triển khai trong repository. In đề giấy và OMR chưa hoàn thiện; các endpoint tương ứng trả `501 NOT_IMPLEMENTED`.

## Yêu cầu

- Node.js và npm tương thích với dependencies trong `backend/package.json` và lockfile.
- Supabase project với database theo `database/schema-pg17/`.
- Thông tin kết nối Supabase và JWT secret riêng của bạn.

## Chạy backend

```bash
git clone https://github.com/takasei1337/olms.git
cd olms
npm --prefix backend ci
```

Chuẩn bị database theo [hướng dẫn database](database/README.md), rồi sao chép `backend/.env.example` thành `backend/.env` và điền:

| Biến | Ý nghĩa |
| --- | --- |
| `SUPABASE_URL` | URL Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key, chỉ dùng ở backend |
| `JWT_ACCESS_SECRET` | Secret ngẫu nhiên riêng cho JWT |
| `PORT` | Cổng backend, mặc định `3000` |
| `NODE_ENV` | `development` khi chạy local |
| `CORS_ORIGIN` | Origin frontend được phép, phân cách bằng dấu phẩy |

```bash
npm --prefix backend start
```

- Health check: `http://localhost:3000/health`.
- API base URL: `http://localhost:3000/api/v1`.
- Hợp đồng API: [OpenAPI](api-tests/06_OpenAPI_3.0.yaml).

Backend khởi chạy worker xử lý kỳ thi/bài thi hết hạn cùng process. Không có tài khoản đăng nhập mặc định hoặc dữ liệu cá nhân kèm repository; bộ kiểm thử có thể chuẩn bị tài khoản fixture trên database test riêng.

## Kiểm thử API

```bash
npm --prefix api-tests ci
npm --prefix api-tests test
```

Bộ Bruno kết nối database thật và tạo dữ liệu kiểm thử. Chạy trên database test riêng; xem [cấu hình và cách chạy](api-tests/README.md). Báo cáo được sinh local.

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `backend/` | Express API và worker |
| `database/` | Schema và migration |
| `api-tests/` | OpenAPI, collection và runner Bruno |
| `design-tokens/` | Token màu, typography và component cho giao diện |

Không commit `.env`, mật khẩu, JWT, dữ liệu database hoặc service-role key. Frontend gọi API backend; không đưa service-role key vào mã chạy trên trình duyệt.
