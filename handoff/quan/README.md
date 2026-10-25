# Nguyễn Lê Minh Quân — Đo, kiểm chứng và bàn giao số liệu

MSSV: **24120219** · Nhánh gợi ý: `work/quan-experiments`

Tập trung công cụ đo, số liệu gốc, CSV tổng hợp và phương pháp thực nghiệm. Phúc nhận CSV để làm bảng trình bày/biểu đồ.

[Quy trình làm việc chung](../README.md) · 

## Nhận những gì để bắt đầu?

- `Src/solvers/member2_dfs.py`: bản DFS đã có; viết theo cách dùng stack và parent trong code.
- `Src/experiments.py`: đã gọi bốn solver, in số liệu và vẽ một ảnh 2 × 2; tiếp tục mở rộng file này.
- `Src/solvers/base.py`: đã đo thời gian và bộ nhớ; dùng lại wrapper có sẵn.
- `Src/tests/helpers.py`: đã có replay_solution(), load_cases(), load_levels().
- `Src/levels/`: 33 màn; `Src/tests/test_cases.json`: 43 ca kiểm tra, gồm 10 ca T và 33 ca màn.
- Nhận policy cost từ Phúc, mô tả heuristic từ Thiện và snapshot cuối từ Thức.

## Danh sách nhiệm vụ

Đổi `[ ]` thành `[x]` sau khi có đủ đầu ra và người nhận xác nhận. Việc đánh dấu trong README được lưu qua commit.

| Đã bàn giao | Mã | Nhiệm vụ |
| --- | --- | --- |
| [ ] | `Q01` | Viết phần DFS sát với bản cài đặt |
| [ ] | `Q02` | Mở rộng script thực nghiệm từ experiments.py |
| [ ] | `Q03` | Lập danh mục và phân nhóm bộ màn |
| [ ] | `Q04` | Chạy và kiểm chứng bộ số liệu chính thức |
| [ ] | `Q05` | Tổng hợp CSV và viết phương pháp đo |
| [ ] | `Q06` | Bàn giao gói tái lập thực nghiệm |

Các đường dẫn đầu ra dưới đây là nơi sẽ tạo file khi thực hiện nhiệm vụ. Thư mục hiện tại mới có README, chưa có kết quả hay báo cáo giả lập.

## Q01 — Viết phần DFS sát với bản cài đặt

**Đầu vào**

- `member2_dfs.py`, `State`, get_successors() và get_initial_state().

**Yêu cầu thực hiện**

