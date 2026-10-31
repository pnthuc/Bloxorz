# Phan Gia Phúc — UCS/cost, biểu đồ, video và source nộp

MSSV **24120503**. Nhận/gửi việc theo [quy trình chung](../README.md).
Phúc không thay số đo của Quân; nhận dữ liệu CSV để vẽ biểu đồ, lập bảng và cùng Thiện thống nhất cost–heuristic.

## Đầu vào và hiện trạng

- UCS/cost: `Src/solvers/member5_ucs.py`, `Src/solvers/costs.py`; kiểm tra đường đi: `Src/core/replay.py`.
- Nhận CSV/metadata từ Quân, đề cương video từ Nam, tư liệu demo từ Thức. Dùng [baseline](../shared/baseline.md) chung.
- Đã bàn giao:
  - Tài liệu thuật toán UCS: [ucs.docx](ucs.docx) và ví dụ [cost-example.docx](cost-example.docx).
  - Quy định chi phí chung: [cost-policy.docx](cost-policy.docx).
  - Biểu đồ thực nghiệm: [charts/](charts/) (gồm cả biểu đồ đường so sánh 4 thuật toán và biểu đồ cột phân nhóm).
  - Bảng số liệu: [result-tables.docx](result-tables.docx), [result-tables.csv](result-tables.csv) và ghi chú [chart-notes.docx](chart-notes.docx).
  - Sản phẩm video P06: [video/video-url.txt](video/video-url.txt) và kịch bản [video/script/](video/script/).

## Nhiệm vụ

| Đã bàn giao | Mã | Công việc | Đầu ra |
| --- | --- | --- | --- |
| [X] | `P01` | Giải thích và chốt cost chung | `cost-policy.docx` → Thiện, Quân, Nam, Thức |
| [X] | `P02` | UCS, giả mã và ví dụ tích lũy cost | `ucs.docx`, `cost-example.docx` → Nam, Thiện |
| [X] | `P05` | Bảng và biểu đồ thực nghiệm từ dữ liệu benchmark | `charts/`, `result-tables.docx`, `chart-notes.docx` → Nam, Quân |
| [X] | `P06` | Kịch bản, quay dựng, phụ đề/lời dẫn và YouTube | `video/video-url.txt`, `video/script/` → Nam, Thức |
| [ ] | `P04` | Source nộp đóng gói và README | `submission/Source/` → Thức |

## Cost và UCS

- Hàm cost: `1 + 0.5 × số ô fragile bị chiếm ở trạng thái đến`.
- Mỗi cạnh có cost dương; lời giải rỗng khi start=goal có tổng cost 0.
- SPACE chơi tay miễn phí, không là cạnh tìm kiếm; hướng có tiền tố S tính một hành động.
- `State` là dataclass bất biến (immutable), dùng làm khóa tập hợp và từ điển được.
- Chi tiết thuật toán và bảng trace từng bước xem tại [ucs.docx](ucs.docx).

## Bảng và biểu đồ thực nghiệm

Công cụ tạo bảng và vẽ biểu đồ: `handoff/phuc/plot.py` (hoặc `Src/benchmarks/plot.py`).

Cài đặt thư viện vẽ (nếu chưa có):
```powershell
python -m pip install -r handoff/phuc/requirements-plot.txt
```

Chạy vẽ từ thư mục gốc dự án:
```powershell
python handoff/phuc/plot.py
```

Lệnh trên tự động đọc `summary.csv` và `raw.csv` từ Quân, kiểm chứng tính hợp lệ và xuất ra:
1. **Biểu đồ đường so sánh 4 thuật toán trên toàn bộ 25 màn (chuẩn báo cáo):**
   - `charts/hinh_6_1_thoi_gian_tim_kiem.png`: Thời gian tìm kiếm (ms, thang logarit).
   - `charts/hinh_6_2_bo_nho.png`: Đỉnh cấp phát bộ nhớ (KiB, thang logarit).
   - `charts/hinh_6_3_so_node_mo_rong.png`: Số node mở rộng (thang logarit).
   - `charts/hinh_6_4_do_dai_loi_giai.png`: Độ dài lời giải / số bước đi (thang logarit).
   - `charts/hinh_6_5_chi_phi_duong_di.png`: Chi phí đường đi chung (thang logarit).
2. **Biểu đồ cột chi tiết:** `01_search_time_ms.png`, `02_memory_kb.png`, `03_expanded_nodes.png`, `04_solution_length.png`, `05_path_cost.png` (định dạng PNG 300 dpi).
3. **Bảng số liệu tổng hợp:** `result-tables.docx`, `result-tables.csv` và `chart-notes.docx`.

## Video demo đồ án (P06)

- Video đã được quay dựng hoàn chỉnh, có phụ đề tiếng Việt và lời thuyết minh chi tiết:
  - Demo tương tác GUI đầy đủ: điều khiển bàn phím, restart, chọn màn chơi, xem luật.
  - Minh họa các cơ chế đặc biệt: gạch cam fragile, công tắc tròn (soft), công tắc chéo (heavy), công tắc phân tách (split), ghép khối (merge), cầu đóng/mở.
  - Minh họa tính năng chạy tự động và replay lời giải của cả 4 thuật toán (BFS, DFS, UCS, A*).
- **Link xem video trên YouTube:** https://www.youtube.com/watch?v=7Mk2lOTqOCM (lưu trong `video/video-url.txt`).
- Kịch bản chi tiết và file phụ đề (.srt, .ass) được lưu trữ tại `video/script/`.

## Đóng gói Source nộp (P04)

- Sao chép toàn bộ mã nguồn sạch từ `Src/` vào `submission/Source/`.
- Loại bỏ các thư mục tạm, cache, `.git`, `node_modules` và môi trường ảo.
- Kèm theo file hướng dẫn chạy `README.md` độc lập, dễ dàng cài đặt qua `pip install -r requirements.txt`.
