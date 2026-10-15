"""Thành viên 2: tự cài đặt phần TODO; xem Giao_viec_Bloxorz.pdf.
Không thay chữ ký solve_* hoặc schema kết quả. Không dùng walkthroughs để giải.
Core trả found, moves, expanded_nodes, total_cost; wrapper đo thời gian/bộ nhớ.
"""
from typing import Any, Dict
from game_logic import BloxorzBoard, State
from .base import run_with_profiler


def _bfs_core(board: BloxorzBoard) -> Dict[str, Any]:
    """TODO TV2: FIFO, chống lặp bằng State, đường ít hành động nhất.
    Dùng get_initial_state(), is_goal(), get_successors(); không viết lại luật game.
    Xử lý start=goal, vô nghiệm, dựng lại danh sách hành động và đếm expanded_nodes.
    """
    raise NotImplementedError("BFS: thành viên 2 chưa hoàn thiện thuật toán.")


def solve_bfs(board: BloxorzBoard) -> Dict[str, Any]:
    return run_with_profiler(_bfs_core, board)


def _dfs_core(board: BloxorzBoard) -> Dict[str, Any]:
    """TODO TV2: LIFO hoặc đệ quy an toàn, chống chu trình; không yêu cầu tối ưu.
    Dùng get_initial_state(), is_goal(), get_successors(); không viết lại luật game.
    Xử lý start=goal, vô nghiệm, dựng lại danh sách hành động và đếm expanded_nodes.
    """
    raise NotImplementedError("DFS: thành viên 2 chưa hoàn thiện thuật toán.")


def solve_dfs(board: BloxorzBoard) -> Dict[str, Any]:
    return run_with_profiler(_dfs_core, board)