- Trình bày stack LIFO, cách parent đồng thời đánh dấu trạng thái đã gặp, thời điểm kiểm tra goal và cách truy vết.
- Nêu thứ tự sinh UP, DOWN, LEFT, RIGHT, SPACE và ảnh hưởng của stack tới thứ tự duyệt; dùng đúng thứ tự code cuối.
- Đưa giả mã, một ví dụ nhỏ và điều kiện về tính đầy đủ/tính tối ưu. Phân tích bộ nhớ theo cấu trúc visited/parent thực tế, tránh gán máy móc O(bm) của tree-DFS.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/quan/dfs.docx`: nội dung, giả mã, ví dụ và tài liệu tham khảo.

**Tiêu chí hoàn thành**

- Người đọc đối chiếu được từng bước với code; giải thích được chống chu trình và vì sao đường đi có thể dài.
- Ghi rõ start=goal, vô nghiệm và ý nghĩa expanded_nodes trong DFS.

**Gửi cho:** Nam nhận để ghép báo cáo; Thức đối chiếu phần dùng engine.

**Thực hiện khi:** Có thể bắt đầu ngay từ bản repo đã đọc.

## Q02 — Mở rộng script thực nghiệm từ experiments.py

**Đầu vào**

- Script đo hiện có, wrapper solve_* có profiler, replay_solution() và danh sách màn đã chốt.

**Yêu cầu thực hiện**

- Bổ sung chọn màn, số lần lặp, giới hạn thời gian và thư mục xuất. Mục tiêu CLI đề xuất nằm ở phần giao ước chung.
- Gọi lần lượt bốn hàm solve_* công khai; mỗi lượt dùng một board mới. Đo tuần tự, mỗi lượt trong process riêng để có thể ngắt khi hết thời gian.
- Giữ số đo search_time_ms và memory_kb từ wrapper; không cộng thời gian tải màn, tạo process, animation, replay hay vẽ biểu đồ.
- Lưu JSON lời giải và một dòng CSV ngay sau mỗi lượt. Replay ngoài vùng đo để kiểm tra đường đi và tính path_cost bằng cost chung.
- Ghi trạng thái SOLVED, NO_SOLUTION, TIMEOUT, ERROR hoặc INVALID_PATH; còn đủ dữ liệu để biết lượt nào cần chạy lại.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `Src/experiments.py` được mở rộng; module hỗ trợ nếu thực sự cần.
- Chạy thử trên màn 1 và 4, sinh CSV/JSON đúng schema quy định bên dưới.

**Tiêu chí hoàn thành**

- Một lượt lỗi không làm mất kết quả đã lưu của các lượt trước.
- TIMEOUT được ngắt thực sự; các metric chưa có để trống, không dùng 0 thay cho số chưa đo.
- Giữ nguyên schema kết quả solver đang được GUI và test sử dụng; chỉ bổ sung dữ liệu ở đầu ra benchmark.

**Gửi cho:** Thức xem thay đổi công cụ đo; Nam nhận ví dụ dữ liệu để chuẩn bị bảng.

**Thực hiện khi:** Có thể viết công cụ ngay; chạy dữ liệu chính thức sau M0 chốt snapshot.

## Q03 — Lập danh mục và phân nhóm bộ màn

**Đầu vào**

- 33 JSON trong levels/, mô tả màn, initial_bridges, switches và grid.

**Yêu cầu thực hiện**

- Lập level-groups.csv: level_id, tên, số hàng/cột, số ô có sàn, số cầu, số split switch và nhóm chính.
- Quy tắc nhóm đề xuất: có split → tách/ghép; còn lại có switch/cầu → công tắc–cầu; còn lại có fragile → gạch cam; phần còn lại → cơ bản. Thêm nhãn stress cho 23–33 hoặc các màn có độ lớn nổi bật và giải thích tiêu chí.
- Nêu bộ thực nghiệm dùng 33 ID màn duy nhất. Các ca T1–T10 dùng kiểm chứng biên; một số tham chiếu lại màn thật nên không cộng thành 43 màn độc lập.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/quan/level-groups.csv` và đoạn mô tả bộ màn trong methodology.docx.

**Tiêu chí hoàn thành**

- Mỗi ID 1–33 xuất hiện đúng một lần ở nhóm chính; có đủ bảng số lượng từng nhóm.
- Phân nhóm có căn cứ từ dữ liệu màn, không chỉ dựa vào tên hoặc kết quả chạy nhanh/chậm.

**Gửi cho:** Nam dùng mô tả và bảng nhóm; Thức kiểm tra ý nghĩa cơ chế game.

**Thực hiện khi:** Có thể bắt đầu ngay từ bản repo đã đọc.

## Q04 — Chạy và kiểm chứng bộ số liệu chính thức

**Đầu vào**

- Snapshot M0, script Q02, danh mục Q03, cost policy của Phúc và thông tin heuristic của Thiện.

**Yêu cầu thực hiện**

