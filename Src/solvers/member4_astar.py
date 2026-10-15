"""Thành viên 4: tự cài đặt phần TODO; xem Giao_viec_Bloxorz.pdf.
Không thay chữ ký solve_* hoặc schema kết quả. Không dùng walkthroughs để giải.
Core trả found, moves, expanded_nodes, total_cost; wrapper đo thời gian/bộ nhớ.
"""
from typing import Any, Dict
from game_logic import BloxorzBoard, State
from .base import run_with_profiler
from .costs import step_cost


def heuristic(board: BloxorzBoard, state: State, goal_pos: tuple[int, int]) -> float:
    """TODO: cận dưới chi phí còn lại; giải thích admissibility/consistency.
    Phải xét hướng khối, cost chung và khả năng dịch chuyển bởi split switch.
    Không cộng phạt hướng một cách tùy tiện làm heuristic vượt chi phí thật.
    """
    raise NotImplementedError("A*: thành viên 4 chưa cài đặt heuristic.")


def _astar_core(board: BloxorzBoard) -> Dict[str, Any]:
    """TODO TV4: Ưu tiên g+h, cập nhật g tốt hơn; heuristic hợp lệ cả khi tách khối.
    Dùng get_initial_state(), is_goal(), get_successors(); không viết lại luật game.
    Xử lý start=goal, vô nghiệm, dựng lại danh sách hành động và đếm expanded_nodes.
    """
    raise NotImplementedError("A*: thành viên 4 chưa hoàn thiện thuật toán.")


def solve_astar(board: BloxorzBoard) -> Dict[str, Any]:
    return run_with_profiler(_astar_core, board)
