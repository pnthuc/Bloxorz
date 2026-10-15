# Source/main.py
import os
import json
import webbrowser
from threading import Timer
from flask import Flask, jsonify, request, render_template
from game_logic import BloxorzBoard, State
from solvers import solve_bfs, solve_dfs, solve_ucs, solve_astar

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static")
)

# Dữ liệu màn chơi dự phòng (tự động dùng nếu thư mục Source/levels/ chưa có file .json)
DEFAULT_LEVELS = {
    "1": {
        "id": "1",
        "name": "Stage 1: Classic Warmup",
        "difficulty": "Easy (Basic Floor Only)",
        "start_pos": [1, 1],
        "initial_bridges": [],
        "switches": {},
        "grid": [
            [1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [0, 0, 0, 0, 0, 1, 1, 9, 1, 1],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 0]
        ]
    },
    "2": {
        "id": "2",
        "name": "Stage 2: Fragile Path",
        "difficulty": "Medium (Fragile Orange Tiles)",
        "start_pos": [2, 1],
        "initial_bridges": [],
        "switches": {},
        "grid": [
            [1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 2, 2, 2, 2, 1, 9, 1],
            [1, 1, 2, 2, 2, 2, 1, 1, 1],
            [0, 0, 0, 0, 0, 0, 1, 1, 1]
        ]
    },
    "3": {
        "id": "3",
        "name": "Stage 3: Switches & Bridges",
        "difficulty": "Hard (Soft & Heavy Switches)",
        "start_pos": [1, 1],
        "initial_bridges": [False, False],
        "switches": {
            "1,3": {"behavior": "toggle", "targets": [0]},
            "1,8": {"behavior": "open", "targets": [1]}
        },
        "grid": [
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
            [1, 1, 1, 3, 0, 0, 1, 1, 4, 1, 1, 1],
            [1, 1, 1, 1, 10, 10, 1, 1, 1, 1, 11, 11],
            [1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 9],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]
        ]
    },
    "4": {
        "id": "4",
        "name": "Stage 4: Split Switch & Fragile",
        "difficulty": "Expert (Split Cubes + Bridge + Fragile)",
        "start_pos": [1, 1],
        "initial_bridges": [False],
        "switches": {
            "1,4": {"behavior": "split", "targets": [[0, 4], [2, 4]]},
            "0,6": {"behavior": "toggle", "targets": [0]}
        },
        "grid": [
            [0, 0, 0, 1, 1, 1, 3, 0, 0, 1],
            [1, 1, 2, 1, 5, 1, 1, 10, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 0, 1, 9],
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1]
        ]
    }
}


def load_all_levels() -> dict:
    """Đọc toàn bộ các file màn chơi .json trong thư mục Source/levels/."""
    levels_dir = os.path.join(BASE_DIR, "levels")
    levels = {}
    if os.path.exists(levels_dir):
        for fname in sorted(os.listdir(levels_dir)):
            if fname.endswith(".json"):
                fpath = os.path.join(levels_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        lvl_id = str(data.get("id", len(levels) + 1))
                        levels[lvl_id] = data
                except Exception as e:
                    print(f"[Warning] Lỗi đọc file {fname}: {e}")
    return dict(sorted((levels or DEFAULT_LEVELS).items(),
                       key=lambda item: (0, int(item[0])) if item[0].isdigit() else (1, item[0])))


def serialize_state(st: State) -> dict:
    """Chuyển đối tượng State của Python sang JSON để gửi lên giao diện 3D."""
    return {
        "r": st.r,
        "c": st.c,
        "orientation": st.orientation,
        "bridges": list(st.bridges),
        "r2": st.r2,
        "c2": st.c2,
        "active_cube": st.active_cube
    }


def deserialize_state(d: dict) -> State:
    """Chuyển dữ liệu JSON từ giao diện 3D ngược lại thành đối tượng State của Python."""
    return State(
        r=int(d["r"]),
        c=int(d["c"]),
        orientation=str(d["orientation"]),
        bridges=tuple(bool(b) for b in d.get("bridges", [])),
        r2=int(d.get("r2", -1)),
        c2=int(d.get("c2", -1)),
        active_cube=int(d.get("active_cube", 0))
    )


@app.route("/")
def index():
    """Hiển thị giao diện chính từ Source/templates/index.html."""
    return render_template("index.html")


@app.route("/api/levels", methods=["GET"])
def api_list_levels():
    """Trả về danh sách tất cả các màn chơi hiện có."""
    levels = load_all_levels()
    return jsonify({
        lvl_id: {"id": lvl_id, "name": data.get("name", f"Stage {lvl_id}"),
                 "display_name": data.get("display_name"),
                 "description": data.get("description"), "difficulty": data.get("difficulty")}
        for lvl_id, data in levels.items()
    })


@app.route("/api/level/<level_id>", methods=["GET"])
def api_get_level(level_id):
    """Tải cấu trúc bàn cờ và trạng thái khởi đầu của một màn chơi."""
    levels = load_all_levels()
    lvl = levels.get(str(level_id)) or next(iter(levels.values()))
    board = BloxorzBoard(lvl)
    return jsonify({
        "level": lvl,
        "initial_state": serialize_state(board.get_initial_state())
    })


@app.route("/api/move", methods=["POST"])
def api_move():
    """Kiểm tra và thực hiện 1 bước di chuyển thủ công hoặc bước diễn hoạt AI."""
    data = request.get_json(force=True)
    levels = load_all_levels()
    lvl = levels.get(str(data.get("level_id", "1"))) or next(iter(levels.values()))
    board = BloxorzBoard(lvl)

    current_state = deserialize_state(data["state"])
    action = str(data.get("action", "")).upper()

    outcome = board.evaluate_move(current_state, action)
    next_state = outcome["state"]
    if not outcome["valid"]:
        return jsonify({"valid": False, "failure_reason": outcome["failure_reason"],
                        "failure_state": serialize_state(next_state) if next_state else None})

    return jsonify({
        "valid": True,
        "next_state": serialize_state(next_state),
        "is_goal": board.is_goal(next_state)
    })


@app.route("/api/solve", methods=["POST"])
def api_solve():
    """Gọi thuật toán tìm kiếm tương ứng (BFS, DFS, UCS, A*) và trả về lời giải + Metrics."""
    data = request.get_json(force=True)
    levels = load_all_levels()
    lvl = levels.get(str(data.get("level_id", "1"))) or next(iter(levels.values()))
    board = BloxorzBoard(lvl)
    solver_name = str(data.get("solver", "bfs")).lower()

    solver = {"bfs": solve_bfs, "dfs": solve_dfs, "ucs": solve_ucs,
              "astar": solve_astar, "a*": solve_astar}.get(solver_name)
    if solver is None:
        return jsonify({"error": f"Unknown solver: {solver_name}"}), 400
    try:
        result = solver(board)
    except NotImplementedError as exc:
        return jsonify({"error": str(exc), "code": "SOLVER_NOT_IMPLEMENTED"}), 501

    return jsonify(result)


if __name__ == "__main__":
    print("=" * 65)
    print("Đang khởi động Bloxorz 3D AI Solver tại: http://127.0.0.1:5000")
    print("=" * 65)
    Timer(1.0, lambda: webbrowser.open("http://127.0.0.1:5000")).start()
    app.run(host="127.0.0.1", port=5000, debug=False)
