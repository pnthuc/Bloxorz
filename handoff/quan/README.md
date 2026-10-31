# Nguyễn Lê Minh Quân — DFS và thực nghiệm

MSSV **24120219**. Nhánh hiện tại: `work/quan-cleanup`. Nhận/gửi việc theo [quy trình chung](../README.md).
Quân đo và kiểm chứng số liệu; Phúc nhận CSV để làm bảng/biểu đồ; Nam tổng hợp báo cáo.

## Đầu vào và hiện trạng

- DFS: `Src/solvers/member2_dfs.py`; engine: `Src/core/board.py`.
- Đo: `Src/benchmarks/cli.py`; profiler: `Src/solvers/base.py`;
  kiểm tra lời giải: `Src/core/replay.py`.
- 25 màn trong `Src/levels/`, giữ ID không liên tiếp theo [bộ đã chọn](../../Src/levels/README.md).
  `Src/tests/test_cases.json` gồm 25 ca màn và 12 ca biên; 37 ca kiểm chứng không phải 37 màn độc lập.
- Đã có [dfs.docx](dfs.docx), [level-groups.csv](level-groups.csv), dữ liệu thử gốc trong `benchmarks/`
  và [đợt Q04](benchmarks/q04-20261031/raw.csv): 300/300 SOLVED, đã replay/kiểm chứng độc lập.
  Chưa có CSV tổng hợp chính thức hoặc methodology Q05.
  Công cụ và catalog chạy thử nằm trong [Src/benchmarks](../../Src/benchmarks/README.md);
  đầu ra thử nghiệm cục bộ không đưa vào handoff.

## Nhiệm vụ

| Đã bàn giao | Mã | Công việc | Đầu ra |
| --- | --- | --- | --- |
| [x] | `Q01` | Viết DFS, giả mã, ví dụ, chống chu trình và giới hạn tối ưu | `dfs.docx` → Nam |
| [x] | `Q02` | Công cụ đo tuần tự, timeout, lưu từng lượt và kiểm chứng replay | `Src/benchmarks/cli.py` → Thức rà; dữ liệu thử → Nam |
| [x] | `Q03` | Danh mục và phân nhóm bộ màn từ JSON | `level-groups.csv` → Nam, Thức |
| [x] | `Q04` | Chạy bộ số liệu trên snapshot đã chốt cho đợt đo | `benchmarks/q04-20261031/raw.csv`, 300 `runs/*.json`, metadata → cả nhóm |
| [ ] | `Q05` | Tổng hợp dữ liệu và viết phương pháp đo | `benchmarks/<đợt>/summary.csv`, `methodology.docx` → Phúc, Nam |
| [ ] | `Q06` | Bàn giao lệnh tái lập, schema dữ liệu, nguồn và khai báo AI | README này và gói dữ liệu → Phúc, Nam |

Q01 đã được cập nhật theo tập tám hành động hiện tại; Q02/Q03 đã được rà lại sau khi đồng bộ main.

## Tiêu chí kiểm tra

**Q01:** Trình bày stack LIFO, `parent` đánh dấu khi phát hiện, kiểm tra goal khi sinh con
và truy vết. Thứ tự sinh là `UP LEFT RIGHT DOWN SUP SLEFT SRIGHT SDOWN`,
các hướng có tiền tố S chỉ khi SPLIT. Stack duyệt theo thứ tự lấy ra ngược lại;
không mô tả SPACE là một cạnh tìm kiếm. Nêu start=goal, vô nghiệm và cách đếm node.
Phân tích bộ nhớ gồm stack và bảng trạng thái đã gặp, không áp công thức tree-DFS máy móc.

**Q02/Q04:** Dùng bốn hàm `solve_*` công khai, board mới cho mỗi lượt và cùng bộ màn.
Lưu CSV ngay sau từng lượt, JSON lời giải, commit, môi trường, cấu hình và run_id.
Replay kiểm tra tới đích và tính `path_cost` ngoài vùng đo profiler.
Giữ `SOLVED`, `NO_SOLUTION`, `TIMEOUT`, `ERROR`, `INVALID_PATH` riêng;
metric chưa đo để trống. Không dùng walkthrough làm lời giải solver.

**Q03:** Mỗi ID xuất hiện đúng một lần. Quy tắc nhóm đang dùng: split → tách/ghép;
còn lại switch/cầu → công tắc–cầu; còn lại fragile → gạch cam; còn lại → cơ bản.
Cột stress là nhãn phụ, không phải nhóm màn mới. Đối chiếu kích thước, số ô/cầu/công tắc với JSON.

