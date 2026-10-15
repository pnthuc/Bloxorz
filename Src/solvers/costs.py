"""Chi phí chung do bộ khung cung cấp. UCS và A* phải dùng cùng hàm này.
Mỗi hành động (kể cả SPACE) tốn 1, cộng 2 cho mỗi ô FRAGILE ở trạng thái đến.
Đổi công thức phải được cả nhóm thống nhất và cập nhật các mốc test.
"""
from game_logic import BloxorzBoard, State, FRAGILE


def step_cost(board: BloxorzBoard, current_state: State, action: str, next_state: State) -> float:
    return float(1 + 2 * sum(board.grid[r][c] == FRAGILE for r, c in next_state.get_occupied_cells()))
