import sys; from pathlib import Path
_ROOT_PARENT = Path(__file__).resolve().parents[2]
if str(_ROOT_PARENT) not in sys.path: sys.path.insert(0, str(_ROOT_PARENT))
import json
from core.levels import load_all_levels
from handoff.quan.generate_level_groups import level_groups
"""Kiểm tra luật game, API và dữ liệu; mỗi class phụ trách một phần."""

from copy import deepcopy
from dataclasses import FrozenInstanceError, replace
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from core.board import BloxorzBoard, State, STANDING, HORIZONTAL, VERTICAL, SPLIT
from web.app import app, serialize_state, deserialize_state
from tests.helpers import ROOT, load_cases, load_levels, read_json
from core.replay import replay_solution


def board_with(tiles=None, switches=None, bridges=()):
    grid = [[1] * 10 for _ in range(10)]
    for (r, c), tile in (tiles or {}).items():
        grid[r][c] = tile
    return BloxorzBoard(
        dict(grid=grid, start_pos=[4, 4], switches=switches or {}, initial_bridges=list(bridges))
    )


class CompoundMoveTests(unittest.TestCase):
    def test_eight_successors_and_both_selected_cubes(self):
        b = board_with()
        for active in (0, 1):
            st = State(2, 2, SPLIT, (), 7, 7, active)
            successors = dict(b.get_successors(st))
            self.assertEqual(set(successors), {
                "UP", "LEFT", "RIGHT", "DOWN", "SUP", "SLEFT", "SRIGHT", "SDOWN"
            })
            for direction in ("UP", "LEFT", "RIGHT", "DOWN"):
                selected = b.apply_move(st, "SPACE")
                self.assertEqual(successors["S" + direction], b.apply_move(selected, direction))
                self.assertEqual(successors["S" + direction].active_cube, 1 - active)

    def test_compound_moves_require_split(self):
        for orient in (STANDING, HORIZONTAL, VERTICAL):
            st = State(4, 4, orient, ())
            for action in ("SUP", "SLEFT", "SRIGHT", "SDOWN"):
                self.assertIsNone(board_with().apply_move(st, action))
            self.assertFalse(any(a.startswith("S") for a, _ in board_with().get_successors(st)))

    def test_compound_merge_and_failed_move(self):
        b = board_with()
        st = State(3, 3, SPLIT, (), 3, 5)
        self.assertEqual(b.apply_move(st, "SLEFT"), State(3, 3, HORIZONTAL, ()))
        st = State(3, 3, SPLIT, (), 0, 0)
        self.assertIsNone(b.apply_move(st, "SUP"))
        self.assertEqual(st.active_cube, 0)

    def test_selection_does_not_repress_parked_switch(self):
        b = board_with({(2, 2): 3}, {"2,2": {"targets": [0]}}, (True,))
        st = State(2, 2, SPLIT, (True,), 7, 7)
        self.assertEqual(b.apply_move(st, "SUP").bridges, (True,))


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
        self.assertEqual({key: value["name"] for key, value in response.json.items()},
                         {key: value["name"] for key, value in self.levels.items()})
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
        with patch("web.app.solve_bfs", side_effect=NotImplementedError("BFS TODO")):
            res = self.client.post("/api/solve", json=dict(level_id="1", solver="bfs"))
        self.assertEqual(res.status_code, 501)
        self.assertEqual(res.json["code"], "SOLVER_NOT_IMPLEMENTED")

    def test_real_solver_api_answers_replay_to_goal(self):
        for level_id in ("1", "3", "4"):
            for solver in ("bfs", "dfs", "ucs", "astar"):
                with self.subTest(level=level_id, solver=solver):
                    response = self.client.post("/api/solve", json={
                        "level_id": level_id, "solver": solver})
                    self.assertEqual(response.status_code, 200)
                    self.assertTrue(response.json["found"])
                    state = self.client.get("/api/level/" + level_id).json["initial_state"]
                    for action in response.json["moves"]:
                        move = self.client.post("/api/move", json={
                            "level_id": level_id, "state": state, "action": action}).json
                        self.assertTrue(move["valid"])
                        state = move["next_state"]
                    self.assertTrue(BloxorzBoard(self.levels[level_id]).is_goal(
                        deserialize_state(state)))

    def test_switch_closes_bridge_under_block(self):
        fixture = {
            "id": "fixture",
            "grid": [
                [1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1],
                [1, 1, 10, 3, 1]
            ],
            "start_pos": [0, 0],
            "initial_bridges": [True],
            "switches": {"2,3": {"behavior": "close", "targets": [0]}}
        }
        state = serialize_state(State(2, 1, STANDING, (True,)))
        with patch("web.app.load_all_levels", return_value={"fixture": fixture}):
            data = self.client.post("/api/move", json=dict(
                level_id="fixture", state=state, action="RIGHT")).json
        self.assertFalse(data["valid"])
        self.assertEqual(data["failure_reason"], "bridge_closed")
        self.assertEqual(data["failure_state"]["bridges"], [False])
        board = BloxorzBoard(fixture)
        original = deserialize_state(state)
        self.assertIsNone(board.apply_move(original, "RIGHT"))
        self.assertNotIn("RIGHT", [a for a, _ in board.get_successors(original)])
        self.assertEqual(original.bridges, (True,))

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
                self.assertEqual(len(case.walkthrough), case.bfs_moves)
                self.assertAlmostEqual(replay.cost, case.walkthrough_cost)
                self.assertGreaterEqual(replay.cost, case.ucs_cost)
                self.assertTrue(set(case.visits) <= replay.visited, (case.visits, replay.visited))

    def test_loader_rejects_missing_maps_and_bad_expectations(self):
        raw = read_json(ROOT / "tests" / "test_cases.json")
        broken = deepcopy(raw)
        del broken[next(iter(self.levels))]
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




class LevelCatalogTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_discovery_add_remove_and_noncontiguous_ids(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertEqual(load_all_levels(root), {})
            for lid in ('42', '2', 'bonus'):
                (root / f'{lid}.json').write_text(json.dumps(dict(id=lid, name=lid,
                    grid=[[1, 1, 1, 9]], start_pos=[0, 0])), encoding='utf-8')
            self.assertEqual(list(load_all_levels(root)), ['2', '42', 'bonus'])
            (root / '2.json').unlink()
            self.assertEqual(list(load_all_levels(root)), ['42', 'bonus'])
            with patch('web.app.load_all_levels', return_value=load_all_levels(root)):
                client = self.client
                self.assertEqual(set(client.get('/api/levels').json), {'42', 'bonus'})
                self.assertEqual(client.get('/api/level/2').status_code, 404)
                self.assertEqual(client.get('/api/level/42').json['level']['name'], '42')
                result = client.post('/api/solve', json={'solver': 'bfs'})
                self.assertTrue(result.json['found'])

    def test_empty_catalog_has_no_old_fallback(self):
        with patch('web.app.load_all_levels', return_value={}):
            client = self.client
            self.assertEqual(client.get('/api/levels').json, {})
            self.assertEqual(client.get('/api/level/1').status_code, 404)
            self.assertEqual(client.post('/api/solve', json={}).status_code, 404)

    def test_duplicate_or_invalid_files_fail_explicitly(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ('one', 'two'):
                (root / f'{name}.json').write_text('{"id":"same"}', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Duplicate'):
                load_all_levels(root)
            (root / 'two.json').write_text('{', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Invalid level file'):
                load_all_levels(root)

    def test_catalog_features_and_metadata(self):
        levels = {name: dict(id=name, name=name, grid=[tiles], initial_bridges=[])
                  for name, tiles in [('plain', [1, 9]), ('orange', [1, 2, 9]),
                                      ('bridge', [1, 3, 9]), ('split', [2, 3, 5, 9])]}
        groups = level_groups(levels)
        self.assertEqual([r['fragile_cells'] for r in groups.values()], [0, 1, 0, 1])
        self.assertEqual([r['switches_count'] for r in groups.values()], [0, 0, 1, 2])
        self.assertEqual([r['split_switches'] for r in groups.values()], [0, 0, 0, 1])


if __name__ == "__main__":
    unittest.main()