**Q04/Q05:** Cấu hình Q04 được Quân yêu cầu chạy ngày 31/10/2026:
25 × 4 × 3 = 300 lượt, timeout 120 giây, source `e5fe581`.
[Baseline](../shared/baseline.md) ghi phạm vi chốt của Quân và các xác nhận nhóm còn thiếu.
Báo tỷ lệ thành công và số mẫu; không đưa timeout thành thời gian 0 hoặc loại âm thầm.
CSV tổng hợp có trung vị và đơn vị rõ: ms, KiB, node, số hành động, cost.
Phân biệt `total_cost` gốc với `path_cost` chung khi so BFS/DFS với UCS/A*.

## Chạy lại

Từ `Src`, chạy thử vào một thư mục mới:

```bash
python -m benchmarks.cli --levels 1 4 --solvers bfs dfs ucs astar --repeats 1 --timeout 5 --output-dir benchmarks/results/trial
```

Lệnh Q04 đã chọn; dùng thư mục output mới để tái lập, không ghi đè đợt bàn giao:

```bash
python -m benchmarks.cli --levels all --solvers bfs dfs ucs astar --repeats 3 --timeout 120 --output-dir benchmarks/results/q04-rerun
```

CLI yêu cầu thư mục mới và từ chối ghi vào thư mục đã tồn tại. Nếu bỏ --output-dir,
CLI tự tạo một thư mục đợt đo mới trong benchmarks/. Metadata có fingerprint source,
hash bộ màn và cờ git_dirty cho thay đổi trong Src; các cột CSV giữ nguyên.
CLI chưa tạo `summary.csv` hay hình; Q05 tổng hợp dữ liệu, P05 của Phúc vẽ biểu đồ.
Q06 phải bổ sung cách tái tạo CSV tổng hợp khi phần đó hoàn thành.

## Đợt Q04 ngày 31/10/2026

Đầu ra nằm trong [benchmarks/q04-20261031](benchmarks/q04-20261031/raw.csv).
Snapshot đo: `e5fe5812cb040bf56e659b3a20cd37879eb579db`; `git_dirty=false` trong Src lúc bắt đầu.
Môi trường: Intel Core i5-12450HX, RAM 24 GB, Windows 11, Python 3.14.6;
chi tiết và fingerprint nằm trong `environment.json`, bộ màn/cấu hình nằm trong `run-config.json`.
Timestamp theo giờ máy SE Asia Standard Time (UTC+07:00).

Kết quả: **300 SOLVED, 0 NO_SOLUTION, 0 TIMEOUT, 0 ERROR, 0 INVALID_PATH**.
Đã đối chiếu đủ 25 × 4 × 3 tổ hợp không trùng/thiếu, 16 cột CSV và 300 JSON tương ứng.
Mọi lời giải được kiểm tra độc lập bằng `tests.helpers.validate_result()` và `core.replay.replay_solution()`:
đúng hành động, tới đích, đúng độ dài và cost; BFS khớp mốc ít bước, UCS/A* khớp cost tối ưu của testcase.
Hash source và bộ màn khớp metadata sau khi đo; dữ liệu benchmark cũ không bị thay đổi.
Đây là xác nhận trên bộ ca hiện tại, không thay chứng minh tổng quát cho heuristic hoặc nghiệm thu nhóm.

Lượt gốc chạy từ Src bằng:

```bash
python -u -m benchmarks.cli --levels all --solvers bfs dfs ucs astar --repeats 3 --timeout 120 --output-dir ../handoff/quan/benchmarks/q04-20261031
```

Chạy tuần tự theo ID màn tăng dần, mỗi màn lặp 1–3, mỗi lần theo bfs → dfs → ucs → astar.
Không warm-up hoặc xáo thứ tự; đây là giới hạn cần nêu khi diễn giải timing ở Q05.
Đợt này chỉ gồm 25 màn chơi; 12 ca biên được kiểm thử riêng, không gộp thành 37 màn hiệu năng.
Giữ nguyên mọi lượt timeout/lỗi nếu có; không thay bằng 0 hoặc chọn lượt đẹp hơn.
Thời gian là phép đo với tracemalloc bật, memory là peak cấp phát Python KiB.

Handoff chỉ giữ đầu ra bàn giao. Màn đã bỏ, trial và nhật ký rà soát cũ có thể tra lại trong lịch sử Git.
