"""Summarize a saved batch: python -m benchmarks.summary BATCH_DIRECTORY."""
import argparse
import csv
from collections import Counter, defaultdict
import statistics
import hashlib
import math
import json
from pathlib import Path
from .cli import CSV_HEADERS, SOLVER_MAP

DEFAULT_GROUPS = Path(__file__).resolve().parents[2] / 'handoff/quan/level-groups.csv'
STATISTICS = ('median', 'min', 'max', 'iqr')
SEARCH_METRICS = ('search_time_ms', 'memory_kb', 'expanded_nodes')
SOLUTION_METRICS = ('solution_length', 'total_cost', 'path_cost')
METRICS = SEARCH_METRICS + SOLUTION_METRICS
RAW_METRICS = METRICS + ('rolling_steps',)
STATUSES = ('SOLVED', 'NO_SOLUTION', 'TIMEOUT', 'ERROR', 'INVALID_PATH')
SUMMARY_HEADERS = [
    'level_id', 'level_name', 'primary_group', 'stress_test', 'solver',
    'runs', 'measured_runs', 'solved', 'no_solution', 'timeouts', 'errors',
    'invalid_paths', 'success_rate', 'timeout_sec', 'source_commit',
    'level_set_sha256', 'raw_sha256',
    *(f'{metric}_{stat}' for metric in METRICS for stat in STATISTICS),
]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def number(value, label, integer=False):
    try:
        parsed = int(value) if integer else float(value)
    except (ValueError, TypeError, OverflowError):
        raise ValueError(f'{label}: expected a nonnegative finite number') from None
    require(math.isfinite(parsed) and parsed >= 0, f'{label}: invalid number')
    return parsed


def load_batch(batch, groups_path):
    batch = Path(batch)
    config = json.loads((batch / 'run-config.json').read_text(encoding='utf-8'))
    environment = json.loads((batch / 'environment.json').read_text(encoding='utf-8'))
    for key in ('levels', 'solvers'):
        values = config.get(key)
        require(isinstance(values, list) and values and all(isinstance(v, str) and v for v in values),
                f'Invalid config {key}')
        require(len(set(values)) == len(values), f'Duplicate config {key}')
    require(set(config['solvers']) <= SOLVER_MAP.keys(), 'Unknown solver in config')
    repeats = config.get('repeats')
    require(type(repeats) is int and repeats > 0, 'Invalid config repeats')
    timeout = number(config.get('timeout_sec'), 'config timeout_sec')
    require(timeout > 0, 'Timeout must be positive')
    for key in ('repeats', 'timeout_sec', 'level_set_sha256'):
        require(environment.get(key) == config.get(key), f'Metadata mismatch: {key}')
    if config.get('level_set_sha256') is not None:
        require(isinstance(config['level_set_sha256'], str) and len(config['level_set_sha256']) == 64,
                'Invalid level set hash')
    require(isinstance(environment.get('git_commit'), str) and environment['git_commit'] != '',
            'Missing measured source commit')

    with Path(groups_path).open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        require({'level_id', 'level_name', 'primary_group', 'stress_test'} <= set(reader.fieldnames or []),
                'Invalid level-groups schema')
        group_rows = list(reader)
    groups = {row['level_id']: row for row in group_rows}
    require(len(groups) == len(group_rows), 'Duplicate level ID in level-groups')
    require(set(config['levels']) <= groups.keys(), 'Missing level group')

    raw_path = batch / 'raw.csv'
    with raw_path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        require(reader.fieldnames == CSV_HEADERS, 'Expected the official 16-column CLI schema')
        rows = list(reader)
    expected = {(lid, solver, rep) for lid in config['levels']
                for solver in config['solvers'] for rep in range(1, repeats + 1)}
    seen, run_ids = set(), set()
    for row in rows:
        require(set(row) == set(CSV_HEADERS) and None not in row.values(), 'Malformed CSV row')
        run_id = row['run_id']
        require(run_id and '/' not in run_id and '\\' not in run_id and run_id not in ('.', '..'),
                'Invalid run_id')
        require(run_id not in run_ids, f'Duplicate run_id: {run_id}')
        run_ids.add(run_id)
        repeat = number(row['repeat_index'], f'{run_id}: repeat_index', integer=True)
        key = (row['level_id'], row['solver'], repeat)
        require(key in expected and key not in seen, f'Unexpected or duplicate run: {key}')
        seen.add(key)
        require(row['level_name'] == groups[row['level_id']]['level_name'], f'{run_id}: level name mismatch')
        require(number(row['timeout_sec'], run_id) == timeout, f'{run_id}: timeout mismatch')
        status = row['status']
        require(status in STATUSES, f'{run_id}: unknown status {status}')
        record = json.loads((batch / 'runs' / (run_id + '.json')).read_text(encoding='utf-8'))
        require(set(record) == set(CSV_HEADERS) | {'moves'}, f'{run_id}: JSON schema mismatch')
        require(all(str(record[k]) == row[k] for k in CSV_HEADERS), f'{run_id}: CSV/JSON mismatch')
        require(isinstance(record['moves'], list), f'{run_id}: invalid moves')
        values = {}
        for metric in RAW_METRICS:
            value = row[metric]
            values[metric] = None if value == '' else number(
                value, f'{run_id}: {metric}', integer=metric in ('expanded_nodes', 'solution_length', 'rolling_steps'))
        if status == 'SOLVED':
            require(all(values[k] is not None for k in RAW_METRICS), f'{run_id}: missing solved metric')
            require(values['solution_length'] == values['rolling_steps'] == len(record['moves']),
                    f'{run_id}: length mismatch')
            require(values['path_cost'] >= values['solution_length'], f'{run_id}: cost below length')
            reported = values['solution_length'] if row['solver'] in ('bfs', 'dfs') else values['path_cost']
            require(values['total_cost'] == reported, f'{run_id}: inconsistent total_cost')
        elif status == 'NO_SOLUTION':
            require(all(values[k] is not None for k in SEARCH_METRICS), f'{run_id}: missing search metric')
            require(all(values[k] is None for k in ('solution_length', 'rolling_steps', 'path_cost'))
                    and values['total_cost'] == 0 and not record['moves'], f'{run_id}: invalid unsolved result')
        elif status in ('TIMEOUT', 'ERROR'):
            require(all(v is None for v in values.values()) and not record['moves'],
                    f'{run_id}: unmeasured metrics must be blank')
        if status in ('TIMEOUT', 'ERROR', 'INVALID_PATH'):
            require(bool(row['error_message']), f'{run_id}: missing failure reason')
        row['_values'] = values
    require(seen == expected, f'Incomplete batch: expected {len(expected)} runs, found {len(seen)}')
    require({p.stem for p in (batch / 'runs').glob('*.json')} == run_ids, 'Extra or missing run JSON')
    return rows, config, environment, groups, hashlib.sha256(raw_path.read_bytes()).hexdigest()


