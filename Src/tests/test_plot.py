"""Check P05 handling of failed runs, unavailable samples and stale summaries."""
import csv
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from benchmarks.plot import RAW_HEADERS, SUMMARY_HEADERS, axis_scale, failure_note, validate_batch


def write_csv(path, headers, rows):
    with path.open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


class PlotDataTests(unittest.TestCase):
    def fixture(self, folder):
        root = Path(folder)
        (root / 'runs').mkdir()
        (root / 'run-config.json').write_text(json.dumps(dict(
            levels=['1'], solvers=['ucs'], repeats=6, timeout_sec=120)), encoding='utf-8')
        (root / 'environment.json').write_text('{}', encoding='utf-8')
        statuses = ['SOLVED', 'NO_SOLUTION', 'SOLVED', 'TIMEOUT', 'ERROR', 'INVALID_PATH']
        raw = []
        for rep, status in enumerate(statuses, 1):
            row = dict(level_id='1', solver='ucs', repeat_index=rep, status=status,
                       search_time_ms=rep * 10, memory_kb=rep, expanded_nodes=rep,
                       solution_length=0 if rep == 1 else 2, path_cost=0 if rep == 1 else 3)
            moves = [] if rep == 1 else ['RIGHT', 'RIGHT']
            if status == 'NO_SOLUTION':
                row.update(solution_length='', path_cost='')
                moves = []
            if status in ('TIMEOUT', 'ERROR'):
                for metric in RAW_HEADERS[4:]:
                    row[metric] = ''
                moves = []
            record = dict(row, moves=moves, error_message='failed' if rep >= 4 else '')
            (root / 'runs' / f'{rep}.json').write_text(json.dumps(record), encoding='utf-8')
            raw.append(row)
        write_csv(root / 'raw.csv', RAW_HEADERS, raw)
        summary = dict(level_id='1', solver='ucs', runs=6, solved=2, no_solution=1,
                       timeouts=1, errors=1, invalid_paths=1, search_time_ms_median=20,
                       memory_kb_median=2, expanded_nodes_median=2,
                       solution_length_median=1, path_cost_median=1.5)
        write_csv(root / 'summary.csv', SUMMARY_HEADERS, [summary])
        groups = root / 'groups.csv'
        write_csv(groups, ['level_id', 'level_name', 'split_switches', 'fragile_cells'],
                  [dict(level_id='1', level_name='Example', split_switches=0, fragile_cells=1)])
        return root, groups, summary

    def test_mixed_statuses_use_distinct_denominators_without_changing_inputs(self):
        with TemporaryDirectory() as folder:
            root, groups, _ = self.fixture(folder)
            before = {p: p.read_bytes() for p in root.rglob('*') if p.is_file()}
            data = validate_batch(root, groups)
            row = data['summaries']['1', 'ucs']
            self.assertEqual(row['samples']['search_time_ms'], 3)
            self.assertEqual(row['samples']['solution_length'], 2)
            self.assertEqual(row['medians']['path_cost'], 1.5)
            self.assertEqual(before, {p: p.read_bytes() for p in before})

    def test_stale_summary_is_rejected(self):
        with TemporaryDirectory() as folder:
            root, groups, summary = self.fixture(folder)
            summary['search_time_ms_median'] = 0
            write_csv(root / 'summary.csv', SUMMARY_HEADERS, [summary])
            with self.assertRaisesRegex(ValueError, 'median mismatch'):
                validate_batch(root, groups)

    def test_missing_run_detail_is_rejected(self):
        with TemporaryDirectory() as folder:
            root, groups, _ = self.fixture(folder)
            (root / 'runs' / '4.json').unlink()
            with self.assertRaisesRegex(ValueError, 'missing JSON'):
                validate_batch(root, groups)

    def test_no_solution_is_not_a_zero_length_solution(self):
        with TemporaryDirectory() as folder:
            root, groups, _ = self.fixture(folder)
            # A zero substituted into CSV alone is caught before it reaches a figure.
            with (root / 'raw.csv').open(encoding='utf-8', newline='') as stream:
                raw = list(csv.DictReader(stream))
            raw[1]['solution_length'] = '0'
            write_csv(root / 'raw.csv', RAW_HEADERS, raw)
            with self.assertRaisesRegex(ValueError, 'CSV/JSON mismatch'):
                validate_batch(root, groups)

    def test_real_zero_uses_scale_that_can_show_zero(self):
        self.assertEqual(axis_scale([0, 10]), 'symlog')
        self.assertEqual(axis_scale([0.1, 10]), 'log')

    def test_all_failed_group_has_no_median_and_retains_failure_marker(self):
        with TemporaryDirectory() as folder:
            root, groups, summary = self.fixture(folder)
            config = dict(levels=['1'], solvers=['ucs'], repeats=1, timeout_sec=120)
            (root / 'run-config.json').write_text(json.dumps(config), encoding='utf-8')
            row = dict(level_id='1', solver='ucs', repeat_index=1, status='ERROR',
                       **{metric: '' for metric in RAW_HEADERS[4:]})
            write_csv(root / 'raw.csv', RAW_HEADERS, [row])
            for path in (root / 'runs').glob('*.json'):
                path.unlink()
            (root / 'runs' / '1.json').write_text(json.dumps(dict(
                row, moves=[], error_message='worker failed')), encoding='utf-8')
            summary.update(runs=1, solved=0, no_solution=0, timeouts=0, errors=1, invalid_paths=0)
            for key in summary:
                if key.endswith('_median'):
                    summary[key] = ''
            write_csv(root / 'summary.csv', SUMMARY_HEADERS, [summary])
            result = validate_batch(root, groups)['summaries']['1', 'ucs']
            self.assertTrue(all(value is None for value in result['medians'].values()))
            self.assertEqual(result['samples']['search_time_ms'], 0)
            self.assertEqual(failure_note(result), 'E1')


if __name__ == '__main__':
    unittest.main()
