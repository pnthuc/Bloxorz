# Bloxorz

[![Bloxorz CI](https://github.com/pnthuc/Bloxorz/actions/workflows/ci.yml/badge.svg)](https://github.com/pnthuc/Bloxorz/actions/workflows/ci.yml)

Repo gồm game Bloxorz, bốn solver và bộ kiểm thử. Phần việc thực nghiệm, báo cáo, video và quy trình bàn giao hiện tại nằm trong [handoff/README.md](handoff/README.md).

## Phân công

| Họ và tên | MSSV | Phạm vi | File chính |
| --- | --- | --- | --- |
| Phan Ngọc Thức | 24120228 | Game engine, UI, levels và testcase | `Src/game_logic.py`, `main.py`, `static/`, `templates/`, `levels/`, `tests/`, `run_tests.py` |
| Nguyễn Lê Minh Quân | 24120219 | DFS | `Src/solvers/member2_dfs.py` |
| Bùi Phương Nam | 24120502 | BFS | `Src/solvers/member3_bfs.py` |
| Tống Phúc Thiện | 24120141 | A* và heuristic | `Src/solvers/member4_astar.py` |
| Phan Gia Phúc | 24120503 | UCS | `Src/solvers/member5_ucs.py` |

## Làm tiếp phần thực nghiệm, báo cáo và video

Đọc [quy trình giao việc và đẩy nhánh](handoff/README.md). Mỗi thành viên có README ghi đầu vào, yêu cầu, đầu ra và tiêu chí hoàn thành:

- [Quân — DFS, công cụ đo và CSV](handoff/quan/README.md).
- [Nam — BFS, mô hình hóa và báo cáo tổng](handoff/nam/README.md).
- [Thiện — A* và heuristic](handoff/thien/README.md).
- [Phúc — UCS/cost, bảng/biểu đồ, video và source sạch](handoff/phuc/README.md).
- [Thức — engine/UI, tư liệu và nghiệm thu](handoff/thuc/README.md).

Trước khi đo chính thức, điền [bản code và cách đo dùng chung](handoff/shared/baseline.md). Các thư mục mới là khung bàn giao; chưa có kết quả thực nghiệm hoặc báo cáo được điền sẵn.

## Chạy game

Cần Python 3.10+ và trình duyệt có WebGL.

```bash
cd Src
python -m venv .venv
```

Kích hoạt trên Windows PowerShell: `.venv\Scripts\Activate.ps1`.
Trên macOS/Linux: `source .venv/bin/activate`.

```bash
python -m pip install -r requirements.txt
python main.py
```

Mở `http://127.0.0.1:5000` nếu trình duyệt không tự mở. Không mở HTML trực tiếp; game cần API Flask. Không cần Node.js để chơi. Three.js, font và vật liệu đi kèm, không cần CDN.

- Mũi tên hoặc WASD: lăn khối; giữ phím để lăn liên tục.
- Space: đổi khối khi tách đôi.
- R: chơi lại; C: đặt lại camera.
- Kéo chuột: xoay; cuộn: thu phóng.
- Hướng luôn theo hàng/cột của bàn, không đổi theo camera.

## Trạng thái thuật toán

Game chơi tay vẫn hoạt động song song với các solver. Bấm solver chưa làm xong sẽ hiện thông báo rõ ràng (API HTTP 501), không báo sai rằng màn vô nghiệm. Sau khi cài đặt đúng hàm, nút UI tự sử dụng thuật toán đó.

Các thành viên dùng chung:

- `get_initial_state()`, `is_goal(state)`, `get_successors(state)` và `apply_move(state, action)` của engine.
- `State` bất biến, hash được, gồm tọa độ, hướng, trạng thái cầu và khối đang điều khiển.
- `solvers/base.py`: wrapper đo thời gian và bộ nhớ đỉnh; không chứa thuật toán tìm kiếm.
- `solvers/costs.py`: chi phí chung cho UCS/A*: 1 + 0.5 cho mỗi ô cam bị chiếm ở trạng thái tiếp theo, kể cả Space. BFS/DFS dùng số hành động làm total_cost.

Đổi schema, State hoặc cost phải trao đổi với nhóm và cập nhật test tương ứng. Toàn bộ kỳ vọng và đường đi mẫu nằm trong **một file** `Src/tests/test_cases.json`. Board của map thật được tham chiếu theo ID từ `Src/levels/`; các board nhỏ chỉ phục vụ test được khai báo ngay trong ca tương ứng.

## Chạy kiểm thử

Từ `Src`, chạy các test nền rồi gọi cả bốn solver trên toàn bộ 43 ca:

```bash
python run_tests.py
```

Chọn một solver hoặc một số ID:

```bash
python run_tests.py --solver bfs
python run_tests.py --solver dfs
python run_tests.py --solver ucs
python run_tests.py --solver astar
python run_tests.py --solver ucs --cases T5 T10 33
```

`--cases` lọc các lượt chạy solver; các kiểm tra nền vẫn chạy đầy đủ.
Để chỉ chạy test nền, không tìm kiếm trên các map lớn:

```bash
python -m unittest discover -s tests -p "test_*.py" -v
```

UI cần Node.js 18+ và `npm ci` trong `Src/tests` một lần. Sau đó, từ `Src`:

```bash
python run_tests.py --ui
```
