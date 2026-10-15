# Source/game_logic.py
from dataclasses import dataclass
from typing import Tuple, List, Dict, Optional

# Các hướng của khối (Block Orientations)
STANDING = "STANDING"         # Đứng thẳng: chiếm 1 ô (r, c)
HORIZONTAL = "HORIZONTAL"     # Nằm ngang: chiếm 2 ô (r, c) và (r, c+1)
VERTICAL = "VERTICAL"         # Nằm dọc: chiếm 2 ô (r, c) và (r+1, c)
SPLIT = "SPLIT"               # Tách đôi thành 2 khối 1x1x1 tại (r, c) và (r2, c2)

# Mã các loại ô trên bàn cờ (Tile Types)
VOID = 0          # Ô trống (rơi xuống vực)
FLOOR = 1         # Ô sàn đá thường
FRAGILE = 2       # Ô gạch cam dễ vỡ (không được đứng thẳng)
SOFT_SWITCH = 3   # Công tắc nhẹ hình bát giác (chạm bất kỳ là kích hoạt)
HEAVY_SWITCH = 4  # Công tắc nặng hình chữ X (phải đứng thẳng mới kích hoạt)
SPLIT_SWITCH = 5  # Công tắc phân tách hình () (đứng thẳng sẽ tách thành 2 khối đơn)
GOAL = 9          # Ô lỗ đích (phải đứng thẳng ở đây mới thắng)
BRIDGE_BASE = 10  # Mã từ 10 trở lên đại diện cho các cây cầu (10: Cầu 0, 11: Cầu 1,...)


@dataclass(frozen=True)
class State:
    """
    Trạng thái của bài toán tìm kiếm (Immutable & Hashable).
    Bao gồm vị trí, hướng khối và trạng thái Đóng/Mở của mọi cây cầu.
    """
    r: int
    c: int
    orientation: str
    bridges: Tuple[bool, ...]  # True = Mở, False = Đóng
    r2: int = -1               # Tọa độ khối đơn thứ 2 (khi orientation == SPLIT)
    c2: int = -1
    active_cube: int = 0       # Khối đơn đang được điều khiển: 0 hoặc 1

    def get_occupied_cells(self) -> List[Tuple[int, int]]:
        if self.orientation == STANDING:
            return [(self.r, self.c)]
        elif self.orientation == HORIZONTAL:
            return [(self.r, self.c), (self.r, self.c + 1)]
        elif self.orientation == VERTICAL:
            return [(self.r, self.c), (self.r + 1, self.c)]
        elif self.orientation == SPLIT:
            return [(self.r, self.c), (self.r2, self.c2)]
        return []


