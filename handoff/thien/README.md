# Tống Phúc Thiện — Chịu trách nhiệm nội dung A*

MSSV: **24120141** · Nhánh gợi ý: `work/thien-astar-report`

Tự viết và kiểm tra toàn bộ nội dung A*/heuristic theo code cuối; gửi nội dung chỉnh sửa được cho Nam và rà lời dẫn video của Phúc.

[Quy trình làm việc chung](../README.md) 

## Nhận những gì để bắt đầu?

- `Src/solvers/member4_astar.py`, `Src/solvers/costs.py` và `game_logic.py`.
- Bản cost policy cuối từ Phúc; A* cần dùng cùng đơn vị cost.
- Dữ liệu A* và UCS của Quân, đặc biệt các màn có split/teleport.

## Danh sách nhiệm vụ

Đổi `[ ]` thành `[x]` sau khi có đủ đầu ra và người nhận xác nhận. Việc đánh dấu trong README được lưu qua commit.

| Đã bàn giao | Mã | Nhiệm vụ |
| --- | --- | --- |
| [ ] | `H01` | Đặc tả heuristic đang dùng ở bản cuối |
| [ ] | `H02` | Viết A*, giả mã và lập luận lý thuyết |
| [ ] | `H03` | Ví dụ tính tay và nhận xét kết quả A* |
| [ ] | `H04` | Rà phần A* trước khi bàn giao cuối |

Các đường dẫn đầu ra dưới đây là nơi sẽ tạo file khi thực hiện nhiệm vụ. Thư mục hiện tại mới có README, chưa có kết quả hay báo cáo giả lập.

## H01 — Đặc tả heuristic đang dùng ở bản cuối

**Đầu vào**

- Hàm heuristic(), cách tìm goal, luật SPLIT/teleport và policy cost cuối.

**Yêu cầu thực hiện**

- Viết rõ tham số đầu vào, đầu ra, công thức từng trường hợp và ý nghĩa từng thành phần.
- Nêu cách xử lý goal, các hướng khối, khoảng cách giữa hai khối và đường đi qua split switch nếu bản cuối có dùng.
- Ghi điều kiện hoặc hệ số liên hệ giữa khoảng cách/số bước và đơn vị cost; tự kiểm tra cả khả năng cost bằng 0 nếu policy cho phép.
- Gửi công thức ngắn gọn cho Quân để ghi metadata và cho Nam dùng ký hiệu nhất quán.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/thien/heuristic-policy.docx`: công thức và phạm vi áp dụng; ghi commit.

**Tiêu chí hoàn thành**

- Mỗi nhánh được đối chiếu với code cuối; không lấy nguyên chú thích cũ khi công thức đã thay đổi.
- Phúc xác nhận cùng policy cost; không biến một công thức chưa kiểm chứng thành kết luận tối ưu toàn cục.

**Gửi cho:** Phúc đối chiếu cost; Quân ghi metadata; Nam nhận nội dung.

**Thực hiện khi:** Bắt đầu ngay; chốt cùng P01 tại M0.

## H02 — Viết A*, giả mã và lập luận lý thuyết

**Đầu vào**

- H01, bản A* cuối, nội dung goal/successor và nguồn tham khảo.

**Yêu cầu thực hiện**

- Giải thích g, h, f; heap, tie-break, best_g, parent, entry lỗi thời, mở lại trạng thái khi tìm được g tốt hơn nếu code có hỗ trợ.
- Đưa giả mã sát code; chỉ rõ kiểm tra goal tại lúc lấy khỏi frontier.
- Phân tích admissible h(s) ≤ h*(s), consistent h(s) ≤ c(s,a,s′) + h(s′), h(goal)=0; nêu lập luận và giả thiết tương ứng.
- Xét riêng split, ghép lại và teleport liên tiếp; phân biệt kiểm tra vài trạng thái với chứng minh cho toàn miền.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/thien/astar.docx`: thuật toán, giả mã, tính chất, giả thiết và tài liệu tham khảo.

**Tiêu chí hoàn thành**

- Mọi khẳng định về tối ưu có điều kiện rõ; nội dung khớp code và cost cuối.
- Nêu được điểm mạnh/hạn chế của heuristic bằng lời dễ hiểu; không chỉ chép công thức.

**Gửi cho:** Nam tổng hợp; Phúc rà quan hệ cost–heuristic.

**Thực hiện khi:** Sau H01 và P01.

## H03 — Ví dụ tính tay và nhận xét kết quả A*

**Đầu vào**

- Các trạng thái thật từ màn đã chọn; CSV A*/UCS Q04–Q05 và hình P05.

**Yêu cầu thực hiện**

- Chọn một trạng thái, tính g, h và f; minh họa hai lựa chọn kế tiếp nếu giúp giải thích ưu tiên.
- So sánh A* với UCS trên màn cơ bản, màn có split và một màn stress; chỉ rõ số liệu lấy từ dòng/hình nào.
- Giải thích khác biệt cost, node, thời gian và bộ nhớ; gửi nhận xét có thể ghép trực tiếp vào discussion.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/thien/astar-example.docx`, `astar-results.docx` và hình/bảng liên quan.

**Tiêu chí hoàn thành**

- Tính tay khớp hàm trên cùng snapshot; số liệu khớp CSV.
- Nêu kết quả theo từng trường hợp; không suy từ vài màn thành bảo đảm chung.

**Gửi cho:** Nam dùng trong báo cáo và lời dẫn video; Quân kiểm tra số liệu.

**Thực hiện khi:** Ví dụ làm sớm; nhận xét thực nghiệm sau Q05 và P05.

## H04 — Rà phần A* trước khi bàn giao cuối

**Đầu vào**

- Bản Report.docx/PDF, kịch bản video, các mục H01–H03.

**Yêu cầu thực hiện**

- Đọc lại mọi đoạn nói về A*, heuristic, tính tối ưu và quan hệ với UCS.
- Kiểm tra hình/caption, ví dụ, ký hiệu, kết luận và nguồn tham khảo.
- Gửi xác nhận nội dung hoặc danh sách chỉnh sửa cụ thể; bổ sung khai báo AI và prompt tiêu biểu cho phần đã dùng.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/thien/review-notes.docx` và gói nội dung A* đã sửa cuối.

**Tiêu chí hoàn thành**

- Không còn nhận xét A* mâu thuẫn với dữ liệu hoặc công thức cuối.
- Nam nhận được câu sửa cụ thể, không chỉ nhận “cần xem lại”.

**Gửi cho:** Nam sửa report; Phúc sửa lời dẫn video; Thức nhận xác nhận để nghiệm thu.

**Thực hiện khi:** Sau khi Nam gửi report và Phúc gửi kịch bản/video nháp.


## Đẩy công việc lên repo

1. Làm theo quy trình tạo nhánh trong [hướng dẫn chung](../README.md#tao-nhanh-va-day-cong-viec).
2. Commit file trong `handoff/thien/`; nếu có sửa code, stage thêm đúng các file code đã sửa.
3. Push nhánh, tạo Pull Request vào `main`, ghi mã task và đầu ra đã có. Gửi link PR cho Thức để xem và gộp.
4. Mỗi người gửi nguồn tham khảo và phần sử dụng AI của mình cùng nội dung bàn giao; Nam tổng hợp vào báo cáo.
