## 1. Tổng quan dự án

OLMS là hệ thống quản lý toàn diện khảo thí từ ngân hàng câu hỏi đến tạo đề thi và chấm thi, phục vụ cho giáo viên (teacher) và sinh viên (student), đồng thời tạo chức năng cho admin quản lý hệ thống. Hệ thống có 4 nhóm nghiệp vụ chính gồm: Quản lý ngân hàng câu hỏi, Tạo đề thi, Công tác thi và Công tác chấm thi. Hệ thống xây dựng nhằm khắc phục tình trạng câu hỏi chất lượng kém khi chọn random (trùng lặp ý tưởng), tạo đề thi có thể kiểm soát mức độ bao phủ kiến thức, chấm thi chính xác (có thể giải trình cho sinh viên về điểm thi), đồng thời phục vụ cho cả thi trực tuyến và thi giấy. MVP của dự án triển khai đầy đủ từ đưa câu hỏi vào hệ thống, sinh đề, tổ chức thi, chấm thi. Giai đoạn MVP, OMR trong khâu chấm thi được sử dụng trên server, OMR chạy offline trên di động được xem là hướng mở rộng trong giai đoạn sau.

## 2. Đặc tả yêu cầu hệ thống

### 2.1. Quản lý ngân hàng câu hỏi

Hệ thống quản lý câu hỏi theo phân cấp Môn -> Chương -> Bài -> Câu hỏi. Hệ thống hỗ trợ 5 dạng câu hỏi là 1-choice, multi-choice, dropdown, nhập đáp án, nối đáp án. Tích hợp AI Service để rà soát trùng lặp ý tưởng giữa các câu hỏi kể cả những câu hỏi chỉ thay số đổi chữ.

Khi AI phát hiện câu hỏi trùng lặp, hệ thống gửi cảnh báo trùng lặp cho giáo viên, giáo viên đối chiếu, giáo viên có thể hủy tạo câu hỏi hoặc nếu giáo viên có lý do hợp lệ để chấp nhận câu hỏi mới, giáo viên có thể lưu câu hỏi mà vẫn không thay đổi câu hỏi trước đó, tuy nhiên cần nhập lý do, và hệ thống lưu lại thông tin giáo viên đã lưu câu hỏi phục vụ đối soát. Nếu AI Service gặp lỗi, hệ thống đánh dấu câu hỏi là SKIPPED_TIMEOUT để biết câu hỏi này đã bị bỏ qua bước kiểm tra trùng lặp và câu hỏi được đưa vào hàng chờ để khi AI Service hoạt động trở lại, câu hỏi sẽ được kiểm tra trùng lặp.

### 2.2. Tạo đề thi

Giáo viên thiết lập ma trận đề, số câu dựa trên các tiêu chí chương -> bài -> dạng câu hỏi. Hệ thống sinh đề gốc và tự động trộn thứ tự câu hỏi và đáp án để tạo ra nhiều mã đề mới. Hệ thống lưu ánh xạ câu hỏi đến phiên bản câu hỏi gốc để giáo viên có thể dễ dàng chấm điểm và thống kê chính xác.

## 3. Luồng dữ liệu

## 4. Thiết kế cơ sở dữ liệu

## 5. Kiến trúc hệ thống