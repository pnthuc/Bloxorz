"""Vẽ bảng và biểu đồ thực nghiệm P05 cho Bloxorz từ dữ liệu benchmark đã lưu.

Không import engine hay solver. Chạy: python handoff/phuc/plot.py
"""
from __future__ import annotations

import argparse
from collections import Counter
import csv
import json
import math
import os
from pathlib import Path
import statistics
import tempfile

os.environ.setdefault("MPLCONFIGDIR", str(Path(tempfile.gettempdir()) / "bloxorz-matplotlib"))

ROOT = Path(__file__).resolve().parents[2]
SOLVERS = ("bfs", "dfs", "ucs", "astar")
NAMES = {"bfs": "BFS", "dfs": "DFS", "ucs": "UCS", "astar": "A*"}
COLORS = {"bfs": "#2B72B2", "dfs": "#DE751A", "ucs": "#94449C", "astar": "#148A66"}
STATUSES = ("SOLVED", "NO_SOLUTION", "TIMEOUT", "ERROR", "INVALID_PATH")
COUNT_COLUMNS = ("solved", "no_solution", "timeouts", "errors", "invalid_paths")

# key, Vietnamese label, chart label, unit, display precision
METRICS = (
    ("search_time_ms", "Thời gian tìm kiếm", "Search time", "ms", 3),
    ("memory_kb", "Đỉnh cấp phát Python", "Peak Python allocation", "KiB", 2),
    ("expanded_nodes", "Số node mở rộng", "Expanded nodes", "node", 0),
    ("solution_length", "Độ dài lời giải", "Solution length", "actions", 0),
    ("path_cost", "Chi phí đường đi chung", "Common path cost", "cost", 1),
)
SEARCH_METRICS = {m[0] for m in METRICS[:3]}
RAW_HEADERS = ("level_id", "solver", "repeat_index", "status", *(m[0] for m in METRICS))
SUMMARY_HEADERS = ("level_id", "solver", "runs", *COUNT_COLUMNS,
                   *(f"{m[0]}_median" for m in METRICS))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_csv(path, columns):
    with Path(path).open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        require(set(columns) <= set(reader.fieldnames or []), f"{path}: missing columns")
        rows = list(reader)
    require(all(None not in row and None not in row.values() for row in rows),
            f"{path}: malformed CSV row")
    return rows


def number(value, label, integer=False):
    try:
        result = int(value) if integer else float(value)
    except (ValueError, TypeError, OverflowError):
        raise ValueError(f"{label}: expected a nonnegative finite number") from None
    require(math.isfinite(result) and result >= 0, f"{label}: invalid number")
    return result


