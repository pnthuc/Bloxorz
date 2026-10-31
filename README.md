# Bloxorz Solver & 3D Web Game

Trò chơi trí tuệ Bloxorz trên nền tảng Web 3D, tích hợp 4 thuật toán tìm kiếm (BFS, DFS, UCS, A*) cùng chế độ phát lại và so sánh trực quan hiệu năng lời giải.

- [Đề bài Project 1](AI%20-%20Project%201.pdf).
- [Phân công và tiến độ bàn giao của nhóm](handoff/README.md).

---

## 1. Cài đặt & Khởi chạy

Yêu cầu: **Python 3.10+** và trình duyệt hỗ trợ WebGL.

Từ thư mục gốc repository:

```bash
cd Src
python -m venv .venv
```

Kích hoạt môi trường ảo:
- **Windows (PowerShell)**: `.venv\Scripts\Activate.ps1`
- **macOS / Linux**: `source .venv/bin/activate`

Cài đặt thư viện và khởi động game:
```bash
python -m pip install -r requirements.txt
python main.py
```

Mở trình duyệt tại địa chỉ: `http://127.0.0.1:5000`

---

## 2. Hướng dẫn điều khiển

| Thao tác | Phím tắt / Chuột |
| :--- | :--- |
| **Lăn khối gỗ** | Các phím mũi tên hoặc `W`, `A`, `S`, `D` (giữ phím để lăn liên tục) |
| **Đổi khối đang chọn** | `Space` (khi khối gỗ đang ở trạng thái phân tách thành 2 khối 1x1) |
| **Chơi lại màn hiện tại** | `R` |
| **Góc nhìn toàn bàn / gần khối** | `C` / `F` |
| **Mở Menu tùy chọn** | `Esc` |
| **Xoay / Thu phóng góc nhìn** | Kéo chuột trái / Cuộn con lăn chuột |

*Lưu ý:* Hướng lăn khối theo đúng hàng và cột của bàn chơi, không phụ thuộc vào góc quay của camera. Bảng điều khiển thuật toán AI Solver nằm sẵn trong giao diện menu.

---

## 3. Cấu trúc thư mục

```text
Bloxorz/
├── Src/
│   ├── main.py           Điểm khởi chạy ứng dụng Flask và game
│   ├── run_tests.py      Script chạy bộ kiểm thử tổng hợp
│   ├── requirements.txt  Danh sách thư viện phụ thuộc Python
│   ├── core/             Xử lý bàn chơi, trạng thái khối gỗ, luật và kiểm tra replay
│   ├── web/              Flask API phục vụ giao diện và solver
│   ├── solvers/          Cài đặt 4 thuật toán tìm kiếm (BFS, DFS, UCS, A*) và profiler
│   ├── benchmarks/       Công cụ chạy thực nghiệm và đo hiệu năng
│   ├── levels/           Dữ liệu 25 màn chơi chuẩn (level_01.json đến level_25.json)
│   ├── static/           Three.js, textures, CSS, fonts, audio
│   ├── templates/        Giao diện HTML chính (index.html)
│   └── tests/            92 bài kiểm thử tự động (unit tests và regression tests)
└── handoff/              Thư mục bàn giao công việc của từng thành viên
```

---

## 4. Kiểm thử tự động (Unit Tests)

Từ thư mục gốc repo:

```powershell
python -m unittest discover -s Src/tests -t Src
```

Chạy bộ kiểm thử solver trên các màn chơi cụ thể với tính năng replay:
```powershell
cd Src
python run_tests.py --cases 1 2 3 4
python run_tests.py --solver astar
```

---

## 5. Thực nghiệm & Vẽ biểu đồ

Quy trình đo lường và kết xuất biểu đồ báo cáo:

```powershell
# 1. Chạy đo đạc 300 lượt benchmark (25 màn × 4 thuật toán × 3 lần lặp)
cd Src
python -m benchmarks.cli --levels all --solvers bfs dfs ucs astar --repeats 3 --timeout 120 --output-dir ../handoff/quan/benchmarks
python ../handoff/quan/summarize.py ../handoff/quan/benchmarks
cd ..

# 2. Xuất 10 biểu đồ PNG 300 DPI và bảng kết quả CSV
python handoff/phuc/plot.py
```

- Bảng số liệu tổng hợp: `handoff/quan/benchmarks/summary.csv` và `handoff/phuc/result-tables.csv`.
- Biểu đồ chuẩn báo cáo: lưu tại `handoff/phuc/charts/` (5 biểu đồ đường `hinh_6_1` đến `hinh_6_5` và 5 biểu đồ cột phân nhóm `01` đến `05`).
- Xem chi tiết phương pháp tại [Src/benchmarks/README.md](Src/benchmarks/README.md).
