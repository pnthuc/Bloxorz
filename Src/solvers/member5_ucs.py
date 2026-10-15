"""Thành viên 5: tự cài đặt phần TODO; xem Giao_viec_Bloxorz.pdf.
Không thay chữ ký solve_* hoặc schema kết quả. Không dùng walkthroughs để giải.
Core trả found, moves, expanded_nodes, total_cost; wrapper đo thời gian/bộ nhớ.
"""
from typing import Any, Dict
from game_logic import BloxorzBoard, State
from .base import run_with_profiler
from .costs import step_cost


def _ucs_core(board: BloxorzBoard) -> Dict[str, Any]:
    """TODO TV3: Ưu tiên g nhỏ nhất, cập nhật đường tốt hơn và bỏ entry lỗi thời.
    Dùng get_initial_state(), is_goal(), get_successors(); không viết lại luật game.
    Xử lý start=goal, vô nghiệm, dựng lại danh sách hành động và đếm expanded_nodes.
    """
    raise NotImplementedError("UCS: thành viên 3 chưa hoàn thiện thuật toán.")


def solve_ucs(board: BloxorzBoard) -> Dict[str, Any]:
    return run_with_profiler(_ucs_core, board)
