# Bùi Phương Nam — Đầu mối báo cáo và phân tích tổng hợp

MSSV: **24120502** · Nhánh gợi ý: `work/nam-report`

Tập trung mô hình hóa, phân tích và báo cáo tổng. Gửi đề cương video ngắn; Phúc làm kịch bản chi tiết, quay dựng và đăng video.

[Quy trình làm việc chung](../README.md) ·

## Nhận những gì để bắt đầu?

- `Src/solvers/member3_bfs.py`: BFS đã cài bằng deque và parent.
- Đề bài §3.6–3.7, README hiện có và bảng phân công trong tài liệu này.
- Nhận mô tả State/engine từ Thức, DFS + số liệu từ Quân, A* từ Thiện, UCS/cost từ Phúc.
- GUI hiện có đã có chọn màn, bốn nút solver, metrics, restart, replay và animation thắng/thua.
- Nhận bảng/biểu đồ và video hoàn chỉnh từ Phúc; Phúc phụ trách kịch bản chi tiết, quay, dựng và đăng video.

## Danh sách nhiệm vụ

Đổi `[ ]` thành `[x]` sau khi có đủ đầu ra và người nhận xác nhận. Việc đánh dấu trong README được lưu qua commit.

| Đã bàn giao | Mã | Nhiệm vụ |
| --- | --- | --- |
| [x] | `N01` | Tạo khung báo cáo và viết phần BFS |
| [ ] | `N02` | Viết mô hình hóa bài toán từ engine đã có |
| [ ] | `N03` | Viết phân tích so sánh có dẫn chứng |
| [ ] | `N04` | Tổng hợp và biên tập Report.pdf |
| [x] | `N05` | Chốt đề cương nội dung video với Phúc |

Các đường dẫn đầu ra dưới đây là nơi sẽ tạo file khi thực hiện nhiệm vụ. Thư mục hiện tại mới có README, chưa có kết quả hay báo cáo giả lập.

## N01 — Tạo khung báo cáo và viết phần BFS

**Đầu vào**

- Đề bài; BFS hiện tại; danh sách thành viên và phân công.

**Yêu cầu thực hiện**

- Tạo khung Report.docx theo mục lục đề xuất ở dưới; đặt tiêu đề, caption, cách trích dẫn thống nhất.
- Viết BFS: queue FIFO, đánh dấu lúc phát hiện, goal test, parent và truy vết; đưa giả mã sát code và ví dụ nhỏ.
- Giải thích ít hành động nhất khi mỗi hành động tính một bước, bao gồm SPACE; phân biệt với tối ưu theo cost chung.
- Mở sẵn chỗ nhận các phần DFS, UCS, A*, mô hình hóa, kết quả và phụ lục.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/nam/Report.docx` bản khung và `bfs.docx`.

**Tiêu chí hoàn thành**

- Mọi mục đề yêu cầu có chỗ nhận nội dung; giả mã BFS khớp code cuối.
- Phân tích bộ nhớ có nhắc queue và tập trạng thái đã gặp; không mặc định BFS luôn nhanh hơn DFS.

**Gửi cho:** Cả nhóm dùng cấu trúc này để gửi nội dung; Thức xem mô hình biểu diễn.

**Thực hiện khi:** Có thể bắt đầu ngay từ bản repo đã đọc.

## N02 — Viết mô hình hóa bài toán từ engine đã có

**Đầu vào**

- `game_logic.py`; model-notes.docx và sơ đồ/tư liệu từ Thức; cost policy của Phúc.

**Yêu cầu thực hiện**

- Định nghĩa state tuple đúng trường, trạng thái ban đầu, actions, transition, goal test và hàm chi phí.
- Nêu rõ STANDING/HORIZONTAL/VERTICAL/SPLIT; SPACE chỉ có khi split; bridge tuple và active_cube ảnh hưởng việc phân biệt state.
- Dùng bảng để mô tả luật và ví dụ hai state cùng vị trí nhưng khác cầu; chỉ trình bày cơ chế đang có trong code.
- Tách mô hình tìm kiếm khỏi phần kiến trúc Flask/Three.js do Thức viết để tránh lặp nội dung.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/nam/model.docx` và bảng state/action/goal đưa vào báo cáo.

**Tiêu chí hoàn thành**

- Các trường khớp đúng State; chuyển trạng thái sử dụng engine chung.
- Thức duyệt nội dung về luật; Phúc duyệt phần cost; Thiện duyệt ký hiệu dùng với heuristic.

**Gửi cho:** Thức, Phúc, Thiện rà trước khi Nam ghép bản cuối.

**Thực hiện khi:** Có thể soạn từ repo ngay; chốt nội dung sau T01 và P01.

## N03 — Viết phân tích so sánh có dẫn chứng

**Đầu vào**

- CSV, metadata và phương pháp của Quân; bảng/biểu đồ P05 của Phúc; nhận xét chuyên môn của Thiện và Phúc.

**Yêu cầu thực hiện**

