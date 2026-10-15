# Bloxorz

[![Bloxorz CI](https://github.com/pnthuc/Bloxorz/actions/workflows/ci.yml/badge.svg)](https://github.com/pnthuc/Bloxorz/actions/workflows/ci.yml)

Đọc **Giao_viec_Bloxorz.pdf** trước khi bắt đầu. Đây là source bàn giao để nhóm tự hoàn thiện thuật toán, không phải bài nộp đã hoàn chỉnh.

## Phân công

| Họ và tên | MSSV | Phạm vi | File chính |
| --- | --- | --- | --- |
| Phan Ngọc Thức | 24120228 | Game engine, UI, levels và testcase | `Src/game_logic.py`, `main.py`, `static/`, `templates/`, `levels/`, `tests/`, `test_solvers.py` |
| Nguyễn Lê Minh Quân | 24120219 | DFS | `Src/solvers/member2_dfs.py` |
| Bùi Phương Nam | 24120502 | BFS | `Src/solvers/member3_bfs.py` |\
| Tống Phúc Thiện | 24120141 | A* và heuristic | `Src/solvers/member4_astar.py` |
| Phan Gia Phúc | 24120503 | UCS | `Src/solvers/member5_ucs.py` |

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
- `solvers/costs.py`: chi phí cố định cho UCS/A*: 1 + 2 cho mỗi ô cam bị chiếm ở trạng thái tiếp theo, kể cả Space. BFS/DFS dùng số hành động làm total_cost.

Đổi schema, State hoặc cost phải trao đổi với nhóm và cập nhật test tương ứng. Không dùng `tests/walkthroughs.json` để trả lời solver: đó chỉ là đường đi mẫu kiểm tra engine/UI.

## Chạy kiểm thử

Từ `Src`:

```bash
python -m unittest discover -s tests -p "test_*.py" -v
python test_solvers.py --solver bfs
python test_solvers.py --solver dfs
python test_solvers.py --solver ucs
python test_solvers.py --solver astar
python test_solvers.py
```

- Engine/API: 38 test, chạy độc lập với solver.
- Solver: 10 fixture + 12 màn = 22 ca cho mỗi thuật toán, 88 ca khi chạy tất cả.
- Mã thoát solver: **0 = tất cả PASS; 1 = có FAIL; 2 = còn TODO/PENDING**.
- Ở bản bàn giao này, 88 PENDING là đúng vì nhóm chưa cài đặt thuật toán. Không ghi là 88 PASS.
- Bộ test kiểm tra schema, đường đi, đích, số bước BFS, cost UCS/A*, các mốc biên và điều kiện cơ bản của heuristic. Test hữu hạn không thay thế chứng minh heuristic.

Test giao diện tùy chọn, cần Node.js 18+ và Python đã cài Flask:

```bash
cd tests
npm install
npm test
```

Test tự mở Flask ở cổng 5001. Có thể đặt biến `PYTHON` trỏ tới Python trong môi trường ảo. Solver response dùng fixture để kiểm tra replay, không phải thuật toán thật; phần render GPU được giả lập, còn Three.js geometry/quaternion và API nước đi chạy thật.

Sau khi cả bốn thuật toán hoàn thiện:

```bash
python experiments.py
```

Script in bảng đo và xuất `experiments_comparison.png`. Đây là công cụ hỗ trợ; phần phân tích thực nghiệm và người làm báo cáo/video vẫn cần nhóm thống nhất.

