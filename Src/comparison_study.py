"""Reproducible diagnostic cases and sequential, isolated solver comparisons.

Supports both repository layouts. --source-root selects the actual engine/solvers;
the measured source, action model and fingerprints are always recorded.
"""
import argparse
import csv
from datetime import datetime, timedelta, timezone
import hashlib
import importlib
import json
import math
import platform
from pathlib import Path
from queue import Empty, Queue
import random
import statistics
import subprocess
import sys
from tempfile import TemporaryFile
from threading import Thread
import time

HERE = Path(__file__).resolve().parent
SOLVERS = ("bfs", "dfs", "ucs", "astar")
METRICS = ("search_time_ms", "memory_kb", "expanded_nodes", "solution_length", "path_cost")


def rotate_board(board):
    """Clockwise grid rotation, including switch and teleport coordinates."""
    board = json.loads(json.dumps(board))
    height = len(board["grid"])
    position = lambda p: [p[1], height - 1 - p[0]]
    board["grid"] = [list(row) for row in zip(*board["grid"][::-1])]
    board["start_pos"] = position(board["start_pos"])
    switches = {}
    for key, switch in board.get("switches", {}).items():
        r, c = position(list(map(int, key.split(","))))
        if switch.get("behavior") == "split":
            switch["targets"] = [position(p) for p in switch["targets"]]
        switches[f"{r},{c}"] = switch
    board["switches"] = switches
    return board


def synthetic_board(shape):
    if shape == "corridor":
        grid, start, goal = [[1] * 16], [0, 0], [0, 15]
    elif shape == "shallow":
        grid, start, goal = [[1] * 15 for _ in range(15)], [7, 7], [7, 4]
    elif shape == "open":
        grid, start, goal = [[1] * 15 for _ in range(15)], [1, 1], [13, 13]
    elif shape == "detour":
        grid = [[int(c != 11 or r >= 14) for c in range(23)] for r in range(18)]
        start, goal = [2, 8], [2, 14]
    elif shape == "weighted":
        grid = [[int(r <= 1 or r >= 4 or c <= 2 or c >= 24)
                 for c in range(28)] for r in range(6)]
        for r in range(2):
            for c in range(3, 24):
                grid[r][c] = 1 if c % 3 == 1 else 2
        start, goal = [1, 1], [1, 25]
    elif shape == "unreachable":
        grid = [[int(c < 15) for c in range(18)] for _ in range(15)]
        start, goal = [7, 7], [7, 17]
    else:
        raise ValueError(f"Unknown shape: {shape}")
    grid[goal[0]][goal[1]] = 9
    return {"grid": grid, "start_pos": start, "initial_bridges": [], "switches": {}}


