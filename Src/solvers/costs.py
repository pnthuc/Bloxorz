"""Chi phí chung cho UCS và A*: 1 + 0.5 cho mỗi ô cam ở trạng thái đến.

Mỗi cạnh là một bước lăn, kể cả đổi khối rồi lăn (SUP/SLEFT/SRIGHT/SDOWN).
SPACE chọn khối miễn phí khi chơi tay và không sinh cạnh tìm kiếm.
"""
from core.board import BloxorzBoard, State

def step_cost(board: BloxorzBoard, next_state: State) -> float:
    return 1 + 0.5 * (sum(board.grid[r][c] == 2 for r, c in next_state.get_occupied_cells()))
