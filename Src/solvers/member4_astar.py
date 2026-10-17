"""Thành viên 4: tự cài đặt phần TODO; xem Giao_viec_Bloxorz.pdf.
Không thay chữ ký solve_* hoặc schema kết quả. Không dùng walkthroughs để giải.
Core trả found, moves, expanded_nodes, total_cost; wrapper đo thời gian/bộ nhớ.
"""
from typing import Any, Dict, List, Tuple, Optional
import heapq
import itertools
from game_logic import BloxorzBoard, State, SPLIT, STANDING
from .base import run_with_profiler
from .costs import step_cost


def heuristic(board: BloxorzBoard, state: State, goal_pos: Tuple[int, int]) -> float:
    """Cận dưới chi phí còn lại từ state đến goal_pos.

    Tính Admissibility & Consistency:
    1. Hàm chi phí mỗi bước (step_cost) luôn >= 1 (1 + 2 * số ô FRAGILE).
    2. Mỗi hành động (UP, DOWN, LEFT, RIGHT) làm khoảng cách Manhattan nhỏ nhất
       từ các ô bị chiếm của khối tới đích giảm tối đa 2 đơn vị. Do đó, số bước
       tối thiểu để tiếp cận đích qua di chuyển thông thường là ceil(d_min / 2).
       Vì step_cost >= 1, nên (d_min + 1) // 2 luôn <= chi phí tối ưu thực tế (Admissible)
       và |h(s) - h(s')| <= 1 <= step_cost(s, a, s') (Consistent).
    3. Trạng thái đích: khi khối STANDING tại ô GOAL, h(goal) = 0.
       Nếu khối chưa STANDING tại GOAL, nó cần ít nhất 1 bước chuyển hướng để thắng,
       do đó nếu d_min == 0 nhưng chưa thỏa is_goal thì h = 1.0.
    4. Xử lý Split Switch (Công tắc phân tách / teleport):
       Nếu trên sàn có Split Switch, khối có thể di chuyển tới switch đó, tách và
       dịch chuyển tức thời tới 2 vị trí mục tiêu (targets). Khoảng cách hình học
       trực tiếp tới đích có thể lớn hơn đường đi qua split switch. Vì vậy, ta xét thêm
       cận dưới của đường đi qua từng split switch:
         h_via_switch = ceil(d_switch / 2) + ceil(d_targets_to_goal / 2) + 1
       và lấy min(h_direct, h_via_switch) để đảm bảo không bao giờ đánh giá quá cao (Admissible).
    """
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
    if state.orientation != SPLIT and board.switches:
        for key, sw in board.switches.items():
            if sw.get("behavior") == "split":
                # Lấy tọa độ của split switch
                sr, sc = map(int, key.split(","))

                # Lấy tọa độ 2 khối được dịch chuyển khi kích hoạt split switch
                targets = sw.get("targets", [])
                x1, x2 = targets[0], targets[1]

                # Tính khoảng cách từ vị trí hiện tại đến split switch
                d_to_sw = min(abs(r - sr) + abs(c - sc) for r, c in cells)

                # Lấy min 2 khối nhỏ đến đích
                d_targets = min(
                abs(x1[0] - gr) + abs(x1[1] - gc),
                abs(x2[0] - gr) + abs(x2[1] - gc)
                )

                # Tính heuristic nếu chọn kích hoạt split switch
                h_via_sw = float(d_to_sw + d_targets + 2) // 2

                # Lấy min để h_direct chắc chắn admissible
                h_direct = min(h_direct, h_via_sw)

    return float(h_direct)


def _find_goal_pos(board: BloxorzBoard) -> Tuple[int, int]:
    for r in range(board.rows):
        for c in range(board.cols):
            if board.grid[r][c] == 9:
                return (r, c)
    return (-1, -1)


def _astar_core(board: BloxorzBoard) -> Dict[str, Any]:
    """Tìm kiếm A* với f(n) = g(n) + h(n).
    - Ưu tiên f nhỏ nhất; tie-breaker ưu tiên h nhỏ hơn, sau đó theo thứ tự sinh node.
    - Cập nhật best_g khi tìm thấy đường rẻ hơn; bỏ qua các entry lỗi thời trên heap.
    - Xử lý đúng start = goal (0 bước, 0 node mở rộng) và trường hợp vô nghiệm.
    - Chỉ tăng expanded_nodes khi một node thực sự được lấy ra để mở rộng các successors.
    """
    start_state = board.get_initial_state()

    # Trường hợp biên: vị trí xuất phát đã là đích
    if board.is_goal(start_state):
        return {
            "found": True,
            "moves": [],
            "expanded_nodes": 0,
            "total_cost": 0.0
        }

    goal_pos = _find_goal_pos(board)
    if goal_pos == (-1, -1):
        return {
            "found": False,
            "moves": [],
            "expanded_nodes": 0,
            "total_cost": 0.0
        }

    h0 = heuristic(board, start_state, goal_pos)
    counter = itertools.count()

    # Priority queue lưu các tuple: (f, h, tie_breaker, state)
    frontier: List[Tuple[float, float, int, State]] = []
    heapq.heappush(frontier, (h0, h0, next(counter), start_state))

    best_g: Dict[State, float] = {start_state: 0.0}
    parent: Dict[State, Tuple[Optional[State], Optional[str]]] = {start_state: (None, None)}

    expanded_nodes = 0

    while frontier:
        f, h, _, current_state = heapq.heappop(frontier)
        current_g = best_g.get(current_state, float("inf"))

        # Bỏ qua entry heap lỗi thời (đã có đường khác rẻ hơn tới state này)
        if f - h > current_g + 1e-9:
            continue

        # Kiểm tra đích tại thời điểm lấy ra khỏi frontier
        if board.is_goal(current_state):
            moves: List[str] = []
            cur = current_state
            while True:
                prev_state, act = parent[cur]
                if prev_state is None or act is None:
                    break
                moves.append(act)
                cur = prev_state
            moves.reverse()

            return {
                "found": True,
                "moves": moves,
                "expanded_nodes": expanded_nodes,
                "total_cost": current_g
            }

        # Node thực sự được mở rộng để sinh successors
        expanded_nodes += 1

        for action, next_state in board.get_successors(current_state):
            cost = step_cost(board, current_state, action, next_state)
            new_g = current_g + cost

            if new_g < best_g.get(next_state, float("inf")) - 1e-9:
                best_g[next_state] = new_g
                parent[next_state] = (current_state, action)
                h_next = heuristic(board, next_state, goal_pos)
                f_next = new_g + h_next
                heapq.heappush(frontier, (f_next, h_next, next(counter), next_state))

    # Toàn bộ không gian trạng thái đã duyệt nhưng không tới được đích (vô nghiệm)
    return {
        "found": False,
        "moves": [],
        "expanded_nodes": expanded_nodes,
        "total_cost": 0.0
    }


def solve_astar(board: BloxorzBoard) -> Dict[str, Any]:
    return run_with_profiler(_astar_core, board)
