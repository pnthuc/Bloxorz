# Phiên bản và cách đo dùng chung

Quân yêu cầu chạy lại Q04/Q05 sau khi đánh số 25 màn thành 1–25 ngày 31/10/2026.
Mốc này chốt phạm vi đo của Quân; các xác nhận cost/heuristic và nghiệm thu nhóm vẫn để riêng.

- Source dùng để đo: sẽ ghi hash sau khi commit phần đánh số và chuẩn hóa metadata.
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
- [ ] Phúc xác nhận cost và diễn giải trên snapshot cuối.
- [ ] Thiện xác nhận heuristic và giả thiết trên snapshot cuối.
- [ ] Thức nghiệm thu snapshot và kết quả kiểm tra.

Chi tiết kết quả, môi trường và lệnh tái lập được cập nhật tại [handoff Quân](../quan/README.md).