def validate_batch(batch, groups_path):
    """Reconcile raw runs, JSON details, counts and medians without writing inputs."""
    batch, groups_path = Path(batch), Path(groups_path)
    config = json.loads((batch / "run-config.json").read_text(encoding="utf-8"))
    levels, solvers, repeats = config["levels"], config["solvers"], config["repeats"]
    require(isinstance(levels, list) and levels and
            all(isinstance(lid, str) and lid.isdigit() for lid in levels), "Invalid level IDs")
    require(len(set(levels)) == len(levels), "Duplicate configured levels")
    require(isinstance(solvers, list) and solvers and set(solvers) <= set(SOLVERS) and
            len(set(solvers)) == len(solvers), "Invalid configured solvers")
    require(type(repeats) is int and repeats > 0, "Invalid repeat count")
    require(number(config["timeout_sec"], "timeout") > 0, "Invalid timeout")
    levels = sorted(levels, key=int)
    solvers = [s for s in SOLVERS if s in solvers]
    expected = {(lid, solver, rep) for lid in levels for solver in solvers
                for rep in range(1, repeats + 1)}
    raw = read_csv(batch / "raw.csv", RAW_HEADERS)
    details = {}
    detail_paths = sorted((batch / "runs").glob("*.json"))
    for path in detail_paths:
        record = json.loads(path.read_text(encoding="utf-8"))
        key = str(record["level_id"]), record["solver"], int(record["repeat_index"])
        require(key not in details, f"Duplicate run JSON: {key}")
        details[key] = record
    grouped, seen = {}, set()
    for row in raw:
        key = row["level_id"], row["solver"], number(row["repeat_index"], "repeat", True)
        require(key in expected and key not in seen, f"Unexpected/duplicate run: {key}")
        seen.add(key)
        status = row["status"]
        require(status in STATUSES, f"{key}: unknown status")
        record = details.get(key)
        require(record is not None, f"{key}: missing JSON")
        require(all(str(record.get(k)) == row[k] for k in RAW_HEADERS),
                f"{key}: CSV/JSON mismatch")
        require(isinstance(record.get("moves"), list), f"{key}: invalid moves")
        values = {}
        for metric, *_ in METRICS:
            values[metric] = None if row[metric] == "" else number(
                row[metric], f"{key}: {metric}", metric in ("expanded_nodes", "solution_length"))
        if status == "SOLVED":
            require(all(v is not None for v in values.values()), f"{key}: missing solved metric")
            require(len(record["moves"]) == values["solution_length"], f"{key}: length mismatch")
            require(values["path_cost"] >= values["solution_length"], f"{key}: cost below length")
        elif status == "NO_SOLUTION":
            require(all(values[m] is not None for m in SEARCH_METRICS), f"{key}: missing search metric")
            require(values["solution_length"] is None and values["path_cost"] is None and
                    not record["moves"], f"{key}: invalid unsolved metrics")
        elif status in ("TIMEOUT", "ERROR"):
            require(all(v is None for v in values.values()) and not record["moves"],
                    f"{key}: unmeasured metrics must be blank")
        if status in ("TIMEOUT", "ERROR", "INVALID_PATH"):
            require(bool(record.get("error_message")), f"{key}: missing failure reason")
        row["values"] = values
        grouped.setdefault(key[:2], []).append(row)
    require(seen == expected and set(details) == expected, "Incomplete batch or extra JSON runs")

    supplied = read_csv(batch / "summary.csv", SUMMARY_HEADERS)
    summaries = {}
    for row in supplied:
        key = row["level_id"], row["solver"]
        require(key in grouped and key not in summaries, f"Unexpected/duplicate summary: {key}")
        runs = grouped[key]
        counts = Counter(r["status"] for r in runs)
        require(number(row["runs"], "runs", True) == len(runs), f"{key}: run count mismatch")
        for status, column in zip(STATUSES, COUNT_COLUMNS):
            require(number(row[column], column, True) == counts[status], f"{key}: {column} mismatch")
        medians, samples = {}, {}
        for metric, *_ in METRICS:
            eligible = ("SOLVED", "NO_SOLUTION") if metric in SEARCH_METRICS else ("SOLVED",)
            values = [r["values"][metric] for r in runs if r["status"] in eligible]
            expected_median = round(statistics.median(values), 6) if values else None
            value = row[f"{metric}_median"]
            actual = None if value == "" else number(value, f"{key}: {metric} median")
            require(actual == expected_median, f"{key}: {metric} median mismatch")
            medians[metric], samples[metric] = actual, len(values)
        summaries[key] = dict(row, medians=medians, samples=samples, counts=dict(counts))
    require(set(summaries) == set(grouped), "Missing summary groups")
    group_rows = read_csv(groups_path, ("level_id", "level_name", "split_switches", "fragile_cells"))
    groups = {}
    for row in group_rows:
        require(row["level_id"] not in groups, "Duplicate level group")
        groups[row["level_id"]] = row
    require(set(levels) <= set(groups), "Missing level descriptions")
    environment = json.loads((batch / "environment.json").read_text(encoding="utf-8"))
    return dict(config=config, levels=levels, solvers=solvers, raw=raw, summaries=summaries,
                groups=groups, environment=environment, detail_paths=detail_paths)


def failure_note(row):
    parts = [f"{code}{row['counts'].get(status, 0)}" for status, code in
             (("NO_SOLUTION", "N"), ("TIMEOUT", "T"), ("ERROR", "E"), ("INVALID_PATH", "I"))
             if row["counts"].get(status, 0)]
    return "/".join(parts)


def axis_scale(values):
    """Keep measured zeros visible; missing values never enter this list."""
    return "symlog" if any(v == 0 for v in values) else "log"


