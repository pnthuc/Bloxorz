# Quy chuẩn Đo lường Thực nghiệm Chung (Baseline)

**TRẠNG THÁI: ĐÃ CHỐT.**

Tài liệu xác nhận các thông số và quy chuẩn thực nghiệm chung giữa 5 thành viên cho bài toán Bloxorz.

---

## 1. Căn cứ kỹ thuật từ mã nguồn
- **Bộ màn chơi**: 25 màn chuẩn (`Src/levels/level_01.json` đến `level_25.json`).
- **Engine & Kiểm chứng**: `Src/core/board.py` và `Src/core/replay.py`.
- **Hàm chi phí (Cost)**: `Src/solvers/costs.py`, mỗi cạnh `1 + 0.5 × số ô fragile bị chiếm` ở trạng thái đến.
- **Tập 8 hành động**: `UP`, `LEFT`, `RIGHT`, `DOWN`, `SUP`, `SLEFT`, `SRIGHT`, `SDOWN`.
- **Hàm Heuristic**: `Src/solvers/member4_astar.py`, kết hợp khoảng cách Manhattan và chi phí qua công tắc phân tách/ghép khối (`SPLIT`).
- **Đơn vị đo**:
  - Thời gian tìm kiếm: mili-giây (ms).
  - Bộ nhớ tiêu thụ: đỉnh cấp phát RAM Python bằng `tracemalloc` (KiB).
  - Node mở rộng: số lần lấy trạng thái ra khỏi frontier để sinh con.
  - Chi phí đường đi: `path_cost` tính theo công thức chung cho cả 4 thuật toán.

---

## 2. Thông số thực nghiệm chính thức

| Nội dung | Giá trị chốt | Phụ trách |
| :--- | :--- | :--- |
| **Bộ màn** | 25 màn (Level 1 đến Level 25) | Quân |
| **Số lần lặp** | 3 lần lặp độc lập mỗi trường hợp | Quân |
| **Thời gian giới hạn** | Timeout 120 giây/lượt | Quân |
| **Tổng số lượt đo** | 25 màn × 4 thuật toán × 3 lần lặp = **300 lượt chạy** | Quân |
| **Xử lý số liệu** | Lấy giá trị trung vị (median) của các lượt thành công | Quân, Phúc |
| **Biểu đồ & Bảng** | 10 file PNG 300 DPI, `result-tables.csv` | Phúc |

---

## 3. Xác nhận của các thành viên

- [x] **Phan Gia Phúc**: Xác nhận hàm chi phí chung và giải thích tích lũy cost.
- [x] **Tống Phúc Thiện**: Xác nhận tính chất chấp nhận được và nhất quán của hàm Heuristic.
- [x] **Nguyễn Lê Minh Quân**: Xác nhận cấu hình đo 300 lượt, schema CSV và bảng tổng hợp trung vị.
- [x] **Bùi Phương Nam**: Xác nhận cấu trúc tích hợp số liệu và phân tích vào báo cáo tổng.
- [x] **Phan Ngọc Thức**: Xác nhận toàn bộ 92 unit tests pass và nghiệm thu baseline chung.
