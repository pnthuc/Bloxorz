# Bloxorz Solver

Game Bloxorz với GUI web, BFS, DFS, UCS, A* và chế độ so sánh/phát lại lời giải.
Engine và thuật toán viết bằng Python; Flask phục vụ API, Three.js hiển thị bàn chơi.

- [Đề bài gốc](AI%20-%20Project%201.pdf).
- [Phân công và bàn giao của nhóm](handoff/README.md).

## Chạy game

Cần Python 3.10+ và trình duyệt hỗ trợ WebGL. Từ gốc repo:

```bash
cd Src
python -m venv .venv
```

Kích hoạt môi trường: PowerShell dùng `.venv\Scripts\Activate.ps1`,
macOS/Linux dùng `source .venv/bin/activate`. Sau đó:

```bash
python -m pip install -r requirements.txt
python main.py
```

Mở `http://127.0.0.1:5000`. Không mở HTML trực tiếp vì game cần API.
Không cần Node.js để chơi; font, Three.js và âm thanh đã có sẵn trong source.
Nhạc và hiệu ứng được phát từ file, không cần tạo lại.

| Thao tác | Điều khiển |
| --- | --- |
| Lăn khối | Mũi tên hoặc WASD; giữ phím để lăn liên tục |
| Đổi khối sau khi tách | Space |
| Chơi lại | R |
| Góc nhìn toàn bàn / xem gần khối | C / F |
| Menu | Esc |
| Xoay / thu phóng | Kéo / cuộn chuột |

Hướng di chuyển theo hàng/cột của bàn, không theo góc camera.
Chọn màn, tùy chỉnh, trợ giúp và AI Solver nằm trong menu.

## Cấu trúc

```text
Src/
  main.py           Chạy game, export Flask app
  run_tests.py      Lệnh kiểm thử chung
  requirements.txt
  core/             Board, State, nạp level và kiểm tra replay
  web/              Flask API và chuyển State sang/từ JSON
  solvers/          Bốn thuật toán, profiler và cost chung
  benchmarks/       CLI thực nghiệm và worker đo cho GUI
  levels/           level_01.json đến level_25.json
  static/           JavaScript, CSS, texture tạo sẵn, font, âm thanh và thư viện local
  templates/        HTML
  tests/            Regression và dữ liệu ca kiểm thử
handoff/            Giao việc, bản thảo và đầu ra của từng thành viên
```

## Kiểm thử

Từ `Src`, kiểm tra engine, API, dữ liệu và công cụ đo:

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```

Chạy solver thật trên một số ca, có kiểm chứng lời giải:

```bash
python run_tests.py --cases 1 2 3 4
```

Bỏ `--cases` để chạy toàn bộ 35 ca, gồm 25 màn và 10 ca biên.
`--solver bfs|dfs|ucs|astar` chọn riêng một thuật toán.

Test UI/audio cần Node.js 18+. Từ `Src/tests`:

```bash
npm ci
npm test
```

`python run_tests.py --ui` chạy thêm UI/audio sau test nền và các solver đã chọn.
Test UI mô phỏng GPU; kết quả này không thay cho kiểm tra hình ảnh trong trình duyệt.

## Thực nghiệm

Chạy benchmark và tổng hợp từ thư mục `Src`:

```bash
python -m benchmarks.cli --levels all --solvers bfs dfs ucs astar --repeats 3 --timeout 120 --output-dir ../handoff/quan/benchmarks
python ../handoff/quan/summarize.py ../handoff/quan/benchmarks
```

- CLI xuất `raw.csv`, `runs/*.json`, `environment.json` và `run-config.json`.
- `handoff/quan/summarize.py` tổng hợp kết quả ra `summary.csv`.
- Xem chi tiết tại [Src/benchmarks/README.md](Src/benchmarks/README.md).

Quy ước:

- Tìm kiếm dùng `UP LEFT RIGHT DOWN SUP SLEFT SRIGHT SDOWN`. Tiền tố `S`
  là đổi khối rồi lăn, chỉ hợp lệ khi SPLIT; mỗi hành động tính một bước.
  SPACE chỉ đổi khối khi chơi tay, không sinh cạnh tìm kiếm.
- `State(r,c,orientation,bridges,r2,c2,active_cube)` bất biến, hash được.
- `solvers/costs.py`: mỗi cạnh có cost `1 + 0.5 × số ô fragile bị chiếm ở trạng thái đến`.
  BFS/DFS trả `total_cost` bằng số hành động; UCS/A* trả cost có trọng số.
  CLI lưu thêm `path_cost` tính lại bằng cùng công thức để so chéo.
- Profiler đo thời gian tìm kiếm bằng ms và đỉnh cấp phát Python bằng KiB
  (trường API tên `memory_kb`), không phải tổng RAM hay bộ nhớ GPU.

Giữ kèm giấy phép [font](Src/static/fonts/OFL.txt) và [Three.js](Src/static/vendor/THREE-LICENSE.txt).
