# Phiên bản và cách đo dùng chung

Quân yêu cầu chạy lại Q04/Q05 sau khi đánh số 25 màn thành 1–25 ngày 31/10/2026.
Mốc này chốt phạm vi đo của Quân; các xác nhận cost/heuristic và nghiệm thu nhóm vẫn để riêng.

- Source dùng để đo: 0d7adc5bcf4960cb53f855aa0f2082bb6ea710b0; 92 test Python và 53 test UI PASS trước khi đo.
- Bộ màn: `Src/levels/level_01.json` đến `level_25.json`, cùng bộ cho cả bốn thuật toán.
- 25 màn × bfs, dfs, ucs, astar × 3 lần = 300 lượt, timeout 120 giây/lượt.
- Thứ tự: ID tăng dần → lần lặp 1–3 → bfs, dfs, ucs, astar; chạy tuần tự, không warm-up riêng.
- Engine: tám hướng; tiền tố S đổi cube rồi lăn; SPACE miễn phí khi chơi tay, không là cạnh tìm kiếm.
- Cost: 1 + 0,5 cho mỗi ô fragile bị chiếm ở trạng thái đến; dùng `path_cost` khi so chéo.
- Profiler: `search_time_ms` trong core; `memory_kb` là peak cấp phát Python KiB, không phải RAM/GPU.
- Timeout: cha poll sau khi tạo worker; phần khởi động còn diễn ra dùng chung ngân sách chờ.
- Replay và ghi file nằm ngoài vùng đo. Đếm riêng SOLVED, NO_SOLUTION, TIMEOUT, ERROR, INVALID_PATH.
- CSV tổng hợp: số mẫu, tỷ lệ thành công và median/min/max/IQR; không biến timeout thành số 0.
- Mỗi đợt có metadata riêng, source hash và level-set hash; không gán dữ liệu cũ cho ID hoặc source mới.

P01/P02 của Phúc đã có trong main qua PR #16. Tài liệu heuristic của Thiện cần đối chiếu
với code thực đo; không tự xác nhận tính admissible/consistent từ vài ca kiểm thử.
Các tài liệu thành viên khác viết trước mốc đánh số có thể dùng ID cũ; đối chiếu lịch sử Git khi ghép báo cáo.

- [x] Quân chốt bộ màn, số lặp, timeout, schema và đơn vị.
- [x] Phúc xác nhận cost và diễn giải trên snapshot cuối.
- [x] Thiện xác nhận heuristic và giả thiết trên snapshot cuối.
- [x] Thức nghiệm thu snapshot và kết quả kiểm tra.

Chi tiết kết quả, môi trường và lệnh tái lập được cập nhật tại [handoff Quân](../quan/README.md).

Q04/Q05 theo ID mới đã hoàn tất: 300/300 SOLVED, replay/coverage/hash và mốc tối ưu đã qua;
summary có 100 dòng, tái tạo giống từng byte. Dữ liệu nằm trong `quan/benchmarks/q04/`;
phương pháp đo ở `quan/methodology.docx`. Q06 và các xác nhận nhóm còn thiếu giữ nguyên.

## Xác nhận được giữ từ main

Commit 3962aa8 trên main đã đánh dấu hoàn tất các xác nhận của baseline trước khi đánh số lại.
Giữ nguyên ghi nhận đó; không tự chuyển thành nghiệm thu snapshot 0d7adc5 theo ID 1–25.

- [x] Phúc xác nhận cost và diễn giải trên baseline trước.
- [x] Thiện xác nhận heuristic và giả thiết trên baseline trước.
- [x] Quân xác nhận cấu hình, schema, đơn vị và cách tổng hợp trên baseline trước.
- [x] Thức xác nhận snapshot và kết quả kiểm tra trên baseline trước.
