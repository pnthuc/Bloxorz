# Phiên bản và cách đo dùng chung

**ĐÃ CHỐT CẤU HÌNH CHẠY Q04 CỦA QUÂN ngày 31/10/2026 theo yêu cầu của Quân.**
Snapshot đo là `e5fe581`; 25 màn × 4 solver × 3 lần, timeout 120 giây/lượt.
Đây là mốc cho một đợt đo cụ thể, không thay xác nhận cost/heuristic hoặc nghiệm thu của thành viên khác.
Nếu code thay đổi sau đợt này, xác định lại dữ liệu cần đo thay vì gán kết quả cho source mới.

Thức tổng hợp; Phúc xác nhận cost; Thiện xác nhận heuristic; Quân xác nhận bộ màn và phép đo.

## Căn cứ từ source hiện tại

- 25 màn JSON trong `Src/levels/`; 37 ca kiểm thử gồm 25 màn và 12 ca biên.
- Engine: `Src/core/board.py`; replay: `Src/core/replay.py`.
- Cost: `Src/solvers/costs.py`, mỗi cạnh `1 + 0.5 × số ô fragile ở trạng thái đến`.
- Tìm kiếm dùng `UP LEFT RIGHT DOWN SUP SLEFT SRIGHT SDOWN`; tiền tố S đổi cube rồi lăn.
  SPACE chỉ chọn cube khi chơi tay. `solution_length = len(moves)`.
- Heuristic: `Src/solvers/member4_astar.py`, gồm khoảng cách/ghép cube và đường qua split switch.
  Thiện phải đối chiếu công thức với code thực sự dùng trong lượt đo.
- Profiler: `Src/solvers/base.py`. Thời gian ms; đỉnh cấp phát Python KiB, không phải tổng RAM/GPU.
- `expanded_nodes` đếm lượt mở rộng để sinh successor, không phải tổng state đã phát hiện;
  mô tả đúng cách từng solver bỏ qua goal và entry lỗi thời khi diễn giải kết quả.
- CLI: `Src/benchmarks/cli.py`. Timeout ngoài tiến trình gồm thời gian khởi động worker;
  `search_time_ms` trong profiler không gồm khởi động, giao tiếp, replay hoặc vẽ hình.
- CLI giữ `total_cost` gốc và tính lại `path_cost` chung. GUI benchmark tính lại cost chung
  trong `total_cost`, giữ số gốc ở `solver_reported_cost`; không trộn hai schema khi làm bảng.

## Nhóm xác nhận

| Nội dung | Giá trị | Người xác nhận |
| --- | --- | --- |
| Commit dùng để đo | e5fe581; source sạch trong Src khi bắt đầu; 87 test Python PASS | Quân; chờ Thức nghiệm thu |
| Ngày chốt cấu hình Q04 | 31/10/2026, theo yêu cầu Quân | Quân |
| Cost và lý do chọn | Công thức trên; P01/P02 đã có trong main qua PR #16; chưa tự xác nhận thay Phúc | Phúc |
| Heuristic và giả thiết | Chờ xác nhận H01/H02 trên commit được chọn | Thiện |
| Bộ màn | 25 ID trong level-groups.csv, cùng bộ cho bốn thuật toán; không tính T1–T12 vào 25 màn | Quân |
| Số lần lặp | 3 lần/trường hợp, tổng 300 lượt; chạy tuần tự | Quân |
| Timeout | 120 giây/lượt, giữ riêng TIMEOUT | Quân |
| Môi trường | i5-12450HX, RAM 24 GB, Windows 11, Python 3.14.6; chi tiết trong environment.json | Quân |
| Thứ tự chạy | ID màn tăng dần → lần lặp 1–3 → bfs, dfs, ucs, astar; không xáo thứ tự hoặc warm-up | Quân |
| Tổng hợp | Ghi số mẫu, tỷ lệ thành công, trung vị và cách xử lý timeout/lỗi | Quân |
| Kiểm tra phiên bản | Ghi lệnh, kết quả, ngày chạy và giới hạn kiểm tra | Thức |

25 màn, 3 lần lặp và 120 giây là cấu hình đợt Q04 này, không phải số bắt buộc của đề.
Lấy commit bằng `git rev-parse HEAD` trên đúng checkout đã chọn; không coi HEAD là đủ
nếu còn sửa code chưa commit. Mỗi đợt dùng thư mục riêng để không trộn dữ liệu/metadata.

- [ ] Phúc xác nhận cost và diễn giải.
- [ ] Thiện xác nhận heuristic và giả thiết.
- [x] Quân chốt cấu hình Q04, schema và đơn vị theo yêu cầu chạy ngày 31/10/2026; tổng hợp thuộc Q05.
- [ ] Thức xác nhận snapshot và kết quả kiểm tra.

Các xác nhận nhóm còn thiếu được giữ nguyên; không dùng mốc Q04 của Quân để thay nghiệm thu chung.
Nếu đổi engine, solver, cost, heuristic hoặc cách đo, tạo mốc mới và xác định dữ liệu cần chạy lại.

Q04 đã chạy đủ 300 lượt: 300 SOLVED, không timeout/lỗi/đường đi sai; đã kiểm tra độc lập
CSV–JSON, coverage, replay, mốc tối ưu và hash source/bộ màn. Dữ liệu bàn giao:
[quan/benchmarks/q04-20261031](../quan/benchmarks/q04-20261031/raw.csv).
Đây là một đợt đo tuần tự trên source hiện tại, không thay xác nhận nội dung H01/H02 của Thiện.

Bộ dữ liệu đã chọn ngày 31/10/2026 có 25 màn và T1–T12. Xem [vai trò các màn](../../Src/levels/README.md).
Các trial cũ giữ nguyên phiên bản, không gán lại cho bộ màn/engine mới.
