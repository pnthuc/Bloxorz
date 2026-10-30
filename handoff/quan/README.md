# Nguyễn Lê Minh Quân — DFS và thực nghiệm

MSSV **24120219**. Nhánh bàn giao: `work/quan-experiment`. Nhận/gửi việc theo [quy trình chung](../README.md).
Quân đo và kiểm chứng số liệu; Phúc nhận CSV để làm bảng/biểu đồ; Nam tổng hợp báo cáo.

## Đầu vào và hiện trạng

- DFS: `Src/solvers/member2_dfs.py`; engine: `Src/core/board.py`.
- Đo: `Src/benchmarks/cli.py`; profiler: `Src/solvers/base.py`;
  kiểm tra lời giải: `Src/core/replay.py`.
- 25 màn trong `Src/levels/`, giữ ID không liên tiếp theo [bộ đã chọn](LEVEL_SELECTION.md).
  `Src/tests/test_cases.json` gồm 25 ca màn và 12 ca biên, không phải 43 màn độc lập.
- Đã có [dfs.docx](dfs.docx), [level-groups.csv](level-groups.csv)
  và [dữ liệu chạy thử](benchmarks/run-config.json): màn 1, 4, bốn solver, một lần/lượt.
  Đây chưa phải bộ số liệu lặp chính thức. Chưa có CSV tổng hợp hoặc phương pháp đo.

## Nhiệm vụ

| Đã bàn giao | Mã | Công việc | Đầu ra |
| --- | --- | --- | --- |
| [x] | `Q01` | Viết DFS, giả mã, ví dụ, chống chu trình và giới hạn tối ưu | `dfs.docx` → Nam |
| [x] | `Q02` | Công cụ đo tuần tự, timeout, lưu từng lượt và kiểm chứng replay | `Src/benchmarks/cli.py` → Thức rà; dữ liệu thử → Nam |
| [x] | `Q03` | Danh mục và phân nhóm bộ màn từ JSON | `level-groups.csv` → Nam, Thức |
| [ ] | `Q04` | Chạy bộ số liệu trên snapshot đã chốt | `benchmarks/<đợt>/raw.csv`, `runs/*.json`, metadata → cả nhóm |
| [ ] | `Q05` | Tổng hợp dữ liệu và viết phương pháp đo | `benchmarks/<đợt>/summary.csv`, `methodology.docx` → Phúc, Nam |
| [ ] | `Q06` | Bàn giao lệnh tái lập, schema dữ liệu, nguồn và khai báo AI | README này và gói dữ liệu → Phúc, Nam |

Dấu đã bàn giao được giữ từ trước; Q01 cần sửa nội dung theo tập hành động hiện tại.

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

**Q04/Q05:** Kế hoạch đang đề xuất 25 × 4 × 3 = 300 lượt, timeout 120 giây;
chỉ dùng sau khi [baseline](../shared/baseline.md) được nhóm chốt.
Báo tỷ lệ thành công và số mẫu; không đưa timeout thành thời gian 0 hoặc loại âm thầm.
CSV tổng hợp có trung vị và đơn vị rõ: ms, KiB, node, số hành động, cost.
Phân biệt `total_cost` gốc với `path_cost` chung khi so BFS/DFS với UCS/A*.

## Chạy lại

Từ `Src`, chạy thử vào một thư mục mới:

```bash
python -m benchmarks.cli --levels 1 4 --solvers bfs dfs ucs astar --repeats 1 --timeout 5 --output-dir ../handoff/quan/benchmarks/trial
```

Lệnh cho toàn bộ kế hoạch đề xuất, chỉ chạy sau mốc chốt:

```bash
python -m benchmarks.cli --levels all --solvers bfs dfs ucs astar --repeats 3 --timeout 120 --output-dir ../handoff/quan/benchmarks/official-run
```

Mỗi đợt dùng thư mục riêng vì CLI nối thêm `raw.csv` nhưng ghi lại metadata.
CLI chưa tạo `summary.csv` hay hình; Q05 tổng hợp dữ liệu, P05 của Phúc vẽ biểu đồ.
Q06 phải bổ sung cách tái tạo CSV tổng hợp khi phần đó hoàn thành.

## Bộ dữ liệu mới

[LEVEL_SELECTION.md](LEVEL_SELECTION.md) ghi lý do chọn 25 màn và archive 17 màn cũ.
[Q01-Q03_REVIEW.md](Q01-Q03_REVIEW.md) ghi kết quả rà soát và phiên bản đồng bộ.