def load_cases(source, catalog=HERE / "benchmark_cases" / "comparison.json"):
    source = Path(source)
    levels = {}
    for path in (source / "levels").glob("*.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        levels[str(data["id"])] = data
    expectations = json.loads((source / "tests" / "test_cases.json").read_text(encoding="utf-8"))
    cases = []
    for spec in json.loads(Path(catalog).read_text(encoding="utf-8"))["cases"]:
        if "case_id" in spec:
            expected = expectations[spec["case_id"]]
            board = expected["board"] if "board" in expected else levels[expected["level"]]
        elif "level_id" in spec:
            board = levels[spec["level_id"]]
            expected = expectations[spec["level_id"]]
        else:
            board, expected = synthetic_board(spec["shape"]), spec
        for angle in spec.get("rotations", [0]):
            variant = json.loads(json.dumps(board))
            for _ in range(angle // 90):
                variant = rotate_board(variant)
            case_id = spec["id"] if "level_id" in spec or "case_id" in spec else f"{spec['id']}-r{angle:03}"
            variant.update(id=case_id, name=case_id)
            cases.append({"id": case_id, "family": spec["family"], "angle": angle,
                          "purpose": spec["purpose"], "board": variant,
                          "solvable": expected.get("solvable", True),
                          "bfs_moves": expected.get("bfs_moves"),
                          "ucs_cost": expected.get("ucs_cost")})
    return cases


def engine(source):
    sys.path.insert(0, str(Path(source).resolve()))
    board_module = importlib.import_module("core.board" if (Path(source) / "core" / "board.py").exists() else "game_logic")
    solvers = importlib.import_module("solvers")
    cost = importlib.import_module("solvers.costs").step_cost
    return board_module, solvers, cost


def worker(source):
    board_module, solvers, _ = engine(source)
    payload = json.loads(sys.stdin.readline())
    board = board_module.BloxorzBoard(payload["board"])
    print(json.dumps({"phase": "ready"}), flush=True)
    try:
        result = getattr(solvers, "solve_" + payload["solver"])(board)
        print(json.dumps({"phase": "result", "result": result}), flush=True)
    except Exception as exc:
        print(json.dumps({"phase": "error", "error": repr(exc)}), flush=True)


def isolated_run(source, board, solver, seconds, output):
    messages = Queue()
    with TemporaryFile(dir=output) as errors:
        proc = subprocess.Popen([sys.executable, "-X", "utf8", "-u", str(Path(__file__).resolve()),
                                 "--worker", "--source-root", str(source)],
                                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errors,
                                text=True, encoding="utf-8")
        def read():
            try:
                for line in proc.stdout:
                    messages.put(json.loads(line))
            except Exception as exc:
                messages.put({"phase": "error", "error": repr(exc)})
            finally:
                messages.put({"phase": "error", "error": "Worker exited without a result"})
        reader = Thread(target=read, daemon=True)
        reader.start()
        try:
            proc.stdin.write(json.dumps({"board": board, "solver": solver}) + "\n")
            proc.stdin.close()
            first = messages.get(timeout=15)
            if first.get("phase") != "ready":
                return {"status": "ERROR", "error": first.get("error", "Bad startup protocol")}
            try:
                reply = messages.get(timeout=seconds)
            except Empty:
                return {"status": "TIMEOUT"}
            if reply.get("phase") != "result":
                return {"status": "ERROR", "error": reply.get("error", "Bad worker protocol")}
            return {"status": "COMPLETED", "result": reply["result"]}
        except (Empty, OSError) as exc:
            return {"status": "ERROR", "error": "Worker startup: " + repr(exc)}
        finally:
            if proc.poll() is None:
                proc.kill()
            proc.wait()
            reader.join(timeout=1)
            proc.stdout.close()
            if not proc.stdin.closed:
                proc.stdin.close()


def validate(case, solver, raw, board_module, step_cost):
    required = {"found", "moves", "solution_length", "total_cost", "expanded_nodes", "search_time_ms", "memory_kb"}
    if not isinstance(raw, dict) or not required <= raw.keys():
        raise ValueError("Missing result fields")
    if type(raw["found"]) is not bool or not isinstance(raw["moves"], list):
        raise ValueError("Invalid found/moves types")
    for key in ("solution_length", "expanded_nodes"):
        if type(raw[key]) is not int or raw[key] < 0:
            raise ValueError(f"Invalid {key}")
    for key in ("search_time_ms", "memory_kb", "total_cost"):
        if type(raw[key]) not in (int, float) or not math.isfinite(raw[key]) or raw[key] < 0:
            raise ValueError(f"Invalid {key}")
    if raw["found"] != case["solvable"] or raw["solution_length"] != len(raw["moves"]):
        raise ValueError("Incorrect solvability/length")
    if not raw["found"]:
        if raw["moves"] or raw["total_cost"]:
            raise ValueError("Unsolved answer has nonzero moves/cost")
        return None
    board = board_module.BloxorzBoard(case["board"])
    state, cost = board.get_initial_state(), 0.0
    for action in raw["moves"]:
        state = board.apply_move(state, action)
        if state is None:
            raise ValueError(f"Invalid solution move {action}")
        cost += step_cost(board, state)
    if not board.is_goal(state):
        raise ValueError("Answer does not reach goal")
    reported = len(raw["moves"]) if solver in ("bfs", "dfs") else cost
    if raw["total_cost"] != reported:
        raise ValueError("Reported cost disagrees with replay")
    if solver == "bfs" and len(raw["moves"]) != case["bfs_moves"]:
        raise ValueError("BFS disagrees with expected optimal length")
    if solver in ("ucs", "astar") and cost != case["ucs_cost"]:
        raise ValueError("Weighted solver disagrees with expected optimum")
    return cost


def summarize(rows):
    summary = []
    for case_id, solver in sorted({(r["case_id"], r["solver"]) for r in rows}):
        group = [r for r in rows if r["case_id"] == case_id and r["solver"] == solver]
        good = [r for r in group if r["status"] in ("SOLVED", "NO_SOLUTION")]
        row = {k: group[0][k] for k in ("case_id", "family", "angle", "solver")}
        row.update(runs=len(group), completed=len(good), solved=sum(r["status"] == "SOLVED" for r in group),
                   timeouts=sum(r["status"] == "TIMEOUT" for r in group),
                   errors=sum(r["status"] in ("ERROR", "INVALID") for r in group))
        for key in METRICS:
            values = [r[key] for r in good if r.get(key) is not None]
            row[key + "_median"] = statistics.median(values) if values else None
        times = [r["search_time_ms"] for r in good]
        row["time_min_ms"] = min(times) if times else None
        row["time_max_ms"] = max(times) if times else None
        if len(times) >= 2:
            q = statistics.quantiles(times, n=4, method="inclusive")
            row["time_iqr_ms"] = q[2] - q[0]
        else:
            row["time_iqr_ms"] = None
        summary.append(row)
    return summary


def write_csv(path, rows):
    with Path(path).open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, default=HERE)
    parser.add_argument("--source-commit", default="unspecified")
    parser.add_argument("--catalog", type=Path, default=HERE / "benchmark_cases" / "comparison.json")
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--repeats", type=int, default=5)
    parser.add_argument("--timeout", type=float, default=10)
    parser.add_argument("--seed", type=int, default=20261031)
    parser.add_argument("--cases", nargs="+", help="Optional case IDs, e.g. C02-r090 C05-r000 B32")
    parser.add_argument("--solvers", nargs="+", choices=SOLVERS, default=list(SOLVERS))
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    if args.worker:
        worker(args.source_root)
        return 0
    if not args.output_dir or args.repeats < 1 or not math.isfinite(args.timeout) or args.timeout <= 0:
        parser.error("Provide a NEW --output-dir, repeats >= 1 and a finite positive timeout")
    source, output = args.source_root.resolve(), args.output_dir.resolve()
    cases = load_cases(source, args.catalog)
    if args.cases:
        unknown = set(args.cases) - {case["id"] for case in cases}
        if unknown:
            parser.error("Unknown cases: " + ", ".join(sorted(unknown)))
        cases = [case for case in cases if case["id"] in args.cases]
    output.mkdir(parents=True, exist_ok=False)
    (output / "runs").mkdir()
    board_module, _, step_cost = engine(source)
    files = [*sorted((source / "solvers").glob("*.py")),
             source / ("core/board.py" if (source / "core/board.py").exists() else "game_logic.py")]
    hashes = {str(p.relative_to(source)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    metadata = {"started_at": datetime.now(timezone(timedelta(hours=7))).isoformat(),
                "source_root": str(source), "source_commit_label": args.source_commit,
                "source_sha256": hashes, "python": sys.version, "os": platform.platform(),
                "cpu": platform.processor(), "seed": args.seed, "repeats": args.repeats,
                "solvers": args.solvers,
                "search_timeout_seconds": args.timeout, "sequential": True,
                "action_model": list(getattr(board_module, "SEARCH_ACTIONS", ("UP", "DOWN", "LEFT", "RIGHT", "SPACE"))),
                "case_manifest_sha256": hashlib.sha256(json.dumps(cases, sort_keys=True).encode()).hexdigest(),
                "method": "Fresh worker per run; public profiler; replay/validation in parent after result; randomized solver order per case/repeat; median and inclusive IQR; no parallel timing."}
    (output / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    (output / "cases.json").write_text(json.dumps(cases, ensure_ascii=False, indent=2), encoding="utf-8")
    rows, rng = [], random.Random(args.seed)
    for repeat in range(1, args.repeats + 1):
        order = list(cases)
        rng.shuffle(order)
        for case in order:
            solvers = list(args.solvers)
            rng.shuffle(solvers)
            for solver in solvers:
                measured = isolated_run(source, case["board"], solver, args.timeout, output)
                raw = measured.get("result")
                row = {"case_id": case["id"], "family": case["family"], "angle": case["angle"],
                       "solver": solver, "repeat": repeat, "status": measured["status"],
                       **{k: None for k in METRICS}, "total_cost": None, "error": measured.get("error", "")}
                if raw is not None:
                    try:
                        path_cost = validate(case, solver, raw, board_module, step_cost)
                        row.update({k: raw[k] for k in METRICS if k != "path_cost"})
                        row.update(path_cost=path_cost, total_cost=raw["total_cost"],
                                   status="SOLVED" if raw["found"] else "NO_SOLUTION")
                    except Exception as exc:
                        row.update(status="INVALID", error=repr(exc))
                rows.append(row)
                write_csv(output / "raw.csv", rows)
                name = f"{case['id']}_{solver}_{repeat}"
                (output / "runs" / (name + ".json")).write_text(json.dumps({**row, "solver_result": raw}, ensure_ascii=False, indent=2), encoding="utf-8")
                print(name, row["status"], row["search_time_ms"], flush=True)
    write_csv(output / "summary.csv", summarize(rows))
    errors = sum(r["status"] in ("ERROR", "INVALID") for r in rows)
    print(f"Saved {len(rows)} runs; {errors} errors/invalid answers: {output}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