class BloxorzBoard:
    def __init__(self, level_data: Dict):
        self.id = level_data.get("id", "1")
        self.name = level_data.get("name", "Stage")
        self.difficulty = level_data.get("difficulty", "Normal")
        self.grid: List[List[int]] = level_data["grid"]
        self.rows = len(self.grid)
        self.cols = len(self.grid[0])
        self.start_pos = tuple(level_data["start_pos"])
        self.initial_bridges = tuple(level_data.get("initial_bridges", []))
        self.switches: Dict[str, Dict] = level_data.get("switches", {})

    def get_initial_state(self) -> State:
        return State(
            r=self.start_pos[0],
            c=self.start_pos[1],
            orientation=STANDING,
            bridges=self.initial_bridges
        )

    def is_goal(self, state: State) -> bool:
        """Thắng khi khối đứng thẳng (STANDING) ngay tại ô lỗ đích (GOAL)."""
        return state.orientation == STANDING and self.grid[state.r][state.c] == GOAL

    def is_cell_walkable(self, r: int, c: int, bridges: Tuple[bool, ...]) -> bool:
        if r < 0 or r >= self.rows or c < 0 or c >= self.cols:
            return False
        tile = self.grid[r][c]
        if tile == VOID:
            return False
        if tile >= BRIDGE_BASE:
            bridge_idx = tile - BRIDGE_BASE
            if bridge_idx >= len(bridges) or not bridges[bridge_idx]:
                return False
        return True

    def is_valid_state(self, state: State) -> bool:
        """Kiểm tra khối có nằm hoàn toàn trên sàn hợp lệ và không làm vỡ gạch cam không."""
        if state.orientation not in (STANDING, HORIZONTAL, VERTICAL, SPLIT):
            return False
        if state.orientation == SPLIT:
            if state.active_cube not in (0, 1) or (state.r, state.c) == (state.r2, state.c2):
                return False
        for (r, c) in state.get_occupied_cells():
            if not self.is_cell_walkable(r, c, state.bridges):
                return False
        # Khối đứng thẳng trên ô gạch cam dễ vỡ (FRAGILE) sẽ làm gạch vỡ và rơi xuống
        if state.orientation == STANDING and self.grid[state.r][state.c] == FRAGILE:
            return False
        return True

    def apply_move(self, state: State, action: str) -> Optional[State]:
        """Solver API: chỉ trả trạng thái hợp lệ; nước đi thua trả None."""
        result = self.evaluate_move(state, action)
        return result["state"] if result["valid"] else None

    def evaluate_move(self, state: State, action: str) -> dict:
        """Gameplay API: giữ cả hậu quả switch của nước đi thua để diễn hoạt.

        Trạng thái thua tuyệt đối không được đưa vào get_successors().
        """
        candidate = self._move_candidate(state, action)
        if candidate is None:
            return {"valid": False, "state": None, "failure_reason": "unsupported"}
        if not self.is_valid_state(candidate):
            reason = "bridge_closed" if any(old and not new for old, new in zip(state.bridges, candidate.bridges)) else "unsupported"
            return {"valid": False, "state": candidate, "failure_reason": reason}
        return {"valid": True, "state": candidate, "failure_reason": None}

    def _move_candidate(self, state: State, action: str) -> Optional[State]:
        """
        Thực hiện hành động: 'UP', 'DOWN', 'LEFT', 'RIGHT', hoặc 'SPACE' (đổi khối đơn).
        Trả ứng viên sau hiệu ứng switch; evaluate_move quyết định còn được đỡ hay không.
        Trả None nếu ngay phép lăn đã không hợp lệ.
        """
        if action == "SPACE":
            if state.orientation == SPLIT:
                return State(
                    state.r, state.c, SPLIT, state.bridges,
                    state.r2, state.c2, 1 - state.active_cube
                )
            return None

        dr_map = {"UP": -1, "DOWN": 1, "LEFT": 0, "RIGHT": 0}
        dc_map = {"UP": 0, "DOWN": 0, "LEFT": -1, "RIGHT": 1}
        if action not in dr_map:
            return None

        r, c, orient = state.r, state.c, state.orientation
        r2, c2, active = state.r2, state.c2, state.active_cube

        # Bảng chuyển trạng thái hướng khối (Orientation Transition Table)
        if orient == STANDING:
            if action == "UP":
                nr, nc, norient = r - 2, c, VERTICAL
            elif action == "DOWN":
                nr, nc, norient = r + 1, c, VERTICAL
            elif action == "LEFT":
                nr, nc, norient = r, c - 2, HORIZONTAL
            elif action == "RIGHT":
                nr, nc, norient = r, c + 1, HORIZONTAL

        elif orient == HORIZONTAL:
            if action == "UP":
                nr, nc, norient = r - 1, c, HORIZONTAL
            elif action == "DOWN":
                nr, nc, norient = r + 1, c, HORIZONTAL
            elif action == "LEFT":
                nr, nc, norient = r, c - 1, STANDING
            elif action == "RIGHT":
                nr, nc, norient = r, c + 2, STANDING

        elif orient == VERTICAL:
            if action == "UP":
                nr, nc, norient = r - 1, c, STANDING
            elif action == "DOWN":
                nr, nc, norient = r + 2, c, STANDING
            elif action == "LEFT":
                nr, nc, norient = r, c - 1, VERTICAL
            elif action == "RIGHT":
                nr, nc, norient = r, c + 1, VERTICAL

        elif orient == SPLIT:
            dr, dc = dr_map[action], dc_map[action]
            if active == 0:
                nr, nc, nr2, nc2 = r + dr, c + dc, r2, c2
            else:
                nr, nc, nr2, nc2 = r, c, r2 + dr, c2 + dc
            norient = SPLIT

            # Nếu 2 khối đơn 1x1x1 nằm sát cạnh nhau thì tự động nhập lại thành khối 1x1x2
            if nr == nr2 and abs(nc - nc2) == 1:
                norient = HORIZONTAL
                nc = min(nc, nc2)
                nr2, nc2, active = -1, -1, 0
            elif nc == nc2 and abs(nr - nr2) == 1:
                norient = VERTICAL
                nr = min(nr, nr2)
                nr2, nc2, active = -1, -1, 0

            temp_state = State(nr, nc, norient, state.bridges, nr2, nc2, active)
            if not self.is_valid_state(temp_state):
                return None
            return self._trigger_switches(temp_state, state)

        temp_state = State(nr, nc, norient, state.bridges)
        if not self.is_valid_state(temp_state):
            return None
        return self._trigger_switches(temp_state, state)

    def _pressed_switches(self, state: State) -> set:
        """Các công tắc đủ điều kiện nhấn trong một trạng thái.

        Áp lực được suy ra từ vị trí/hướng, không cần thêm lịch sử vào State.
        Một khối đơn đứng yên trên soft switch vẫn giữ tiếp xúc khi khối kia đi.
        """
        pressed = set()
        for r, c in state.get_occupied_cells():
            if not (0 <= r < self.rows and 0 <= c < self.cols):
                continue
            key = f"{r},{c}"
            tile = self.grid[r][c]
            if key in self.switches and (
                tile == SOFT_SWITCH or
                (tile in (HEAVY_SWITCH, SPLIT_SWITCH) and state.orientation == STANDING)
            ):
                pressed.add(key)
        return pressed

    def _trigger_switches(self, state: State, previous: State) -> Optional[State]:
        """Chỉ kích hoạt ở cạnh nhấn: chưa bị đè -> vừa bị đè.

        Giữ khối trên switch, đổi khối bằng Space, hoặc di chuyển khối còn lại
        không phải là một lần nhấn mới. Rời rồi quay lại mới toggle lần nữa.
        """
        bridges = list(state.bridges)
        r, c, orient = state.r, state.c, state.orientation
        r2, c2, active = state.r2, state.c2, state.active_cube
        newly_pressed = self._pressed_switches(state) - self._pressed_switches(previous)
        teleported = False

        for key in sorted(newly_pressed):
            cell_r, cell_c = map(int, key.split(','))
            tile = self.grid[cell_r][cell_c]
            sw = self.switches[key]

            if tile == SOFT_SWITCH:
                self._apply_bridge_effect(bridges, sw)
            elif tile == HEAVY_SWITCH and orient == STANDING:
                self._apply_bridge_effect(bridges, sw)
            elif tile == SPLIT_SWITCH and orient == STANDING:
                p1, p2 = sw["targets"]
                r, c = p1[0], p1[1]
                r2, c2 = p2[0], p2[1]
                orient = SPLIT
                active = 0
                teleported = True

        final_state = State(r, c, orient, tuple(bridges), r2, c2, active)
        if teleported:
            # Landing on a soft switch after teleporting is a new physical press.
            for key in sorted(self._pressed_switches(final_state)):
                self._apply_bridge_effect(bridges, self.switches[key])
            final_state = State(r, c, orient, tuple(bridges), r2, c2, active)
        return final_state

    def _apply_bridge_effect(self, bridges: List[bool], sw: Dict):
        behavior = sw.get("behavior", "toggle")
        for b_idx in sw.get("targets", []):
            if behavior == "toggle":
                bridges[b_idx] = not bridges[b_idx]
            elif behavior == "open":
                bridges[b_idx] = True
            elif behavior == "close":
                bridges[b_idx] = False

    def get_successors(self, state: State) -> List[Tuple[str, State]]:
        """Trả về danh sách các cặp (action, next_state) hợp lệ từ state hiện tại."""
        actions = ["UP", "DOWN", "LEFT", "RIGHT"]
        if state.orientation == SPLIT:
            actions.append("SPACE")
        results = []
        for act in actions:
            nxt = self.apply_move(state, act)
            if nxt is not None:
                results.append((act, nxt))
        return results
