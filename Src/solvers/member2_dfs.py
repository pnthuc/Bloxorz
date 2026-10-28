"""Thành viên 2: tự cài đặt phần TODO; xem Giao_viec_Bloxorz.pdf.
Không thay chữ ký solve_* hoặc schema kết quả. Không dùng walkthroughs để giải.
Core trả found, moves, expanded_nodes, total_cost; wrapper đo thời gian/bộ nhớ.
"""
from typing import Any, Dict
from game_logic import BloxorzBoard, State
from .base import run_with_profiler


def _dfs_core(board: BloxorzBoard) -> Dict[str, Any]:
    """TODO TV2: LIFO hoặc đệ quy an toàn, chống chu trình; không yêu cầu tối ưu.
    Dùng get_initial_state(), is_goal(), get_successors(); không viết lại luật game.
    Xử lý start=goal, vô nghiệm, dựng lại danh sách hành động và đếm expanded_nodes.
    """
    start_state = board.get_initial_state()

    # Trường hợp bắt đầu ngay tại ô đích
    if board.is_goal(start_state):
        return {
            "found": True,
            "moves": [],
            "expanded_nodes": 0,
            "total_cost": 0,
        }

    stack = [start_state]
    parent = {start_state: None}
    expanded_nodes = 0

    while stack:
        current = stack.pop()
        expanded_nodes += 1

        for action, nxt in board.get_successors(current):
            if nxt in parent:
                continue
            parent[nxt] = (current, action)
            
            if board.is_goal(nxt):
                moves = []
                node = nxt
                while parent[node] is not None:
                    node, act = parent[node]
                    moves.append(act)
                moves.reverse()
                return {
                    "found": True,
                    "moves": moves,
                    "expanded_nodes": expanded_nodes,
                    "total_cost": sum(1 for m in moves if m != "SPACE"),
                }

            stack.append(nxt)

    # Trường hợp không tìm thấy đường đi
    return {
        "found": False,
        "moves": [],
        "expanded_nodes": expanded_nodes,
        "total_cost": 0,
    }


def solve_dfs(board: BloxorzBoard) -> Dict[str, Any]:
    return run_with_profiler(_dfs_core, board)