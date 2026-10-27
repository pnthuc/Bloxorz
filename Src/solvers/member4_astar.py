from typing import Any, Dict, List, Tuple, Optional
import heapq
import itertools
from game_logic import BloxorzBoard, State, SPLIT, STANDING
from .base import run_with_profiler
from .costs import step_cost


def precompute_switch_costs_from_goal(
    board: BloxorzBoard, 
    goal_pos: Tuple[int, int]
) -> Dict[Tuple[int, int], float]:
    """
    Hàm này sẽ dùng Bellman ford để tính sẵn khoảng cách từ
    các switch -> landing target -> switch -> ... -> goal
    """
    if not board.switches:
        return {}
    gr, gc = goal_pos

    # 1. Lọc ra danh sách các split switch
    switches = []
    for key, sw in board.switches.items():
        if sw.get("behavior") == "split":
            sr, sc = map(int, key.split(","))
            targets = [tuple(t) for t in sw.get("targets", [])]
            switches.append(((sr, sc), targets))

    # Nếu không có split switch
    K = len(switches)
    if K == 0:
        return {}
    
    # Khoảng cách bước từ landing target tới 1 ô bất kỳ
    def step_dist(targets, r, c) -> float:
        d = min(abs(tr - r) + abs(tc - c) for tr, tc in targets)
        return float((d + 1) // 2)
    
    # Xây dựng danh sách cạnh từ goal tới các landing target
    edges = []
    for i in range(K):
        w_to_goal = step_dist(switches[i][1], gr, gc)
        edges.append(('GOAL', i, w_to_goal))

    # Xây dựng các cạnh ngược từ switch j -> i
    for i in range(K):
        for j in range(K):
            if i != j:
                sjr, sjc = switches[j][0]
                w_ij = step_dist(switches[i][1], sjr, sjc) + 1.0
                edges.append((j, i, w_ij))


    dist = {i: float('inf') for i in range(K)}

    # Cập nhật sẵn goal -> landing targets
    for u, v, w in edges:
        if u == 'GOAL':
            dist[v] = min(dist[v], w)

    # Bellman ford
    for _ in range(K - 1):
        for u, v, w in edges:
            if u != 'GOAL' and dist[u] != float('inf'):
                if dist[u] + w < dist[v]:
                    dist[v] = dist[u] + w

    
    return {switches[i][0]: dist[i] for i in range(K)}

def heuristic(
    board: BloxorzBoard,
    state: State,
    goal_pos: Tuple[int, int],
    switch_table: Optional[Dict[Tuple[int, int], float]] = None
) -> float:
    
    if board.is_goal(state):
        return 0.0
    
    # Lấy tọa độ vị trí hiện tại
    cells = state.get_occupied_cells()
    if not cells:
        return 0.0

    gr, gc = goal_pos

    # Tính khoảng cách Manhattan từ các ô đang chiếm giữ tới ô đích
    d_min = min(abs(r - gr) + abs(c - gc) for r, c in cells)

    if d_min == 0:
        # Khối đang đè lên ô đích nhưng không ở trạng thái STANDING
        h_direct = 1.0
    else:
        h_direct = float((d_min + 1) // 2)

    # Xét khối ở trạng thái SPLIT
    if state.orientation == SPLIT:
        # Tính manhattan dist giữa 2 khối 1x1x1
        d_between = abs(state.r - state.r2) + abs(state.c - state.c2)

        # 2 khối chỉ cần ở kế nhau là được => khoảng cách 2 khối = d_between - 1
        h_direct = max(h_direct, float(max(0, d_between - 1)))


    # 2. Xét khả năng dịch chuyển khi kích hoạt split switch (nếu chưa tách)
    if switch_table is None and board.switches:
        switch_table = precompute_switch_costs_from_goal(board, goal_pos)

    if switch_table:
        for (sr, sc), cost_sw_to_goal in switch_table.items():
            d_to_sw = min(abs(r - sr) + abs(c - sc) for r, c in cells)
            h_via_sw = float((d_to_sw + 1) // 2 + 1 + cost_sw_to_goal)
            h_direct = min(h_direct, h_via_sw)

    return float(h_direct)


def _find_goal_pos(board: BloxorzBoard) -> Tuple[int, int]:
    for r in range(board.rows):
        for c in range(board.cols):
            if board.grid[r][c] == 9:
                return (r, c)
    return (-1, -1)


def _astar_core(board: BloxorzBoard) -> Dict[str, Any]:
    start_state = board.get_initial_state()

    # Trường hợp vị trí xuất phát đã là đích
    if board.is_goal(start_state):
        return {
            "found": True,
            "moves": [],
            "expanded_nodes": 0,
            "total_cost": 0.0
        }

    # Trường hợp vị trí đích không hợp lệ
    goal_pos = _find_goal_pos(board)
    if goal_pos == (-1, -1):
        return {
            "found": False,
            "moves": [],
            "expanded_nodes": 0,
            "total_cost": 0.0
        }

    switch_table = precompute_switch_costs_from_goal(board, goal_pos)
    h0 = heuristic(board, start_state, goal_pos, switch_table)

    # tie breaker để so node nào đến trước khi f và h = nhau
    counter = itertools.count()

    # Priority queue lưu các tuple: (f, h, tie breaker, state)
    pq: List[Tuple[float, float, int, State]] = []
    heapq.heappush(pq, (h0, h0, next(counter), start_state))

    best_g: Dict[State, float] = {start_state: 0.0}
    parent: Dict[State, Tuple[State, str]] = {}

    expanded_nodes = 0
    

    while pq:
        f, h, _, current_state = heapq.heappop(pq)
        current_g = best_g.get(current_state, float("inf"))

        # Nếu đã có cách đến vị trí này với cost rẻ hơn thì continue
        if f - h > current_g + 1e-9:
            continue

        # Kiểm tra đích tại thời điểm lấy ra khỏi pq
        if board.is_goal(current_state):
            moves: List[str] = []
            cur = current_state
            while cur in parent:
                prev_state, act = parent[cur]
                moves.append(act)
                cur = prev_state
            moves.reverse()

            return {
                "found": True,
                "moves": moves,
                "expanded_nodes": expanded_nodes,
                "total_cost": current_g
            }

        # Mở rộng
        expanded_nodes += 1

        for action, next_state in board.get_successors(current_state):
            cost = step_cost(board, next_state)
            new_g = current_g + cost

            if new_g < best_g.get(next_state, float("inf")) - 1e-9:
                best_g[next_state] = new_g
                parent[next_state] = (current_state, action)
                h_next = heuristic(board, next_state, goal_pos, switch_table)
                f_next = new_g + h_next
                heapq.heappush(pq, (f_next, h_next, next(counter), next_state))

    # Không thể tới đích
    return {
        "found": False,
        "moves": [],
        "expanded_nodes": expanded_nodes,
        "total_cost": 0.0
    }


def solve_astar(board: BloxorzBoard) -> Dict[str, Any]:
    return run_with_profiler(_astar_core, board)
