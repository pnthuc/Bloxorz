# Phan Ngọc Thức — Cung cấp nền tảng và nghiệm thu cuối

MSSV: **24120228** · Nhánh gợi ý: `work/thuc-final-review`

Kế thừa engine, UI, levels và test đã làm. Cung cấp ghi chú/tư liệu, chốt phiên bản chung và nghiệm thu bài nộp.

[Quy trình làm việc chung](../README.md) · 

## Nhận những gì để bắt đầu?

- Phần đã làm: `game_logic.py`, `main.py`, static/, templates/, levels/, tests/ và run_tests.py.
- Bảng phân công hiện có, snapshot repo và các cơ chế/bug regression đã được kiểm tra.
- Nhận các gói bàn giao đã hoàn chỉnh từ Quân, Nam, Thiện và Phúc.

## Danh sách nhiệm vụ

Đổi `[ ]` thành `[x]` sau khi có đủ đầu ra và người nhận xác nhận. Việc đánh dấu trong README được lưu qua commit.

| Đã bàn giao | Mã | Nhiệm vụ |
| --- | --- | --- |
| [x] | `T01` | Ghi chú engine và mô hình để người khác viết tiếp |
| [x] | `T02` | Bàn giao tư liệu và đường thao tác demo |
| [ ] | `T03` | Chốt snapshot và giao ước dùng chung |
| [ ] | `T04` | Nghiệm thu tích hợp và xác nhận đóng góp |
| [ ] | `T05` | Tạo và kiểm tra gói nộp cuối |

Các đường dẫn đầu ra dưới đây là nơi sẽ tạo file khi thực hiện nhiệm vụ. Thư mục hiện tại mới có README, chưa có kết quả hay báo cáo giả lập.

## T01 — Ghi chú engine và mô hình để người khác viết tiếp

**Đầu vào**

- game_logic.py, main.py, scene.js, game.js và JSON màn chơi đã có.

**Yêu cầu thực hiện**

- Viết model-notes.docx: State(r,c,orientation,bridges,r2,c2,active_cube), ý nghĩa từng trường và ví dụ phân biệt state.
- Mô tả get_initial_state(), get_successors(), apply_move(), evaluate_move() và is_goal(); chỉ ra solver dùng luật từ engine chung.
- Giải thích ngắn trigger switch ở lần chạm mới, SPACE đổi khối, split/teleport, ghép khi sát cạnh và cầu đóng gây rơi.
- Viết phần kiến trúc: browser → Flask API → engine/solver → dữ liệu JSON → scene/replay. Nêu profiler riêng, frontend chịu trách nhiệm hiển thị.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/thuc/model-notes.docx`, `architecture.docx`, một sơ đồ hoặc bảng thành phần.

**Tiêu chí hoàn thành**

- Nam có thể viết mô hình hóa mà không phải tự đoán quy ước tọa độ/hướng.
- Nội dung dựa trên phần đã làm; đủ ngắn để đưa vào report và không lặp lại toàn bộ code.

**Gửi cho:** Nam viết model và ghép kiến trúc; cả nhóm dùng chung ký hiệu.

**Thực hiện khi:** Có thể bắt đầu ngay từ bản repo đã đọc.

## T02 — Bàn giao tư liệu và đường thao tác demo

**Đầu vào**

- GUI và màn 1–4; walkthrough/test regression hiện có.

**Yêu cầu thực hiện**

- Gửi Phúc và Nam ảnh tổng quan GUI và danh sách màn thể hiện từng cơ chế; ưu tiên tận dụng các màn đã có.
- Cung cấp chuỗi thao tác mẫu hoặc điểm bắt đầu để quay thắng/thua, fragile, soft/heavy, bridge, split, SPACE và ghép lại.
- Chỉ Phúc cách reset, chọn màn và chạy solver từ đầu; nhắc rằng Stop ở UI hủy chờ/phát lại, không phải chứng nhận server đã dừng tìm kiếm.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/thuc/demo-notes.docx`, `screenshots/` các ảnh được chọn.

**Tiêu chí hoàn thành**

- Phúc tự quay lại được các cảnh; mỗi cảnh gắn với một mục trong yêu cầu video.
- Ảnh có chú thích mục đích, chữ rõ và không chứa thông tin ngoài bài.

**Gửi cho:** Phúc nhận để viết kịch bản và quay video; Nam rà đề cương nội dung.

**Thực hiện khi:** Làm sớm, song song với các phần viết thuật toán.

## T03 — Chốt snapshot và giao ước dùng chung

**Đầu vào**

- Policy cost P01, heuristic H01 và script/protocol do Quân chuẩn bị.

**Yêu cầu thực hiện**

