# Nguyễn Lê Minh Quân — DFS và thực nghiệm

MSSV **24120219**. Nhận/gửi việc theo [quy trình chung](../README.md).
Quân đo và kiểm chứng số liệu; Phúc nhận CSV để làm bảng/biểu đồ; Nam tổng hợp báo cáo.

## Đầu vào và hiện trạng

- DFS: `Src/solvers/member2_dfs.py`; engine: `Src/core/board.py`.
- Đo: `Src/benchmarks/cli.py`; profiler: `Src/solvers/base.py`;
  kiểm tra lời giải: `Src/core/replay.py`.
- 25 màn `Src/levels/level_01.json` đến `level_25.json`.
  `Src/tests/test_cases.json` gồm 35 ca (25 ca màn và 10 ca biên).
- Đã có [dfs.docx](dfs.docx), [level-groups.csv](level-groups.csv),
  bộ benchmark chuẩn 300 lượt ([raw.csv](benchmarks/raw.csv), [runs](benchmarks/runs/))
  và [summary.csv](benchmarks/summary.csv).

## Nhiệm vụ

| Đã bàn giao | Mã | Công việc | Đầu ra |
| --- | --- | --- | --- |
| [x] | `Q01` | Viết DFS, giả mã, ví dụ, chống chu trình và giới hạn tối ưu | `dfs.docx` → Nam |
| [x] | `Q02` | Công cụ đo tuần tự, timeout, lưu từng lượt và kiểm chứng replay | `Src/benchmarks/cli.py` → Thức rà; dữ liệu thử → Nam |
| [x] | `Q03` | Danh mục và phân nhóm bộ màn từ JSON | `level-groups.csv` → Nam, Thức |
| [x] | `Q04` | Chạy bộ số liệu trên snapshot đã chốt | `benchmarks/raw.csv`, `runs/*.json`, metadata → cả nhóm |
| [x] | `Q05` | Tổng hợp dữ liệu bằng tool summarize | `benchmarks/summary.csv` → Phúc, Nam |
| [x] | `Q06` | Bàn giao lệnh tái lập, schema dữ liệu, nguồn và khai báo AI | README này và gói dữ liệu → Phúc, Nam |

Dấu đã bàn giao được giữ từ trước; phần mô tả chi tiết của DFS được hiệu chỉnh đồng bộ trực tiếp trên `Report.docx` tổng của Nam.

## Tiêu chí kiểm tra

**Q01:** Trình bày stack LIFO, `parent` đánh dấu khi phát hiện, kiểm tra goal khi sinh con
và truy vết. Thứ tự sinh là `UP LEFT RIGHT DOWN SUP SLEFT SRIGHT SDOWN`,
các hướng có tiền tố S chỉ khi SPLIT. Stack duyệt theo thứ tự lấy ra ngược lại;
không mô tả SPACE là một cạnh tìm kiếm. Nêu start=goal, vô nghiệm và cách đếm node.
Phân tích bộ nhớ gồm stack và bảng trạng thái đã gặp, không áp công thức tree-DFS máy móc.

**Q02/Q04:** Dùng bốn hàm `solve_*` công khai, board mới cho mỗi lượt và cùng bộ màn.
Lưu CSV ngay sau từng lượt, JSON lời giải, môi trường, cấu hình và run_id.
Replay kiểm tra tới đích và tính `path_cost` ngoài vùng đo profiler.
Giữ `SOLVED`, `NO_SOLUTION`, `TIMEOUT`, `ERROR`, `INVALID_PATH` riêng;
metric chưa đo để trống. Không dùng walkthrough làm lời giải solver.

**Q03:** Mỗi ID xuất hiện đúng một lần. File `level-groups.csv` thống kê 8 thông số
kích thước, ô sàn, cầu, công tắc và gạch cam của 25 màn từ JSON.

**Q04/Q05:** Bộ benchmark chính thức gồm 25 × 4 × 3 = 300 lượt, timeout 120 giây;
chỉ dùng sau khi [baseline](../shared/baseline.md) được nhóm chốt.
Báo tỷ lệ thành công và số mẫu; không đưa timeout thành thời gian 0 hoặc loại âm thầm.
CSV tổng hợp có trung vị và đơn vị rõ: ms, KiB, node, số hành động, cost.
Phân biệt `total_cost` gốc với `path_cost` chung khi so BFS/DFS với UCS/A*.

