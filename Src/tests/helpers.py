"""Công cụ dùng chung: nạp ca, replay, tính cost và kiểm tra kết quả.

Chỉ module này nạp test_cases.json ở phía Python. Không gọi solver để tạo kỳ vọng.
"""

from copy import deepcopy
from dataclasses import dataclass
import json
import math
from pathlib import Path
from typing import Any, Dict, FrozenSet, List, Optional, Tuple

from game_logic import BloxorzBoard, GOAL, State
from solvers import heuristic
from solvers.member4_astar import precompute_switch_costs_from_goal
from solvers.costs import step_cost

ROOT = Path(__file__).resolve().parents[1]
ACTIONS = {"UP", "DOWN", "LEFT", "RIGHT", "SPACE"}
EPSILON = 1e-6


def check(condition: bool, message: str) -> None:
    # Các kiểm tra vẫn phải chạy khi Python được gọi với -O.
    if not condition:
        raise AssertionError(message)


def finite_number(value: Any) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def _unique_object(pairs):
    data = {}
    for key, value in pairs:
        check(key not in data, f"JSON có key trùng: {key}")
        data[key] = value
    return data


def read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as stream:
        return json.load(stream, object_pairs_hook=_unique_object)


@dataclass(frozen=True)
class Case:
    id: str
    title: str
    level: Dict[str, Any]
    solvable: bool
    bfs_moves: Optional[int]
    ucs_cost: Optional[float]
    walkthrough: Optional[List[str]] = None
    walkthrough_cost: Optional[float] = None
    visits: Tuple[Any, ...] = ()
    level_id: Optional[str] = None

    def make_board(self) -> BloxorzBoard:
        # Solver và replay có board riêng, tránh làm thay đổi dữ liệu ca sau.
        return BloxorzBoard(deepcopy(self.level))


@dataclass(frozen=True)
class Replay:
    valid: bool
    reason: str
    cost: float
    state: State
    visited: FrozenSet[Any]


def load_levels() -> Dict[str, dict]:
    levels = {}
    for path in sorted((ROOT / "levels").glob("*.json")):
        level = read_json(path)
        level_id = str(level["id"])
        check(level_id not in levels, f"Trùng ID màn chơi: {level_id}")
        levels[level_id] = level
    check(bool(levels), "Không tìm thấy màn chơi trong levels/")
    return levels


def _parse_case(case_id: str, data: dict, levels: dict) -> Case:
    required = {"solvable", "bfs_moves", "ucs_cost", "walkthrough", "walkthrough_cost"}
    allowed = required | {"name", "level", "board", "visits"}
    check(isinstance(data, dict), f"{case_id}: dữ liệu phải là object")
    check(required <= data.keys(), f"{case_id}: thiếu trường {sorted(required - data.keys())}")
    check(not data.keys() - allowed, f"{case_id}: trường lạ {sorted(data.keys() - allowed)}")
    check(("level" in data) != ("board" in data), f"{case_id}: cần đúng một nguồn level hoặc board")
    if "level" in data:
        level_id = data["level"]
        check(
            isinstance(level_id, str) and level_id in levels, f"{case_id}: ID level không tồn tại"
        )
        level = levels[level_id]
    else:
        level_id = None
        level = data["board"]
        check(
            isinstance(level, dict) and {"grid", "start_pos"} <= level.keys(),
            f"{case_id}: board cần grid và start_pos",
        )
        level = dict(level, id=case_id, name=data.get("name", case_id))

    solvable, length, cost = data["solvable"], data["bfs_moves"], data["ucs_cost"]
    moves, walk_cost = data["walkthrough"], data["walkthrough_cost"]
    check(type(solvable) is bool, f"{case_id}: solvable phải là bool")
    if solvable:
        check(
            type(length) is int and length >= 0, f"{case_id}: bfs_moves phải là số nguyên không âm"
        )
        check(
            finite_number(cost) and cost >= length,
            f"{case_id}: ucs_cost phải hữu hạn và >= bfs_moves",
        )
        check(
            isinstance(moves, list)
            and all(isinstance(action, str) and action in ACTIONS for action in moves),
            f"{case_id}: walkthrough chứa hành động sai",
        )
        check(len(moves) == length, f"{case_id}: walkthrough phải có bfs_moves hành động")
        check(
            finite_number(walk_cost) and walk_cost >= cost,
            f"{case_id}: walkthrough_cost phải >= ucs_cost",
        )
    else:
        check(
            all(value is None for value in (length, cost, moves, walk_cost)),
            f"{case_id}: vô nghiệm dùng null cho các mốc tối ưu và walkthrough",
        )
    visits = data.get("visits", [])
    check(
        isinstance(visits, list)
        and all(
            type(value) is int or value in ("STANDING", "HORIZONTAL", "VERTICAL", "SPLIT")
            for value in visits
        ),
        f"{case_id}: visits không hợp lệ",
    )
    return Case(
        id=case_id,
        title=data.get("name", level.get("name", case_id)),
        level=level,
        level_id=level_id,
        solvable=solvable,
        bfs_moves=length,
        ucs_cost=cost,
        walkthrough=moves,
        walkthrough_cost=walk_cost,
        visits=tuple(visits),
    )


def load_cases(path: Optional[Path] = None) -> List[Case]:
    data = read_json(path or ROOT / "tests" / "test_cases.json")
    check(isinstance(data, dict) and bool(data), "test_cases.json phải là object không rỗng")
    levels = load_levels()
    cases = [_parse_case(case_id, entry, levels) for case_id, entry in data.items()]
    canonical = {case.id for case in cases if case.id == case.level_id}
    missing, extra = sorted(levels.keys() - canonical), sorted(canonical - levels.keys())
    check(not missing and not extra, f"test_cases.json: thiếu map {missing}; dư map {extra}")

    def order(case):
        if case.id.startswith("T") and case.id[1:].isdigit():
            return 0, int(case.id[1:])
        if case.id.isdigit():
            return 1, int(case.id)
        return 2, case.id

    return sorted(cases, key=order)


