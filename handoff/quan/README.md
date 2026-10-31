# Nguyễn Lê Minh Quân — DFS và Thực nghiệm

MSSV: **24120219**. Nhận và bàn giao việc theo [Quy trình chung](../README.md).

Phụ trách: Thuật toán DFS, xây dựng công cụ đo lường và thực thi toàn bộ 300 lượt benchmark cho nhóm.

---

## 1. Đầu vào & Tài nguyên
- **Mã nguồn DFS**: `Src/solvers/member2_dfs.py`.
- **Engine & Replay**: `Src/core/board.py`, `Src/core/replay.py`.
- **Công cụ đo & tổng hợp**: `Src/benchmarks/cli.py`, `Src/benchmarks/worker.py`, `handoff/quan/summarize.py`.
- **Dữ liệu 25 màn chơi**: `Src/levels/level_01.json` đến `level_25.json`.

---

## 2. Danh mục công việc & Sản phẩm bàn giao

| Mã | Nhiệm vụ | Sản phẩm đầu ra | Trạng thái |
| :--- | :--- | :--- | :---: |
| `Q01` | Mô tả thuật toán DFS, giả mã, cơ chế tránh lặp và ví dụ | [dfs.docx](dfs.docx) | Đã xong |
| `Q02` | Công cụ đo benchmark tự động, kiểm chứng replay, ghi nhận timeout | `Src/benchmarks/cli.py`, `worker.py` | Đã xong |
| `Q03` | Thống kê và phân loại 25 màn chơi theo độ phức tạp | [level-groups.csv](level-groups.csv) | Đã xong |
| `Q04` | Thực thi bộ benchmark chuẩn 300 lượt (25 màn × 4 thuật toán × 3 lần lặp) | [raw.csv](benchmarks/raw.csv), [runs/](benchmarks/runs/) | Đã xong |
| `Q05` | Tổng hợp trung vị số liệu thực nghiệm | [summary.csv](benchmarks/summary.csv) | Đã xong |

---

## 3. Hướng dẫn chạy lại thực nghiệm

Từ thư mục gốc repository:

### Bước 1: Thống kê thông số màn chơi (Q03)
```powershell
python handoff/quan/generate_level_groups.py
```
Xuất file: `handoff/quan/level-groups.csv`.

### Bước 2: Chạy benchmark 300 lượt (Q04)
```powershell
cd Src
python -m benchmarks.cli --levels all --solvers bfs dfs ucs astar --repeats 3 --timeout 120 --output-dir ../handoff/quan/benchmarks
cd ..
```
*Ghi chú:* Mỗi lượt chạy được cách ly trong một tiến trình độc lập (`worker.py`), có giới hạn timeout 120s và tự động xác thực đường đi qua `replay.py`.

### Bước 3: Tổng hợp số liệu trung vị (Q05)
```powershell
python handoff/quan/summarize.py handoff/quan/benchmarks
```
Xuất file: `handoff/quan/benchmarks/summary.csv`.

---

## 4. Cấu trúc dữ liệu thực nghiệm

- **`benchmarks/raw.csv`**: Dữ liệu thô 300 lượt chạy với các trường `level_id`, `solver`, `repeat_index`, `status`, `search_time_ms`, `memory_kb`, `expanded_nodes`, `solution_length`, `path_cost`.
- **`benchmarks/summary.csv`**: Bảng trung vị 100 nhóm `(level_id, solver)` dùng trực tiếp để vẽ biểu đồ và phân tích trong báo cáo.
- **`benchmarks/runs/*.json`**: Lưu chi tiết chuỗi hành động `moves` và log chi tiết từng lượt.
- **`level-groups.csv`**: Thống kê kích thước sàn, số ô đi được, cầu bật/tắt, công tắc và ô gạch cam của 25 màn.