def statistics_for(values):
    if not values:
        return dict.fromkeys(STATISTICS, '')
    iqr = ''
    if len(values) >= 2:
        q1, _, q3 = statistics.quantiles(values, n=4, method='inclusive')
        iqr = round(q3 - q1, 6)
    return dict(median=round(statistics.median(values), 6), min=min(values), max=max(values), iqr=iqr)


def summarize_batch(batch, groups_path=DEFAULT_GROUPS, output=None):
    rows, config, environment, groups, raw_hash = load_batch(batch, groups_path)
    grouped = defaultdict(list)
    for row in rows:
        grouped[row['level_id'], row['solver']].append(row)
    summary = []
    for lid in sorted(config['levels'], key=lambda value: (not value.isdigit(), int(value) if value.isdigit() else value)):
        for solver in config['solvers']:
            runs = grouped[lid, solver]
            counts = Counter(row['status'] for row in runs)
            completed = [row for row in runs if row['status'] in ('SOLVED', 'NO_SOLUTION')]
            solved = [row for row in runs if row['status'] == 'SOLVED']
            record = {k: groups[lid][k] for k in ('level_id', 'level_name', 'primary_group', 'stress_test')}
            record.update(solver=solver, runs=len(runs), measured_runs=len(completed),
                          solved=counts['SOLVED'], no_solution=counts['NO_SOLUTION'], timeouts=counts['TIMEOUT'],
                          errors=counts['ERROR'], invalid_paths=counts['INVALID_PATH'],
                          success_rate=round(len(solved) / len(runs), 6), timeout_sec=config['timeout_sec'],
                          source_commit=environment['git_commit'], level_set_sha256=config.get('level_set_sha256', ''),
                          raw_sha256=raw_hash)
            for metric in METRICS:
                samples = completed if metric in SEARCH_METRICS else solved
                for stat, value in statistics_for([row['_values'][metric] for row in samples]).items():
                    record[f'{metric}_{stat}'] = value
            summary.append(record)
    target = Path(output) if output is not None else Path(batch) / 'summary.csv'
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('x', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=SUMMARY_HEADERS)
        writer.writeheader()
        writer.writerows(summary)
    return summary


def summarize_main(argv=None):
    parser = argparse.ArgumentParser(description="Summarize one complete benchmark batch without rerunning solvers")
    parser.add_argument('batch', type=Path, help='Folder containing raw.csv, runs/, and metadata')
    parser.add_argument('--groups', type=Path, default=DEFAULT_GROUPS)
    parser.add_argument('--output', type=Path, help='NEW CSV path; default: batch/summary.csv')
    args = parser.parse_args(argv)
    try:
        result = summarize_batch(args.batch, args.groups, args.output)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        parser.error(str(exc))
    print(f'Saved {len(result)} level/solver groups; {sum(r["runs"] for r in result)} runs; '
          f'{sum(r["solved"] for r in result)} SOLVED. Input measurements unchanged.')
    return 0



if __name__ == "__main__":
    raise SystemExit(summarize_main())
