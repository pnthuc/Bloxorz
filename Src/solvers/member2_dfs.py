"""Thành viên 2: Depth-First Search.
Core dùng luật engine; wrapper đo thời gian, bộ nhớ và chuẩn hóa kết quả.
"""
from typing import Any, Dict
from core.board import BloxorzBoard
from .base import run_with_profiler


def _dfs_core(board: BloxorzBoard) -> Dict[str, Any]:
    """LIFO, chống chu trình; không yêu cầu lời giải tối ưu."""
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
                    "total_cost": len(moves),
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