- Phân tích riêng bốn chỉ số bắt buộc và cost chung; nêu màn hoặc nhóm màn làm bằng chứng cho mỗi nhận xét quan trọng.
- Chọn 3–5 trường hợp đáng chú ý theo số liệu thật: DFS đi vòng, BFS dùng nhiều bộ nhớ, UCS ưu tiên cost, tác dụng và hạn chế của heuristic.
- Giải thích các khác biệt thời gian dù node gần nhau: độ đắt của successor, step_cost, heuristic và profiler; nêu dưới dạng nhận định có căn cứ.
- Công bố timeout và hạn chế phạm vi đo; tính tỷ lệ/so sánh chỉ trên tập mẫu được nêu rõ.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/nam/discussion.docx`, bảng nhận xét gắn với ID màn và hình.

**Tiêu chí hoàn thành**

- Các con số khớp CSV; không sửa số liệu để hợp một kết luận có sẵn.
- Thiện rà phần A*, Phúc rà UCS/cost, Quân rà cách tổng hợp số liệu.
- Không viết “A* luôn tốt nhất” hoặc “ít node luôn đồng nghĩa ít thời gian” khi số liệu không hỗ trợ.

**Gửi cho:** Quân, Thiện và Phúc duyệt các đoạn thuộc phạm vi của mình.

**Thực hiện khi:** Sau Q05, P05, H03 và P03. Có thể phân tích từ CSV trước khi có hình cuối.

## N04 — Tổng hợp và biên tập Report.pdf

**Đầu vào**

- Nội dung từ cả năm người; bảng phân công của Thức; hình/bảng và video URL do Phúc bàn giao.

**Yêu cầu thực hiện**

- Ghép mô hình, kiến trúc, bốn thuật toán, phương pháp, kết quả, nhận xét, kết luận và hạn chế.
- Thống nhất tên hàm/biến, ký hiệu toán, đơn vị và cách đếm node. Viết đoạn nối giữa các phần để báo cáo có một mạch trình bày.
- Thêm trách nhiệm và phần trăm hoàn thành từng thành viên theo xác nhận thực tế; tài liệu tham khảo; phụ lục cách dùng AI và prompt tiêu biểu do mỗi người cung cấp.
- Đưa bảng lớn/dữ liệu chi tiết vào phụ lục; nhận video-url.txt từ Phúc ở P06, chèn link YouTube vào DOCX và xuất lại PDF.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/nam/Report.docx` có thể chỉnh sửa và `Report.pdf` bản cuối.

**Tiêu chí hoàn thành**

- Đủ ma trận yêu cầu ở cuối tài liệu; caption, mục lục, bảng/hình và link hoạt động.
- PDF không tràn lề, không có chỗ trống kiểu “TODO”, hình đọc được; các phần mô tả khớp snapshot.
- Có đầy đủ nguồn tham khảo và thông tin mức độ hoàn thành thực tế.

**Gửi cho:** Thức nhận để kiểm tra và đóng gói; cả nhóm rà phần đã viết.

**Thực hiện khi:** Bản khung làm ngay; bản cuối sau các gói nội dung và video.

## N05 — Chốt đề cương nội dung video với Phúc

**Đầu vào**

- Yêu cầu video của đề, demo-notes của Thức và các kết luận đã thống nhất trong report.

**Yêu cầu thực hiện**

- Gửi một đề cương ngắn gồm các mục phải xuất hiện: giao diện, điều khiển tay, thắng/thua, các loại ô/công tắc, tách–ghép và bốn solver.
- Nêu 1–2 ý so sánh thuật toán muốn giới thiệu và ID màn phù hợp nếu đã có số liệu. Đối chiếu nội dung video với báo cáo.
- Phúc phát triển đề cương thành kịch bản lời dẫn/phụ đề rồi quay, dựng và đăng YouTube ở P06; Nam chỉ rà nội dung sau khi nhận bản nháp.

**Đầu ra cần đẩy lên hoặc bàn giao**

- `handoff/nam/video-outline.docx`: checklist nội dung và các ý chính, khoảng một trang.

**Tiêu chí hoàn thành**

- Phúc biết những chức năng và thông điệp cần chứng minh; đề cương không cần lời dẫn chi tiết hay bảng timeline dựng phim.
- Nam phản hồi một lượt về sự thống nhất giữa video nháp và report.

**Gửi cho:** Phúc nhận để thực hiện P06; Thức rà danh sách tính năng.

**Thực hiện khi:** Làm sớm cùng N01; dùng T02 để chọn ví dụ.


## Đẩy công việc lên repo

1. Làm theo quy trình tạo nhánh trong [hướng dẫn chung](../README.md#tao-nhanh-va-day-cong-viec).
2. Commit file trong `handoff/nam/`; nếu có sửa code, stage thêm đúng các file code đã sửa.
3. Push nhánh, tạo Pull Request vào `main`, ghi mã task và đầu ra đã có. Gửi link PR cho Thức để xem và gộp.
4. Mỗi người gửi nguồn tham khảo và phần sử dụng AI của mình cùng nội dung bàn giao; Nam tổng hợp vào báo cáo.
