"""CLI measurements must drain worker output and report invalid answers safely."""
import multiprocessing as mp
import time
import unittest
from unittest.mock import patch

from benchmarks.cli import run_single_solver
from core.levels import load_all_levels


def large_error_worker(solver, level, connection):
    connection.send({"success": False, "error": "x" * 100000})
    connection.close()


def invalid_path_worker(solver, level, connection):
    connection.send({"success": True, "data": {"found": True, "moves": ["UP"]}})
    connection.close()


def stalled_worker(solver, level, connection):
    time.sleep(30)


class ExperimentTests(unittest.TestCase):
    def test_large_worker_output_is_not_misreported_as_timeout(self):
        with patch("benchmarks.cli._worker_solver_process", large_error_worker):
            result = run_single_solver("bfs", load_all_levels()["1"], 3)
        self.assertEqual(result["status"], "ERROR")
        self.assertEqual(result["error_message"], "x" * 100000)

    def test_invalid_solution_reports_replay_reason(self):
        with patch("benchmarks.cli._worker_solver_process", invalid_path_worker):
            result = run_single_solver("bfs", load_all_levels()["1"], 3)
        self.assertEqual(result["status"], "INVALID_PATH")
        self.assertIn("vi phạm", result["error_message"])

    def test_timeout_cleans_up_processes(self):
        before = {p.pid for p in mp.active_children()}
        with patch("benchmarks.cli._worker_solver_process", stalled_worker):
            result = run_single_solver("bfs", load_all_levels()["1"], .05)
        self.assertEqual(result["status"], "TIMEOUT")
        self.assertEqual(result["search_time_ms"], "")
        self.assertEqual({p.pid for p in mp.active_children()}, before)

    def test_real_cli_answers_keep_metrics_and_shared_path_cost(self):
        for solver in ("bfs", "dfs", "ucs", "astar"):
            with self.subTest(solver=solver):
                result = run_single_solver(solver, load_all_levels()["2"], 5)
                self.assertEqual(result["status"], "SOLVED")
                self.assertEqual(result["solution_length"], len(result["moves"]))
                self.assertGreaterEqual(result["path_cost"], result["total_cost"])


if __name__ == "__main__":
    unittest.main()
