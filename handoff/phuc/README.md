# Phan Gia Phúc — UCS/cost, biểu đồ, video và source nộp

MSSV **24120503**. Nhận/gửi việc theo [quy trình chung](../README.md).
Phúc không thay số đo của Quân; nhận dữ liệu để trình bày và cùng Thiện thống nhất cost–heuristic.

## Đầu vào và hiện trạng

- UCS/cost: `Src/solvers/member5_ucs.py`, `Src/solvers/costs.py`;
  kiểm tra đường đi: `Src/core/replay.py`.
- Nhận CSV/metadata/nhóm màn từ Quân, đề cương video từ Nam,
  tư liệu và thao tác demo từ Thức. Dùng [baseline](../shared/baseline.md) chung.
- Đã có tài liệu P01/P02 và gói P05: [biểu đồ](charts/),
  [bảng](result-tables.docx), [chú thích](chart-notes.docx) cùng nguồn Markdown/CSV.

## Nhiệm vụ

| Đã bàn giao | Mã | Công việc | Đầu ra |
| --- | --- | --- | --- |
| [X] | `P01` | Giải thích và chốt cost chung | `cost-policy.docx` → Thiện, Quân, Nam, Thức |
| [X] | `P02` | UCS, giả mã và ví dụ tích lũy cost | `ucs.docx`, `cost-example.docx` → Nam, Thiện |
| [ ] | `P03` | Phân tích UCS và rà kết luận về cost | `ucs-results.docx` → Nam; Quân rà nguồn dữ liệu |
| [ ] | `P04` | README và source giải nén chạy được | `submission/Source/`, `run-check.docx` → Thức |
| [X] | `P05` | Bảng/biểu đồ từ CSV đã kiểm chứng | `charts/`, `result-tables.docx`, `chart-notes.docx` và lệnh tái tạo → Nam, Quân |
| [X] | `P06` | Kịch bản, quay dựng, phụ đề/lời dẫn và YouTube | `video/video-script.docx`, `video/video-url.txt`, phụ đề → Nam, Thức |

Có thể gộp các phần viết liên quan vào một tài liệu có mục rõ ràng, tránh tạo bản sao cùng nội dung.

## Cost và UCS

P01 mô tả đúng hàm hiện tại: `1 + 0.5 × số ô fragile bị chiếm ở trạng thái đến`.
Mỗi cạnh có cost dương; lời giải rỗng khi start=goal có tổng cost 0.
SPACE chơi tay miễn phí, không là cạnh tìm kiếm; hướng có tiền tố S tính một hành động.
Giải thích ý nghĩa mức phạt và ví dụ; không đổi policy mà không báo nhóm/đo lại.

P02 đối chiếu heap theo g, best_g, parent, entry cũ và goal test khi lấy khỏi heap.
Bảng tính tay ghi state, action, step_cost và tổng cost; phân biệt tối ưu số bước với cost có trọng số.
P03 dùng ID màn và CSV để nhận xét UCS/BFS/A*. CLI giữ `total_cost` gốc của solver;
so chéo bằng `path_cost` chung, không so hai cột khác nghĩa.

## Bảng và biểu đồ

P05 đọc `raw.csv`, `summary.csv`, metadata và nhóm màn của Q05.
Đủ bốn chỉ số bắt buộc: thời gian tìm kiếm, peak memory, expanded nodes và solution length;
có thể thêm cost chung. Ghi đơn vị ms, KiB, node, hành động, cost và số mẫu.
Timeout/lỗi có ký hiệu riêng; giải thích trục log hoặc việc loại mẫu nếu dùng.

Công cụ vẽ: `Src/benchmarks/plot.py`, tách khỏi bước chạy solver.
Gói P05 được tạo theo checkout `9f4aa41937b1004b009d55616df0c6f9cffa6c17`,
dùng bộ 300 lượt hiện có. Commit này xác định checkout trình bày; metadata đo
không ghi commit gốc của lượt chạy. Hash đầu vào nằm trong [provenance.json](provenance.json).