- Ghi commit cuối vào handoff/shared/baseline.md cùng cost policy, heuristic version, bộ màn, cách đếm node và phiên bản môi trường.
- Giữ chữ ký solver và State thống nhất giữa engine, API, GUI và test; xác nhận mốc test phản ánh policy cuối.
- Đây là bước chốt phiên bản theo giả định các solver đã hoàn thiện. Khi có thay đổi ảnh hưởng kết quả sau đó, ghi phiên bản mới và chỉ rõ cần đo lại phần nào.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/shared/baseline.md`: điểm chung để mọi người trích đúng phiên bản.

**Tiêu chí hoàn thành**

- Quân, Nam, Thiện và Phúc dùng cùng commit/policy; số liệu có thể truy về phiên bản này.
- Không bỏ qua test thất bại để coi snapshot đã sẵn sàng. Nếu lỗi xuất hiện, chủ phần đó xử lý rồi mới xác nhận.

**Gửi cho:** Cả nhóm, đặc biệt Quân trước lượt đo chính thức.

**Thực hiện khi:** M0; cần P01, H01 và thống nhất cách đo.

## T04 — Nghiệm thu tích hợp và xác nhận đóng góp

**Đầu vào**

- Snapshot, report/video bản cuối, gói số liệu, source sạch và phiếu tự báo cáo công việc của từng người.

**Yêu cầu thực hiện**

- Chạy kiểm tra nền, solver và UI bằng bộ test đã có trên bản nộp; lưu kết quả kiểm tra cuối. Xem trực tiếp một số cảnh chơi tay và replay.
- Đối chiếu một số dòng CSV với bảng/hình trong PDF; kiểm tra cùng cost/heuristic và link video.
- Thu phần trăm hoàn thành theo trách nhiệm thực tế từng người và thống nhất bảng cuối với nhóm. Đây là mức hoàn thành cá nhân, không phải tỷ trọng đóng góp buộc cộng thành 100%.
- Tổng hợp lỗi theo người sở hữu: script đo/số liệu → Quân; report → Nam; A* → Thiện; UCS/cost/README/biểu đồ/video → Phúc; engine/UI → Thức.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/thuc/final-review.docx`, log kiểm tra và bảng phân công/mức hoàn thành gửi Nam.

**Tiêu chí hoàn thành**

- Lỗi còn tồn tại được ghi nhận đúng và xử lý trước khi chốt; không phát sinh yêu cầu làm lại game khi chỉ thiếu tài liệu.
- Report khớp kết quả đã đo; mọi người xác nhận phần đóng góp của mình.

**Gửi cho:** Nam cập nhật PDF; các chủ nhiệm vụ sửa đúng phần; Phúc cập nhật source nếu cần.

**Thực hiện khi:** Sau report N04, video P06, biểu đồ P05 và source P04.

## T05 — Tạo và kiểm tra gói nộp cuối

**Đầu vào**

- submission/Source, biểu đồ và video URL của Phúc; Report.pdf của Nam; xác nhận T04.

**Yêu cầu thực hiện**

- Đặt thư mục Source và Report.pdf dưới một thư mục tên MSSV năm thành viên; nén ZIP/RAR theo định dạng đề.
- Kiểm tra mở PDF, click YouTube, giải nén và mở game theo README từ thư mục sạch.
- Kiểm tra kích thước: nếu trên 20 MB, đưa lên Google Drive và kiểm tra quyền xem/tải theo yêu cầu đề.
- Chốt bản nộp trước hạn do lớp công bố; lưu bản cuối và tránh thay nội dung sau deadline.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `24120228_24120219_24120502_24120141_24120503.zip` hoặc RAR tương ứng; link Drive nếu cần.

**Tiêu chí hoàn thành**

- Đúng tên, đủ source và PDF có YouTube URL; giải nén được và hướng dẫn chạy khớp cấu trúc.
- Không tự điền deadline vì PDF chỉ ghi thời lượng khoảng ba tuần; dùng mốc thật của lớp.

**Gửi cho:** Thành viên phụ trách nộp bài/giảng viên theo kênh lớp.

**Thực hiện khi:** M4, sau nghiệm thu T04.


## Đẩy công việc lên repo

1. Làm theo quy trình tạo nhánh trong [hướng dẫn chung](../README.md#tao-nhanh-va-day-cong-viec).
2. Commit file trong `handoff/thuc/`; nếu có sửa code, stage thêm đúng các file code đã sửa.
3. Push nhánh, tạo Pull Request vào `main`, ghi mã task và đầu ra đã có. Gửi link PR cho Thức để xem và gộp.
4. Mỗi người gửi nguồn tham khảo và phần sử dụng AI của mình cùng nội dung bàn giao; Nam tổng hợp vào báo cáo.
