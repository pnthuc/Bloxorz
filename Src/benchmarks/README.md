# Benchmarks & Thực nghiệm

Thư mục chứa công cụ đo hiệu năng và tổng hợp kết quả thực nghiệm cho 4 thuật toán (BFS, DFS, UCS, A*).

## 1. Chạy thực nghiệm đo lường

Từ thư mục gốc repo:

```powershell
cd Src
python -m benchmarks.cli --levels all --solvers bfs dfs ucs astar --repeats 3 --timeout 120 --output-dir ../handoff/quan/benchmarks/new-run
python ../handoff/quan/summarize.py ../handoff/quan/benchmarks/new-run
```

### Định dạng dữ liệu đầu ra:
- `raw.csv`: Dữ liệu thô từng lượt chạy (level_id, solver, repeat_index, status, search_time_ms, memory_kb, expanded_nodes, solution_length, path_cost).
- `summary.csv`: Tổng hợp trung vị theo cặp (level_id, solver) cho 5 chỉ số chính.
- `runs/*.json`: Chi tiết đường đi `moves` và thông báo lỗi (nếu có) cho từng lượt.
- `environment.json`: Thông số môi trường phần cứng và hệ điều hành.
- `run-config.json`: Cấu hình đo (danh sách màn, thuật toán, số lần lặp, timeout).

### Quy ước chỉ số:
- **Thời gian (search_time_ms)**: Đo thời gian tìm kiếm thuần túy (ms).
- **Bộ nhớ (memory_kb)**: Đỉnh cấp phát RAM Python (`tracemalloc`, KiB).
- **Node mở rộng (expanded_nodes)**: Số trạng thái lấy ra khỏi frontier.
- **Độ dài lời giải (solution_length)**: Số bước lăn khối (`len(moves)`).
- **Chi phí (path_cost)**: Tính theo công thức chung $1 + 0.5 \times \text{fragile_cells}$ (được kiểm chứng qua replay).

---

## 2. Vẽ biểu đồ và bảng kết quả (P05)

Kịch bản vẽ được duy trì chính thức tại `handoff/phuc/plot.py` (hoặc chạy qua forwarder `Src/benchmarks/plot.py`).

Cài đặt thư viện vẽ (nếu chưa có):
```powershell
python -m pip install -r handoff/phuc/requirements-plot.txt
```

Chạy vẽ từ thư mục gốc repo:
```powershell
python handoff/phuc/plot.py
```

Lệnh tự động đọc dữ liệu chuẩn từ `handoff/quan/benchmarks/` và xuất kết quả vào `handoff/phuc/`:
- **5 biểu đồ đường chuẩn báo cáo (PNG 300 DPI)**: So sánh 4 thuật toán trên toàn bộ 25 màn (`hinh_6_1` đến `hinh_6_5`).
- **5 biểu đồ cột phân nhóm (PNG 300 DPI)**: Chi tiết từng nhóm 5 màn (`01_` đến `05_`).
- **Bảng số liệu tổng hợp**: `result-tables.csv`.

---

## 3. Kiểm thử benchmark & plot

```powershell
python -m unittest tests.test_benchmark tests.test_summary tests.test_plot -v
```
