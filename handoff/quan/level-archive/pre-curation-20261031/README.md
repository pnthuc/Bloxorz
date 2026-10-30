# Archive màn trước khi tinh gọn

17 JSON ở đây được chuyển nguyên byte ra khỏi Src/levels ngày 31/10/2026.
Chúng không còn xuất hiện trong menu hoặc bộ benchmark mặc định của game.

- index.json: ID, tên, tên file và SHA-256 của từng màn gốc.
- test_cases.json: kỳ vọng và walkthrough cũ tương ứng; tham chiếu tới các JSON trong archive này.
- Nguồn: checkout work/quan-experiments tại 6b7e3b5, trước bước chọn bộ 25 màn.

Lý do: giảm các màn cùng vai trò trong một nhóm cơ chế, tạo chỗ cho ca có mục đích
so sánh rõ hơn. Không kết luận các màn cũ sai luật hoặc hoàn toàn vô ích.
Chi tiết quyết định ở ../../LEVEL_SELECTION.md.

Đây là dữ liệu lịch sử, không phải thư mục levels thay thế dùng trực tiếp với API.
Nếu phục hồi một phiên bản cũ, cần dùng đúng engine, testcase và tài liệu cùng phiên bản.
Các ID cũ không được tái sử dụng cho màn khác trong bộ mới.
