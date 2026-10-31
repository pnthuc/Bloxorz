# Quân — DFS và thực nghiệm

Nguyễn Lê Minh Quân · MSSV 24120219 · Nhánh `work/quan-cleanup`.
Handoff giữ tài liệu cuối, CSV phân nhóm và một bộ kết quả; công cụ ở `Src/benchmarks/cli.py`.

| Trạng thái | Mã | Bàn giao |
| --- | --- | --- |
| [x] | Q01 | [dfs.docx](dfs.docx) — DFS và giới hạn tối ưu |
| [x] | Q02 | CLI đo tuần tự, timeout, replay, CSV/JSON và metadata |
| [x] | Q03 | [level-groups.csv](level-groups.csv) — 25 màn ID 1–25 |
| [x] | Q04 | `benchmarks/q04/`: 25 màn × 4 solver × 3 lần, timeout 120 giây |
| [x] | Q05 | [summary.csv](benchmarks/q04/summary.csv) và [methodology.docx](methodology.docx) |
| [ ] | Q06 | Nguồn, schema, lệnh tái lập và khai báo AI đầy đủ |

## Bộ màn

`Src/levels/level_01.json` đến `level_25.json`, đánh số liên tục 1–25.
Tên dạng `Stage x: ...`; mô tả ngắn; độ khó chỉ `Easy`, `Medium`, `Hard`.
Thứ tự khóa: id, name, display_name (nếu có), description, difficulty, start_pos, initial_bridges, switches, grid.
Màn 17–20 là bốn góc xoay đích nông; 21–22 là cặp bàn mở; 23 có vách ngăn;
24–25 đối chiếu ít bước với ít cost. Màn stress: 12, 13, 16.
25 màn và 12 ca biên nằm chung `Src/tests/test_cases.json`; ca biên không nằm trong bộ đo 25 màn.

## Đo và tổng hợp

Từ `Src`, chạy thử vào thư mục mới:

```powershell
python -m benchmarks.cli --levels 1 4 --solvers bfs dfs ucs astar --repeats 1 --timeout 10 --output-dir "$env:TEMP/bloxorz-smoke"
```

Lệnh cho đợt Q04 theo ID mới:

```powershell
python -u -m benchmarks.cli --levels all --solvers bfs dfs ucs astar --repeats 3 --timeout 120 --output-dir ../handoff/quan/benchmarks/q04
python -m benchmarks.cli summarize ../handoff/quan/benchmarks/q04
```

Mỗi đợt cần thư mục mới. Lệnh tổng hợp từ chối ghi đè; để tái lập, thêm
`--output "$env:TEMP/bloxorz-summary-recheck.csv"` và so với CSV bàn giao.
Đầu ra thử cục bộ đặt ngoài repo; thư mục Src/benchmarks chỉ giữ ba file công cụ.

`raw.csv` giữ schema 16 cột; `runs/*.json` giữ moves từng lượt. Metadata ghi đúng commit,
CPU/RAM/OS/Python, hash source và bộ màn, cờ source sạch lúc đo. `path_cost` là cost chung;
`total_cost` của BFS/DFS là số bước, của UCS/A* là cost có trọng số.
Thời gian là ms trong profiler có tracemalloc; memory là peak cấp phát Python KiB.
Timeout chờ worker gồm phần khởi động còn diễn ra, không gồm replay ở cha.

Baseline và xác nhận nhóm nằm ở [baseline chung](../shared/baseline.md).
Các bộ dữ liệu theo ID cũ đã đưa ra ngoài repo và còn trong lịch sử Git; không trộn với đợt mới.

## CSV tổng hợp Q05

Mỗi dòng là một cặp màn/solver; 25 màn tạo 100 dòng. `runs` là toàn bộ số lượt,
`measured_runs` đếm SOLVED và NO_SOLUTION; `solved`, `no_solution`, `timeouts`, `errors`,
`invalid_paths` giữ số lượng từng trạng thái. `success_rate` là tỷ lệ 0–1, mẫu số là `runs`.

Các cột `search_time_ms`, `memory_kb`, `expanded_nodes`, `solution_length`, `total_cost`,
`path_cost` có hậu tố `_median`, `_min`, `_max`, `_iqr`. IQR dùng quartile inclusive.
Ba metric tìm kiếm dùng `measured_runs`; ba metric chất lượng nghiệm chỉ dùng `solved`.
Không có mẫu thì để trống; chỉ một mẫu thì IQR trống. Không đưa timeout/lỗi thành số 0.
CSV có BOM UTF-8, giữ tên nhóm tiếng Việt; `source_commit`, `level_set_sha256`, `raw_sha256`
truy về đúng dữ liệu gốc. Các CSV của đợt được giữ nguyên byte trong Git để hash không đổi khi checkout.

## Kết quả đã kiểm chứng

Snapshot đo: `0d7adc5bcf4960cb53f855aa0f2082bb6ea710b0`, source sạch lúc bắt đầu.
Q04: 300/300 SOLVED; không timeout, lỗi hoặc đường đi sai. Đã replay độc lập mọi lời giải,
đối chiếu cost/độ dài, mốc BFS/UCS/A*, đầy đủ tổ hợp và hash source/bộ màn.
Q05: 100 dòng, 41 cột; mọi metric đã được kiểm tra độc lập và file tái tạo giống từng byte.
Môi trường: i5-12450HX, RAM 24 GB, Windows 11, Python 3.14.6; chi tiết trong metadata của đợt.
92 test Python và 53 test UI PASS; test UI dùng GPU mock, không xác nhận rasterization thật.
Phương pháp đo đã kiểm tra bố cục đủ 4 trang; DFS đã đồng bộ snapshot cuối.
Q06 vẫn để mở, các xác nhận thành viên khác trong baseline không tự đánh dấu thay.
