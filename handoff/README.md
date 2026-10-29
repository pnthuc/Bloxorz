# Giao việc và bàn giao Bloxorz

Đây là bản phân công của nhóm, không phải báo cáo nghiệm thu.
Căn cứ [đề bài gốc](../AI%20-%20Project%201.pdf), mục 3 và 4.
Các ô đã đánh dấu trong README cá nhân được giữ từ lần bàn giao trước;
có file hoặc test qua chưa đồng nghĩa nội dung đã khớp phiên bản cuối.

## Người phụ trách

| Thành viên | MSSV | Phạm vi và nơi bàn giao | Nhánh gợi ý |
| --- | --- | --- | --- |
| Nguyễn Lê Minh Quân | 24120219 | [DFS, bộ màn và thực nghiệm](quan/README.md) | `work/quan-experiments` |
| Bùi Phương Nam | 24120502 | [BFS, mô hình và báo cáo tổng](nam/README.md) | `work/nam-report` |
| Tống Phúc Thiện | 24120141 | [A* và heuristic](thien/README.md) | `work/thien-astar-report` |
| Phan Gia Phúc | 24120503 | [UCS/cost, biểu đồ, video và source nộp](phuc/README.md) | `work/phuc-charts-video` |
| Phan Ngọc Thức | 24120228 | [Engine/UI, tư liệu và nghiệm thu](thuc/README.md) | `work/thuc-final-review` |

## Đối chiếu đề bài

| Yêu cầu | Điểm | Đầu mối |
| --- | --- | --- |
| Game có GUI, luật cơ bản và ô nâng cao | 20 | Thức; bốn chủ solver dùng cùng engine |
| BFS / DFS hoặc IDS / UCS / A* | 10 cho mỗi thuật toán | Nam / Quân / Phúc / Thiện |
| Báo cáo: mô tả thuật toán | 10 | Mỗi chủ thuật toán viết; Nam tổng hợp |
| Báo cáo: thực nghiệm, bảng, biểu đồ và phân tích | 20 | Quân đo, Phúc trình bày, Nam phân tích |
| Video GUI và chức năng, có lời dẫn hoặc phụ đề | 10 | Phúc quay dựng; Nam và Thức rà |

Báo cáo PDF phải có phân công và mức hoàn thành từng thành viên,
mô hình trạng thái/hành động/chuyển/đích/cost, bốn thuật toán, heuristic,
bốn chỉ số thực nghiệm, bảng/biểu đồ, nhận xét, nguồn tham khảo và phụ lục AI/prompt.
Phần trăm hoàn thành là mức hoàn thành trách nhiệm của từng người, không bắt buộc cộng thành 100%.
Video phải có URL YouTube công khai trong PDF.

Đề yêu cầu bộ test cố định, công bằng giữa các thuật toán. Kế hoạch **33 màn,
3 lần lặp, timeout 120 giây/lượt** là đề xuất của nhóm, không phải định mức của đề.
Chốt các giá trị này trong [baseline](shared/baseline.md) trước khi đo.

## Trình tự bàn giao

1. **Chốt bản đo:** Thức ghi commit; Phúc xác nhận cost; Thiện xác nhận heuristic;
   Quân xác nhận bộ màn, môi trường, số lần lặp và timeout.
2. **Quân → Phúc, Nam:** CSV gốc/tổng hợp, JSON lời giải, metadata, phân nhóm màn và phương pháp đo.
3. **Phúc → Nam:** bảng/biểu đồ truy về CSV. **Thiện, Phúc → Nam:** nhận xét A*/UCS theo số liệu thật.
4. **Nam → Phúc:** đề cương video. **Thức → Phúc:** tư liệu và thao tác demo.
   Phúc gửi video nháp cho Nam rà nội dung, Thức rà cơ chế.
5. **Nam, Phúc → Thức:** PDF và nguồn chỉnh sửa, URL video, source đóng gói và minh chứng kiểm tra.

Nếu đổi thuật toán, engine, cost, heuristic hoặc cách đo sau mốc chốt,
ghi phiên bản mới và xác định dữ liệu cần đo lại. Không trộn các lượt khác policy.

## Đầu ra đang có và phần cần rà

- Quân đã có `dfs.docx`, `level-groups.csv` và một đợt chạy thử 8 lượt trên màn 1, 4.
  Chưa có `summary.csv` và `methodology.docx` trong repo.
- Nam đã có `BFS.docx`, `Report.docx` bản thảo và `video-outline.docx`; chưa có `Report.pdf`.
  Bìa bản thảo hiện thiếu Quân và cần bổ sung đủ năm thành viên.
- Thiện đã có năm DOCX A*/heuristic; phần kết quả còn dẫn tới CSV tổng hợp/hình chưa có trong repo.
- Thức đã có `Phan_Ngoc_Thuc.docx`, ảnh demo và JSON kiểm tra phiên bản trước.
- Phúc hiện có bản giao việc; chưa có gói cost/UCS, biểu đồ hoặc URL video trong repo.

Các bản thảo của Quân/Thức còn mô tả SPACE là cạnh tìm kiếm riêng.
Đối chiếu lại tập tám hành động trong [README source](../README.md#thực-nghiệm)
trước khi ghép báo cáo. Không tự thay số liệu cũ bằng số minh họa.

<a id="tao-nhanh-va-day-cong-viec"></a>
## Làm việc với Git

Tạo nhánh từ `main` đã cập nhật; lưu thay đổi đang làm trước khi đổi nhánh.
Ví dụ của Quân:

```bash
git switch main
git pull --ff-only origin main
git switch -c work/quan-experiments
```

Trước khi bàn giao, xem `git status`, chỉ stage file mình sửa, commit và push nhánh.
Tạo PR vào `main`, ghi mã task, đầu ra, kiểm tra đã chạy, phần còn thiếu và người nhận.
Thức rà và gộp; quy trình này không tự tạo nhánh, Issue hoặc gửi PR cho thành viên.

Code nằm trong `Src/`; tài liệu và dữ liệu nằm trong thư mục của người phụ trách.
Quân sửa `Src/benchmarks/cli.py`; Phúc có thể bổ sung công cụ đọc CSV/vẽ hình
trong `Src/benchmarks/`. Không sửa chung dữ liệu đo mà không phối hợp.

Giữ trên Git tài liệu chỉnh sửa được, CSV/JSON, biểu đồ, kịch bản, phụ đề và URL.
Video gốc/file dựng nặng lưu ngoài Git. Không đưa `.git`, môi trường ảo,
`node_modules`, cache hoặc `submission/` vào source bàn giao.

## Gói nộp

Thức đóng gói sau nghiệm thu:

```text
24120228_24120219_24120502_24120141_24120503/
  Source/           Source chạy được, README và requirements.txt
  Report.pdf        Có URL YouTube công khai
```

Nén ZIP/RAR theo tên MSSV. Nếu lớn hơn 20 MB, nộp qua link Google Drive có quyền truy cập.
Dùng deadline do lớp công bố; PDF không ghi ngày cụ thể. Không sửa bản nộp sau deadline.
