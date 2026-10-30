"""Plot saved trial data and export candidate boards without rerunning solvers."""
import argparse
import csv
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_dir", type=Path)
    args = parser.parse_args()
    root = args.run_dir.resolve()
    with (root / "summary.csv").open(encoding="utf-8", newline="") as stream:
        summary = list(csv.DictReader(stream))
    cases = json.loads((root / "cases.json").read_text(encoding="utf-8"))
    metadata = json.loads((root / "metadata.json").read_text(encoding="utf-8"))
    lookup = {(r["case_id"], r["solver"]): r for r in summary}
    case_lookup = {c["id"]: c for c in cases}
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np
    from matplotlib.colors import ListedColormap
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10,
                         "axes.spines.top": False, "axes.spines.right": False,
                         "figure.facecolor": "#fbfaf6", "axes.facecolor": "#fbfaf6"})
    solvers = ["bfs", "dfs", "ucs", "astar"]
    labels = ["BFS", "DFS", "UCS", "A*"]
    colors = ["#3478a4", "#db873b", "#368475", "#8a63a7"]
    quality = []
    for row in summary:
        case = case_lookup[row['case_id']]
        solved = int(row['solved']) > 0
        moves = float(row['solution_length_median']) if solved else None
        cost = float(row['path_cost_median']) if solved else None
        quality.append({'case_id': row['case_id'], 'family': row['family'], 'solver': row['solver'],
                        'time_median_ms': row['search_time_ms_median'], 'moves': moves, 'path_cost': cost,
                        'length_ratio': moves / case['bfs_moves'] if solved and case['bfs_moves'] else None,
                        'cost_ratio': cost / case['ucs_cost'] if solved and case['ucs_cost'] else None})
    with (root / 'quality.csv').open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(quality[0]))
        writer.writeheader()
        writer.writerows(quality)
    selected = [c for c in ["B04", "C02-r090", "C03-r000", "C05-r000", "B32", "C06-r000"] if c in case_lookup]
    names = {"B04":"Original split", "C02-r090":"Shallow goal 90°", "C03-r000":"Open field",
             "C05-r000":"Fragile tradeoff", "B32":"Teleport chain", "C06-r000":"Unreachable goal"}
    metrics = [("search_time_ms", "Search time (ms)"), ("memory_kb", "Peak Python allocation (KiB)"),
               ("expanded_nodes", "Expanded nodes"), ("solution_length", "Solution length (rolls)")]
    fig, axes = plt.subplots(2, 2, figsize=(15, 9), layout="constrained")
    for ax, (metric, title) in zip(axes.flat, metrics):
        for j, (solver, label, color) in enumerate(zip(solvers, labels, colors)):
            values = []
            for cid in selected:
                row = lookup[(cid, solver)]
                value = row[metric + "_median"]
                values.append(float(value) if value and (metric != "solution_length" or int(row["solved"])) else np.nan)
            ax.bar(np.arange(len(selected)) + (j - 1.5) * .19, values, .18, label=label, color=color)
        ax.set_yscale("log")
        ax.set_title(title, loc="left", fontweight="bold")
        ax.set_xticks(range(len(selected)), [names[c] for c in selected], rotation=18, ha="right")
        ax.grid(axis="y", alpha=.18, which="major")
        ax.set_axisbelow(True)
    axes[0, 0].legend(ncol=4, frameon=False)
    fig.suptitle("Different questions produce different winners", fontsize=19, fontweight="bold")
    fig.supxlabel(f"Median of {metadata['repeats']} sequential runs, public profiler enabled. Log scales. Unreachable: no solution length.", fontsize=10)
    fig.savefig(root / "comparison-metrics.png", dpi=160)
    plt.close(fig)

    angles = [0, 90, 180, 270]
    if all(f"C02-r{angle:03}" in case_lookup for angle in angles):
        fig, axes = plt.subplots(1, 2, figsize=(12, 4.5), layout="constrained")
        for solver, label, color in zip(solvers, labels, colors):
            for ax, metric in zip(axes, ["search_time_ms", "solution_length"]):
                values = [float(lookup[(f"C02-r{angle:03}", solver)][metric + "_median"]) for angle in angles]
                ax.plot(angles, values, "o-", color=color, label=label, linewidth=2)
                if solver == "dfs" and metric == "solution_length":
                    for angle, value in zip(angles, values):
                        ax.annotate(str(int(value)), (angle, value), xytext=(0, 7), textcoords="offset points", ha="center", color=color)
        axes[0].set_yscale("log")
        axes[0].set_title("Search time (ms), median")
        axes[1].set_title("Returned solution length; optimum = 2")
        for ax in axes:
            ax.set_xticks(angles)
            ax.set_xlabel("Clockwise rotation of the same board (degrees)")
            ax.grid(alpha=.18)
        axes[0].legend(frameon=False, ncol=4)
        fig.suptitle("DFS sensitivity to action order", fontsize=17, fontweight="bold")
        fig.savefig(root / "rotation-sensitivity.png", dpi=160)
        plt.close(fig)

    examples = [c for c in cases if c["id"].startswith("C") and c["angle"] == 0]
    fig, axes = plt.subplots(2, 3, figsize=(15, 8), layout="constrained")
    cmap = ListedColormap(["#e9f2f3", "#d9ceb7", "#e89c49", "#246b61"])
    for ax, case in zip(axes.flat, examples):
        board = case["board"]
        data = np.array(board["grid"])
        ax.imshow(np.where(data == 9, 3, data), cmap=cmap, vmin=0, vmax=3, interpolation="nearest")
        sr, sc = board["start_pos"]
        gr, gc = np.argwhere(data == 9)[0]
        ax.text(sc, sr, "S", ha="center", va="center", color="#17497b", fontweight="bold")
        ax.text(gc, gr, "G", ha="center", va="center", color="white", fontweight="bold")
        ax.set_title(case["id"] + "  " + case["family"].replace("_", " "), loc="left", fontweight="bold")
        ax.set_xticks([])
        ax.set_yticks([])
    fig.suptitle("Six diagnostic families | S: start, G: goal, orange: fragile", fontsize=17, fontweight="bold")
    fig.savefig(root / "candidate-boards.png", dpi=160)
    plt.close(fig)

    candidate_dir = root / "candidate-levels"
    candidate_dir.mkdir(exist_ok=True)
    index = []
    starts = {"C01": 34, "C02": 35, "C03": 39, "C04": 43, "C05": 45, "C06": 47}
    for case in (c for c in cases if c["id"].startswith("C")):
        family_id = case["id"].split("-")[0]
        turn = case["angle"] // (90 if family_id in ("C02", "C03") else 180)
        number = starts[family_id] + turn
        board = {**case["board"], "id": str(number), "name": case["id"] + " " + case["family"],
                 "description": case["purpose"], "difficulty": "Diagnostic"}
        filename = f"level_{number}_{case['id']}.json"
        (candidate_dir / filename).write_text(json.dumps(board, ensure_ascii=False, indent=2), encoding="utf-8")
        index.append({"candidate_id": number, "case_id": case["id"], "family": case["family"], "filename": filename,
                      "solvable": case["solvable"], "bfs_moves": case["bfs_moves"], "ucs_cost": case["ucs_cost"]})
    if index:
        with (root / "candidate-index.csv").open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(index[0]))
            writer.writeheader()
            writer.writerows(index)
    print("Saved plots and", len(index), "candidate JSON levels in", root)


if __name__ == "__main__":
    main()
