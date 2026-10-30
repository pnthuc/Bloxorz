"""Command-line benchmarking: python -m benchmarks.cli."""
import argparse
import csv
import json
import hashlib
import math
import multiprocessing as mp
import platform
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from uuid import uuid4

SRC_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = SRC_DIR.parent
DEFAULT_OUTPUT_DIR = str(PROJECT_ROOT / "handoff" / "quan" / "benchmarks")

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from core.levels import load_all_levels
from core.board import BloxorzBoard
from solvers import solve_bfs, solve_dfs, solve_ucs, solve_astar
from core.replay import replay_solution

SOLVER_MAP = {
    "bfs": solve_bfs,
    "dfs": solve_dfs,
    "ucs": solve_ucs,
    "astar": solve_astar,
}

CSV_HEADERS = [
    "run_id",
    "level_id",
    "level_name",
    "solver",
    "repeat_index",
    "status",
    "search_time_ms",
    "memory_kb",
    "expanded_nodes",
    "solution_length",
    "rolling_steps",
    "total_cost",
    "path_cost",
    "timeout_sec",
    "timestamp",
    "error_message",
]


def get_git_commit() -> str:
    """Lấy commit hash hiện tại của repository."""
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=str(SRC_DIR),
            text=True,
            stderr=subprocess.DEVNULL,
        )
        return out.strip()
    except Exception:
        return "UNKNOWN"


def get_cpu_and_ram() -> tuple[str, str]:
    """Lấy tên CPU chi tiết và tổng dung lượng RAM."""
    cpu_name = platform.processor()
    ram_str = "Unknown"
    if sys.platform == "win32":
        try:
            cmd_cpu = ["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_Processor).Name"]
            out_cpu = subprocess.check_output(cmd_cpu, text=True).strip()
            if out_cpu:
                cpu_name = out_cpu
        except Exception:
            pass
        try:
            cmd_ram = ["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum / 1GB"]
            out_ram = subprocess.check_output(cmd_ram, text=True).strip()
            if out_ram:
                ram_str = f"{round(float(out_ram), 1)} GB"
        except Exception:
            pass
    return cpu_name, ram_str