def draw_charts(data, output):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Patch
    from matplotlib.ticker import LogLocator, NullFormatter

    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10,
                         "axes.titlesize": 10, "axes.labelsize": 10})
    output.mkdir(parents=True, exist_ok=True)
    for index, (metric, _, label, unit, _) in enumerate(METRICS, 1):
        levels, solvers = data["levels"], data["solvers"]
        panels = [levels[i:i + 5] for i in range(0, len(levels), 5)]
        values = [r["medians"][metric] for r in data["summaries"].values()
                  if r["medians"][metric] is not None]
        scale = axis_scale(values)
        fig, axes = plt.subplots(len(panels), 1, figsize=(7.2, 1.85 * len(panels) + 1.25), squeeze=False)
        fig.subplots_adjust(left=0.14, right=0.98, top=0.89, bottom=0.07, hspace=0.85)
        fig.suptitle(f"{label} by level", x=0.14, y=0.985, ha="left", fontsize=16, fontweight="bold")
        sample_counts = sorted({r["samples"][metric] for r in data["summaries"].values()})
        sample_text = ",".join(map(str, sample_counts))
        fig.text(0.14, 0.955, f"Median; n={sample_text} per level/solver; {scale} y-axis", fontsize=10)
        fig.legend(handles=[Patch(color=COLORS[s], label=NAMES[s]) for s in solvers],
                   loc="upper left", bbox_to_anchor=(0.125, 0.944), ncol=len(solvers), frameon=False)
        for ax, lids in zip(axes[:, 0], panels):
            width = 0.8 / len(solvers)
            for si, solver in enumerate(solvers):
                for li, lid in enumerate(lids):
                    row = data["summaries"][lid, solver]
                    value = row["medians"][metric]
                    x = li - 0.4 + width * (si + 0.5)
                    if value is not None and value > 0:
                        ax.bar(x, value, width=width * 0.9, color=COLORS[solver], zorder=3)
                    elif value == 0:
                        ax.plot(x, 0, marker="o", color=COLORS[solver], markersize=4, zorder=4)
                    else:
                        ax.text(x, 0.03, "NA", transform=ax.get_xaxis_transform(),
                                rotation=90, ha="center", fontsize=7, color=COLORS[solver])
                    note = failure_note(row)
                    if note:
                        ax.text(x, 1.04, note, transform=ax.get_xaxis_transform(), ha="center",
                                fontsize=7, color=COLORS[solver])
            if values:
                if scale == "log":
                    ax.set_yscale("log")
                    lo, hi = min(values), max(values)
                    ax.set_ylim(lo / 1.8, max(hi * 1.8, lo * 3))
                    ax.yaxis.set_major_locator(LogLocator(base=10, numticks=5))
                    ax.yaxis.set_minor_formatter(NullFormatter())
                else:
                    ax.set_yscale("symlog", linthresh=1)
                    ax.set_ylim(-0.15, max(max(values) * 1.8, 1))
            ax.set_ylabel(unit)
            ax.set_xticks(range(len(lids)), [f"L{lid}" for lid in lids])
            ax.set_title(f"Levels {lids[0]}–{lids[-1]}", loc="left", pad=6)
            ax.grid(axis="y", which="major", color="#DDE2E8", linewidth=0.7, zorder=0)
            ax.spines[["top", "right"]].set_visible(False)
            ax.set_xlim(-0.6, len(lids) - 0.4)
        fig.text(0.14, 0.02, "Nguồn: summary.csv", fontsize=8)
        fig.savefig(output / f"{index:02d}_{metric}.png", dpi=300)
        plt.close(fig)


