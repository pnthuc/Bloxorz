# Quân — DFS và thực nghiệm

Nguyễn Lê Minh Quân · MSSV 24120219 · Nhánh `work/quan-cleanup`.
Handoff giữ tài liệu cuối, CSV phân nhóm và một bộ kết quả; công cụ ở `Src/benchmarks/cli.py`.

| Trạng thái | Mã | Bàn giao |
| --- | --- | --- |
| Hoàn tất | Q01 | [dfs.docx](dfs.docx) — DFS và giới hạn tối ưu |
| Hoàn tất | Q02 | CLI đo tuần tự, timeout, replay, CSV/JSON và metadata |
| Hoàn tất | Q03 | [level-groups.csv](level-groups.csv) — 25 màn ID 1–25 |
| Đang chạy lại | Q04 | `benchmarks/q04/`: 25 màn × 4 solver × 3 lần, timeout 120 giây |
| Đang thực hiện | Q05 | `benchmarks/q04/summary.csv` và `methodology.docx` |
| Chưa hoàn tất | Q06 | Nguồn, schema, lệnh tái lập và khai báo AI đầy đủ |

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
