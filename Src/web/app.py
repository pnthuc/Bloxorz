"""Flask routes; gameplay and search remain in core/ and solvers/."""
import hashlib
import json
from pathlib import Path
from threading import BoundedSemaphore

from flask import Flask, jsonify, request, render_template
from core.board import BloxorzBoard, State
from core.levels import load_all_levels
from solvers import solve_bfs, solve_dfs, solve_ucs, solve_astar
from benchmarks.worker import measure_solver

_BENCHMARK_SLOT = BoundedSemaphore(1)
BASE_DIR = Path(__file__).resolve().parents[1]
app = Flask(__name__, template_folder=str(BASE_DIR / "templates"),
            static_folder=str(BASE_DIR / "static"))


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
    """Hiển thị giao diện chính từ Src/templates/index.html."""
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


@app.route("/api/benchmark", methods=["POST"])
def api_benchmark():
    """One bounded measurement. The browser queues all four sequentially."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(error="Cần gửi cấu hình lượt đo."), 400
    solver_name = data.get("solver")
    if solver_name not in ("bfs", "dfs", "ucs", "astar"):
        return jsonify(error="Thuật toán không hợp lệ."), 400
    limit_ms = data.get("limit_ms", 5000)
    if type(limit_ms) is not int or not 1000 <= limit_ms <= 30000:
        return jsonify(error="Giới hạn phải từ 1 đến 30 giây."), 400
    level_id = str(data.get("level_id", ""))
    level = load_all_levels().get(level_id)
    if level is None:
        return jsonify(error="Màn chơi không tồn tại."), 404
    revision = hashlib.sha256(json.dumps(level, sort_keys=True).encode()).hexdigest()
    if data.get("level_revision") not in (None, revision):
        return jsonify(error="Dữ liệu màn chơi đã đổi. Hãy chạy lại cả lượt so sánh.",
                       code="LEVEL_CHANGED"), 409
    if not _BENCHMARK_SLOT.acquire(blocking=False):
        return jsonify(error="Một lượt đo khác đang chạy. Hãy thử lại khi lượt đó kết thúc."), 409
    try:
        measured = measure_solver(level, solver_name, limit_ms)
        return jsonify(**measured, solver=solver_name, level_id=level_id,
                       level_revision=revision, limit_ms=limit_ms)
    finally:
        _BENCHMARK_SLOT.release()