---

## Hướng dẫn chạy lại thực nghiệm (Q06)

Các bước chạy lại toàn bộ dữ liệu bàn giao từ mã nguồn gốc:

### 1. Chạy bộ kiểm thử (Unit Tests)
Trước khi đo hoặc tổng hợp, chạy toàn bộ unit test để đảm bảo code không bị lỗi hồi quy:
```bash
# Windows PowerShell (từ thư mục gốc E:\Bloxorz):
$env:PYTHONPATH="Src"; python -m unittest discover -s Src/tests
```

### 2. Thống kê và phân loại màn chơi (Q03)
Tạo file `level-groups.csv` thống kê các thông số hình học và cơ chế của 25 màn chơi từ dữ liệu JSON:
```bash
python handoff/quan/generate_level_groups.py
```
File xuất tại: `handoff/quan/level-groups.csv`.

### 3. Chạy thực nghiệm chuẩn 300 lượt (Q04)
Chạy đo độc lập 25 màn × 4 thuật toán × 3 lần lặp với thời gian giới hạn (timeout) 120 giây/lượt:
```bash
cd Src
python -m benchmarks.cli --levels all --solvers bfs dfs ucs astar --repeats 3 --timeout 120 --output-dir ../handoff/quan/benchmarks
cd ..
```
*Lưu ý:* CLI chạy mỗi lượt trong một tiến trình riêng (`worker.py`), tự động kiểm tra lại đường đi bằng `replay.py` và lưu đồng thời vào `raw.csv`, thông số môi trường cùng các file `runs/*.json`.

### 4. Tổng hợp số liệu trung vị (Q05)
Tổng hợp bảng số liệu báo cáo từ dữ liệu thô mà không cần chạy lại thuật toán:
```bash
python handoff/quan/summarize.py handoff/quan/benchmarks
```
File xuất tại: `handoff/quan/benchmarks/summary.csv`.

---

## Cấu trúc dữ liệu bàn giao (Q06)

Dữ liệu bàn giao cho Phúc (vẽ biểu đồ) và Nam (viết báo cáo) được quy ước thống nhất như sau:

### 1. Bảng phân loại màn chơi (`level-groups.csv`)
- `level_id` *(int)*: ID màn chơi (1 đến 25).
- `level_name` *(str)*: Tên màn chơi.
- `grid_size` *(str)*: Kích thước bản đồ (Dòng $\times$ Cột).
- `floor_cells` *(int)*: Tổng số ô gạch đi được trên sàn (khác 0).
- `bridges_count` *(int)*: Số lượng cầu bật/tắt có trong màn.
- `switches_count` *(int)*: Tổng số công tắc (nhẹ, nặng, phân tách).
- `split_switches` *(int)*: Số lượng công tắc phân tách `()` (tạo trạng thái `SPLIT`).
- `fragile_cells` *(int)*: Số ô gạch cam dễ vỡ (khối gỗ đứng thẳng sẽ bị gãy và rơi).

### 2. Dữ liệu thực nghiệm thô (`benchmarks/raw.csv`)
- `level_id` *(int)*: ID màn chơi.
- `solver` *(str)*: Tên thuật toán (`bfs`, `dfs`, `ucs`, `astar`).
- `repeat_index` *(int)*: Lần chạy lặp thứ mấy trong 3 lần đo (1, 2, 3).
- `status` *(str)*: Trạng thái kết thúc:
  - `SOLVED`: Tìm được đường đi hợp lệ tới đích (đã kiểm tra qua bước replay).
  - `NO_SOLUTION`: Đã duyệt hết các trạng thái nhưng không có đường tới đích.
  - `TIMEOUT`: Chạy quá thời gian quy định (120 giây).
  - `ERROR`: Phát sinh lỗi trong lúc chạy.
  - `INVALID_PATH`: Đường đi sinh ra không hợp lệ khi kiểm tra bằng replay.
