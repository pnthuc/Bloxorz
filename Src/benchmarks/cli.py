"""Command-line benchmarking: python -m benchmarks.cli."""
import argparse
import csv
import json
import multiprocessing as mp
import platform
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

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
    "level_id", "solver", "repeat_index", "status", "search_time_ms",
    "memory_kb", "expanded_nodes", "solution_length", "path_cost",
]


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
        "date": datetime.now().isoformat(),
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
    if (out_path / "raw.csv").exists():
        raise ValueError("Thư mục đã có raw.csv. Hãy chọn --output-dir mới để không trộn các đợt đo.")
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
    csv_file = open(raw_csv_path, "x", newline="", encoding="utf-8")
    writer = csv.DictWriter(csv_file, fieldnames=CSV_HEADERS)
    writer.writeheader()
    csv_file.flush()

    print("=" * 105)
    print(f"{'Stage':<24} | {'Algo':<5} | {'Status':<10} | {'Time (ms)':>10} | {'Mem (KB)':>9} | {'Expanded':>8} | {'Moves':>5} | {'PathCost':>8}")
    print("=" * 105)

    try:
        for lvl_id in sorted(levels.keys(), key=lambda x: (0, int(x)) if x.isdigit() else (1, x)):
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
                        "path_cost": res["path_cost"],
                        "timestamp": now_iso,
                        "error_message": res["error_message"],
                    }

                    # Ghi ngay dòng CSV (Streaming)
                    writer.writerow({key: record[key] for key in CSV_HEADERS})
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


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    parser = argparse.ArgumentParser(description="Bloxorz Benchmarking CLI with Progressive Logging")
    parser.add_argument("--levels", nargs="+", default=["all"], help="Danh sách ID màn cần chạy")
    parser.add_argument("--solvers", nargs="+", default=["all"], help="Danh sách thuật toán: bfs dfs ucs astar")
    parser.add_argument("--repeats", type=int, default=1, help="Số lần lặp lại cho mỗi màn")
    parser.add_argument("--timeout", type=float, default=60.0, help="Giới hạn thời gian (giây), mặc định 60s")
    parser.add_argument("--output-dir", type=str, default=DEFAULT_OUTPUT_DIR, help="Thư mục xuất CSV/JSON")
    args = parser.parse_args(argv)

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