Đầu ra:

- `charts/01_search_time_ms`, `02_memory_kb`, `03_expanded_nodes`,
  `04_solution_length`, `05_path_cost`: mỗi hình có PNG 300 dpi và SVG.
- `result-tables.md` → `result-tables.docx` → `result-tables.pdf`:
  năm bảng trung vị và danh mục 25 màn. `result-tables.csv` chứa 100 dòng
  màn/thuật toán với số mẫu tìm kiếm/lời giải và số trạng thái.
- `chart-notes.md` → `chart-notes.docx` → `chart-notes.pdf`:
  định nghĩa, đơn vị, xử lý mẫu, chú thích tiếng Việt, nguồn và khai báo AI.
- `charts/manifest.json`: màu, kiểu trục và số mẫu; `provenance.json`:
  SHA-256 CSV/metadata, 300 JSON và script vẽ.

Từ gốc repo:

```powershell
python -m pip install -r Src/benchmarks/requirements-plot.txt
python Src/benchmarks/plot.py
powershell -ExecutionPolicy Bypass -File handoff/phuc/build-documents.ps1
```

Script vẽ tạo lại hai file Markdown. Sau khi sửa Markdown thủ công, chỉ chạy
`build-documents.ps1` để chuyển tài liệu; lần chạy script vẽ tiếp theo sẽ tạo lại
nội dung từ CSV. `page-layout.lua` giữ ngắt trang giữa các cặp bảng trong cả hai
bước Pandoc. Cần Pandoc, XeLaTeX và font Arial/Consolas cho bước tài liệu.

Kiểm tra P05: đủ 300 lượt/300 JSON, 100 nhóm tổng hợp, mọi trung vị khớp CSV thô;
13 test `tests.test_plot` và `tests.test_summary` đạt. Tài liệu đã chuyển theo
chuỗi Markdown → DOCX → PDF bằng Pandoc 3.13 và XeLaTeX (TeX Live 2026),
rồi kiểm tra trực quan PDF. Các file đo đầu vào được giữ nguyên.

## Video

P06 nhận N05/T02, viết kịch bản có cảnh, thao tác và lời dẫn/phụ đề.
Quay GUI, điều khiển tay, thắng/thua, fragile, soft/heavy, cầu, split/merge,
chọn màn, restart và solver/replay. Theo kế hoạch nhóm, minh họa đủ bốn thuật toán trên màn nhỏ.
Phân biệt thời gian tìm kiếm với animation; không cần ép một thời lượng cố định vì đề không quy định.

Gửi bản nháp cho Nam rà nội dung, Thức rà luật. Video có phụ đề hoặc lời dẫn Việt/Anh,
đăng YouTube công khai và kiểm tra xem được khi chưa đăng nhập.
Lưu URL cuối ở `video/video-url.txt` để Nam chèn vào PDF.
MP4 gốc/file dựng lưu ngoài Git; gửi link kèm kịch bản, phụ đề và nguồn tư liệu.

## Source bàn giao

P04 dùng snapshot đã chốt; sao chép nội dung `Src/` vào `submission/Source/`
và đặt README hướng dẫn chạy trong đó. Giữ `core`, `web`, `benchmarks`, `solvers`,
`levels`, `static`, `templates`, `tests`, các lệnh chạy và `requirements.txt`.
Font, Three.js, âm thanh đã có sẵn; giữ giấy phép và ghi nguồn.

Loại Git metadata, môi trường ảo, cache, node_modules và file tạm.
Sửa đường dẫn chạy cho đúng thư mục Source, giải nén vào nơi sạch rồi thử cài/chạy/test.
Node.js chỉ cần cho test UI; không cần để chơi. Ghi môi trường, lệnh và kết quả ở `run-check.docx`.
Thức nhận source để ghép Report.pdf và đóng gói cuối.
