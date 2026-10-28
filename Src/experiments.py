# Source/experiments.py
import argparse
import sys
import os
import matplotlib.pyplot as plt
import multiprocessing as mp
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parent
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
            "search_time_ms": None,
            "memory_kb": None,
            "expanded_nodes": None,
            "solution_length": None,
            "total_cost": None,
            "path_cost": None,
            "moves": [],
        }
    
    # 2. Trường hợp hoàn thành trong thời gian cho phép
    if parent_conn.poll():
        resp = parent_conn.recv()
        parent_conn.close()
        if not resp.get("success"):
            return {
                "status": "ERROR",
                "search_time_ms": None,
                "memory_kb": None,
                "expanded_nodes": None,
                "solution_length": None,
                "total_cost": None,
                "path_cost": None,
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
        else:
            status = "NO_SOLUTION"
            path_cost = None

        return {
            "status": status,
            "search_time_ms": solver_data.get("search_time_ms"),
            "memory_kb": solver_data.get("memory_kb"),
            "expanded_nodes": solver_data.get("expanded_nodes"),
            "solution_length": len(moves) if found else None,
            "total_cost": solver_data.get("total_cost"),
            "path_cost": path_cost,
            "moves": moves,
        }
    
    parent_conn.close()
    return {
        "status": "ERROR",
        "search_time_ms": None,
        "memory_kb": None,
        "expanded_nodes": None,
        "solution_length": None,
        "total_cost": None,
        "path_cost": None,
        "moves": [],
    }


def run_benchmarks(selected_levels=None, selected_solvers=None, repeats=1, timeout=60.0):
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

    print("=" * 105)
    print(f"{'Stage':<24} | {'Algo':<5} | {'Status':<10} | {'Time (ms)':>10} | {'Mem (KB)':>9} | {'Expanded':>8} | {'Moves':>5} | {'PathCost':>8}")
    print("=" * 105)

    for lvl_id in sorted(levels.keys(), key=lambda x: int(x) if x.isdigit() else 999):
        lvl_data = levels[lvl_id]
        for rep in range(1, repeats + 1):
            for solver_name in solvers:
                res = run_single_solver(solver_name, lvl_data, timeout_sec=timeout)

                rep_str = f" #{rep}" if repeats > 1 else ""
                lvl_title = lvl_data.get("name", f"Stage {lvl_id}")

                t_str = f"{res['search_time_ms']:.2f}" if res['search_time_ms'] is not None else "-"
                m_str = f"{res['memory_kb']:.2f}" if res['memory_kb'] is not None else "-"
                n_str = str(res['expanded_nodes']) if res['expanded_nodes'] is not None else "-"
                l_str = str(res['solution_length']) if res['solution_length'] is not None else "-"
                c_str = f"{res['path_cost']:.1f}" if res['path_cost'] is not None else "-"

                print(
                    f"{lvl_title[:20] + rep_str:<24} | {solver_name.upper():<5} | {res['status']:<10} | "
                    f"{t_str:>10} | {m_str:>9} | {n_str:>8} | {l_str:>5} | {c_str:>8}"
                )

        print("-" * 105)


def main():
    parser = argparse.ArgumentParser(description="Bloxorz Benchmarking CLI")
    parser.add_argument("--levels", nargs="+", default=["all"], help="Danh sách ID màn cần chạy")
    parser.add_argument("--solvers", nargs="+", default=["all"], help="Danh sách thuật toán: bfs dfs ucs astar")
    parser.add_argument("--repeats", type=int, default=1, help="Số lần lặp lại cho mỗi màn")
    parser.add_argument("--timeout", type=float, default=60.0, help="Giới hạn thời gian (giây), mặc định 60s")
    args = parser.parse_args()

    run_benchmarks(
        selected_levels=args.levels,
        selected_solvers=args.solvers,
        repeats=args.repeats,
        timeout=args.timeout,
    )


if __name__ == "__main__":
    mp.freeze_support()
    main()
