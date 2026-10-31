"""CLI measurements must drain worker output and report invalid answers safely."""
import multiprocessing as mp
import csv
from contextlib import redirect_stdout
from io import StringIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest
from unittest.mock import patch

from benchmarks import cli
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


def exited_worker(solver, level, connection):
    connection.close()


class ExperimentTests(unittest.TestCase):
    def test_unexpected_worker_exit_is_an_error_and_cleans_up(self):
        before = {p.pid for p in mp.active_children()}
        with patch('benchmarks.cli._worker_solver_process', exited_worker):
            result = run_single_solver('bfs', load_all_levels()['1'], 3)
        self.assertEqual(result['status'], 'ERROR')
        self.assertEqual({p.pid for p in mp.active_children()}, before)

    def test_invalid_configuration_fails_before_output_creation(self):
        invalid = [dict(selected_levels=['5']), dict(selected_levels=['all','1']),
                   dict(selected_solvers=['missing']), dict(repeats=0), dict(repeats=True),
                   dict(timeout=0), dict(timeout=float('nan')), dict(timeout=float('inf'))]
        with TemporaryDirectory() as directory:
            target = Path(directory) / 'new-batch'
            for args in invalid:
                with self.subTest(args=args), self.assertRaises(ValueError):
                    cli.run_benchmarks(output_dir=target, **args)
                self.assertFalse(target.exists())

    def test_existing_output_is_rejected_without_changing_old_data(self):
        with TemporaryDirectory() as directory:
            path = Path(directory)
            (path/'raw.csv').write_bytes(b'old,data\n')
            (path/'environment.json').write_bytes(b'{"commit":"old"}')
            with self.assertRaises(FileExistsError):
                cli.run_benchmarks(['1'], ['bfs'], output_dir=path)
            self.assertEqual((path/'raw.csv').read_bytes(), b'old,data\n')
            self.assertEqual((path/'environment.json').read_bytes(), b'{"commit":"old"}')

    def test_each_batch_has_own_metadata_and_unchanged_csv_schema(self):
        with TemporaryDirectory() as directory, \
                patch.object(cli, 'get_cpu_and_ram', return_value=('test CPU','test RAM')), \
                patch.object(cli, 'get_git_commit', side_effect=['commit-A','commit-B']), \
                patch.object(cli, 'run_single_solver', return_value=cli._empty_result('TIMEOUT','budget')), \
                redirect_stdout(StringIO()):
            paths = [Path(directory)/'A',Path(directory)/'B']
            for path, level in zip(paths,['1','4']):
                self.assertEqual(cli.run_benchmarks([level],['bfs'],output_dir=path),0)
            for path, commit, level in zip(paths,['commit-A','commit-B'],['1','4']):
                env = json.loads((path/'environment.json').read_text(encoding='utf-8'))
                self.assertEqual(env['git_commit'],commit)
                self.assertIn('core/board.py',env['source_sha256'])
                with (path/'raw.csv').open(encoding='utf-8',newline='') as stream:
                    reader=csv.DictReader(stream)
                    self.assertEqual(reader.fieldnames,cli.CSV_HEADERS)
                    rows=list(reader)
                self.assertEqual([r['level_id'] for r in rows],[level])
                self.assertEqual(rows[0]['search_time_ms'],'')
                self.assertEqual(len(list((path/'runs').glob('*.json'))),1)

    def test_failed_run_is_logged_and_following_run_still_executes(self):
        with TemporaryDirectory() as directory, \
                patch.object(cli,'get_cpu_and_ram',return_value=('test','test')), \
                patch.object(cli,'run_single_solver',side_effect=[RuntimeError('broken'),cli._empty_result('TIMEOUT','budget')]), \
                redirect_stdout(StringIO()):
            path=Path(directory)/'batch'
            self.assertEqual(cli.run_benchmarks(['1','4'],['bfs'],output_dir=path),1)
            with (path/'raw.csv').open(encoding='utf-8',newline='') as stream:
                rows=list(csv.DictReader(stream))
            self.assertEqual([r['status'] for r in rows],['ERROR','TIMEOUT'])
            self.assertIn('broken',rows[0]['error_message'])

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