def save_environment_metadata(out_dir: Path, config: dict) -> None:
    """Lưu cấu hình hệ thống và thông số chạy benchmark."""
    out_dir.mkdir(parents=True, exist_ok=True)
    cpu_name, ram_str = get_cpu_and_ram()
    env_info = {
        "cpu": cpu_name,
        "ram": ram_str,
        "os": platform.platform(),
        "python_version": sys.version,
        "git_commit": get_git_commit(),
        "date": datetime.now().isoformat(),
        "timeout_sec": config.get("timeout_sec"),
        "repeats": config.get("repeats"),
        "source_sha256": {
            str(path.relative_to(SRC_DIR)).replace("\\", "/"): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in [SRC_DIR / "benchmarks" / "cli.py", SRC_DIR / "core" / "board.py", SRC_DIR / "core" / "replay.py",
                         *sorted((SRC_DIR / "solvers").glob("*.py"))]
        },
        "level_set_sha256": config["level_set_sha256"],
    }
    try:
        env_info["git_dirty"] = bool(subprocess.check_output(
            ["git", "status", "--porcelain", "--", "."], cwd=str(SRC_DIR), text=True,
            stderr=subprocess.DEVNULL).strip())
    except (OSError, subprocess.SubprocessError):
        env_info["git_dirty"] = None
    with open(out_dir / "environment.json", "x", encoding="utf-8") as f:
        json.dump(env_info, f, indent=2, ensure_ascii=False)

    with open(out_dir / "run-config.json", "x", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def _worker_solver_process(solver_name: str, level_data: dict, conn) -> None:
    """Tiến trình con cô lập để chạy solver an toàn và có thể ngắt khi hết giờ."""
    try:
        board = BloxorzBoard(level_data)
        solver_fn = SOLVER_MAP[solver_name]
        result = solver_fn(board)
        conn.send({"success": True, "data": result})
    except Exception as exc:
        conn.send({"success": False, "error": str(exc)})
    finally:
        conn.close()


def _empty_result(status: str, message: str) -> dict:
    return {
        "status": status,
        **{key: "" for key in ("search_time_ms", "memory_kb", "expanded_nodes",
                               "solution_length", "rolling_steps", "total_cost", "path_cost")},
        "error_message": message,
        "moves": [],
    }


def run_single_solver(solver_name: str, level_data: dict, timeout_sec: float) -> dict:
    """Chạy cô lập; timeout gồm khởi động tiến trình, replay nằm ngoài profiler."""
    parent_conn, child_conn = mp.Pipe(duplex=False)
    proc = mp.Process(target=_worker_solver_process,
                      args=(solver_name, level_data, child_conn))
    try:
        proc.start()
        child_conn.close()
        # Drain the pipe before joining: long answers can fill its buffer and
        # prevent an otherwise completed worker from exiting.
        if not parent_conn.poll(timeout_sec):
            return _empty_result("TIMEOUT", f"Vượt quá giới hạn thời gian {timeout_sec}s")
        resp = parent_conn.recv()
    except (EOFError, OSError, RuntimeError) as exc:
        return _empty_result("ERROR", f"Tiến trình đo bị gián đoạn: {exc}")
    finally:
        parent_conn.close()
        child_conn.close()
        if proc.pid is not None:
            proc.join(.2)
            if proc.is_alive():
                proc.terminate()
                proc.join(2)
            if proc.is_alive():
                proc.kill()
                proc.join()
            proc.close()

    if not resp.get("success"):
        return _empty_result("ERROR", resp.get("error", "Lỗi không xác định trong solver"))
    solver_data = resp.get("data", {})
    found = solver_data.get("found", False)
    moves = solver_data.get("moves", [])
    if found:
        replay = replay_solution(BloxorzBoard(level_data), moves)
        status = "SOLVED" if replay.valid else "INVALID_PATH"
        path_cost = round(replay.cost, 2)
        err_msg = "" if replay.valid else f"Đường đi không hợp lệ: {replay.reason}"
    else:
        status, path_cost, err_msg = "NO_SOLUTION", "", ""
    return {
        "status": status,
        **{key: solver_data.get(key, "") for key in
           ("search_time_ms", "memory_kb", "expanded_nodes", "total_cost")},
        "solution_length": len(moves) if found else "",
        "rolling_steps": len(moves) if found else "",
        "path_cost": path_cost,
        "error_message": err_msg,
        "moves": moves,
    }


def run_benchmarks(
    selected_levels=None,
    selected_solvers=None,
    repeats=1,
    timeout=60.0,
    output_dir=None,
):
    if type(repeats) is not int or repeats < 1:
        raise ValueError("Số lần lặp phải là số nguyên dương.")
    if type(timeout) not in (int, float) or not math.isfinite(timeout) or timeout <= 0:
        raise ValueError("Timeout phải là số hữu hạn lớn hơn 0.")
    all_levels = load_all_levels()

    def select(requested, available, label):
        names = list(dict.fromkeys(str(value).lower() for value in (requested or ["all"])))
        if names == ["all"]:
            return list(available)
        unknown = set(names) - set(available)
        if unknown:
            raise ValueError(f"{label} không hợp lệ: {', '.join(sorted(unknown))}")
        return names

    level_ids = select(selected_levels, all_levels, "ID màn")
    levels = {lid: all_levels[lid] for lid in level_ids}
    solvers = select(selected_solvers, SOLVER_MAP, "Thuật toán")
    if not levels:
        raise ValueError("Bộ màn trống.")

    batch_name = datetime.now().strftime("run-%Y%m%d-%H%M%S-") + uuid4().hex[:8]
    out_path = (Path(output_dir) if output_dir is not None else Path(DEFAULT_OUTPUT_DIR) / batch_name).resolve()
    # Never append a new batch under old metadata, even for an empty existing directory.
    out_path.mkdir(parents=True, exist_ok=False)
    runs_dir = out_path / "runs"
    runs_dir.mkdir()

    # Lưu metadata môi trường
    run_config = {
        "levels": list(levels.keys()),
        "solvers": solvers,
        "repeats": repeats,
        "timeout_sec": timeout,
        "level_set_sha256": hashlib.sha256(json.dumps(levels, sort_keys=True).encode()).hexdigest(),
    }
    save_environment_metadata(out_path, run_config)

    # One immutable batch per output directory; flush each completed row.
    raw_csv_path = out_path / "raw.csv"
    csv_file = open(raw_csv_path, "x", newline="", encoding="utf-8")
    writer = csv.DictWriter(csv_file, fieldnames=CSV_HEADERS)
    writer.writeheader()
    csv_file.flush()

    print("=" * 105)
    print(f"{'Stage':<24} | {'Algo':<5} | {'Status':<10} | {'Time (ms)':>10} | {'Mem (KB)':>9} | {'Expanded':>8} | {'Moves':>5} | {'PathCost':>8}")
    print("=" * 105)

    failures = 0
    try:
        for lvl_id in sorted(levels.keys(), key=lambda x: int(x) if x.isdigit() else 999):
            lvl_data = levels[lvl_id]
            for rep in range(1, repeats + 1):
                for solver_name in solvers:
                    try:
                        res = run_single_solver(solver_name, lvl_data, timeout_sec=timeout)
                    except Exception as exc:
                        res = _empty_result("ERROR", f"Lượt đo bị lỗi: {type(exc).__name__}: {exc}")
                    failures += res["status"] in ("ERROR", "INVALID_PATH")

                    run_id = f"lvl{lvl_id}_{solver_name}_rep{rep}_{int(time.time()*1000)}"
                    now_iso = datetime.now().isoformat()
                    lvl_title = lvl_data.get("name", f"Stage {lvl_id}")

                    record = {
                        "run_id": run_id,
                        "level_id": str(lvl_id),
                        "level_name": lvl_title,
                        "solver": solver_name,
                        "repeat_index": rep,
                        "status": res["status"],
                        "search_time_ms": res["search_time_ms"],
                        "memory_kb": res["memory_kb"],
                        "expanded_nodes": res["expanded_nodes"],
                        "solution_length": res["solution_length"],
                        "rolling_steps": res["rolling_steps"],
                        "total_cost": res["total_cost"],
                        "path_cost": res["path_cost"],
                        "timeout_sec": timeout,
                        "timestamp": now_iso,
                        "error_message": res["error_message"],
                    }

                    # Ghi ngay dòng CSV (Streaming)
                    writer.writerow(record)
                    csv_file.flush()

                    # Lưu JSON chi tiết lượt chạy
                    record_with_moves = dict(record)
                    record_with_moves["moves"] = res["moves"]
                    with open(runs_dir / f"{run_id}.json", "w", encoding="utf-8") as f_json:
                        json.dump(record_with_moves, f_json, indent=2, ensure_ascii=False)

                    # In ra màn hình console
                    rep_str = f" #{rep}" if repeats > 1 else ""
                    t_str = f"{res['search_time_ms']:.2f}" if isinstance(res['search_time_ms'], (int, float)) else "-"
                    m_str = f"{res['memory_kb']:.2f}" if isinstance(res['memory_kb'], (int, float)) else "-"
                    n_str = str(res['expanded_nodes']) if res['expanded_nodes'] != "" else "-"
                    l_str = str(res['solution_length']) if res['solution_length'] != "" else "-"
                    c_str = f"{res['path_cost']:.1f}" if isinstance(res['path_cost'], (int, float)) else "-"

                    print(
                        f"{lvl_title[:20] + rep_str:<24} | {solver_name.upper():<5} | {res['status']:<10} | "
                        f"{t_str:>10} | {m_str:>9} | {n_str:>8} | {l_str:>5} | {c_str:>8}"
                    )
            print("-" * 105)
    finally:
        csv_file.close()

    print(f"\nĐã xuất kết quả vào: {out_path}")
    return 1 if failures else 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="Bloxorz Benchmarking CLI with Progressive Logging")
    parser.add_argument("--levels", nargs="+", default=["all"], help="Danh sách ID màn cần chạy")
    parser.add_argument("--solvers", nargs="+", default=["all"], help="Danh sách thuật toán: bfs dfs ucs astar")
    parser.add_argument("--repeats", type=int, default=1, help="Số lần lặp lại cho mỗi màn")
    parser.add_argument("--timeout", type=float, default=60.0, help="Giới hạn thời gian (giây), mặc định 60s")
    parser.add_argument("--output-dir", type=str, help="Thư mục mới xuất CSV/JSON; mặc định tự tạo một đợt trong benchmarks/")
    args = parser.parse_args(argv)

    try:
        return run_benchmarks(selected_levels=args.levels, selected_solvers=args.solvers,
                              repeats=args.repeats, timeout=args.timeout, output_dir=args.output_dir)
    except (ValueError, FileExistsError) as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    mp.freeze_support()
    raise SystemExit(main())
