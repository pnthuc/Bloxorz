"""Chi phí chung cho UCS và A*: 10 trừ số hành động hợp lệ ở trạng thái đến.

SPACE cũng được tính khi khối đang tách. Engine có tối đa 5 hành động,
nên chi phí nằm trong [5, 10]; trạng thái càng nhiều lựa chọn càng rẻ.
"""
from game_logic import BloxorzBoard, State


def step_cost(board: BloxorzBoard, next_state: State) -> float:
    return 1 + 0.5 * (sum(board.grid[r][c] == 2 for r, c in next_state.get_occupied_cells()))
