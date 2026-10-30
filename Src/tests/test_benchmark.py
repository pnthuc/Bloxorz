"""Actual solver results, bounded worker lifetime and benchmark request isolation."""
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import time
import unittest
from unittest.mock import patch

from benchmarks.worker import _run_worker, measure_solver
from core.board import BloxorzBoard
from web.app import app, _BENCHMARK_SLOT
from core.levels import load_all_levels
from core.replay import verify_solution_walk


def worker_command(source):
    return [sys.executable, "-u", "-c", source]


class BenchmarkTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_four_real_solvers_same_level_results_replay_and_cost(self):
        board = BloxorzBoard(load_all_levels()["1"])
        revision = None
        for solver in ("bfs", "dfs", "ucs", "astar"):
            with self.subTest(solver=solver):
                response = self.client.post("/api/benchmark", json={
                    "level_id": "1", "solver": solver, "limit_ms": 5000,
                    "level_revision": revision})
                self.assertEqual(response.status_code, 200)
                data = response.json
                self.assertEqual(data["status"], "solved")
                self.assertEqual(data["solver"], solver)
                self.assertEqual(data["level_id"], "1")
                if revision:
                    self.assertEqual(data["level_revision"], revision)
                revision = data["level_revision"]
                result = data["result"]
                valid, reason, cost = verify_solution_walk(board, result["moves"])
                self.assertTrue(valid, reason)
                self.assertEqual(result["total_cost"], cost)
                self.assertEqual(result["solution_length"], len(result["moves"]))
                self.assertGreater(result["search_time_ms"], 0)
                self.assertGreater(result["memory_kb"], 0)

    def test_bad_configuration_never_starts_a_worker(self):
        with patch("web.app.measure_solver") as measure:
            invalid = [None, [], {}, {"solver": "unknown"},
                       {"solver": "bfs", "level_id": "absent"},
                       *({"solver": "bfs", "level_id": "1", "limit_ms": value}
                         for value in (True, 0, 999, 30001, "5000")),
                       {"solver": "bfs", "level_id": "1", "level_revision": "stale"}]
            for data in invalid:
                with self.subTest(data=data):
                    response = self.client.post("/api/benchmark", json=data)
                    self.assertIn(response.status_code, (400, 404, 409))
            measure.assert_not_called()

    def test_fragile_cost_uses_one_shared_model_for_all_four_answers(self):
        board = BloxorzBoard(load_all_levels()["2"])
        for solver in ("bfs", "dfs", "ucs", "astar"):
            with self.subTest(solver=solver):
                response = self.client.post("/api/benchmark", json={"level_id": "2", "solver": solver})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json["status"], "solved")
                result = response.json["result"]
                valid, reason, cost = verify_solution_walk(board, result["moves"])
                self.assertTrue(valid, reason)
                self.assertEqual(result["total_cost"], cost)
                if solver in ("bfs", "dfs"):
                    self.assertEqual(result["solver_reported_cost"], result["solution_length"])
                    self.assertGreater(cost, result["solution_length"])

    def test_busy_measurement_is_rejected_without_overlap(self):
        _BENCHMARK_SLOT.acquire()
        try:
            response = self.client.post("/api/benchmark", json={"level_id": "1", "solver": "bfs"})
            self.assertEqual(response.status_code, 409)
        finally:
            _BENCHMARK_SLOT.release()

    def test_timeout_really_terminates_child_and_has_no_fake_metrics(self):
        started = time.perf_counter()
        children = []
        popen = subprocess.Popen

        def track(*args, **kwargs):
            child = popen(*args, **kwargs)
            children.append(child)
            return child

        with patch("benchmarks.worker.subprocess.Popen", side_effect=track):
            result = _run_worker(worker_command(
                'import time; print(\'{"status":"ready"}\', flush=True); time.sleep(30)'), {}, 50)
        self.assertEqual(result, {"status": "timeout"})
        self.assertLess(time.perf_counter() - started, 10)
        self.assertEqual(len(children), 1)
        self.assertIsNotNone(children[0].poll())
        self.assertTrue(children[0].stdout.closed)

    def test_large_answer_is_read_before_join(self):
        result = _run_worker(worker_command(
            'import json; print(\'{"status":"ready"}\', flush=True); '
            'print(json.dumps({"status":"solved","result":{"moves":["RIGHT"]*100000}}), flush=True)'), {}, 2000)
        self.assertEqual(result["status"], "solved")
        self.assertEqual(len(result["result"]["moves"]), 100000)

    def test_unexpected_child_exit_reports_error(self):
        self.assertEqual(_run_worker(worker_command(
            'print(\'{"status":"ready"}\', flush=True)'), {}, 1000)["status"], "error")

    def test_server_bootstrap_is_not_reimported_by_worker(self):
        # Hosted entrypoints may start an HTTP loop at import time. A spawn
        # child executes that loop instead of reaching its solver target.
        with TemporaryDirectory() as directory:
            marker = Path(directory) / "reimported"
            bootstrap = Path(directory) / "server.py"
            bootstrap.write_text(
                f"from pathlib import Path\nPath({str(marker)!r}).touch()\n"
                "import time\ntime.sleep(30)\n", encoding="utf-8")
            with patch.object(sys.modules["__main__"], "__file__", str(bootstrap)), \
                    patch.object(sys.modules["__main__"], "__spec__", None):
                result = measure_solver(load_all_levels()["1"], "bfs", 5000)
            self.assertEqual(result["status"], "solved")
            self.assertFalse(marker.exists())

    def test_worker_startup_timeout_and_early_exit_have_no_metrics(self):
        result = _run_worker(worker_command('import time; time.sleep(30)'), {}, 1000,
                             startup_seconds=.1)
        self.assertEqual(result["status"], "error")
        self.assertNotIn("result", result)
        result = _run_worker(worker_command('raise SystemExit(1)'), {}, 1000)
        self.assertEqual(result["status"], "error")
        self.assertNotIn("result", result)


if __name__ == "__main__":
    unittest.main()
