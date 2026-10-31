# Bùi Phương Nam — BFS và Báo cáo tổng

MSSV: **24120502**. Nhận và bàn giao việc theo [Quy trình chung](../README.md).

Phụ trách: Thuật toán BFS, mô hình hóa bài toán Bloxorz và tổng hợp báo cáo toàn nhóm.

---

## 1. Đầu vào & Tài nguyên
- **Mã nguồn**: `Src/solvers/member3_bfs.py`, `Src/core/board.py`.
- **Dữ liệu thực nghiệm**: Nhận từ Quân (`handoff/quan/benchmarks/summary.csv`).
- **Biểu đồ & Bảng số liệu**: Nhận từ Phúc (`handoff/phuc/charts/` và `handoff/phuc/result-tables.csv`).
- **Nội dung thành viên**:
  - DFS: Quân (`handoff/quan/dfs.docx`).
  - UCS & Cost: Phúc (`handoff/phuc/ucs.docx`, `cost-policy.docx`).
  - A* & Heuristic: Thiện (`handoff/thien/astar.docx`, `heuristic-policy.docx`).
  - Engine & GUI: Thức (`handoff/thuc/Phan_Ngoc_Thuc.docx`).

---

## 2. Danh mục công việc & Sản phẩm

| Mã | Nhiệm vụ | Sản phẩm đầu ra | Trạng thái |
| :--- | :--- | :--- | :---: |
| `N01` | Mô tả thuật toán BFS, giả mã và ví dụ từng bước | [BFS.docx](BFS.docx) | Đã xong |
| `N02` | Mô hình hóa trạng thái, hành động, chuyển trạng thái và đích | Mục 2 trong `Report.docx` | Đang tổng hợp |
| `N03` | So sánh, nhận xét 4 thuật toán dựa trên số liệu thực nghiệm | Mục 5-6 trong `Report.docx` | Đang tổng hợp |
| `N04` | Biên tập và xuất bản báo cáo PDF hoàn chỉnh | `Report.docx`, `Report.pdf` | Đang hoàn thiện |
| `N05` | Đề cương nội dung kịch bản video demo | [video-outline.docx](video-outline.docx) | Đã xong |

---

## 3. Quy chuẩn kỹ thuật trong báo cáo
1. **Thuật toán BFS**:
   - Sử dụng hàng đợi `collections.deque` (FIFO).
   - Kiểm tra đích sớm ngay khi sinh trạng thái con để tối ưu số node mở rộng.
   - Giải thích rõ: BFS đảm bảo tìm được lời giải có số bước đi ít nhất, nhưng không đảm bảo chi phí tối ưu trên các màn có ô gạch cam fragile (vì chi phí mỗi bước không đồng nhất = 1).
2. **Quy ước trạng thái & hành động**:
   - Trạng thái `State(r, c, orientation, bridges, r2, c2, active_cube)` gồm 7 trường bất biến (frozen dataclass).
   - Tập 8 hành động tìm kiếm: `UP`, `LEFT`, `RIGHT`, `DOWN`, `SUP`, `SLEFT`, `SRIGHT`, `SDOWN` (tiền tố `S` chỉ xuất hiện khi đang ở trạng thái phân tách khối `SPLIT`). Phím `SPACE` chỉ phục vụ chơi tay, không tính là cạnh trong cây tìm kiếm.
3. **Số liệu thực nghiệm**:
   - Trích dẫn chính xác từ bảng số liệu chuẩn 300 lượt chạy tại `handoff/quan/benchmarks/summary.csv` và các biểu đồ PNG chuẩn tại `handoff/phuc/charts/`.
   - Đơn vị: Thời gian (ms), Bộ nhớ đỉnh (KiB), Node mở rộng (node), Độ dài (bước), Chi phí đường đi (`path_cost`).
