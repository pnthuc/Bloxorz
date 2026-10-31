# Benchmark

Chạy từ thư mục Src, chọn một thư mục mới cho mỗi đợt đo:

```powershell
python -m benchmarks.cli --levels all --solvers bfs dfs ucs astar --repeats 3 --timeout 120 --output-dir ../handoff/quan/benchmarks/new-run
python ../handoff/quan/summarize.py ../handoff/quan/benchmarks/new-run
```

- raw.csv gồm 9 cột: level_id, solver, repeat_index, status, search_time_ms, memory_kb, expanded_nodes, solution_length, path_cost.
- summary.csv gồm 13 cột: level_id, solver, runs, solved, no_solution, timeouts, errors, invalid_paths và trung vị của năm chỉ số trên.
- environment.json chỉ lưu CPU, RAM, hệ điều hành, Python và ngày chạy; không cần Git.
- run-config.json lưu bộ màn, thuật toán, số lần lặp và timeout.
- runs/*.json lưu chi tiết đường đi và lý do lỗi, để CSV gọn và dễ đọc.

Thời gian dùng ms; bộ nhớ là đỉnh cấp phát Python tính bằng KiB. Chi phí dùng path_cost đã được replay kiểm chứng cho cả bốn thuật toán.

Thời gian, bộ nhớ và node lấy trung vị các lượt SOLVED hoặc NO_SOLUTION; độ dài và chi phí chỉ lấy từ SOLVED. Timeout/lỗi không được thay bằng số 0. Không có mẫu thì để trống.

Tool tổng hợp kiểm tra đủ lượt, không trùng, CSV khớp JSON và metric hợp lệ. Không cần environment.json, Git commit hay bảng phân nhóm. Các raw.csv cũ có cột bổ sung vẫn đọc được; dữ liệu đầu vào không bị sửa.

Nếu summary.csv đã tồn tại, chọn tên mới:

```powershell
python ../handoff/quan/summarize.py ../handoff/quan/benchmarks/new-run --output ../handoff/quan/benchmarks/new-run/summary-new.csv
```

Kiểm tra:

```powershell
python -m unittest tests.test_summary tests.test_experiments tests.test_benchmark
```

## Vẽ bảng và biểu đồ từ dữ liệu đã lưu (P05)

Từ `Src`:

```powershell
python -m pip install -r benchmarks/requirements-plot.txt
python -m benchmarks.plot
```

Mặc định đọc `handoff/quan/benchmarks/` và `handoff/quan/level-groups.csv`,
xuất vào `handoff/phuc/`. Đường dẫn mặc định tính từ vị trí script, không phụ thuộc
thư mục đang đứng. Dùng `--batch`, `--groups`, `--output-dir` để chọn bộ khác.

- Script chỉ đọc CSV/JSON đã lưu, không gọi solver hoặc thay dữ liệu đo.
- Kiểm tra đủ lượt, CSV khớp JSON, số trạng thái và mọi trung vị khớp `summary.csv`
  trước khi xuất hình. Sai lệch làm lệnh thất bại thay vì tự sửa số liệu.
- Xuất các biểu đồ PNG 300 dpi (cả biểu đồ đường toàn bộ 25 màn và biểu đồ cột phân nhóm).
- Màu thuật toán nhất quán; trục log được ghi trên hình. Số 0 thật dùng symlog; thiếu mẫu dùng NA, timeout/lỗi có mã riêng, không thay bằng 0.
- `result-tables.csv` giữ đủ giá trị và số mẫu; các bản báo cáo bảng và biểu đồ lưu sẵn dưới định dạng Word (`result-tables.docx`, `chart-notes.docx`). `charts/manifest.json` ghi số mẫu, màu và kiểu trục của từng hình.
- Matplotlib là thư viện tùy chọn cho P05, không cần để chơi game hay đo benchmark.

```powershell
python -m unittest tests.test_plot tests.test_summary -v
```
