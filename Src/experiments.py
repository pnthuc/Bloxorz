# Source/experiments.py
import argparse
import csv
import json
import multiprocessing as mp
import os
import platform
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SRC_DIR.parent
DEFAULT_OUTPUT_DIR = str(PROJECT_ROOT / "handoff" / "quan" / "benchmarks")
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from main import load_all_levels
from game_logic import BloxorzBoard
from solvers import solve_bfs, solve_dfs, solve_ucs, solve_astar
from tests.helpers import replay_solution

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
    }
    with open(out_dir / "environment.json", "w", encoding="utf-8") as f:
        json.dump(env_info, f, indent=2, ensure_ascii=False)

    with open(out_dir / "run-config.json", "w", encoding="utf-8") as f:
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


def run_single_solver(solver_name: str, level_data: dict, timeout_sec: float) -> dict:
    """Điều phối 1 lượt chạy với cơ chế ngắt Timeout và kiểm chứng Replay."""
    parent_conn, child_conn = mp.Pipe(duplex=False)
    proc = mp.Process(
        target=_worker_solver_process,
        args=(solver_name, level_data, child_conn),
    )
    proc.start()
    child_conn.close()

    proc.join(timeout=timeout_sec)

    # 1. Trường hợp bị TIMEOUT
    if proc.is_alive():
        proc.terminate()
        proc.join(timeout=2.0)
        if proc.is_alive():
            proc.kill()
        parent_conn.close()
        return {
            "status": "TIMEOUT",
            "search_time_ms": "",
            "memory_kb": "",
            "expanded_nodes": "",
            "solution_length": "",
            "rolling_steps": "",
            "total_cost": "",
            "path_cost": "",
            "error_message": f"Vượt quá giới hạn thời gian {timeout_sec}s",
            "moves": [],
        }

    # 2. Trường hợp hoàn thành trong thời gian cho phép
    if parent_conn.poll():
        resp = parent_conn.recv()
        parent_conn.close()
        if not resp.get("success"):
            return {
                "status": "ERROR",
                "search_time_ms": "",
                "memory_kb": "",
                "expanded_nodes": "",
                "solution_length": "",
                "rolling_steps": "",
                "total_cost": "",
                "path_cost": "",
                "error_message": resp.get("error", "Lỗi không xác định trong solver"),
                "moves": [],
            }

        solver_data = resp.get("data", {})
        found = solver_data.get("found", False)
        moves = solver_data.get("moves", [])

        if found:
            # Replay kiểm chứng đường đi và tính path_cost ngoài vùng đo profiler
            board_verify = BloxorzBoard(level_data)
            replay = replay_solution(board_verify, moves)
            status = "SOLVED" if replay.valid else "INVALID_PATH"
            path_cost = round(replay.cost, 2)
            err_msg = "" if replay.valid else f"Đường đi không hợp lệ: {replay.message}"
        else:
            status = "NO_SOLUTION"
            path_cost = ""
            err_msg = ""

        sol_len = len(moves) if found else ""
        roll_steps = len(moves) if found else ""

        return {
            "status": status,
            "search_time_ms": solver_data.get("search_time_ms", ""),
            "memory_kb": solver_data.get("memory_kb", ""),
            "expanded_nodes": solver_data.get("expanded_nodes", ""),
            "solution_length": sol_len,
            "rolling_steps": roll_steps,
            "total_cost": solver_data.get("total_cost", ""),
            "path_cost": path_cost,
            "error_message": err_msg,
            "moves": moves,
        }

    parent_conn.close()
    return {
        "status": "ERROR",
        "search_time_ms": "",
        "memory_kb": "",
        "expanded_nodes": "",
        "solution_length": "",
        "rolling_steps": "",
        "total_cost": "",
        "path_cost": "",
        "error_message": f"Tiến trình kết thúc với mã {proc.exitcode} mà không có dữ liệu",
        "moves": [],
    }


def run_benchmarks(
    selected_levels=None,
    selected_solvers=None,
    repeats=1,
    timeout=60.0,
    output_dir=DEFAULT_OUTPUT_DIR,
):
    all_levels = load_all_levels()

    # Lọc danh sách màn chơi
    if selected_levels and "all" not in selected_levels:
        levels = {lid: data for lid, data in all_levels.items() if str(lid) in selected_levels}
    else:
        levels = all_levels

    # Lọc thuật toán
    if selected_solvers and "all" not in selected_solvers:
        solvers = [s.lower() for s in selected_solvers if s.lower() in SOLVER_MAP]
    else:
        solvers = list(SOLVER_MAP.keys())

    out_path = Path(output_dir).resolve()
    runs_dir = out_path / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)

    # Lưu metadata môi trường
    run_config = {
        "levels": list(levels.keys()),
        "solvers": solvers,
        "repeats": repeats,
        "timeout_sec": timeout,
    }
    save_environment_metadata(out_path, run_config)

    # Thiết lập file CSV ghi lũy tiến
    raw_csv_path = out_path / "raw.csv"
    csv_exists = raw_csv_path.exists() and raw_csv_path.stat().st_size > 0
    csv_file = open(raw_csv_path, "a", newline="", encoding="utf-8")
    writer = csv.DictWriter(csv_file, fieldnames=CSV_HEADERS)
    if not csv_exists:
        writer.writeheader()
        csv_file.flush()

    print("=" * 105)
    print(f"{'Stage':<24} | {'Algo':<5} | {'Status':<10} | {'Time (ms)':>10} | {'Mem (KB)':>9} | {'Expanded':>8} | {'Moves':>5} | {'PathCost':>8}")
    print("=" * 105)

    try:
        for lvl_id in sorted(levels.keys(), key=lambda x: int(x) if x.isdigit() else 999):
            lvl_data = levels[lvl_id]
            for rep in range(1, repeats + 1):
                for solver_name in solvers:
                    res = run_single_solver(solver_name, lvl_data, timeout_sec=timeout)

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


def main():
    parser = argparse.ArgumentParser(description="Bloxorz Benchmarking CLI with Progressive Logging")
    parser.add_argument("--levels", nargs="+", default=["all"], help="Danh sách ID màn cần chạy")
    parser.add_argument("--solvers", nargs="+", default=["all"], help="Danh sách thuật toán: bfs dfs ucs astar")
    parser.add_argument("--repeats", type=int, default=1, help="Số lần lặp lại cho mỗi màn")
    parser.add_argument("--timeout", type=float, default=60.0, help="Giới hạn thời gian (giây), mặc định 60s")
    parser.add_argument("--output-dir", type=str, default=DEFAULT_OUTPUT_DIR, help="Thư mục xuất CSV/JSON")
    args = parser.parse_args()

    run_benchmarks(
        selected_levels=args.levels,
        selected_solvers=args.solvers,
        repeats=args.repeats,
        timeout=args.timeout,
        output_dir=args.output_dir,
    )


if __name__ == "__main__":
    mp.freeze_support()
    main()
