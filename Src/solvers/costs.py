from game_logic import BloxorzBoard, State

def step_cost(board: BloxorzBoard, next_state: State) -> float:
    return 1 + 0.5 * (sum(board.grid[r][c] == 2 for r, c in next_state.get_occupied_cells()))