- Chạy cùng máy, cùng Python, cùng cấu hình trên 33 màn × 4 solver × 3 lần: 396 lượt theo kế hoạch.
- Lưu cấu hình CPU/RAM/OS/Python, commit, ngày đo, timeout và số lần lặp vào environment.json.
- Kiểm tra các lời giải SOLVED bằng replay, goal và số hành động. Giữ kết quả bất thường và báo chủ solver kiểm tra; nếu sửa code, xác định lại snapshot và đo lại các phần chịu ảnh hưởng.
- Lưu total_cost gốc cùng path_cost tính bằng step_cost chung; tách hai cột vì BFS/DFS hiện dùng total_cost là số hành động.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/quan/benchmarks/raw.csv`, `runs/*.json`, `environment.json`, `run-config.json`.

**Tiêu chí hoàn thành**

- Có một dòng cho mỗi lượt dự kiến, kể cả timeout/lỗi; mọi dòng truy về cùng snapshot hoặc có run_id tách riêng.
- Nếu NO_SOLUTION xuất hiện trên màn đã biết có nghiệm thì được đánh dấu bất thường để điều tra.
- Không dùng walkthrough làm lời giải solver hoặc dùng một solver để thay kết quả solver khác.

**Gửi cho:** Nam nhận dữ liệu; Thiện nhận phần A*; Phúc nhận phần UCS/cost; Thức xác nhận đủ dữ liệu.

**Thực hiện khi:** Sau M0 và Q02; cần chạy xong trước phần phân tích cuối của Nam.

## Q05 — Tổng hợp CSV và viết phương pháp đo

**Đầu vào**

- raw.csv, nhóm màn và metadata Q04.

**Yêu cầu thực hiện**

- Xuất summary.csv với số lượt thành công, trung vị thời gian/bộ nhớ và các metric còn lại. Giữ nguyên ID màn, solver, đơn vị và trạng thái để Phúc sử dụng.
- Viết methodology.docx: cách đo, profiler sẵn có, giới hạn bộ nhớ Python, số lần lặp, timeout, cách tổng hợp và giới hạn của phép đo.
- Gửi Phúc raw.csv, summary.csv, level-groups.csv và ghi chú đơn vị; giải thích các dòng timeout/bất thường. Phúc làm bảng trình bày và biểu đồ ở P05.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/quan/benchmarks/summary.csv`, `handoff/quan/methodology.docx` và mô tả các cột.

**Tiêu chí hoàn thành**

- CSV khớp dữ liệu gốc, đủ metric và mẫu số thống kê; mọi trường hợp bị loại khỏi tổng hợp có lý do.
- Phúc đọc được dữ liệu mà không phải chạy lại solver; Nam có phần phương pháp đo có thể ghép vào report.

**Gửi cho:** Phúc nhận dữ liệu để làm P05; Nam nhận CSV và phương pháp để phân tích/ghép báo cáo.

**Thực hiện khi:** Sau Q04. Phần biểu đồ và bảng trình bày đã chuyển cho Phúc.

## Q06 — Bàn giao gói tái lập thực nghiệm

**Đầu vào**

- Script đo, cấu hình, dữ liệu CSV/JSON, phương pháp đo và phần DFS.

**Yêu cầu thực hiện**

- Viết hướng dẫn một lượt chạy thử nhỏ và lệnh tái lập lượt đo chính thức.
- Liệt kê ý nghĩa từng CSV/JSON, môi trường, commit và các timeout/lỗi còn tồn tại; cung cấp nguồn và khai báo AI.
- Bàn giao dữ liệu cho Phúc vẽ biểu đồ và cho Nam phân tích. Hướng dẫn tạo lại hình thuộc P05 của Phúc.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/quan/README.md` và đầy đủ gói bàn giao có thể chỉnh sửa.

**Tiêu chí hoàn thành**

- Người khác chạy lại được thử nghiệm nhỏ theo README và hiểu cách tạo lại CSV/JSON.
- Có dữ liệu gốc và script đo, không chỉ ảnh chụp terminal.

**Gửi cho:** Nam nhận phần DFS/phương pháp; Phúc nhận dữ liệu và hướng dẫn tái lập.

**Thực hiện khi:** Sau Q01–Q05.


## Đẩy công việc lên repo

1. Làm theo quy trình tạo nhánh trong [hướng dẫn chung](../README.md#tao-nhanh-va-day-cong-viec).
2. Commit file trong `handoff/quan/`; nếu có sửa code, stage thêm đúng các file code đã sửa.
3. Push nhánh, tạo Pull Request vào `main`, ghi mã task và đầu ra đã có. Gửi link PR cho Thức để xem và gộp.
4. Mỗi người gửi nguồn tham khảo và phần sử dụng AI của mình cùng nội dung bàn giao; Nam tổng hợp vào báo cáo.
