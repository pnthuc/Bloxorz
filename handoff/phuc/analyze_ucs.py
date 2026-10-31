"""Recompute P03 comparisons from saved measurements; never execute solvers."""
import argparse
from collections import Counter
import csv
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Src"))
from benchmarks.plot import METRICS, provenance, sha256, validate_batch

OUT = Path(__file__).resolve().parent
BATCH = ROOT / "handoff/quan/benchmarks"
GROUPS = ROOT / "handoff/quan/level-groups.csv"
SELECTED = ("1", "4", "8", "12", "16", "24", "25")
SOLVERS = ("bfs", "ucs", "astar")


def analyze(output):
    data = validate_batch(BATCH, GROUPS)
    previous = json.loads((OUT / "provenance.json").read_text(encoding="utf-8"))
    current = provenance(BATCH, GROUPS, data)
    if current["source_sha256"] != previous["source_sha256"] or current["run_json_sha256"] != previous["run_json_sha256"]:
        raise ValueError("Measurements differ from the P05 package; update the cited data before analysis")
    result = dict(checkout_commit=current["repository_commit"],
                  measurement_commit="Not recorded in the measurement metadata",
                  raw_runs=len(data["raw"]), summary_groups=len(data["summaries"]),
                  status_counts=current["status_counts"], source_sha256=current["source_sha256"],
                  p05_run_json_hashes_match=True,
                  status_by_solver={s: dict(Counter(r["status"] for r in data["raw"] if r["solver"] == s))
                                    for s in data["solvers"]},
                  comparisons={}, representative_changes={}, quality_examples=[])
    for a, b in (("ucs", "bfs"), ("astar", "ucs")):
        comparison = {}
        for metric, *_ in METRICS:
            sets = {"lower": [], "equal": [], "higher": []}
            for lid in data["levels"]:
                x, y = (data["summaries"][lid, solver]["medians"][metric] for solver in (a, b))
                if x is None or y is None:
                    raise ValueError(f"Unavailable comparison: {lid}, {metric}")
                sets["lower" if x < y else "equal" if x == y else "higher"].append(lid)
            comparison[metric] = sets
        result["comparisons"][f"{a}_vs_{b}"] = comparison
    for lid in SELECTED:
        for a, b in (("ucs", "bfs"), ("astar", "ucs")):
            changes = {}
            for metric, *_ in METRICS:
                x, y = (data["summaries"][lid, solver]["medians"][metric] for solver in (a, b))
                changes[metric] = dict(difference=x - y,
                                       percent_change=100 * (x - y) / y if y else None)
            result["representative_changes"][f"L{lid}/{a}_vs_{b}"] = changes
    for lid in ("16", "24", "25"):
        for solver in SOLVERS:
            samples = [r for r in data["raw"] if r["level_id"] == lid and r["solver"] == solver]
            pairs = {(r["values"]["solution_length"], r["values"]["path_cost"]) for r in samples}
            if len(pairs) != 1:
                raise ValueError(f"Path quality varies across repeats: {lid}/{solver}")
            length, cost = next(iter(pairs))
            result["quality_examples"].append(dict(level_id=lid, solver=solver, actions=length,
                                                    path_cost=cost, fragile_cell_visits=2 * (cost - length)))
    inputs = [ROOT / rel for rel in (
        "Src/solvers/costs.py", "Src/solvers/member5_ucs.py", "Src/solvers/member3_bfs.py",
        "Src/solvers/member4_astar.py", "Src/solvers/base.py", "Src/core/board.py",
        "Src/benchmarks/cli.py", "handoff/nam/Report.docx", "handoff/nam/video-outline.docx",
        "handoff/thien/astar-results.docx", "handoff/thien/review-notes.docx")]
    result["reviewed_source_sha256"] = {p.relative_to(ROOT).as_posix(): sha256(p) for p in inputs}
    result["analysis_script_sha256"] = sha256(Path(__file__))
    result["checks"] = dict(csv_json_match=True, summary_counts_match=True, summary_medians_match=True,
                             selected_quality_stable_across_repeats=True, solver_rerun=False, replay_rerun=False)
    output.mkdir(parents=True, exist_ok=True)
    (output / "ucs-results-data.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    fields = ("level_id", "level_name", "solver", "samples", *(m[0] + "_median" for m in METRICS))
    with (output / "ucs-results-selected.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for lid in SELECTED:
            for solver in SOLVERS:
                row = data["summaries"][lid, solver]
                writer.writerow(dict(level_id=lid, level_name=data["groups"][lid]["level_name"], solver=solver,
                                     samples=row["samples"]["solution_length"],
                                     **{m[0] + "_median": row[m[0] + "_median"] for m in METRICS}))
    print(f"Validated {len(data['raw'])} saved runs; exported comparisons for 25 levels and 21 representative rows.")
    for comparison, metrics in result["comparisons"].items():
        print(comparison, {m: {k: len(v) for k, v in sets.items()} for m, sets in metrics.items()})
    for key in ("L8/astar_vs_ucs", "L12/astar_vs_ucs", "L16/astar_vs_ucs"):
        print(key, result["representative_changes"][key])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=OUT)
    args = parser.parse_args()
    analyze(args.output_dir)
