"""Kiểm tra bộ kiểm tra kết quả và lệnh chạy bằng các kết quả được giả lập."""

from contextlib import redirect_stdout
from copy import deepcopy
from dataclasses import replace
from io import StringIO
import unittest
from unittest.mock import Mock, patch

from core.board import BloxorzBoard, SPLIT, State
from tests.helpers import (
    Case,
    load_cases,
    load_levels,
    select_cases,
    validate_result,
    validate_schema,
)
from core.replay import replay_solution, verify_solution_walk
import run_tests
from run_tests import run_case, run_selected, run_suite


def make_result(moves=None, cost=None, **changes):
    moves = ["RIGHT", "RIGHT"] if moves is None else moves
    result = {
        "found": True,
        "moves": moves,
        "solution_length": len(moves),
        "expanded_nodes": 0 if not moves else 2,
        "total_cost": len(moves) if cost is None else cost,
        "search_time_ms": 0.1,
        "memory_kb": 1.0,
    }
    result.update(changes)
    return result


class SolverRunnerTests(unittest.TestCase):
    def setUp(self):
        self.case = next(case for case in load_cases() if case.id == "T5")
        self.board = BloxorzBoard(self.case.level)

    def test_schema_rejects_missing_fields_and_invalid_types(self):
        for result in (None, [], {}, {"found": True}):
            with self.subTest(result=result), self.assertRaises(AssertionError):
                validate_schema(result)
        invalid_fields = [
            ("found", 1),
            ("moves", ("RIGHT", "RIGHT")),
            ("moves", ["JUMP"]),
            ("moves", [[]]),
            ("solution_length", True),
            ("solution_length", 1),
            ("expanded_nodes", False),
            ("expanded_nodes", -1),
            ("search_time_ms", float("nan")),
            ("memory_kb", float("inf")),
            ("total_cost", -1),
            ("total_cost", True),
            ("total_cost", "2"),
        ]
        for key, value in invalid_fields:
            with self.subTest(field=key, value=value), self.assertRaises(AssertionError):
                validate_schema(make_result(**{key: value}))

    def test_replay_rejects_invalid_moves_and_unfinished_paths(self):
        for moves in (["UP"], ["RIGHT"], ["JUMP"], [[]]):
            with self.subTest(moves=moves):
                valid, reason, _ = verify_solution_walk(self.board, moves)
                self.assertFalse(valid)
                self.assertTrue(reason)
        self.assertEqual(
            verify_solution_walk(self.board, ["RIGHT", "RIGHT"]), (True, "Hợp lệ", 2.0)
        )

    def test_unit_cost_and_weighted_cost_are_checked_separately(self):
        level = {"id": "weighted", "grid": [[1, 2, 1, 9]], "start_pos": [0, 0]}
        case = Case("weighted", "Một ô cam", level, True, 2, 2.5)
        board = BloxorzBoard(level)
        validate_result("bfs", case, board, make_result(cost=2))
        validate_result("dfs", case, board, make_result(cost=2))
        validate_result("ucs", case, board, make_result(cost=2.5))
        with self.assertRaisesRegex(AssertionError, "replay"):
            validate_result("ucs", case, board, make_result(cost=2))

    def test_solver_replay_rejects_standalone_space(self):
        board = BloxorzBoard({"grid": [[1, 2, 1, 1, 9]], "start_pos": [0, 0]})
        split = State(0, 1, SPLIT, (), 0, 3)
        with patch.object(board, "get_initial_state", return_value=split):
            replay = replay_solution(board, ["SPACE"])
        self.assertFalse(replay.valid)
        self.assertEqual(replay.cost, 0)
        self.assertEqual(replay.state, split)
        with self.assertRaises(AssertionError):
            validate_schema(make_result(["SPACE"]))

    def test_compound_search_matches_free_selection_reference(self):
        # Independent reference graph: four rolls plus a zero-cost selection edge.
        from heapq import heappop, heappush
        from itertools import count
        from solvers.costs import step_cost
        from solvers.member3_bfs import _bfs_core
        from solvers.member5_ucs import _ucs_core
        from solvers.member4_astar import _astar_core

        grid = [[1] * 7 for _ in range(4)]
        grid[1][3] = 9
        grid[1][2] = 2
        board = BloxorzBoard({"grid": grid, "start_pos": [0, 0]})
        start = State(1, 1, SPLIT, (), 1, 5)

        def reference(weighted):
            serial = count()
            heap = [(0, next(serial), start)]
            best = {start: 0}
            while heap:
                cost, _, state = heappop(heap)
                if cost != best[state]:
                    continue
                if board.is_goal(state):
                    return cost
                for action in ("UP", "LEFT", "RIGHT", "DOWN", "SPACE"):
                    nxt = board.apply_move(state, action)
                    if nxt is None:
                        continue
                    delta = 0 if action == "SPACE" else step_cost(board, nxt) if weighted else 1
                    new_cost = cost + delta
                    if new_cost < best.get(nxt, float("inf")):
                        best[nxt] = new_cost
                        heappush(heap, (new_cost, next(serial), nxt))
            self.fail("Reference board must be solvable")

        with patch.object(board, "get_initial_state", return_value=start):
            for core, weighted in ((_bfs_core, False), (_ucs_core, True), (_astar_core, True)):
                with self.subTest(core=core.__name__):
                    result = core(board)
                    self.assertTrue(result["found"])
                    self.assertNotIn("SPACE", result["moves"])
                    self.assertEqual(result["total_cost"], reference(weighted))
                    self.assertTrue(replay_solution(board, result["moves"]).valid)

    def test_dfs_allows_detours_but_optimal_solvers_reject_them(self):
        detour = make_result(["RIGHT", "LEFT", "RIGHT", "RIGHT"])
        validate_result("dfs", self.case, self.board, detour)
        for name in ("bfs", "ucs", "astar"):
            with self.subTest(solver=name), self.assertRaisesRegex(AssertionError, "tối ưu"):
                validate_result(name, self.case, self.board, detour)

    def test_different_shortest_walks_are_both_accepted(self):
        grid = [[1] * 4 for _ in range(4)]
        grid[3][3] = 9
        case = Case(
            "two-paths",
            "Hai đường tối ưu",
            {"id": "two-paths", "grid": grid, "start_pos": [0, 0]},
            True,
            4,
            4,
        )
        for moves in (["RIGHT", "RIGHT", "DOWN", "DOWN"], ["DOWN", "DOWN", "RIGHT", "RIGHT"]):
            with self.subTest(moves=moves):
                validate_result("bfs", case, BloxorzBoard(case.level), make_result(moves))

    def test_start_at_goal_is_not_tied_to_fixture_id(self):
        case = Case(
            "any-id", "Goal", {"id": "any-id", "grid": [[9]], "start_pos": [0, 0]}, True, 0, 0
        )
        board = BloxorzBoard(case.level)
        validate_result("dfs", case, board, make_result([]))
        with self.assertRaisesRegex(AssertionError, "Start=goal"):
            validate_result("dfs", case, board, make_result([], expanded_nodes=1))

    def test_unsolvable_result_has_empty_moves_and_zero_cost(self):
        case = next(case for case in load_cases() if case.id == "T4")
        board = BloxorzBoard(case.level)
        valid = make_result([], found=False, expanded_nodes=1)
        validate_result("ucs", case, board, valid)
        for result in (dict(valid, moves=["RIGHT"], solution_length=1), dict(valid, total_cost=1)):
            with self.subTest(result=result), self.assertRaisesRegex(AssertionError, "Vô nghiệm"):
                validate_result("ucs", case, board, result)
        with self.assertRaisesRegex(AssertionError, "found"):
            validate_result("bfs", self.case, self.board, valid)

    def test_heuristic_start_bound_and_goal_zero_are_checked(self):
        for values in ([3, 0], [-1, 0], [float("nan"), 0], [0, 1]):
            with (
                self.subTest(values=values),
                patch("tests.helpers.heuristic", side_effect=values),
            ):
                with self.assertRaises(AssertionError):
                    validate_result("astar", self.case, self.board, make_result())
        with patch("tests.helpers.heuristic", side_effect=[0, 0]):
            validate_result("astar", self.case, self.board, make_result())

    def test_solver_cannot_change_fixture_to_make_its_path_valid(self):
        level = deepcopy(self.case.level)
        level["grid"][0][1] = 0
        case = replace(self.case, level=level)

        def mutate_board(board):
            board.grid[0][1] = 1
            return make_result()

        status, detail = run_case("bfs", mutate_board, case)
        self.assertEqual(status, "FAIL")
        self.assertIn("vi phạm", detail)
        self.assertEqual(case.level["grid"][0][1], 0)

    def test_suite_exit_codes_and_pending_are_not_confused_with_pass(self):
        combinations = [
            ({"dfs": Mock(return_value=make_result())}, 0, "1 PASS / 0 FAIL / 0 PENDING"),
            (
                {"dfs": Mock(side_effect=NotImplementedError("TODO"))},
                2,
                "0 PASS / 0 FAIL / 1 PENDING",
            ),
            (
                {
                    "dfs": Mock(side_effect=ValueError("broken")),
                    "ucs": Mock(side_effect=NotImplementedError("TODO")),
                },
                1,
                "0 PASS / 1 FAIL / 1 PENDING",
            ),
        ]
        for solvers, exit_code, summary in combinations:
            with self.subTest(exit_code=exit_code), redirect_stdout(StringIO()) as output:
                self.assertEqual(run_suite([self.case], solvers), exit_code)
                self.assertIn(summary, output.getvalue().splitlines()[-1])

    def test_one_catalog_contains_small_cases_and_every_map(self):
        cases = load_cases()
        ids = {case.id for case in cases}
        self.assertTrue({f"T{i}" for i in range(1, 11)} <= ids)
        self.assertTrue(set(load_levels()) <= ids)
        self.assertEqual(len(cases), 10 + len(load_levels()))
        for lid in load_levels():
            case = select_cases(cases, [lid])[0]
            self.assertEqual(case.level_id, lid)

    def test_filters_cases_without_changing_default_solver_contract(self):
        solve = Mock(
            side_effect=lambda board: (
                make_result([]) if board.is_goal(board.get_initial_state()) else make_result()
            )
        )
        with patch.dict("run_tests.SOLVERS", {"bfs": solve}):
            with redirect_stdout(StringIO()) as output:
                status = run_selected("bfs", ["T5", "T10"])
        self.assertEqual(status, 0)
        self.assertEqual(solve.call_count, 2)
        self.assertIn("2 PASS / 0 FAIL / 0 PENDING", output.getvalue())
        self.assertNotIn("DFS /", output.getvalue())

    def test_unknown_ids_and_missing_data_fail_instead_of_pending(self):
        with redirect_stdout(StringIO()) as output:
            status = run_selected(ids=["missing"])
        self.assertEqual(status, 1)
        self.assertIn("0 PASS / 1 FAIL / 0 PENDING", output.getvalue())
        with patch("run_tests.load_cases", side_effect=FileNotFoundError("missing.json")):
            with redirect_stdout(StringIO()) as output:
                self.assertEqual(run_selected(), 1)
        self.assertIn("missing.json", output.getvalue())
        with patch("tests.helpers.read_json", return_value=[]):
            with redirect_stdout(StringIO()) as output:
                self.assertEqual(run_selected(), 1)
        self.assertIn("không rỗng", output.getvalue())


