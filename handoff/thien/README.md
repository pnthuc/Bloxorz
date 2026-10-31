# Tống Phúc Thiện — A* và heuristic

MSSV **24120141**. Nhận/gửi việc theo [quy trình chung](../README.md).
Thiện chịu trách nhiệm công thức, giải thích và kiểm chứng phần A*; Nam ghép báo cáo,
Phúc đối chiếu cost và lời dẫn video.

## Đầu vào và hiện trạng

- `Src/solvers/member4_astar.py`, `Src/solvers/costs.py`, `Src/core/board.py`.
- Nhận policy cost từ Phúc, số liệu A*/UCS từ Quân và bản nháp Report/video để rà.
- Đã có [heuristic-policy.docx](heuristic-policy.docx), [astar.docx](astar.docx),
  [astar-example.docx](astar-example.docx), [astar-results.docx](astar-results.docx)
  và [review-notes.docx](review-notes.docx).
- `astar-results.docx` đang dẫn `summary.csv` và hình P05 chưa có trong repo;
  cần nhận nguồn từ Quân/Phúc và đối chiếu trước khi sử dụng số liệu.
  Các kiểm tra/phiên bản ghi trong DOCX cũng cần cập nhật theo mốc chốt.

## Nhiệm vụ

| Đã bàn giao | Mã | Công việc | Đầu ra |
| --- | --- | --- | --- |
| [X] | `H01` | Đặc tả từng nhánh heuristic, đơn vị và giả thiết | `heuristic-policy.docx` → Phúc, Quân, Nam |
| [X] | `H02` | A*, giả mã, heap, best_g, parent và lập luận tính chất | `astar.docx` → Nam; Phúc rà cost |
| [X] | `H03` | Ví dụ tính g/h/f và nhận xét A* so với UCS | `astar-example.docx`, `astar-results.docx` → Nam, Quân |
| [ ] | `H04` | Rà nội dung A* trong báo cáo và video, bổ sung nguồn/AI | `review-notes.docx` và bản sửa → Nam, Phúc, Thức |

Giữ trạng thái bàn giao trước đây; sự tồn tại của năm file không thay xác nhận nội dung.

## Tiêu chí kiểm tra

**H01:** Đối chiếu trực tiếp `heuristic()` và `precompute_switch_costs_from_goal()`.
Mô tả khoảng cách tới goal, trường hợp đang chiếm goal, khoảng cách giữa hai cube
và đường qua split switch. Cost hiện có mỗi cạnh ít nhất 1; không dùng giả định
về cost bằng 0 hoặc policy khác khi giải thích bản này.

**H02:** Giải thích `g`, `h`, `f`, bộ đếm tie-break, cập nhật best_g,
bỏ entry lỗi thời, mở lại đường tốt hơn và goal test khi lấy khỏi heap.
Thảo luận admissible/consistent theo yêu cầu đề; ghi rõ lập luận, điều kiện và giới hạn,
kể cả split/merge/teleport liên tiếp. Một số ví dụ hoặc test qua không thay cho chứng minh tổng quát.

**H03:** Ví dụ tính tay dùng state thật và code cùng phiên bản.
Chọn màn cơ bản, màn split và màn stress để so A*/UCS nếu có số liệu;
chỉ ra nguồn CSV của cost, node, thời gian và bộ nhớ. Không dùng số minh họa như kết quả đo.

**H04:** Đọc lại công thức, ký hiệu, caption, ví dụ và nhận xét trong Report/video.
Gửi câu sửa cụ thể hoặc xác nhận có phạm vi; kèm tài liệu tham khảo và khai báo AI/prompt.
Chốt H01 cùng P01 trước thực nghiệm; kết quả H03 chờ Q05/P05;
H04 thực hiện sau bản nháp của Nam/Phúc.
