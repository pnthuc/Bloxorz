"""Verify statistics, status denominators, and immutable benchmark inputs."""
import csv
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from benchmarks.cli import CSV_HEADERS
from benchmarks.cli import summarize_batch


class SummaryTests(unittest.TestCase):
    def make_batch(self, root, statuses):
        root = Path(root)
        (root / 'runs').mkdir()
        config = dict(levels=['1'], solvers=['bfs'], repeats=len(statuses), timeout_sec=120,
                      level_set_sha256='a' * 64)
        (root / 'run-config.json').write_text(json.dumps(config), encoding='utf-8')
        (root / 'environment.json').write_text(json.dumps(dict(config, git_commit='b' * 40)), encoding='utf-8')
        groups = root / 'groups.csv'
        groups.write_text('level_id,level_name,primary_group,stress_test\n1,Màn thử,Cơ bản,Không\n', encoding='utf-8')
        rows = []
        for index, status in enumerate(statuses, 1):
            record = dict(run_id=f'run{index}', level_id='1', level_name='Màn thử', solver='bfs',
                          repeat_index=index, status=status, search_time_ms=[1, 2, 100, 4, 5][index-1],
                          memory_kb=10 * index, expanded_nodes=index, solution_length=2,
                          rolling_steps=2, total_cost=2.0, path_cost=2.0, timeout_sec=120,
                          timestamp='2026-10-31T14:00:00', error_message='', moves=['RIGHT', 'RIGHT'])
            if status == 'NO_SOLUTION':
                record.update(solution_length='', rolling_steps='', total_cost=0.0, path_cost='', moves=[])
            elif status in ('TIMEOUT', 'ERROR'):
                for key in ('search_time_ms', 'memory_kb', 'expanded_nodes', 'solution_length',
                            'rolling_steps', 'total_cost', 'path_cost'):
                    record[key] = ''
                record['moves'] = []
            if status in ('TIMEOUT', 'ERROR', 'INVALID_PATH'):
                record['error_message'] = 'failure'
            (root / 'runs' / f'run{index}.json').write_text(json.dumps(record), encoding='utf-8')
            rows.append({key: record[key] for key in CSV_HEADERS})
        self.write_rows(root, rows)
        return root, groups

    def write_rows(self, root, rows):
        with (root / 'raw.csv').open('w', newline='', encoding='utf-8') as stream:
            writer = csv.DictWriter(stream, fieldnames=CSV_HEADERS)
            writer.writeheader()
            writer.writerows(rows)

    def test_median_and_inclusive_iqr_preserve_outlier_and_inputs(self):
        with TemporaryDirectory() as directory:
            root, groups = self.make_batch(directory, ['SOLVED'] * 3)
            before = {p: p.read_bytes() for p in root.rglob('*') if p.is_file()}
            row, = summarize_batch(root, groups)
            self.assertEqual((row['runs'], row['measured_runs'], row['solved'], row['success_rate']), (3, 3, 3, 1))
            self.assertEqual([row[f'search_time_ms_{s}'] for s in ('median', 'min', 'max', 'iqr')], [2, 1, 100, 49.5])
            self.assertTrue(all(p.read_bytes() == data for p, data in before.items()))
            with (root / 'summary.csv').open(encoding='utf-8-sig', newline='') as stream:
                self.assertEqual(next(csv.DictReader(stream))['primary_group'], 'Cơ bản')

    def test_failures_remain_in_denominator_and_no_solution_is_not_zero_length(self):
        with TemporaryDirectory() as directory:
            root, groups = self.make_batch(directory, ['SOLVED', 'NO_SOLUTION', 'TIMEOUT', 'ERROR', 'INVALID_PATH'])
            row, = summarize_batch(root, groups)
            self.assertEqual((row['runs'], row['measured_runs'], row['success_rate']), (5, 2, .2))
            self.assertEqual([row[k] for k in ('solved', 'no_solution', 'timeouts', 'errors', 'invalid_paths')], [1]*5)
            self.assertEqual(row['search_time_ms_median'], 1.5)
            self.assertEqual(row['solution_length_median'], 2)
            self.assertEqual(row['path_cost_median'], 2)
            self.assertEqual(row['path_cost_iqr'], '')

    def test_unmeasured_group_has_blank_statistics(self):
        with TemporaryDirectory() as directory:
            root, groups = self.make_batch(directory, ['TIMEOUT', 'ERROR'])
            row, = summarize_batch(root, groups)
            self.assertEqual((row['measured_runs'], row['success_rate']), (0, 0))
            self.assertEqual(row['search_time_ms_median'], '')
            self.assertEqual(row['solution_length_median'], '')

    def test_missing_duplicate_or_mismatched_rows_rejected_before_output(self):
        for mutation in ('missing', 'duplicate', 'json_mismatch'):
            with self.subTest(mutation=mutation), TemporaryDirectory() as directory:
                root, groups = self.make_batch(directory, ['SOLVED']*3)
                with (root / 'raw.csv').open(encoding='utf-8', newline='') as stream:
                    rows = list(csv.DictReader(stream))
                if mutation == 'missing':
                    rows.pop()
                elif mutation == 'duplicate':
                    rows.append(rows[0])
                else:
                    rows[0]['search_time_ms'] = '999'
                self.write_rows(root, rows)
                with self.assertRaises(ValueError):
                    summarize_batch(root, groups)
                self.assertFalse((root / 'summary.csv').exists())

    def test_nonfinite_and_fake_timeout_metrics_rejected_even_if_json_agrees(self):
        for status, value in [('SOLVED', 'nan'), ('TIMEOUT', 0)]:
            with self.subTest(status=status), TemporaryDirectory() as directory:
                root, groups = self.make_batch(directory, [status])
                path = root / 'runs/run1.json'
                record = json.loads(path.read_text(encoding='utf-8'))
                record['search_time_ms'] = value
                path.write_text(json.dumps(record), encoding='utf-8')
                self.write_rows(root, [{k: record[k] for k in CSV_HEADERS}])
                with self.assertRaises(ValueError):
                    summarize_batch(root, groups)

    def test_existing_output_is_not_overwritten(self):
        with TemporaryDirectory() as directory:
            root, groups = self.make_batch(directory, ['SOLVED'])
            output = root / 'summary.csv'
            output.write_bytes(b'old summary\n')
            with self.assertRaises(FileExistsError):
                summarize_batch(root, groups)
            self.assertEqual(output.read_bytes(), b'old summary\n')


if __name__ == '__main__':
    unittest.main()