class RunCommandTests(unittest.TestCase):
    def test_failed_core_checks_stop_before_solver(self):
        result = Mock()
        result.wasSuccessful.return_value = False
        with (
            patch("run_tests.unittest.defaultTestLoader.discover"),
            patch("run_tests.unittest.TextTestRunner") as runner,
            patch("run_tests.run_selected") as solve,
            redirect_stdout(StringIO()),
        ):
            runner.return_value.run.return_value = result
            self.assertEqual(run_tests.main([]), 1)
            solve.assert_not_called()

    def test_solver_selection_and_ui_are_forwarded(self):
        result = Mock()
        result.wasSuccessful.return_value = True
        with (
            patch("run_tests.unittest.defaultTestLoader.discover"),
            patch("run_tests.unittest.TextTestRunner") as runner,
            patch("run_tests.run_selected", return_value=2) as solve,
            patch("run_tests.shutil.which", return_value="node"),
            patch("run_tests.subprocess.run") as ui,
        ):
            runner.return_value.run.return_value = result
            ui.return_value.returncode = 0
            self.assertEqual(run_tests.main(["--solver", "bfs", "--cases", "T5", "--ui"]), 2)
            solve.assert_called_once_with("bfs", ["T5"])
            self.assertEqual(ui.call_args.args[0], ["node", "--test", "test_ui.cjs", "test_audio.cjs", "test_render_assets.cjs"])
            ui.return_value.returncode = 1
            self.assertEqual(run_tests.main(["--ui"]), 1)


if __name__ == "__main__":
    unittest.main()
