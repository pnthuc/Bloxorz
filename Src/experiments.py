# Source/experiments.py
import os
import matplotlib.pyplot as plt
from main import load_all_levels
from game_logic import BloxorzBoard
from solvers import solve_bfs, solve_dfs, solve_ucs, solve_astar


def run_benchmarks():
    levels = load_all_levels()
    algorithms = [
        ("BFS", solve_bfs),
        ("DFS", solve_dfs),
        ("UCS", solve_ucs),
        ("A*", solve_astar),
    ]

    summary = {algo_name: {"time": [], "mem": [], "nodes": [], "len": []} for algo_name, _ in algorithms}
    stage_names = []

    print("=" * 88)
    print(f"{'Stage':<28} | {'Algo':<5} | {'Time (ms)':>10} | {'Mem (KB)':>9} | {'Expanded':>9} | {'Moves':>6} | {'Cost':>6}")
    print("=" * 88)

    for lvl_id, lvl_data in levels.items():
        board = BloxorzBoard(lvl_data)
        short_name = f"Stage {lvl_id}"
        stage_names.append(short_name)

        for algo_name, solver_fn in algorithms:
            try:
                res = solver_fn(board)
            except NotImplementedError as error:
                print(f"PENDING: {error}")
                print("Hoàn thiện cả 4 thuật toán và chạy run_tests.py trước khi đo so sánh.")
                return False
            summary[algo_name]["time"].append(res["search_time_ms"])
            summary[algo_name]["mem"].append(res["memory_kb"])
            summary[algo_name]["nodes"].append(res["expanded_nodes"])
            summary[algo_name]["len"].append(res["solution_length"])

            print(
                f"{lvl_data['name'][:28]:<28} | {algo_name:<5} | "
                f"{res['search_time_ms']:>10.3f} | {res['memory_kb']:>9.2f} | "
                f"{res['expanded_nodes']:>9d} | {res['solution_length']:>6d} | {res['total_cost']:>6.1f}"
            )
        print("-" * 88)

    # Vẽ 4 biểu đồ so sánh (Search Time, Memory Usage, Expanded Nodes, Solution Length)
    fig, axes = plt.subplots(2, 2, figsize=(13, 9))
    fig.suptitle("Comparison of Search Algorithms on Bloxorz Stages", fontsize=15, fontweight="bold")

    metrics_cfg = [
        ("time", "Search Time (ms)", axes[0, 0]),
        ("mem", "Peak Memory Usage (KB)", axes[0, 1]),
        ("nodes", "Expanded Nodes", axes[1, 0]),
        ("len", "Solution Length (Moves)", axes[1, 1]),
    ]

    x = range(len(stage_names))
    width = 0.2
    colors = ["#38bdf8", "#f43f5e", "#f59e0b", "#10b981"]

    for key, title, ax in metrics_cfg:
        for i, (algo_name, _) in enumerate(algorithms):
            offset = [pos + (i - 1.5) * width for pos in x]
            ax.bar(offset, summary[algo_name][key], width=width, label=algo_name, color=colors[i])
        ax.set_title(title, fontweight="bold")
        ax.set_xticks(list(x))
        ax.set_xticklabels(stage_names)
        ax.grid(axis="y", linestyle="--", alpha=0.4)
        ax.legend()

    plt.tight_layout()
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "experiments_comparison.png")
    plt.savefig(out_path, dpi=200)
    print(f"\nĐã xuất biểu đồ so sánh chất lượng cao tại: {out_path}")


if __name__ == "__main__":
    run_benchmarks()