def select_cases(cases: List[Case], ids: Optional[List[str]]) -> List[Case]:
    if not ids:
        return cases
    unknown = sorted(set(ids) - {case.id for case in cases})
    check(not unknown, f"ID ca kiểm thử không tồn tại: {unknown}")
    return [case for case in cases if case.id in ids]


def replay_solution(board: BloxorzBoard, moves: List[str]) -> Replay:
    state = board.get_initial_state()
    cost = 0.0
    visited = {state.orientation}
    visited.update(board.grid[r][c] for r, c in state.get_occupied_cells())
    for index, action in enumerate(moves, start=1):
        if not isinstance(action, str) or action not in ACTIONS:
            return Replay(
                False,
                f"Hành động thứ {index} không hợp lệ: {action!r}",
                cost,
                state,
                frozenset(visited),
            )
        child = board.apply_move(state, action)
        if child is None:
            return Replay(
                False,
                f"Bước thứ {index} ({action}) vi phạm luật bàn chơi",
                cost,
                state,
                frozenset(visited),
            )
        cost += step_cost(board, child)
        state = child
        visited.add(state.orientation)
        visited.update(board.grid[r][c] for r, c in state.get_occupied_cells())
    valid = board.is_goal(state)
    reason = "Hợp lệ" if valid else f"Đi hết {len(moves)} hành động nhưng chưa tới GOAL"
    return Replay(valid, reason, cost, state, frozenset(visited))


def verify_solution_walk(board: BloxorzBoard, moves: List[str]) -> Tuple[bool, str, float]:
    result = replay_solution(board, moves)
    return result.valid, result.reason, result.cost


REQUIRED_FIELDS = {
    "found",
    "moves",
    "solution_length",
    "expanded_nodes",
    "search_time_ms",
    "memory_kb",
    "total_cost",
}


def validate_schema(result: Any) -> None:
    check(isinstance(result, dict), "Kết quả phải là dict")
    missing = REQUIRED_FIELDS - result.keys()
    check(not missing, f"Thiếu trường kết quả: {sorted(missing)}")
    check(type(result["found"]) is bool, "found phải là bool")
    check(isinstance(result["moves"], list), "moves phải là list")
    check(
        all(isinstance(action, str) and action in ACTIONS for action in result["moves"]),
        "moves chứa hành động không hợp lệ",
    )
    for key in ("solution_length", "expanded_nodes"):
        check(type(result[key]) is int and result[key] >= 0, f"{key} phải là số nguyên không âm")
    check(result["solution_length"] == len(result["moves"]), "solution_length khác len(moves)")
    for key in ("search_time_ms", "memory_kb", "total_cost"):
        check(finite_number(result[key]), f"{key} phải là số hữu hạn, không âm")


def validate_heuristic(board: BloxorzBoard, case: Case, goal_state: State) -> None:
    """Kiểm tra tại start/goal; kết quả hữu hạn không chứng minh admissible/consistent."""
    goal_pos = next(
        (r, c) for r, row in enumerate(board.grid) for c, tile in enumerate(row) if tile == GOAL
    )
    
    # 1. Tiền xử lý switch_table bằng tọa độ goal_pos (Tuple[int, int])
    switch_table = precompute_switch_costs_from_goal(board, goal_pos)
    
    # 2. Truyền switch_table vào cả lúc tính h_start và h_goal
    h_start = heuristic(board, board.get_initial_state(), goal_pos, switch_table)
    check(finite_number(h_start), "h(start) phải hữu hạn, không âm")
    check(
        h_start <= case.ucs_cost + EPSILON,
        f"h(start)={h_start:g} vượt cost tối ưu {case.ucs_cost:g}",
    )
    
    h_goal = heuristic(board, goal_state, goal_pos, switch_table)
    check(finite_number(h_goal) and h_goal <= EPSILON, "h(goal) phải bằng 0")


def validate_result(name: str, case: Case, board: BloxorzBoard, result: Any) -> None:
    validate_schema(result)
    check(result["found"] == case.solvable, f"found={result['found']}, kỳ vọng {case.solvable}")
    if board.is_goal(board.get_initial_state()):
        check(result["expanded_nodes"] == 0, "Start=goal không cần mở rộng node")
        check(result["moves"] == [], "Start=goal phải trả lời giải rỗng")
    else:
        check(result["expanded_nodes"] > 0, "Phải mở rộng ít nhất một node khi start khác goal")
    if not result["found"]:
        check(
            result["moves"] == [] and result["total_cost"] == 0,
            "Vô nghiệm phải có moves=[] và total_cost=0",
        )
        return

    replay = replay_solution(board, result["moves"])
    check(replay.valid, replay.reason)
    path_cost = len(result["moves"]) if name in ("bfs", "dfs") else replay.cost
    check(
        math.isclose(result["total_cost"], path_cost, rel_tol=0, abs_tol=EPSILON),
        f"total_cost={result['total_cost']:g}, replay tính được {path_cost:g}",
    )
    if name == "bfs":
        check(
            result["solution_length"] == case.bfs_moves,
            f"BFS có {result['solution_length']} bước, tối ưu là {case.bfs_moves}",
        )
    if name in ("ucs", "astar"):
        check(
            math.isclose(result["total_cost"], case.ucs_cost, rel_tol=0, abs_tol=EPSILON),
            f"Cost {result['total_cost']:g}, tối ưu là {case.ucs_cost:g}",
        )
    if name == "astar":
        validate_heuristic(board, case, replay.state)
