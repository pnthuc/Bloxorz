"""Kiểm tra luật game, API và dữ liệu; mỗi class phụ trách một phần."""

from copy import deepcopy
from dataclasses import FrozenInstanceError, replace
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from game_logic import BloxorzBoard, State, STANDING, HORIZONTAL, VERTICAL, SPLIT
from main import app, serialize_state, deserialize_state
from tests.helpers import ROOT, load_cases, load_levels, read_json, replay_solution


def board_with(tiles=None, switches=None, bridges=()):
    grid = [[1] * 10 for _ in range(10)]
    for (r, c), tile in (tiles or {}).items():
        grid[r][c] = tile
    return BloxorzBoard(
        dict(grid=grid, start_pos=[4, 4], switches=switches or {}, initial_bridges=list(bridges))
    )


class MovementTests(unittest.TestCase):
    def test_all_twelve_roll_transitions(self):
        cases = [
            (STANDING, "UP", 2, 4, VERTICAL),
            (STANDING, "DOWN", 5, 4, VERTICAL),
            (STANDING, "LEFT", 4, 2, HORIZONTAL),
            (STANDING, "RIGHT", 4, 5, HORIZONTAL),
            (HORIZONTAL, "UP", 3, 4, HORIZONTAL),
            (HORIZONTAL, "DOWN", 5, 4, HORIZONTAL),
            (HORIZONTAL, "LEFT", 4, 3, STANDING),
            (HORIZONTAL, "RIGHT", 4, 6, STANDING),
            (VERTICAL, "UP", 3, 4, STANDING),
            (VERTICAL, "DOWN", 6, 4, STANDING),
            (VERTICAL, "LEFT", 4, 3, VERTICAL),
            (VERTICAL, "RIGHT", 4, 5, VERTICAL),
        ]
        board = board_with()
        for orient, action, r, c, end in cases:
            with self.subTest(orient=orient, action=action):
                self.assertEqual(
                    board.apply_move(State(4, 4, orient, ()), action), State(r, c, end, ())
                )

    def test_roll_then_reverse_restores_state(self):
        b = board_with()
        for orient in (STANDING, HORIZONTAL, VERTICAL):
            for action, inverse in [
                ("UP", "DOWN"),
                ("DOWN", "UP"),
                ("LEFT", "RIGHT"),
                ("RIGHT", "LEFT"),
            ]:
                with self.subTest(orient=orient, action=action):
                    st = State(4, 4, orient, ())
                    self.assertEqual(b.apply_move(b.apply_move(st, action), inverse), st)

    def test_void_under_either_half_is_invalid(self):
        for hole in [(4, 5), (4, 6)]:
            with self.subTest(hole=hole):
                self.assertIsNone(
                    board_with({hole: 0}).apply_move(State(4, 4, STANDING, ()), "RIGHT")
                )

    def test_board_edges(self):
        b = board_with()
        self.assertIsNone(b.apply_move(State(0, 0, STANDING, ()), "UP"))
        self.assertIsNone(b.apply_move(State(0, 0, STANDING, ()), "LEFT"))
        self.assertIsNone(b.apply_move(State(9, 9, STANDING, ()), "DOWN"))
        self.assertIsNone(b.apply_move(State(9, 9, STANDING, ()), "RIGHT"))

    def test_fragile_accepts_lying_and_single_cube(self):
        b = board_with({(4, 6): 2})
        self.assertTrue(b.is_valid_state(State(4, 5, HORIZONTAL, ())))
        self.assertTrue(b.is_valid_state(State(4, 6, SPLIT, (), 8, 8)))
        self.assertIsNone(b.apply_move(State(4, 4, HORIZONTAL, ()), "RIGHT"))

    def test_goal_requires_full_upright_block(self):
        b = board_with({(4, 4): 9})
        self.assertTrue(b.is_goal(State(4, 4, STANDING, ())))
        self.assertFalse(b.is_goal(State(4, 4, HORIZONTAL, ())))
        self.assertFalse(b.is_goal(State(4, 4, SPLIT, (), 8, 8)))

    def test_closed_or_missing_bridge_is_not_floor(self):
        b = board_with({(4, 4): 10, (4, 5): 11})
        self.assertFalse(b.is_cell_walkable(4, 4, (False,)))
        self.assertTrue(b.is_cell_walkable(4, 4, (True,)))
        self.assertFalse(b.is_cell_walkable(4, 5, (True,)))

    def test_invalid_action_and_regular_space(self):
        b = board_with()
        st = b.get_initial_state()
        self.assertIsNone(b.apply_move(st, "JUMP"))
        self.assertIsNone(b.apply_move(st, "SPACE"))

    def test_invalid_split_shape(self):
        b = board_with()
        self.assertFalse(b.is_valid_state(State(4, 4, "UNKNOWN", ())))
        self.assertFalse(b.is_valid_state(State(4, 4, SPLIT, (), 4, 4)))
        self.assertFalse(b.is_valid_state(State(4, 4, SPLIT, (), 7, 7, 2)))

    def test_split_moves_only_selected_cube(self):
        b = board_with()
        self.assertEqual(
            b.apply_move(State(2, 2, SPLIT, (), 7, 7, 0), "RIGHT"), State(2, 3, SPLIT, (), 7, 7, 0)
        )
        self.assertEqual(
            b.apply_move(State(2, 2, SPLIT, (), 7, 7, 1), "UP"), State(2, 2, SPLIT, (), 6, 7, 1)
        )

    def test_split_rejoins_in_both_directions(self):
        b = board_with()
        self.assertEqual(
            b.apply_move(State(3, 3, SPLIT, (), 3, 5, 1), "LEFT"), State(3, 3, HORIZONTAL, ())
        )
        self.assertEqual(
            b.apply_move(State(3, 3, SPLIT, (), 5, 3, 0), "DOWN"), State(4, 3, VERTICAL, ())
        )

    def test_state_is_immutable_and_bridge_sensitive(self):
        st = State(2, 2, SPLIT, (True,), 7, 7)
        with self.assertRaises(FrozenInstanceError):
            st.r = 3
        self.assertEqual(len({st, replace(st, bridges=(False,)), replace(st, active_cube=1)}), 3)


