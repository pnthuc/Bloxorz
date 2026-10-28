# Source/experiments.py
import argparse
import sys
import os
import matplotlib.pyplot as plt

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from main import load_all_levels
from game_logic import BloxorzBoard
from solvers import solve_bfs, solve_dfs, solve_ucs, solve_astar

SOLVER_MAP = {
    "bfs": ("BFS", solve_bfs),
    "dfs": ("DFS", solve_dfs),
    "ucs": ("UCS", solve_ucs),
    "astar": ("A*", solve_astar),
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
        algorithms = [SOLVER_MAP[s.lower()] for s in selected_solvers if s.lower() in SOLVER_MAP]
    else:
        algorithms = list(SOLVER_MAP.values())

    print("=" * 88)
    print(f"{'Stage':<28} | {'Algo':<5} | {'Time (ms)':>10} | {'Mem (KB)':>9} | {'Expanded':>9} | {'Moves':>6} | {'Cost':>6}")
    print("=" * 88)

    for lvl_id, lvl_data in levels.items():
        for rep in range(1, repeats + 1):
            board = BloxorzBoard(lvl_data)
            for algo_name, solver_fn in algorithms:
                try:
                    res = solver_fn(board)
                except NotImplementedError as error:
                    print(f"PENDING: {error}")
                    return False
                
                rep_str = f" #{rep}" if repeats > 1 else ""
                lvl_title = lvl_data.get("name", f"Stage {lvl_id}")
                print(
                    f"{lvl_title[:24] + rep_str:<28} | {algo_name:<5} | "
                    f"{res['search_time_ms']:>10.3f} | {res['memory_kb']:>9.2f} | "
                    f"{res['expanded_nodes']:>9d} | {res['solution_length']:>6d} | {res['total_cost']:>6.1f}"
                )
        print("-" * 88)


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
    main()
