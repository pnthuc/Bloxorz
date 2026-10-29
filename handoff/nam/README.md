# Bùi Phương Nam — BFS và báo cáo tổng

MSSV **24120502**. Nhận/gửi việc theo [quy trình chung](../README.md).
Nam viết BFS, mô hình hóa, phân tích và ghép báo cáo; Phúc phụ trách quay dựng video.

## Đầu vào và hiện trạng

- BFS: `Src/solvers/member3_bfs.py`; State/luật: `Src/core/board.py`.
- Nhận DFS/phương pháp/số liệu từ Quân, A* từ Thiện, UCS/cost và hình từ Phúc,
  kiến trúc/demo từ Thức. Dùng cùng [baseline](../shared/baseline.md).
- Đã có [BFS.docx](BFS.docx) và [Report.docx](Report.docx) bản thảo.
  Bìa Report hiện thiếu Nguyễn Lê Minh Quân, MSSV 24120219; nội dung còn chỗ giữ chỗ.
  Chưa có `Report.pdf` và URL video cuối trong repo.
- Số node, độ sâu và bộ nhớ nêu trong BFS.docx cần đối chiếu CSV đúng phiên bản;
  không coi các con số trong bản thảo là dữ liệu đã nghiệm thu.

## Nhiệm vụ

| Đã bàn giao | Mã | Công việc | Đầu ra |
| --- | --- | --- | --- |
| [ ] | `N01` | Khung báo cáo, BFS, giả mã và ví dụ | `Report.docx`, `BFS.docx` → cả nhóm |
| [ ] | `N02` | Mô hình trạng thái, hành động, chuyển, đích và cost | `model.docx` hoặc mục tương ứng trong Report → Thức, Phúc, Thiện rà |
| [ ] | `N03` | So sánh bốn thuật toán bằng dữ liệu thật | `discussion.docx` hoặc mục tương ứng trong Report → Quân, Phúc, Thiện rà |
| [ ] | `N04` | Biên tập PDF hoàn chỉnh, nguồn và phụ lục | `Report.docx`, `Report.pdf` → Thức |
| [ ] | `N05` | Đề cương nội dung video và rà bản nháp | `video-outline.docx` → Phúc; phản hồi video → Phúc, Thức |

Có bản thảo chưa đồng nghĩa nhiệm vụ đã nghiệm thu; giữ trạng thái bàn giao hiện có.
Không cần tạo thêm DOCX rời nếu nội dung đã có mục rõ ràng trong Report và người nhận sử dụng được.

## Nội dung phải khớp source

- BFS dùng deque FIFO, đánh dấu khi phát hiện bằng `parent`, kiểm tra goal khi sinh con,
  truy vết bằng parent. Giải thích vì sao ít hành động nhất không đồng nghĩa ít cost có trọng số nhất.
- State gồm `r,c,orientation,bridges,r2,c2,active_cube`; có bốn trạng thái hướng,
  gồm SPLIT. Hai state cùng vị trí nhưng khác cầu hoặc khối đang chọn có thể khác nhau.
- Tập tìm kiếm gồm bốn hướng thường và bốn hướng đổi khối rồi lăn có tiền tố S.
  SPACE chỉ chọn khối khi chơi tay; `solution_length = len(moves)`.
- Phần kiến trúc web tách khỏi mô hình tìm kiếm để tránh lặp nội dung của Thức.
  Nhờ Thức rà luật, Phúc rà cost, Thiện rà quan hệ cost–heuristic.

## Bố cục báo cáo theo đề §3.6

1. Giới thiệu, đủ năm thành viên, phân công và phần trăm hoàn thành được từng người xác nhận.
2. Mô hình hóa và kiến trúc game/GUI.
3. BFS, DFS, UCS, A*: ý tưởng, giả mã, chống lặp, cost và heuristic.
4. Bộ màn cố định, nhóm độ khó, môi trường, phiên bản code và phương pháp đo.
5. Bảng/biểu đồ thời gian, peak memory, expanded nodes, solution length; thêm cost chung để phân tích.
6. Nhận xét theo màn/nhóm màn, timeout, điểm mạnh/yếu và giới hạn.
7. URL YouTube công khai, tài liệu tham khảo và phụ lục cách dùng AI/prompt.

Phần trăm là mức hoàn thành công việc cá nhân, không bắt buộc cộng thành 100%.
Không tự điền thay thành viên hoặc coi checkbox giao việc là phần trăm chấm điểm.

## Tiêu chí N03/N04/N05

- Mọi kết luận định lượng có ID màn, dòng CSV hoặc hình nguồn; cùng snapshot và policy.
  Không kết luận A* luôn tốt nhất hay ít node luôn nhanh hơn.
- Nêu số mẫu, timeout/lỗi và cách tổng hợp. Sửa các số liệu cũ chỉ sau khi có kết quả đo thay thế.
- Dùng đúng ms và KiB; peak Python không phải tổng RAM hoặc bộ nhớ GPU.
- PDF đủ mục, không còn placeholder, hình và công thức đọc được, link video hoạt động.
- N05 chỉ cần checklist GUI, thao tác tay, thắng/thua, ô nâng cao và solver/replay.
  Phúc viết kịch bản chi tiết/quay dựng; Nam rà tính thống nhất với báo cáo.
