"""Validate saved CSV/JSON measurements and build P05 figures and Markdown tables.

No solver or game module is imported. Run with: python -m benchmarks.plot --help
"""
from __future__ import annotations

import argparse
from collections import Counter
import csv
import hashlib
import json
import math
import os
from pathlib import Path
import statistics
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
SOLVERS = ("bfs", "dfs", "ucs", "astar")
NAMES = {"bfs": "BFS", "dfs": "DFS", "ucs": "UCS", "astar": "A*"}
COLORS = {"bfs": "#0072B2", "dfs": "#D55E00", "ucs": "#009E73", "astar": "#CC79A7"}
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


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def provenance(batch, groups, data):
    try:
        commit = subprocess.check_output(["git", "-C", str(ROOT), "rev-parse", "HEAD"],
                                         text=True, stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError):
        commit = "unavailable"
    sources = [batch / name for name in ("raw.csv", "summary.csv", "run-config.json", "environment.json")]
    sources.append(groups)
    def display(path):
        try:
            return path.relative_to(ROOT).as_posix()
        except ValueError:
            return path.name
    hashes = {display(path): sha256(path) for path in sources}
    run_hashes = {path.name: sha256(path) for path in data["detail_paths"]}
    return dict(repository_commit=commit,
                commit_meaning="Checkout used for presentation; original measurement commit is not recorded in the batch.",
                source_sha256=hashes, run_json_sha256=run_hashes,
                plot_script_sha256=sha256(Path(__file__)),
                status_counts=dict(Counter(r["status"] for r in data["raw"])),
                checks={"csv_json_match": True, "summary_counts_match": True,
                        "summary_medians_match": True, "solver_rerun": False, "replay_rerun": False})


def failure_note(row):
    parts = [f"{code}{row['counts'].get(status, 0)}" for status, code in
             (("NO_SOLUTION", "N"), ("TIMEOUT", "T"), ("ERROR", "E"), ("INVALID_PATH", "I"))
             if row["counts"].get(status, 0)]
    return "/".join(parts)


def axis_scale(values):
    """Keep measured zeros visible; missing values never enter this list."""
    return "symlog" if any(v == 0 for v in values) else "log"


def draw_charts(data, output, manifest):
    # Only the plotting command needs matplotlib; CSV validation uses the standard library.
    os.environ.setdefault("MPLCONFIGDIR", str(Path(tempfile.gettempdir()) / "bloxorz-matplotlib"))
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Patch
    from matplotlib.ticker import LogLocator, NullFormatter

    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10,
                         "axes.titlesize": 10, "axes.labelsize": 10, "svg.fonttype": "none"})
    output.mkdir(parents=True, exist_ok=True)
    charts = []
    for index, (metric, _, label, unit, _) in enumerate(METRICS, 1):
        levels, solvers = data["levels"], data["solvers"]
        panels = [levels[i:i + 5] for i in range(0, len(levels), 5)]
        values = [r["medians"][metric] for r in data["summaries"].values()
                  if r["medians"][metric] is not None]
        scale = axis_scale(values)
        fig, axes = plt.subplots(len(panels), 1, figsize=(7.2, 1.85 * len(panels) + 1.25), squeeze=False)
        fig.subplots_adjust(left=0.14, right=0.98, top=0.89, bottom=0.07, hspace=0.85)
        title = f"{label} by level"
        fig.suptitle(title, x=0.14, y=0.985, ha="left", fontsize=16, fontweight="bold")
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
        source_hash = next(v for k, v in manifest["source_sha256"].items() if k.endswith("/summary.csv") or k == "summary.csv")
        fig.text(0.14, 0.035, f"Source: Quan / summary.csv (SHA-256 {source_hash[:12]})", fontsize=8)
        fig.text(0.14, 0.016, "N=no solution; T=timeout; E=error; I=invalid path; NA=no eligible sample", fontsize=8)
        stem = f"{index:02d}_{metric}"
        for ext in ("png", "svg"):
            fig.savefig(output / f"{stem}.{ext}", dpi=300, metadata={"Date": None} if ext == "svg" else {})
        plt.close(fig)
        charts.append(dict(file=stem, metric=metric, title=title, scale=scale, samples=sample_counts))
    return charts


