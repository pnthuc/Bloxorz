"""Thành viên 5: Uniform-Cost Search theo chi phí chung trong costs.py.

Core tìm đường có tổng chi phí nhỏ nhất và trả các chỉ số tìm kiếm.
Wrapper solve_ucs đo thời gian, bộ nhớ và chuẩn hóa schema kết quả.
"""
from heapq import heappop, heappush
from itertools import count
from typing import Any, Dict, List, Optional, Tuple

from core.board import BloxorzBoard, State
from .base import run_with_profiler
from .costs import step_cost


def _ucs_core(board: BloxorzBoard) -> Dict[str, Any]:
    """Mở rộng trạng thái theo tổng chi phí g tăng dần.

    step_cost >= 1, nên đích lấy khỏi heap với g tốt nhất có chi phí tối ưu.
    best_g và parent dùng đầy đủ State, bao gồm cầu và khối đang điều khiển.
    expanded_nodes chỉ đếm lần sinh successor, bỏ qua đích và entry lỗi thời.
    """
    start_state = board.get_initial_state()
    counter = count()
    # Bộ đếm phân xử khi cùng chi phí, tránh so sánh trực tiếp hai State.
    frontier: List[Tuple[float, int, State]] = [
        (0.0, next(counter), start_state)
    ]
    best_g: Dict[State, float] = {start_state: 0.0}
    parent: Dict[State, Optional[Tuple[State, str]]] = {start_state: None}
    expanded_nodes = 0

    while frontier:
        current_g, _, current = heappop(frontier)

        # Một đường rẻ hơn đã thay thế entry này trong lúc nó còn ở heap.
        if current_g != best_g[current]:
            continue

        # Chỉ kết luận khi lấy đích ra khỏi heap, kể cả start đã là đích.
        if board.is_goal(current):
            moves: List[str] = []
            node = current
            while parent[node] is not None:
                node, action = parent[node]
                moves.append(action)
            moves.reverse()
            return {
                "found": True,
                "moves": moves,
                "expanded_nodes": expanded_nodes,
                "total_cost": current_g,
            }

        expanded_nodes += 1
        for action, next_state in board.get_successors(current):
            next_g = current_g + step_cost(board, next_state)
            if next_g >= best_g.get(next_state, float("inf")):
                continue

            # Cập nhật cả chi phí và đường đi khi tìm được cách đến rẻ hơn.
            best_g[next_state] = next_g
            parent[next_state] = (current, action)
            heappush(frontier, (next_g, next(counter), next_state))

    return {
        "found": False,
        "moves": [],
        "expanded_nodes": expanded_nodes,
        "total_cost": 0.0,
    }


def solve_ucs(board: BloxorzBoard) -> Dict[str, Any]:
    return run_with_profiler(_ucs_core, board)
