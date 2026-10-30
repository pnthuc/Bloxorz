# Phiên bản và cách đo dùng chung

**CHƯA CHỐT.** File này là giao ước cần nhóm xác nhận trước thực nghiệm chính thức,
không phải xác nhận báo cáo/video hoặc gói nộp đã hoàn tất.

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
| Commit dùng để đo | Chưa chốt; ghi hash sau khi các thay đổi cần đo đã commit | Thức, Quân |
| Ngày chốt | Chưa điền | Thức |
| Cost và lý do chọn | Công thức trên; chờ xác nhận P01 | Phúc |
| Heuristic và giả thiết | Chờ xác nhận H01/H02 trên commit được chọn | Thiện |
| Bộ màn | Đề xuất 25 ID trong level-groups.csv, cùng bộ cho bốn thuật toán | Quân |
| Số lần lặp | Đề xuất 3 lần/trường hợp | Quân |
| Timeout | Đề xuất 120 giây/lượt, giữ riêng TIMEOUT | Quân |
| Môi trường | CPU, RAM, OS, Python; cùng máy/cấu hình | Quân |
| Tổng hợp | Ghi số mẫu, tỷ lệ thành công, trung vị và cách xử lý timeout/lỗi | Quân |
| Kiểm tra phiên bản | Ghi lệnh, kết quả, ngày chạy và giới hạn kiểm tra | Thức |

25 màn, 3 lần lặp và 120 giây là kế hoạch nhóm, không phải số bắt buộc của đề.
Lấy commit bằng `git rev-parse HEAD` trên đúng checkout đã chọn; không coi HEAD là đủ
nếu còn sửa code chưa commit. Mỗi đợt dùng thư mục riêng để không trộn dữ liệu/metadata.

- [ ] Phúc xác nhận cost và diễn giải.
- [ ] Thiện xác nhận heuristic và giả thiết.
- [ ] Quân xác nhận cấu hình, schema, đơn vị và cách tổng hợp.
- [ ] Thức xác nhận snapshot và kết quả kiểm tra.

Sau khi đủ xác nhận, ghi commit/ngày thật và đổi trạng thái thành ĐÃ CHỐT.
Nếu đổi engine, solver, cost, heuristic hoặc cách đo, tạo mốc mới và xác định dữ liệu cần chạy lại.

Bộ dữ liệu đã chọn ngày 31/10/2026 có 25 màn và T1–T12. Xem [lựa chọn màn](../quan/LEVEL_SELECTION.md).
Các trial cũ giữ nguyên phiên bản, không gán lại cho bộ màn/engine mới.