def formatted(value, precision):
    return "NA" if value is None else f"{value:,.{precision}f}"


def markdown_table(headers, rows, separators=None):
    def cell(value):
        return str(value).replace("|", "\\|").replace("\n", " ")
    return "\n".join(["| " + " | ".join(map(cell, headers)) + " |",
                      "| " + " | ".join(separators or [":---", *(["---:"] * (len(headers) - 1))]) + " |",
                      *("| " + " | ".join(map(cell, row)) + " |" for row in rows)])


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


def write_markdown(data, output, manifest, charts):
    config = data["config"]
    nlevels, nsolvers = len(data["levels"]), len(data["solvers"])
    repetitions = config["repeats"]
    counts = Counter(r["status"] for r in data["raw"])
    intro = (f"Bộ dữ liệu gồm {nlevels} màn × {nsolvers} thuật toán × {repetitions} lần lặp "
             f"= {len(data['raw'])} lượt; timeout {config['timeout_sec']:g} giây/lượt. "
             f"SOLVED: {counts['SOLVED']}; NO_SOLUTION: {counts['NO_SOLUTION']}; "
             f"TIMEOUT: {counts['TIMEOUT']}; ERROR: {counts['ERROR']}; INVALID_PATH: {counts['INVALID_PATH']}.")
    source = "Nguồn: handoff/quan/benchmarks/raw.csv và summary.csv; tên và đặc điểm màn từ handoff/quan/level-groups.csv."
    method = ("Thời gian, bộ nhớ và node lấy trung vị các lượt SOLVED hoặc NO_SOLUTION. "
              "Độ dài và path_cost chỉ lấy trung vị các lượt SOLVED. Timeout/lỗi không được thay bằng 0. "
              "NA nghĩa là không có mẫu hợp lệ cho chỉ số đó. Dấu chấm là dấu thập phân; dấu phẩy phân tách hàng nghìn.")
    sample_pairs = {(s["samples"]["search_time_ms"], s["samples"]["solution_length"])
                    for s in data["summaries"].values()}
    sample_note = (f"Mỗi ô có n={next(iter(sample_pairs))[0]} mẫu tìm kiếm và "
                   f"n={next(iter(sample_pairs))[1]} mẫu lời giải. " if len(sample_pairs) == 1 else
                   "Số mẫu tìm kiếm / lời giải cho từng thuật toán nằm ở bảng số mẫu cuối tài liệu. ")
    tables = ["---", 'title: "Bloxorz — Bảng kết quả thực nghiệm"', 'lang: vi', "---", "", intro, "", source, "", method, "",
              sample_note + "Bộ nhớ là đỉnh cấp phát Python (KiB), không phải tổng RAM. Độ dài tính bằng số hành động tìm kiếm; "
              "hướng có tiền tố S tính một hành động, SPACE chơi tay không phải cạnh tìm kiếm. "
              "Chi phí so sánh là path_cost được tính theo cùng policy cho cả bốn thuật toán.", ""]
    for i, (metric, label, _, unit, precision) in enumerate(METRICS, 1):
        rows = [[f"L{lid}", *(formatted(data["summaries"][lid, solver]["medians"][metric], precision)
                              for solver in data["solvers"])] for lid in data["levels"]]
        tables += [f"# Bảng {i}. {label} ({unit})", "",
                   markdown_table(["Màn", *(NAMES[s] for s in data["solvers"])], rows), ""]
    samples = []
    for lid in data["levels"]:
        cells = []
        for solver in data["solvers"]:
            s = data["summaries"][lid, solver]
            cells.append(f"{s['samples']['search_time_ms']}/{s['samples']['solution_length']}")
        samples.append([f"L{lid}", *cells])
    if len(sample_pairs) > 1:
        tables += ["# Bảng 6. Số mẫu tìm kiếm / lời giải", "",
                   markdown_table(["Màn", *(NAMES[s] for s in data["solvers"])], samples), ""]
    tables += ["# Danh mục màn", "",
               markdown_table(["Màn", "Tên", "Công tắc tách", "Ô fragile"],
                              [[f"L{lid}", data["groups"][lid]["level_name"],
                                data["groups"][lid]["split_switches"], data["groups"][lid]["fragile_cells"]]
                               for lid in data["levels"]],
                              [":---", ":----------------------------------", "-----------:", "-------:"]), ""]
    (output / "result-tables.md").write_text("\n".join(tables), encoding="utf-8")

    env = data["environment"]
    notes = ["---", 'title: "Bloxorz — Chú thích và cách tái tạo biểu đồ"', 'lang: vi', "---", "",
             "# Dữ liệu và kiểm tra", "", intro, "", source, "",
             f"Commit của checkout dùng để tạo P05: `{manifest['repository_commit']}`. "
             "Metadata đo không ghi commit gốc của lượt chạy. File provenance.json lưu SHA-256 từng CSV/metadata, "
             "từng JSON và script vẽ để truy lại đúng dữ liệu đã dùng.", "",
             f"Môi trường đo được Quân ghi: CPU {env.get('cpu', 'NA')}; RAM {env.get('ram', 'NA')}; "
             f"OS {env.get('os', 'NA')}; Python {env.get('python_version', 'NA')}; ngày đo {env.get('date', 'NA')}.", "",
             "Script kiểm tra đủ và không trùng lượt, CSV khớp JSON, số trạng thái và từng trung vị khớp summary.csv. "
             "Bước trình bày chỉ đọc dữ liệu đã lưu; không thực thi solver hoặc replay.", "",
             "# Quy ước đọc hình", "", method, "",
             "BFS màu xanh dương (#0072B2), DFS màu cam (#D55E00), UCS màu xanh lá (#009E73), "
             "A* màu tím (#CC79A7). Mỗi hình gồm các cụm tối đa năm màn theo ID, cùng giới hạn trục y trong hình. "
             "Cách chia cụm phục vụ bố cục, không phải phân nhóm độ khó. Đặc điểm cơ chế nằm trong danh mục màn.", "",
             "Trục y ghi log là log cơ số 10: khoảng cách bằng nhau biểu thị tỷ lệ bằng nhau. "
             "Không diễn giải chiều cao cột như chênh lệch tuyệt đối. Nếu có số 0 thật, script dùng symlog "
             "với vùng tuyến tính quanh 0 (linthresh=1) và vẽ dấu tròn tại 0; tên trục được ghi trong manifest. "
             "Các ô thiếu mẫu ghi NA, không vẽ cột bằng 0. Trên cột có thể có N/T/E/I kèm số lượt "
             "NO_SOLUTION/TIMEOUT/ERROR/INVALID_PATH. Số mẫu từng chỉ số nằm trong charts/manifest.json "
             "và result-tables.csv; tài liệu bảng ghi rõ n tìm kiếm và n lời giải.", "",
             "Tất cả hình xuất PNG 300 dpi và SVG vector. Nhãn trong hình dùng tiếng Anh; dùng các chú thích "
             "tiếng Việt dưới đây khi ghép báo cáo. Đặt hình rộng khoảng 17 cm trên A4; giữ tỷ lệ gốc, "
             "mỗi hình toàn bộ 25 màn nên chiếm một trang riêng. Có thể lấy riêng cụm màn từ SVG khi "
             "cần minh họa chi tiết, nhưng phải giữ nhãn trục, chú giải và nguồn.", "",
             "# Chú thích để ghép báo cáo", ""]
    for i, (metric, label, _, unit, _) in enumerate(METRICS, 1):
        chart = charts[i - 1]
        detail = {
            "search_time_ms": "Thời gian chỉ gồm tìm kiếm, không gồm animation hoặc replay.",
            "memory_kb": "Bộ nhớ là đỉnh cấp phát Python do tracemalloc đo, không phải tổng RAM hoặc bộ nhớ GPU.",
            "expanded_nodes": "Node mở rộng đếm lượt sinh successor; không phải tổng trạng thái đã phát hiện.",
            "solution_length": "Đơn vị là hành động tìm kiếm, gồm cả hành động đổi khối rồi lăn có tiền tố S.",
            "path_cost": "Mỗi cạnh có cost = 1 + 0.5 × số ô fragile bị chiếm ở trạng thái đến; path_cost là tổng trên đường đi.",
        }[metric]
        notes += [f"## Hình {i}. {label}", "",
                  f"File: `charts/{chart['file']}.png` hoặc `.svg`. {label} ({unit}) của "
                  f"{nsolvers} thuật toán trên {nlevels} màn; trung vị theo quy ước mẫu ở trên. "
                  f"Trục y: {chart['scale']}. Nguồn: CSV của Nguyễn Lê Minh Quân, bộ {len(data['raw'])} lượt. "
                  + detail, ""]
    notes += ["# Lệnh tái tạo", "", "Từ thư mục gốc repo:", "", "```powershell",
              "python -m pip install -r Src/benchmarks/requirements-plot.txt",
              "python Src/benchmarks/plot.py `",
              "  --batch handoff/quan/benchmarks `",
              "  --groups handoff/quan/level-groups.csv `",
              "  --output-dir handoff/phuc",
              "powershell -ExecutionPolicy Bypass `",
              "  -File handoff/phuc/build-documents.ps1", "```", "",
              "Lệnh đầu chỉ cài thư viện vẽ, không cần cho chạy game. Bước Pandoc cần pandoc và xelatex "
              "trên PATH, cùng font Arial/Consolas. Quy trình tài liệu là Markdown → DOCX bằng Pandoc, "
              "sau đó đọc lại DOCX → PDF bằng Pandoc với --pdf-engine=xelatex. "
              "PDF dùng kiểm tra và ghép tài liệu; DOCX là bảng có thể sửa, Markdown là nguồn soạn.", "",
              "# Nguồn và sử dụng AI", "",
              "Nguồn số liệu: bộ CSV/JSON và metadata do Quân bàn giao trong repo. Nguồn định nghĩa "
              "chỉ số: Src/benchmarks/README.md và Src/solvers/base.py; policy cost: Src/solvers/costs.py. "
              "Màu biểu đồ dùng bốn màu từ bảng Okabe–Ito.", "",
              "Codex hỗ trợ viết script trình bày, kiểm tra tính nhất quán, dựng bảng và soạn chú thích. "
              "Không tạo số đo thực nghiệm mới. Việc xác nhận số liệu của Quân và tiếp nhận hình/bảng "
              "của Nam được theo dõi riêng khi bàn giao.", ""]
    (output / "chart-notes.md").write_text("\n".join(notes), encoding="utf-8")


