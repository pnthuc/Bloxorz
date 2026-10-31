"""Summarize a saved batch: python -m benchmarks.summary BATCH_DIRECTORY."""
import argparse
import csv
from collections import Counter, defaultdict
import statistics
import math
import json
from pathlib import Path
from .cli import CSV_HEADERS, SOLVER_MAP

SEARCH_METRICS = ('search_time_ms', 'memory_kb', 'expanded_nodes')
SOLUTION_METRICS = ('solution_length', 'path_cost')
METRICS = SEARCH_METRICS + SOLUTION_METRICS
RAW_METRICS = METRICS
STATUSES = ('SOLVED', 'NO_SOLUTION', 'TIMEOUT', 'ERROR', 'INVALID_PATH')
SUMMARY_HEADERS = [
    'level_id', 'solver', 'runs', 'solved', 'no_solution', 'timeouts', 'errors', 'invalid_paths',
    *(f'{metric}_median' for metric in METRICS),
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


def load_batch(batch):
    batch = Path(batch)
    config = json.loads((batch / 'run-config.json').read_text(encoding='utf-8'))
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
    raw_path = batch / 'raw.csv'
    with raw_path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        require(set(CSV_HEADERS) <= set(reader.fieldnames or []), 'Missing raw CSV columns')
        rows = list(reader)
    expected = {(lid, solver, rep) for lid in config['levels']
                for solver in config['solvers'] for rep in range(1, repeats + 1)}
    details = {}
    for path in (batch / 'runs').glob('*.json'):
        record = json.loads(path.read_text(encoding='utf-8'))
        key = (str(record['level_id']), record['solver'], int(record['repeat_index']))
        require(key not in details, f'Duplicate JSON run: {key}')
        details[key] = record
    seen = set()
    for row in rows:
        require(None not in row and None not in row.values(), 'Malformed CSV row')
        run_id = (row['level_id'], row['solver'], row['repeat_index'])
        repeat = number(row['repeat_index'], f'{run_id}: repeat_index', integer=True)
        key = (row['level_id'], row['solver'], repeat)
        require(key in expected and key not in seen, f'Unexpected or duplicate run: {key}')
        seen.add(key)
        status = row['status']
        require(status in STATUSES, f'{run_id}: unknown status {status}')
        record = details.get(key)
        require(record is not None, f'{run_id}: missing JSON')
        require(all(str(record.get(k)) == row[k] for k in CSV_HEADERS), f'{run_id}: CSV/JSON mismatch')
        require(isinstance(record['moves'], list), f'{run_id}: invalid moves')
        values = {}
        for metric in RAW_METRICS:
            value = row[metric]
            values[metric] = None if value == '' else number(
                value, f'{run_id}: {metric}', integer=metric in ('expanded_nodes', 'solution_length'))
        if status == 'SOLVED':
            require(all(values[k] is not None for k in RAW_METRICS), f'{run_id}: missing solved metric')
            require(values['solution_length'] == len(record['moves']),
                    f'{run_id}: length mismatch')
            require(values['path_cost'] >= values['solution_length'], f'{run_id}: cost below length')
        elif status == 'NO_SOLUTION':
            require(all(values[k] is not None for k in SEARCH_METRICS), f'{run_id}: missing search metric')
            require(all(values[k] is None for k in ('solution_length', 'path_cost'))
                    and not record['moves'], f'{run_id}: invalid unsolved result')
        elif status in ('TIMEOUT', 'ERROR'):
            require(all(v is None for v in values.values()) and not record['moves'],
                    f'{run_id}: unmeasured metrics must be blank')
        if status in ('TIMEOUT', 'ERROR', 'INVALID_PATH'):
            require(bool(record.get('error_message')), f'{run_id}: missing failure reason')
        row['_values'] = values
    require(seen == expected, f'Incomplete batch: expected {len(expected)} runs, found {len(seen)}')
    require(set(details) == seen, 'Extra or missing run JSON')
    return rows, config


def summarize_batch(batch, output=None):
    rows, config = load_batch(batch)
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
            record = dict(level_id=lid, solver=solver, runs=len(runs),
                          solved=counts['SOLVED'], no_solution=counts['NO_SOLUTION'], timeouts=counts['TIMEOUT'],
                          errors=counts['ERROR'], invalid_paths=counts['INVALID_PATH'])
            for metric in METRICS:
                samples = completed if metric in SEARCH_METRICS else solved
                values = [row['_values'][metric] for row in samples]
                record[f'{metric}_median'] = round(statistics.median(values), 6) if values else ''
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
    parser.add_argument('--output', type=Path, help='NEW CSV path; default: batch/summary.csv')
    args = parser.parse_args(argv)
    try:
        result = summarize_batch(args.batch, args.output)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        parser.error(str(exc))
    print(f'Saved {len(result)} level/solver groups; {sum(r["runs"] for r in result)} runs; '
          f'{sum(r["solved"] for r in result)} SOLVED. Input measurements unchanged.')
    return 0



if __name__ == "__main__":
    raise SystemExit(summarize_main())