def draw_line_charts(data, output):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.ticker import FuncFormatter, NullFormatter

    output.mkdir(parents=True, exist_ok=True)

    line_configs = [
        {
            "metric": "search_time_ms",
            "title": "Thời gian tìm kiếm",
            "subtitle": "Thời gian (ms) | Thang logarit",
            "caption": "Hình 6.1. Thời gian tìm kiếm",
            "filename": "hinh_6_1_thoi_gian_tim_kiem.png",
            "ylim": (0.1, 1e5),
            "yticks": [0.1, 1, 10, 100, 1000, 10000, 100000],
        },
        {
            "metric": "memory_kb",
            "title": "Bộ nhớ tiêu thụ",
            "subtitle": "Bộ nhớ (KiB) | Thang logarit",
            "caption": "Hình 6.2. Bộ nhớ tiêu thụ",
            "filename": "hinh_6_2_bo_nho.png",
            "ylim": (1, 1e5),
            "yticks": [1, 10, 100, 1000, 10000, 100000],
        },
        {
            "metric": "expanded_nodes",
            "title": "Số node mở rộng",
            "subtitle": "Node | Thang logarit",
            "caption": "Hình 6.3. Số node mở rộng",
            "filename": "hinh_6_3_so_node_mo_rong.png",
            "ylim": (1, 1e6),
            "yticks": [1, 10, 100, 1000, 10000, 100000, 1000000],
        },
        {
            "metric": "solution_length",
            "title": "Độ dài lời giải",
            "subtitle": "Số bước | Thang logarit",
            "caption": "Hình 6.4. Độ dài lời giải",
            "filename": "hinh_6_4_do_dai_loi_giai.png",
            "ylim": (1, 2e3),
            "yticks": [1, 10, 100, 1000],
        },
        {
            "metric": "path_cost",
            "title": "Chi phí đường đi",
            "subtitle": "Chi phí | Thang logarit",
            "caption": "Hình 6.5. Chi phí đường đi",
            "filename": "hinh_6_5_chi_phi_duong_di.png",
            "ylim": (1, 2e3),
            "yticks": [1, 10, 100, 1000],
        },
    ]

    solvers = data["solvers"]
    level_ids = [int(lid) for lid in data["levels"]]
    level_strs = [str(lid) for lid in level_ids]

    def log_fmt(x, pos):
        if x >= 1e6:
            return f"{x:.0e}"
        elif x >= 1:
            return f"{int(x)}"
        elif x == 0.1:
            return "0.1"
        return f"{x:g}"

    for cfg in line_configs:
        fig, ax = plt.subplots(figsize=(8.8, 3.8), dpi=300)
        fig.subplots_adjust(left=0.08, right=0.96, top=0.82, bottom=0.22)

        metric = cfg["metric"]
        for s in solvers:
            y_vals = [data["summaries"][lid, s]["medians"][metric] for lid in level_strs]
            x_valid = [lid for lid, y in zip(level_ids, y_vals) if y is not None and y > 0]
            y_valid = [y for y in y_vals if y is not None and y > 0]
            ax.plot(x_valid, y_valid, linestyle="-", linewidth=1.4,
                    marker="o", markersize=4.2, color=COLORS[s], label=NAMES.get(s, s),
                    zorder=4)

        ax.set_yscale("log")
        ax.set_ylim(*cfg["ylim"])
        ax.set_yticks(cfg["yticks"])
        ax.yaxis.set_major_formatter(FuncFormatter(log_fmt))
        ax.yaxis.set_minor_formatter(NullFormatter())

        ax.set_xticks(level_ids)
        ax.set_xticklabels([str(x) for x in level_ids], fontsize=9, color="#374151")
        ax.set_xlim(0.5, len(level_ids) + 0.5)

        ax.tick_params(which="both", left=False, bottom=False, pad=5)
        ax.set_xlabel("Màn chơi", fontsize=10, color="#1F2937", labelpad=5)

        # Crisp, light grid matching the report style
        ax.grid(axis="y", which="major", color="#E8ECEF", linewidth=0.75, zorder=0)
        ax.grid(axis="x", which="major", color="#F2F4F7", linewidth=0.6, zorder=0)

        # Spines styling
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.spines["left"].set_visible(False)
        ax.spines["bottom"].set_color("#B0B8C1")
        ax.spines["bottom"].set_linewidth(0.8)

        # Titles and legend aligned across top
        fig.text(0.08, 0.93, cfg["title"], fontsize=14, fontweight="bold", color="#111827", ha="left")
        fig.text(0.08, 0.865, cfg["subtitle"], fontsize=9.5, color="#6B7280", ha="left")

        ax.legend(loc="upper right", bbox_to_anchor=(1.0, 1.18), ncol=len(solvers),
                  frameon=False, fontsize=9.5, handlelength=2.5, handletextpad=0.5, columnspacing=1.8)

        # Centered caption below figure
        fig.text(0.5, 0.04, cfg["caption"], fontsize=12, fontfamily="serif", ha="center", color="#1F2937")

        fig.savefig(output / cfg["filename"], dpi=300)
        plt.close(fig)


def write_tables(data, output):
    fields = ["level_id", "level_name", "solver", "runs", *COUNT_COLUMNS,
              *(f"{m[0]}_median" for m in METRICS), "search_samples", "solution_samples"]
    with (output / "result-tables.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for lid in data["levels"]:
            for solver in data["solvers"]:
                s = data["summaries"][lid, solver]
                row = {key: s[key] for key in SUMMARY_HEADERS}
                row.update(level_name=data["groups"][lid]["level_name"],
                           search_samples=s["samples"]["search_time_ms"],
                           solution_samples=s["samples"]["solution_length"])
                writer.writerow(row)


def build(batch, groups, output):
    batch, groups, output = Path(batch).resolve(), Path(groups).resolve(), Path(output).resolve()
    data = validate_batch(batch, groups)
    output.mkdir(parents=True, exist_ok=True)
    draw_charts(data, output / "charts")
    draw_line_charts(data, output / "charts")
    write_tables(data, output)
    return data


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    default_output = Path(__file__).resolve().parent
    parser.add_argument("--batch", type=Path, default=ROOT / "handoff/quan/benchmarks")
    parser.add_argument("--groups", type=Path, default=ROOT / "handoff/quan/level-groups.csv")
    parser.add_argument("--output-dir", type=Path, default=default_output)
    args = parser.parse_args(argv)
    try:
        data = build(args.batch, args.groups, args.output_dir)
    except (OSError, ValueError, KeyError, TypeError, ImportError) as exc:
        parser.error(str(exc))
    msg = f"Đã kiểm chứng {len(data['raw'])} lượt chạy; xuất 10 biểu đồ PNG và result-tables.csv vào {args.output_dir}."
    try:
        print(msg)
    except UnicodeEncodeError:
        print(f"Da kiem chung {len(data['raw'])} luot chay; xuat 10 bieu do PNG va result-tables.csv vao {args.output_dir}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
