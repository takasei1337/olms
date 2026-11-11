# Kiểm thử OLMS bằng Bruno

Collection **OLMS Backend** dùng OpenCollection YAML và Bruno CLI **4.3.0** được pin trong package-lock.json. Đây là HTTP integration với ứng dụng Express và Supabase/PostgreSQL thật từ backend/.env. Các file `backend/test-*.js` cũ đã được bỏ; lệnh test của backend chuyển tiếp sang bộ Bruno này. Các script `.cjs` tại `api-tests/scripts/` vẫn cần để setup fixture, dựng collection, chạy CLI và xuất báo cáo.

Phạm vi hiện tại là kiểm thử API. Bộ này chưa thay thế các ca unit riêng cho embedding/cosine, ranh giới timeout, xung đột đồng thời và những logic nội bộ không quan sát được đầy đủ qua HTTP.

## Chạy lại bằng một lệnh

Sau khi cài dependencies lần đầu:

```powershell
npm --prefix backend ci
npm --prefix api-tests ci
npm --prefix api-tests test
```

Runner sẽ:

1. Đọc cấu hình database/JWT từ `backend/.env`.
2. Tạo hoặc xác minh bốn tài khoản riêng cho Bruno: ADMIN, TEACHER, một TEACHER khác chủ và STUDENT. Bootstrap bằng Supabase service-role chỉ phục vụ fixture; các request cần xác thực vẫn login qua API thật.
3. Sinh run_id và mật khẩu user kiểm thử; ghi biến local vào `OLMS Backend/.env`, giữ nguyên các biến không thuộc runner đã có trong file đó. Tạo thêm fixture exam riêng ở RESULT_PUBLISHED để test archive thành công; đây là tiền điều kiện seed trong DB, không phải API công bố kết quả đã triển khai.
4. Dựng collection từ `scripts/cases.cjs`; mở backend localhost cổng 3301 nếu chưa có server phù hợp.
5. Chạy các request tuần tự bằng Bruno CLI safe sandbox, tự lưu/gửi cookie, tự lấy token và ID từ response.
6. Ghi JSON/JUnit/log, cập nhật `docs/completed_api.md` và lưu bằng chứng JSON đã lược dữ liệu nhạy cảm.
7. Dừng backend nếu chính runner đã mở process đó; không dừng server có sẵn.

Exit code khác 0 khi có assertion hoặc request lỗi. Báo cáo vẫn được tạo để đối chiếu; không thay expected status thành 500 chỉ để che lỗi backend.

## Biến môi trường

Copy `api-tests/.env.example` thành `api-tests/.env` nếu muốn thay mặc định:

| Biến | Mặc định | Mục đích |
| --- | --- | --- |
| OLMS_TEST_BASE_URL | http://127.0.0.1:3301/api/v1 | Địa chỉ backend cần kiểm thử |
| OLMS_TEST_AUTO_START | true | Tự mở server localhost khi health chưa có; false để dùng server tự quản lý |

`backend/.env` cần SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_ACCESS_SECRET. Không chép service key vào environment của Bruno. Nếu dùng server tự quản lý, server đó cần trỏ cùng database để thấy tài khoản fixture.

Environment **Local** trong `OLMS Backend/environments/Local.yml` lấy các biến `OLMS_TEST_*` từ file `.env` tại collection. Không commit mật khẩu, JWT, cookie hoặc giá trị secrets. `.bruno.local.json` lưu credentials/ID của bốn tài khoản fixture để các lần sau tái sử dụng; file này bị ignore.

| Nhóm biến trong Bruno | Nguồn |
| --- | --- |
| base_url, root_url | Cấu hình runner |
| admin/teacher/other_teacher/student username và password | Bootstrap tài khoản test riêng |
| run_id, opens_at, closes_at | Sinh mới mỗi lần setup; lịch thi tương đối theo giờ chạy |
| single_choice_type_id | Tra cứu canonical question type hiện có |
| archive_ready_exam_id | Fixture riêng ở RESULT_PUBLISHED, có result_published_at/by hợp lệ, dành cho nhánh archive 200 |
| api_user_password, api_user_new_password | Sinh ngẫu nhiên; chỉ đổi/khôi phục mật khẩu user được API tạo trong lần test |
| token, admin_token và token các vai trò khác | Login/refresh response |
| subject_id, chapter_id, lesson_id, question_id, exam_id và ID phụ | Response tạo tài nguyên, không ghi cứng UUID database |

