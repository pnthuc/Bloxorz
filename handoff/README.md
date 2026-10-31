# Kế hoạch & Bàn giao Đồ án Bloxorz

Tài liệu điều phối tiến độ, phân công trách nhiệm và tình trạng bàn giao sản phẩm của nhóm theo [Đề bài Project 1](../AI%20-%20Project%201.pdf).

---

## 1. Phân công trách nhiệm

| Thành viên | MSSV | Vai trò chính | Thư mục bàn giao | Nhánh Git |
| :--- | :--- | :--- | :--- | :--- |
| **Phan Ngọc Thức** | 24120228 | Trưởng nhóm, Engine/GUI, nghiệm thu | [thuc/](thuc/README.md) | `work/thuc-final-review` |
| **Nguyễn Lê Minh Quân** | 24120219 | Thuật toán DFS, chạy benchmark thực nghiệm | [quan/](quan/README.md) | `work/quan-experiments` |
| **Bùi Phương Nam** | 24120502 | Thuật toán BFS, mô hình hóa, tổng hợp báo cáo | [nam/](nam/README.md) | `work/nam-report` |
| **Tống Phúc Thiện** | 24120141 | Thuật toán A*, thiết kế và phân tích heuristic | [thien/](thien/README.md) | `work/thien-astar-report` |
| **Phan Gia Phúc** | 24120503 | Thuật toán UCS, bảng biểu đồ thực nghiệm, video | [phuc/](phuc/README.md) | `work/phuc-charts-video` |

---

## 2. Đối chiếu yêu cầu đề bài

| Hạng mục đề bài | Điểm | Phụ trách chính | Đầu ra bàn giao |
| :--- | :---: | :--- | :--- |
| **Game & GUI** | 20 | Thức | Web 3D (Three.js + Flask), đầy đủ cơ chế đặc biệt, replay |
| **BFS / DFS / UCS / A\*** | 40 | Nam / Quân / Phúc / Thiện | 4 module solver trong `Src/solvers/`, pass 92 unit tests |
| **Báo cáo: Lý thuyết & Mô hình** | 10 | Mỗi người viết phần mình; Nam tổng hợp | `Report.docx` / `Report.pdf` |
| **Báo cáo: Thực nghiệm & Phân tích** | 20 | Quân đo, Phúc vẽ bảng biểu, Nam phân tích | 10 biểu đồ PNG 300 DPI, `result-tables.csv`, phân tích |
| **Video Demo & Thuyết minh** | 10 | Phúc quay dựng; Nam, Thức duyệt | Video YouTube, phụ đề `.srt`, kịch bản lời dẫn |

---

## 3. Quy chuẩn thực nghiệm chung ([Baseline](shared/baseline.md))

- **Bộ màn**: 25 màn chính thức (`level_01.json` đến `level_25.json`).
- **Lượt đo**: 4 thuật toán × 25 màn × 3 lần lặp = **300 lượt chạy**. Timeout: 120s/lượt.
- **Tập hành động**: 8 hướng (`UP`, `LEFT`, `RIGHT`, `DOWN`, `SUP`, `SLEFT`, `SRIGHT`, `SDOWN`).
- **Hàm chi phí chung (Cost)**: `1 + 0.5 × số ô fragile bị chiếm` ở trạng thái đến.
- **Chỉ số ghi nhận**: Thời gian tìm kiếm (ms), Đỉnh cấp phát RAM (`tracemalloc`, KiB), Số node mở rộng, Độ dài lời giải (bước), Chi phí đường đi (`path_cost`).

---

## 4. Tình trạng sản phẩm các thành viên

- **Quân ([quan/](quan/README.md))**: Đã hoàn thành `dfs.docx`, `level-groups.csv`, bộ dữ liệu 300 lượt (`raw.csv`, `runs/*.json`) và `summary.csv`.
- **Phúc ([phuc/](phuc/README.md))**: Đã hoàn thành `ucs.docx`, `cost-policy.docx`, `cost-example.docx`, script vẽ [plot.py](phuc/plot.py), 10 biểu đồ PNG 300 DPI, `result-tables.csv`, và gói video YouTube (`video-url.txt`, kịch bản, phụ đề).
- **Thiện ([thien/](thien/README.md))**: Đã hoàn thành 5 tài liệu Word về thuật toán A*, chứng minh tính chấp nhận/nhất quán của heuristic và ví dụ tính toán.
- **Nam ([nam/](nam/README.md))**: Đã hoàn thành `BFS.docx`, `video-outline.docx` và khung tổng hợp `Report.docx`.
- **Thức ([thuc/](thuc/README.md))**: Đã hoàn thành Engine/GUI, Flask API, 92 unit tests, tài liệu kiến trúc `Phan_Ngoc_Thuc.docx` và điều phối nghiệm thu.

---

## 5. Cấu trúc đóng gói nộp bài

Thư mục nộp cuối cùng được nén theo cú pháp MSSV của 5 thành viên:

```text
24120228_24120219_24120502_24120141_24120503/
  Source/           Toàn bộ mã nguồn chạy được, README.md và requirements.txt
  Report.pdf        Báo cáo hoàn chỉnh có kèm link video YouTube công khai
```