class SwitchRegressionTests(unittest.TestCase):
    def setUp(self):
        self.board = board_with(
            {(2, 2): 3}, {"2,2": {"behavior": "toggle", "targets": [0]}}, (False,)
        )

    def test_parked_cube_does_not_retrigger_switch(self):
        # Exact failure in bug.mp4, including either cube being the parked one.
        for parked in (0, 1):
            st = (
                State(2, 2, SPLIT, (True,), 7, 7, 1)
                if parked == 0
                else State(7, 7, SPLIT, (True,), 2, 2, 0)
            )
            for action in ["LEFT", "UP", "RIGHT", "DOWN"]:
                with self.subTest(parked=parked, action=action):
                    st = self.board.apply_move(st, action)
                    self.assertIsNotNone(st)
                    self.assertEqual(st.bridges, (True,))

    def test_space_preserves_switch_and_positions(self):
        st = State(2, 2, SPLIT, (True,), 7, 7, 1)
        changed = self.board.apply_move(st, "SPACE")
        self.assertEqual(changed, replace(st, active_cube=0))
        self.assertEqual(self.board.apply_move(changed, "SPACE"), st)

    def test_leave_stays_latched_reenter_toggles(self):
        st = State(2, 1, SPLIT, (False,), 7, 7)
        on = self.board.apply_move(st, "RIGHT")
        self.assertEqual(on.bridges, (True,))
        off = self.board.apply_move(on, "LEFT")
        self.assertEqual(off.bridges, (True,))
        self.assertEqual(self.board.apply_move(off, "RIGHT").bridges, (False,))
        self.assertEqual(st.bridges, (False,))

    def test_merge_keeps_existing_switch_contact(self):
        st = State(2, 2, SPLIT, (True,), 2, 4, 1)
        self.assertEqual(self.board.apply_move(st, "LEFT"), State(2, 2, HORIZONTAL, (True,)))

    def test_full_block_rolling_over_same_switch_does_not_toggle_twice(self):
        st = State(2, 2, STANDING, (True,))
        # A sideways roll vacates the switch; it remains latched until reentry.
        out = self.board.apply_move(st, "RIGHT")
        self.assertEqual(out.bridges, (True,))
        self.assertEqual(self.board.apply_move(out, "LEFT").bridges, (False,))

    def test_soft_switch_works_with_full_lying_block(self):
        st = State(2, 0, STANDING, (False,))
        self.assertEqual(self.board.apply_move(st, "RIGHT").bridges, (True,))

    def test_open_and_close_are_idempotent(self):
        for behavior, expected in [("open", True), ("close", False)]:
            with self.subTest(behavior=behavior):
                b = board_with(
                    {(2, 2): 3}, {"2,2": {"behavior": behavior, "targets": [0]}}, (not expected,)
                )
                st = State(2, 1, SPLIT, (not expected,), 7, 7)
                for _ in range(2):
                    st = b.apply_move(st, "RIGHT")
                    self.assertEqual(st.bridges, (expected,))
                    st = b.apply_move(st, "LEFT")
                    self.assertEqual(st.bridges, (expected,))

    def test_heavy_switch_requires_full_standing_block(self):
        b = board_with({(2, 2): 4}, {"2,2": {"behavior": "toggle", "targets": [0]}}, (False,))
        self.assertEqual(b.apply_move(State(2, 0, STANDING, (False,)), "RIGHT").bridges, (False,))
        self.assertEqual(
            b.apply_move(State(2, 1, SPLIT, (False,), 7, 7), "RIGHT").bridges, (False,)
        )
        self.assertEqual(b.apply_move(State(2, 0, HORIZONTAL, (False,)), "RIGHT").bridges, (True,))

    def test_two_switches_control_separate_bridges(self):
        b = board_with(
            {(2, 2): 3, (7, 7): 3},
            {
                "2,2": {"behavior": "toggle", "targets": [0]},
                "7,7": {"behavior": "toggle", "targets": [1]},
            },
            (False, False),
        )
        st = b.apply_move(State(2, 1, SPLIT, (False, False), 7, 6), "RIGHT")
        self.assertEqual(st.bridges, (True, False))
        st = b.apply_move(b.apply_move(st, "SPACE"), "RIGHT")
        self.assertEqual(st.bridges, (True, True))

    def test_closing_bridge_under_other_cube_falls(self):
        b = board_with(
            {(2, 2): 3, (7, 7): 10}, {"2,2": {"behavior": "close", "targets": [0]}}, (True,)
        )
        self.assertIsNone(b.apply_move(State(2, 1, SPLIT, (True,), 7, 7), "RIGHT"))

    def test_held_switch_does_not_reopen_bridge_closed_elsewhere(self):
        b = board_with(
            {(2, 2): 3, (7, 7): 3},
            {
                "2,2": {"behavior": "toggle", "targets": [0]},
                "7,7": {"behavior": "close", "targets": [0]},
            },
            (True,),
        )
        st = b.apply_move(State(2, 2, SPLIT, (True,), 7, 6, 1), "RIGHT")
        self.assertEqual(st.bridges, (False,))
        self.assertEqual(b.apply_move(st, "LEFT").bridges, (False,))

    def test_split_teleport_and_landing_switch_press_once(self):
        b = board_with(
            {(2, 2): 5, (5, 5): 3},
            {
                "2,2": {"behavior": "split", "targets": [[5, 5], [8, 8]]},
                "5,5": {"behavior": "toggle", "targets": [0]},
            },
            (False,),
        )
        st = b.apply_move(State(2, 0, HORIZONTAL, (False,)), "RIGHT")
        self.assertEqual(st, State(5, 5, SPLIT, (True,), 8, 8))
        st = b.apply_move(b.apply_move(st, "SPACE"), "LEFT")
        self.assertEqual(st.bridges, (True,))

    def test_split_switch_ignores_lying_block(self):
        b = board_with({(2, 2): 5}, {"2,2": {"behavior": "split", "targets": [[5, 5], [8, 8]]}})
        self.assertEqual(
            b.apply_move(State(2, 0, STANDING, ()), "RIGHT"), State(2, 1, HORIZONTAL, ())
        )

    def test_split_into_void_is_invalid(self):
        b = board_with(
            {(2, 2): 5, (8, 8): 0}, {"2,2": {"behavior": "split", "targets": [[5, 5], [8, 8]]}}
        )
        self.assertIsNone(b.apply_move(State(2, 0, HORIZONTAL, ()), "RIGHT"))

    def test_video_stage4_sequence(self):
        b = next(case for case in load_cases() if case.id == "4").make_board()
        st = b.get_initial_state()
        for action in ["RIGHT", "RIGHT", "RIGHT", "RIGHT"]:
            st = b.apply_move(st, action)
            self.assertIsNotNone(st)
        self.assertEqual((st.r, st.c), (0, 6))
        self.assertEqual(st.bridges, (True,))
        for action in ["SPACE", "LEFT", "RIGHT", "UP"]:
            st = b.apply_move(st, action)
            self.assertIsNotNone(st)
            self.assertEqual(st.bridges, (True,))
            self.assertEqual((st.r, st.c), (0, 6))


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cases = {case.id: case for case in load_cases() if case.id == case.level_id}
        cls.levels = {case_id: case.level for case_id, case in cls.cases.items()}
        cls.client = app.test_client()

    def test_state_serialization_round_trip(self):
        for state in (State(2, 2, STANDING, (False, True)), State(2, 2, SPLIT, (True,), 7, 7, 1)):
            with self.subTest(state=state):
                self.assertEqual(deserialize_state(serialize_state(state)), state)

    def test_api_level_catalog_and_each_level(self):
        response = self.client.get("/api/levels")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json), len(self.levels))
        self.assertEqual(set(response.json), set(self.levels))
        self.assertEqual(response.json["12"]["display_name"], "Hành trình liên hoàn")
        for id in self.levels:
            with self.subTest(level=id):
                data = self.client.get("/api/level/" + id).json
                self.assertEqual(str(data["level"]["id"]), id)
                self.assertEqual(data["level"], self.levels[id])
                self.assertEqual(data["initial_state"]["orientation"], STANDING)

    def test_api_video_bridge_regression(self):
        state = self.client.get("/api/level/4").json["initial_state"]
        actions = ["RIGHT", "RIGHT", "RIGHT", "RIGHT", "SPACE", "LEFT", "RIGHT", "UP"]
        for i, action in enumerate(actions):
            data = self.client.post(
                "/api/move", json=dict(level_id="4", state=state, action=action)
            ).json
            self.assertTrue(data["valid"], action)
            state = data["next_state"]
            if i >= 3:
                self.assertEqual(state["bridges"], [True])

    def test_api_replay_every_level_without_solver(self):
        for id in self.levels:
            with self.subTest(level=id):
                state = self.client.get("/api/level/" + id).json["initial_state"]
                for action in self.cases[id].walkthrough or []:
                    data = self.client.post(
                        "/api/move", json=dict(level_id=id, state=state, action=action)
                    ).json
                    self.assertTrue(data["valid"])
                    state = data["next_state"]
                self.assertEqual(
                    BloxorzBoard(self.levels[id]).is_goal(deserialize_state(state)),
                    self.cases[id].solvable,
                )

    def test_pending_solver_is_explicit_501(self):
        with patch("main.solve_bfs", side_effect=NotImplementedError("BFS TODO")):
            res = self.client.post("/api/solve", json=dict(level_id="1", solver="bfs"))
        self.assertEqual(res.status_code, 501)
        self.assertEqual(res.json["code"], "SOLVER_NOT_IMPLEMENTED")

    def test_video2_failed_move_retains_closed_bridge(self):
        state = self.client.get("/api/level/11").json["initial_state"]
        for action in ["RIGHT", "DOWN", "RIGHT"]:
            data = self.client.post(
                "/api/move", json=dict(level_id="11", state=state, action=action)
            ).json
            self.assertTrue(data["valid"])
            state = data["next_state"]
        data = self.client.post(
            "/api/move", json=dict(level_id="11", state=state, action="RIGHT")
        ).json
        self.assertFalse(data["valid"])
        self.assertEqual(data["failure_reason"], "bridge_closed")
        self.assertEqual(data["failure_state"]["bridges"], [False, False])
        b = BloxorzBoard(self.levels["11"])
        original = deserialize_state(state)
        self.assertIsNone(b.apply_move(original, "RIGHT"))
        self.assertNotIn("RIGHT", [a for a, st in b.get_successors(original)])
        self.assertEqual(original.bridges, (True, False))

    def test_api_invalid_move_and_unknown_solver(self):
        state = self.client.get("/api/level/1").json["initial_state"]
        self.assertFalse(
            self.client.post("/api/move", json=dict(level_id="1", state=state, action="UP")).json[
                "valid"
            ]
        )
        self.assertEqual(
            self.client.post("/api/solve", json=dict(level_id="1", solver="unknown")).status_code,
            400,
        )

    def test_local_assets_and_fonts_are_served(self):
        for asset in [
            "css/app.css",
            "js/scene.js",
            "js/materials.js",
            "js/game.js",
            "vendor/three.min.js",
            "fonts/BeVietnamPro-Regular.ttf",
            "fonts/BeVietnamPro-SemiBold.ttf",
            "fonts/OFL.txt",
        ]:
            with self.subTest(asset=asset):
                with self.client.get("/static/" + asset) as response:
                    self.assertEqual(response.status_code, 200)
                    self.assertGreater(len(response.data), 100)
        self.assertEqual(self.client.get("/").status_code, 200)


class CaseDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cases = load_cases()
        cls.levels = load_levels()

    def test_canonical_cases_cover_every_game_level(self):
        canonical = {case.id for case in self.cases if case.id == case.level_id}
        self.assertEqual(canonical, set(load_levels()))
        self.assertEqual(len({case.id for case in self.cases}), len(self.cases))

    def test_boards_and_switch_targets(self):
        for case in self.cases:
            with self.subTest(case=case.id):
                board = case.make_board()
                self.assertTrue(all(len(row) == board.cols for row in board.grid))
                self.assertEqual(sum(row.count(9) for row in board.grid), 1)
                self.assertTrue(board.is_valid_state(board.get_initial_state()))
                for r, row in enumerate(board.grid):
                    for c, tile in enumerate(row):
                        if tile >= 10:
                            self.assertLess(tile - 10, len(board.initial_bridges))
                        if tile in (3, 4, 5):
                            self.assertIn(f"{r},{c}", board.switches)
                for key, switch in board.switches.items():
                    r, c = map(int, key.split(","))
                    self.assertIn(board.grid[r][c], (3, 4, 5))
                    if switch["behavior"] == "split":
                        self.assertEqual(len(switch["targets"]), 2)
                        for rr, cc in switch["targets"]:
                            self.assertTrue(board.is_cell_walkable(rr, cc, board.initial_bridges))
                    else:
                        self.assertIn(switch["behavior"], ("toggle", "open", "close"))
                        for target in switch["targets"]:
                            self.assertTrue(0 <= target < len(board.initial_bridges))

    def test_all_reference_walks_reach_goals_and_match_recorded_cost(self):
        for case in self.cases:
            with self.subTest(case=case.id):
                if not case.solvable:
                    self.assertIsNone(case.walkthrough)
                    continue
                replay = replay_solution(case.make_board(), case.walkthrough)
                self.assertTrue(replay.valid, replay.reason)
                self.assertEqual(sum(1 for m in case.walkthrough if m != "SPACE"), case.bfs_moves)
                self.assertAlmostEqual(replay.cost, case.walkthrough_cost)
                self.assertGreaterEqual(replay.cost, case.ucs_cost)
                self.assertTrue(set(case.visits) <= replay.visited, (case.visits, replay.visited))

    def test_loader_rejects_missing_maps_and_bad_expectations(self):
        raw = read_json(ROOT / "tests" / "test_cases.json")
        broken = deepcopy(raw)
        del broken["33"]
        with patch("tests.helpers.read_json", return_value=broken):
            with patch("tests.helpers.load_levels", return_value=self.levels):
                with self.assertRaisesRegex(AssertionError, "thiếu map"):
                    load_cases()
        for field, value in (
            ("solvable", 1),
            ("bfs_moves", None),
            ("ucs_cost", -1),
            ("walkthrough", ["JUMP"]),
            ("walkthrough_cost", 0),
        ):
            broken = deepcopy(raw)
            broken["T5"][field] = value
            with self.subTest(field=field), patch("tests.helpers.read_json", return_value=broken):
                with patch("tests.helpers.load_levels", return_value=self.levels):
                    with self.assertRaises(AssertionError):
                        load_cases()

    def test_loader_rejects_ambiguous_sources_and_duplicate_json_keys(self):
        raw = read_json(ROOT / "tests" / "test_cases.json")
        broken = deepcopy(raw)
        broken["T5"]["level"] = "1"
        with patch("tests.helpers.read_json", return_value=broken):
            with patch("tests.helpers.load_levels", return_value=self.levels):
                with self.assertRaisesRegex(AssertionError, "đúng một nguồn"):
                    load_cases()
        with TemporaryDirectory() as folder:
            path = Path(folder) / "duplicate.json"
            path.write_text('{"T1": {}, "T1": {}}', encoding="utf-8")
            with self.assertRaisesRegex(AssertionError, "key trùng"):
                read_json(path)


if __name__ == "__main__":
    unittest.main()