- `search_time_ms` *(float)*: Thời gian chạy thuật toán tìm kiếm thuần túy (đơn vị: mili-giây, không tính thời gian khởi tạo tiến trình hay replay).
- `memory_kb` *(float)*: Mức RAM tối đa (peak memory) mà Python cấp phát, đo bằng `tracemalloc` (đơn vị: KiB).
- `expanded_nodes` *(int)*: Số lượng trạng thái được lấy ra khỏi tập biên (frontier) để mở rộng.
- `solution_length` *(int)*: Số bước di chuyển (số lần lăn khối gỗ) trong lời giải tìm được (`len(moves)`).
- `path_cost` *(float)*: Chi phí đường đi tính theo công thức chung: $1 + 0.5 \times \text{số ô fragile ở trạng thái đến}$.

### 3. File chi tiết từng lượt chạy (`benchmarks/runs/<run_id>.json`)
Lưu đầy đủ thông tin của mỗi lượt chạy: `run_id`, `level_id`, `solver`, `repeat_index`, `status`, chuỗi bước đi chi tiết `moves: [...]`, thời gian chạy, bộ nhớ tiêu thụ và thông báo lỗi (nếu có).

### 4. Bảng số liệu tổng hợp (`benchmarks/summary.csv`)
Tổng hợp kết quả của 100 nhóm theo cặp `(level_id, solver)`:
- `runs`, `solved`, `no_solution`, `timeouts`, `errors`, `invalid_paths`: Số lượt tương ứng cho từng trạng thái.
- `search_time_ms_median`: Trung vị thời gian tìm kiếm (ms) của các lượt giải thành công.
- `memory_kb_median`: Trung vị mức RAM đỉnh (KiB) của các lượt giải thành công.
- `expanded_nodes_median`: Trung vị số node mở rộng của các lượt giải thành công.
- `solution_length_median`: Trung vị số bước đi của các lượt giải thành công.
- `path_cost_median`: Trung vị chi phí đường đi của các lượt giải thành công.
*Quy ước:* Dùng giá trị trung vị (median) để hạn chế sai số từ tiến trình nền của hệ điều hành và Garbage Collector; các lượt `TIMEOUT`/`ERROR` được để trống thay vì gán bằng 0 để không làm lệch kết quả thống kê.

---

## Tài liệu tham khảo và Kê khai AI (Q06)

### 1. Tài liệu tham khảo
1. Stuart Russell, Peter Norvig, *Artificial Intelligence: A Modern Approach* (4th Edition), Pearson, 2020 (Chương 3: Solving Problems by Searching).
2. Đề bài đồ án môn học Cơ sở Trí tuệ Nhân tạo và tài liệu giải đáp thắc mắc (FAQs) từ Giảng viên hướng dẫn.
3. Luật chơi và cấu trúc trò chơi Bloxorz: Định dạng dữ liệu bản đồ JSON tại `Src/levels/` và mã nguồn xử lý bàn cờ tại `Src/core/board.py`.

### 2. Kê khai sử dụng công cụ AI (AI Disclosure)
- **Công cụ hỗ trợ:** GitHub Copilot, Gemini.
- **Mục đích sử dụng:**
  - Hỗ trợ viết các kịch bản kiểm thử tự động (`Src/tests/test_summary.py`, `test_benchmark.py`).
  - Hỗ trợ căn chỉnh định dạng bảng biểu CSV/Markdown và thống nhất cấu trúc dữ liệu (schema) cho nhóm.
  - Hỗ trợ tối ưu hóa script tổng hợp dữ liệu `summarize.py`.
- **Cam kết trách nhiệm:**
  - Thuật toán DFS trên đồ thị (`Src/solvers/member2_dfs.py`), kỹ thuật kiểm tra đích sớm và xử lý tránh lặp chu trình do sinh viên tự cài đặt và kiểm thử.
  - Toàn bộ 300 lượt chạy thực nghiệm được thực hiện trực tiếp trên máy cá nhân của sinh viên; số liệu thô và số liệu tổng hợp đã được đối chiếu, đảm bảo tính trung thực 100%.