## Chạy trong Bruno GUI

```powershell
npm --prefix api-tests run setup
```

Mở thư mục `api-tests/OLMS Backend`, chọn environment **Local**, bảo đảm backend đang chạy ở base_url, rồi chạy collection theo thứ tự `seq`. Để backend dùng cổng mặc định của runner:

```powershell
$env:PORT='3301'
npm --prefix backend start
```

Token và ID được truyền giữa request. Request đơn lẻ phụ thuộc ID cần chạy các bước trước trong cùng lượt collection; các request có thiếu tiền điều kiện sẽ được Bruno skip và báo BLOCKED. Có thể gửi riêng login, health và những GET không cần ID.

CLI trực tiếp, từ thư mục collection:

```powershell
..\node_modules\.bin\bru.cmd run --env Local --exclude-tags external --reporter-json ..\reports\manual.json --reporter-skip-all-headers --reporter-skip-body
```

File `API.yml` cũ gọi dịch vụ AI bên ngoài OLMS được giữ để dùng thủ công, gắn tag external/manual và loại khỏi đợt regression OLMS. Wrapper chỉ truyền danh sách scenario OLMS cụ thể vào CLI.

## Phạm vi và dữ liệu fixture

Các scenario bao phủ mọi method/path có handler ở thời điểm xây dựng collection: auth, users, catalog, question types, questions/AI/clone/versions, exams/matrix/grading rules/generate/lifecycle và health. Có thêm các nhánh thiếu JWT, sai role, sai owner, UUID/answer_spec sai và chuyển trạng thái DRAFT không hợp lệ. Không tính 32 scaffold 501 là tính năng đã hoàn thành.

Mỗi lần chạy tạo dữ liệu có code/name theo run_id. CRUD xóa mềm được test bằng tài nguyên riêng chưa dùng. Những câu hỏi/snapshot đã dùng sinh đề, kỳ thi và user test được giữ để đối soát, không hard-delete dữ liệu frozen hay thay dữ liệu người dùng sẵn có. Bốn tài khoản bootstrap được tái sử dụng qua file state local; mỗi lượt tạo user đổi mật khẩu riêng rồi khôi phục mật khẩu test.

Kịch bản xuất đề giấy kiểm tra HTTP 501 NOT_IMPLEMENTED. Kịch bản bắt đầu thi kiểm tra cả trước và sau opens_at. Archive đã đồng bộ theo SQL: ENDED trả 409, RESULT_PUBLISHED → ARCHIVED trả 200, gọi archive lần nữa trả 409. Collection kiểm cả ba nhánh, không thay lỗi 500 thành expected success. Xem kết quả thực tế trong báo cáo.

## Kết quả và bảo trì

- `docs/completed_api.md`: bảng từng API và các lỗi/bước bị chặn.
- `docs/verification/bruno-<run_id>.json`: bằng chứng an toàn, không chứa body/header/secret.
- `api-tests/reports/<run_id>/`: Bruno JSON, JUnit, CLI log, server log và summary của lần chạy; bị Git ignore.
- `api-tests/reports/latest.json`: summary của lần gần nhất.

Khi thêm API, bổ sung scenario trong `scripts/cases.cjs`; `npm test` dựng lại YAML từ nguồn này. Các request thử nghiệm ngoài danh sách không tự được wrapper chạy. Muốn chuẩn bị collection mà chưa chạy: `node api-tests/scripts/build-collection.cjs`. Tài liệu tham khảo: [Bruno CLI run](https://docs.usebruno.com/bru-cli/run/overview) và [reporter options](https://docs.usebruno.com/bru-cli/run/options).

## Thiết kế ngân hàng 2.0

Bộ Bruno hiện tại kiểm backend 1.x. Các ca cần bổ sung cho topic, nhóm tương đương và mã đề khác dữ kiện nằm ở mục 11 của [đặc tả 2.0](../docs/16_Ngan_Hang_Cau_Hoi_Va_Ma_De.md). Chỉ tính nghiệm thu 2.0 sau khi triển khai và chạy các ca BANK2/MAT2/GEN2/MIG2 trên fixture mới.
