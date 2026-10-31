---
title: "Bloxorz — Chú thích và cách tái tạo biểu đồ"
lang: vi
---

# Dữ liệu và kiểm tra

Bộ dữ liệu gồm 25 màn × 4 thuật toán × 3 lần lặp = 300 lượt; timeout 120 giây/lượt. SOLVED: 300; NO_SOLUTION: 0; TIMEOUT: 0; ERROR: 0; INVALID_PATH: 0.

Nguồn: handoff/quan/benchmarks/raw.csv và summary.csv; tên và đặc điểm màn từ handoff/quan/level-groups.csv.

Commit của checkout dùng để tạo P05: `9f4aa41937b1004b009d55616df0c6f9cffa6c17`. Metadata đo không ghi commit gốc của lượt chạy. File provenance.json lưu SHA-256 từng CSV/metadata, từng JSON và script vẽ để truy lại đúng dữ liệu đã dùng.

Môi trường đo được Quân ghi: CPU 12th Gen Intel(R) Core(TM) i5-12450HX; RAM 24.0 GB; OS Windows-11-10.0.26200-SP0; Python 3.14.4 (tags/v3.14.4:23116f9, Apr  7 2026, 14:10:54) [MSC v.1944 64 bit (AMD64)]; ngày đo 2026-10-31T16:42:37.598449.

Script kiểm tra đủ và không trùng lượt, CSV khớp JSON, số trạng thái và từng trung vị khớp summary.csv. Bước trình bày chỉ đọc dữ liệu đã lưu; không thực thi solver hoặc replay.

# Quy ước đọc hình

Thời gian, bộ nhớ và node lấy trung vị các lượt SOLVED hoặc NO_SOLUTION. Độ dài và path_cost chỉ lấy trung vị các lượt SOLVED. Timeout/lỗi không được thay bằng 0. NA nghĩa là không có mẫu hợp lệ cho chỉ số đó. Dấu chấm là dấu thập phân; dấu phẩy phân tách hàng nghìn.

BFS màu xanh dương (#0072B2), DFS màu cam (#D55E00), UCS màu xanh lá (#009E73), A* màu tím (#CC79A7). Mỗi hình gồm các cụm tối đa năm màn theo ID, cùng giới hạn trục y trong hình. Cách chia cụm phục vụ bố cục, không phải phân nhóm độ khó. Đặc điểm cơ chế nằm trong danh mục màn.

Trục y ghi log là log cơ số 10: khoảng cách bằng nhau biểu thị tỷ lệ bằng nhau. Không diễn giải chiều cao cột như chênh lệch tuyệt đối. Nếu có số 0 thật, script dùng symlog với vùng tuyến tính quanh 0 (linthresh=1) và vẽ dấu tròn tại 0; tên trục được ghi trong manifest. Các ô thiếu mẫu ghi NA, không vẽ cột bằng 0. Trên cột có thể có N/T/E/I kèm số lượt NO_SOLUTION/TIMEOUT/ERROR/INVALID_PATH. Số mẫu từng chỉ số nằm trong charts/manifest.json và result-tables.csv; tài liệu bảng ghi rõ n tìm kiếm và n lời giải.

Tất cả hình xuất PNG 300 dpi và SVG vector. Nhãn trong hình dùng tiếng Anh; dùng các chú thích tiếng Việt dưới đây khi ghép báo cáo. Đặt hình rộng khoảng 17 cm trên A4; giữ tỷ lệ gốc, mỗi hình toàn bộ 25 màn nên chiếm một trang riêng. Có thể lấy riêng cụm màn từ SVG khi cần minh họa chi tiết, nhưng phải giữ nhãn trục, chú giải và nguồn.

# Chú thích để ghép báo cáo

## Hình 1. Thời gian tìm kiếm

File: `charts/01_search_time_ms.png` hoặc `.svg`. Thời gian tìm kiếm (ms) của 4 thuật toán trên 25 màn; trung vị theo quy ước mẫu ở trên. Trục y: log. Nguồn: CSV của Nguyễn Lê Minh Quân, bộ 300 lượt. Thời gian chỉ gồm tìm kiếm, không gồm animation hoặc replay.

## Hình 2. Đỉnh cấp phát Python

File: `charts/02_memory_kb.png` hoặc `.svg`. Đỉnh cấp phát Python (KiB) của 4 thuật toán trên 25 màn; trung vị theo quy ước mẫu ở trên. Trục y: log. Nguồn: CSV của Nguyễn Lê Minh Quân, bộ 300 lượt. Bộ nhớ là đỉnh cấp phát Python do tracemalloc đo, không phải tổng RAM hoặc bộ nhớ GPU.

## Hình 3. Số node mở rộng

File: `charts/03_expanded_nodes.png` hoặc `.svg`. Số node mở rộng (node) của 4 thuật toán trên 25 màn; trung vị theo quy ước mẫu ở trên. Trục y: log. Nguồn: CSV của Nguyễn Lê Minh Quân, bộ 300 lượt. Node mở rộng đếm lượt sinh successor; không phải tổng trạng thái đã phát hiện.

## Hình 4. Độ dài lời giải

File: `charts/04_solution_length.png` hoặc `.svg`. Độ dài lời giải (actions) của 4 thuật toán trên 25 màn; trung vị theo quy ước mẫu ở trên. Trục y: log. Nguồn: CSV của Nguyễn Lê Minh Quân, bộ 300 lượt. Đơn vị là hành động tìm kiếm, gồm cả hành động đổi khối rồi lăn có tiền tố S.

## Hình 5. Chi phí đường đi chung

File: `charts/05_path_cost.png` hoặc `.svg`. Chi phí đường đi chung (cost) của 4 thuật toán trên 25 màn; trung vị theo quy ước mẫu ở trên. Trục y: log. Nguồn: CSV của Nguyễn Lê Minh Quân, bộ 300 lượt. Mỗi cạnh có cost = 1 + 0.5 × số ô fragile bị chiếm ở trạng thái đến; path_cost là tổng trên đường đi.

# Lệnh tái tạo

Từ thư mục gốc repo:

```powershell
python -m pip install -r Src/benchmarks/requirements-plot.txt
python Src/benchmarks/plot.py `
  --batch handoff/quan/benchmarks `
  --groups handoff/quan/level-groups.csv `
  --output-dir handoff/phuc
powershell -ExecutionPolicy Bypass `
  -File handoff/phuc/build-documents.ps1
```

Lệnh đầu chỉ cài thư viện vẽ, không cần cho chạy game. Bước Pandoc cần pandoc và xelatex trên PATH, cùng font Arial/Consolas. Quy trình tài liệu là Markdown → DOCX bằng Pandoc, sau đó đọc lại DOCX → PDF bằng Pandoc với --pdf-engine=xelatex. PDF dùng kiểm tra và ghép tài liệu; DOCX là bảng có thể sửa, Markdown là nguồn soạn.

# Nguồn và sử dụng AI

Nguồn số liệu: bộ CSV/JSON và metadata do Quân bàn giao trong repo. Nguồn định nghĩa chỉ số: Src/benchmarks/README.md và Src/solvers/base.py; policy cost: Src/solvers/costs.py. Màu biểu đồ dùng bốn màu từ bảng Okabe–Ito.

Codex hỗ trợ viết script trình bày, kiểm tra tính nhất quán, dựng bảng và soạn chú thích. Không tạo số đo thực nghiệm mới. Việc xác nhận số liệu của Quân và tiếp nhận hình/bảng của Nam được theo dõi riêng khi bàn giao.
