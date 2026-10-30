"""Replay and validate a solution using the shared engine and cost policy."""
from dataclasses import dataclass
from typing import Any, FrozenSet, List, Tuple

from core.board import BloxorzBoard, State, SEARCH_ACTIONS
from solvers.costs import step_cost

ACTIONS = set(SEARCH_ACTIONS)


@dataclass(frozen=True)
class Replay:
    valid: bool
    reason: str
    cost: float
    state: State
    visited: FrozenSet[Any]


def replay_solution(board: BloxorzBoard, moves: List[str]) -> Replay:
    state = board.get_initial_state()
    cost = 0.0
    visited = {state.orientation}
    visited.update(board.grid[r][c] for r, c in state.get_occupied_cells())
    for index, action in enumerate(moves, start=1):
        if not isinstance(action, str) or action not in ACTIONS:
            return Replay(
                False,
                f"Hành động thứ {index} không hợp lệ: {action!r}",
                cost,
                state,
                frozenset(visited),
            )
        child = board.apply_move(state, action)
        if child is None:
            return Replay(
                False,
                f"Bước thứ {index} ({action}) vi phạm luật bàn chơi",
                cost,
                state,
                frozenset(visited),
            )
        cost += step_cost(board, child)
        state = child
        visited.add(state.orientation)
        visited.update(board.grid[r][c] for r, c in state.get_occupied_cells())
    valid = board.is_goal(state)
    reason = "Hợp lệ" if valid else f"Đi hết {len(moves)} hành động nhưng chưa tới GOAL"
    return Replay(valid, reason, cost, state, frozenset(visited))


def verify_solution_walk(board: BloxorzBoard, moves: List[str]) -> Tuple[bool, str, float]:
    result = replay_solution(board, moves)
    return result.valid, result.reason, result.cost