def build(batch, groups, output):
    batch, groups, output = Path(batch).resolve(), Path(groups).resolve(), Path(output).resolve()
    # Never let a presentation output overwrite an input, including via a symlink.
    targets = [output / name for name in ("result-tables.csv", "result-tables.md", "chart-notes.md", "provenance.json")]
    inputs = [batch / name for name in ("raw.csv", "summary.csv", "run-config.json", "environment.json")]
    inputs.append(groups)
    require(all(target.resolve() not in {p.resolve() for p in inputs} for target in targets),
            "Output would overwrite an input")
    require(not (output / "charts").is_symlink(), "Charts output must not be a symlink")
    data = validate_batch(batch, groups)
    manifest = provenance(batch, groups, data)
    output.mkdir(parents=True, exist_ok=True)
    charts = draw_charts(data, output / "charts", manifest)
    (output / "charts" / "manifest.json").write_text(json.dumps(dict(
        figures=charts, solver_colors=COLORS, samples_by_level_solver={
            f"{lid}/{solver}": data["summaries"][lid, solver]["samples"]
            for lid in data["levels"] for solver in data["solvers"]}), indent=2) + "\n", encoding="utf-8")
    write_tables(data, output)
    write_markdown(data, output, manifest, charts)
    (output / "provenance.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    # Verify content hashes, including run JSON, after all exports.
    after = provenance(batch, groups, data)
    require(after["source_sha256"] == manifest["source_sha256"] and
            after["run_json_sha256"] == manifest["run_json_sha256"], "Input changed during export")
    return data, charts


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch", type=Path, default=ROOT / "handoff/quan/benchmarks")
    parser.add_argument("--groups", type=Path, default=ROOT / "handoff/quan/level-groups.csv")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "handoff/phuc")
    args = parser.parse_args(argv)
    try:
        data, charts = build(args.batch, args.groups, args.output_dir)
    except (OSError, ValueError, KeyError, TypeError, ImportError) as exc:
        parser.error(str(exc))
    print(f"Validated {len(data['raw'])} saved runs; wrote {len(charts)} PNG/SVG figures, CSV and Markdown. No solvers executed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
