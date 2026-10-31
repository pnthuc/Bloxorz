# Benchmark

Chạy từ thư mục Src, chọn một thư mục mới cho mỗi đợt đo:

```powershell
python -m benchmarks.cli --levels all --solvers bfs dfs ucs astar --repeats 3 --timeout 120 --output-dir ../handoff/quan/benchmarks/new-run
python -m benchmarks.cli summarize ../handoff/quan/benchmarks/new-run
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
python -m benchmarks.cli summarize ../handoff/quan/benchmarks/new-run --output ../handoff/quan/benchmarks/new-run/summary-new.csv
```

Kiểm tra:

```powershell
python -m unittest tests.test_summary tests.test_experiments tests.test_benchmark
```
