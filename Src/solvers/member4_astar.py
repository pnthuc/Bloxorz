"""A* cho Bloxorz, có xét split switch và teleport nối tiếp.

Heuristic là max của ba cận dưới:
    - Chi phí tới đích trong mô hình điểm được nới lỏng.
    - Số bước tối thiểu để hai khối đơn trở thành kề nhau.
    - Một bước nếu trạng thái hiện tại chưa thắng.

Mô hình điểm bỏ qua hướng khối, void, fragile và trạng thái cầu. Mỗi bước
đi 1 hoặc 2 ô theo một trục tốn 1; teleport tới từng target tốn 0.
Khoảng cách được tính bằng 0-1 BFS ngược từ đích, một lần mỗi lần giải.

Các cận dưới đều admissible và consistent khi step_cost >= 1. Dùng max
để kết hợp chúng, tránh cộng trùng chi phí. Đổi khối bằng SPACE vẫn được
engine xử lý như một hành động và tính cost qua step_cost.
"""

import heapq
from collections import deque
from itertools import count
from typing import Any, Dict, List, Optional, Tuple

from game_logic import BloxorzBoard, GOAL, SPLIT, SPLIT_SWITCH, State

from .base import run_with_profiler
from .costs import step_cost


Position = Tuple[int, int]
_MOVE_OFFSETS = (
    (-1, 0), (-2, 0), (1, 0), (2, 0),
    (0, -1), (0, -2), (0, 1), (0, 2),
)


def _find_goal_pos(board: BloxorzBoard) -> Position:
    for r in range(board.rows):
        for c in range(board.cols):
            if board.grid[r][c] == GOAL:
                return r, c
    return -1, -1


def _build_relaxed_distances(
    board: BloxorzBoard, goal_pos: Position
) -> Dict[Position, int]:
    """Tính D[p]: cost từ p tới đích trong mô hình điểm nới lỏng.

    Duyệt từ đích nên cạnh teleport phải đảo chiều: target -> switch.
    Cạnh di chuyển thông thường đối xứng, có cost 1. Mọi ô trong phạm vi
    bàn cờ đều được phép đi qua, kể cả void hoặc cầu đang đóng.
    """
    reverse_teleports: Dict[Position, List[Position]] = {}
    for key, switch in board.switches.items():
        sr, sc = map(int, key.split(","))
        if board.grid[sr][sc] != SPLIT_SWITCH:
            continue
        for tr, tc in switch["targets"]:
            reverse_teleports.setdefault((tr, tc), []).append((sr, sc))

    distances = {goal_pos: 0}
    frontier = deque([goal_pos])

    while frontier:
        r, c = frontier.popleft()
        current_distance = distances[(r, c)]

        # Cạnh đảo của teleport có cost 0, ưu tiên đầu deque.
        for previous in reverse_teleports.get((r, c), ()):
            if current_distance < distances.get(previous, float("inf")):
                distances[previous] = current_distance
                frontier.appendleft(previous)

        # Cạnh di chuyển có cost 1, đưa vào cuối deque.
        next_distance = current_distance + 1
        for dr, dc in _MOVE_OFFSETS:
            nr, nc = r + dr, c + dc
            if not (0 <= nr < board.rows and 0 <= nc < board.cols):
                continue
            previous = (nr, nc)
            if next_distance < distances.get(previous, float("inf")):
                distances[previous] = next_distance
                frontier.append(previous)

    return distances


def _heuristic_value(
    board: BloxorzBoard,
    state: State,
    distances: Dict[Position, int],
) -> float:
    if board.is_goal(state):
        return 0.0

    h_point = min(distances[cell] for cell in state.get_occupied_cells())

    h_merge = 0
    if state.orientation == SPLIT:
        distance_between = (
            abs(state.r - state.r2) + abs(state.c - state.c2)
        )
        h_merge = max(0, distance_between - 1)

    return float(max(1, h_point, h_merge))


def heuristic(
    board: BloxorzBoard, state: State, goal_pos: Position
) -> float:
    """Giữ API ba tham số để tương thích với test hiện tại.

    Lời gọi độc lập này tự tính bảng D. Trong _astar_core, bảng D được
    tính một lần rồi dùng lại qua _heuristic_value cho mọi trạng thái.
    """
    if board.is_goal(state):
        return 0.0
    distances = _build_relaxed_distances(board, goal_pos)
    return _heuristic_value(board, state, distances)


def _astar_core(board: BloxorzBoard) -> Dict[str, Any]:
    start = board.get_initial_state()
    if board.is_goal(start):
        return {
            "found": True, "moves": [],
            "expanded_nodes": 0, "total_cost": 0.0,
        }

    goal_pos = _find_goal_pos(board)
    if goal_pos == (-1, -1):
        return {
            "found": False, "moves": [],
            "expanded_nodes": 0, "total_cost": 0.0,
        }

    # Nằm bên trong profiler: thời gian và peak memory gồm tiền xử lý.
    distances = _build_relaxed_distances(board, goal_pos)
    h0 = _heuristic_value(board, start, distances)
    serial = count()

    # Ưu tiên f nhỏ nhất, sau đó h nhỏ nhất, rồi thứ tự đưa vào heap.
    # Lưu g riêng để kiểm tra entry cũ mà không cần tính lại f - h.
    frontier: List[Tuple[float, float, int, float, State]] = [
        (h0, h0, next(serial), 0.0, start)
    ]
    best_g: Dict[State, float] = {start: 0.0}
    parent: Dict[State, Optional[Tuple[State, str]]] = {start: None}
    expanded_nodes = 0

    while frontier:
        _, _, _, current_g, current = heapq.heappop(frontier)
        if current_g > best_g[current]:
            continue

        # Chỉ kết luận khi lấy đích ra khỏi heap; đích không được mở rộng.
        if board.is_goal(current):
            moves: List[str] = []
            node = current
            while parent[node] is not None:
                node, action = parent[node]
                moves.append(action)
            moves.reverse()
            return {
                "found": True, "moves": moves,
                "expanded_nodes": expanded_nodes, "total_cost": current_g,
            }

        expanded_nodes += 1
        for action, next_state in board.get_successors(current):
            next_g = current_g + step_cost(board, current, action, next_state)
            if next_g >= best_g.get(next_state, float("inf")):
                continue

            best_g[next_state] = next_g
            parent[next_state] = (current, action)
            h_next = _heuristic_value(board, next_state, distances)
            heapq.heappush(
                frontier,
                (next_g + h_next, h_next, next(serial), next_g, next_state),
            )

    return {
        "found": False, "moves": [],
        "expanded_nodes": expanded_nodes, "total_cost": 0.0,
    }


def solve_astar(board: BloxorzBoard) -> Dict[str, Any]:
    return run_with_profiler(_astar_core, board)
