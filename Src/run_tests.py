"""Chạy các test nền, gọi solver thật trên từng ca; thêm --ui để kiểm tra giao diện."""

import argparse
import shutil
import subprocess
import sys
import unittest

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
from typing import Callable, Dict, List, Optional

from solvers import solve_astar, solve_bfs, solve_dfs, solve_ucs
from tests.helpers import ROOT, Case, load_cases, select_cases, validate_result


SOLVERS = {"bfs": solve_bfs, "dfs": solve_dfs, "ucs": solve_ucs, "astar": solve_astar}


class TestParser(argparse.ArgumentParser):
    def error(self, message):
        # Exit 2 chỉ dành cho PENDING; lỗi tham số phải là FAIL cho CI.
        self.print_usage()
        self.exit(1, f"{self.prog}: {message}\n")


def build_parser(description="Kiểm thử solver: exit 0=PASS, 1=FAIL, 2=PENDING"):
    parser = TestParser(description=description)
    parser.add_argument("--solver", choices=["all", *SOLVERS], default="all")
    parser.add_argument(
        "--cases", nargs="+", metavar="ID", help="Chạy riêng các ID, ví dụ: T1 T10 33"
    )
    return parser


def run_case(name: str, solve: Callable, case: Case):
    try:
        result = solve(case.make_board())
        validate_result(name, case, case.make_board(), result)
        detail = (
            f"moves={result['solution_length']} cost={result['total_cost']:g} "
            f"expanded={result['expanded_nodes']} time={result['search_time_ms']:.3f}ms "
            f"peak={result['memory_kb']:.2f}KiB"
        )
        return "PASS", detail
    except NotImplementedError as error:
        return "PENDING", str(error)
    except Exception as error:
        return "FAIL", f"{type(error).__name__}: {error}"


def run_suite(cases: List[Case], solvers: Dict[str, Callable]) -> int:
    counts = {"PASS": 0, "FAIL": 0, "PENDING": 0}
    for name, solve in solvers.items():
        for case in cases:
            status, detail = run_case(name, solve, case)
            counts[status] += 1
            print(f"{status}: {name.upper()} / {case.id} - {case.title} | {detail}")
    print(f"Kết quả: {counts['PASS']} PASS / {counts['FAIL']} FAIL / {counts['PENDING']} PENDING")
    return 1 if counts["FAIL"] else 2 if counts["PENDING"] else 0


def run_selected(solver: str = "all", ids: Optional[List[str]] = None) -> int:
    try:
        cases = select_cases(load_cases(), ids)
    except (OSError, ValueError, KeyError, TypeError, AssertionError) as error:
        print(f"FAIL: Không nạp được bộ test - {error}")
        print("Kết quả: 0 PASS / 1 FAIL / 0 PENDING")
        return 1
    selected = SOLVERS if solver == "all" else {solver: SOLVERS[solver]}
    return run_suite(cases, selected)


def main(argv=None):
    parser = build_parser("Kiểm thử Bloxorz: engine, API, dữ liệu và solver")
    parser.add_argument(
        "--ui", action="store_true", help="Chạy thêm test UI (cần Node.js và npm ci)"
    )
    args = parser.parse_args(argv)

    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"), top_level_dir=str(ROOT))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        print("FAIL: kiểm thử engine/API/dữ liệu; cần sửa trước khi chạy solver")
        return 1

    solver_status = run_selected(args.solver, args.cases)
    ui_status = 0
    if args.ui:
        node = shutil.which("node")
        if node is None:
            print("FAIL: test UI cần Node.js; cài Node rồi chạy npm ci trong tests/")
            ui_status = 1
        else:
            ui_status = subprocess.run(
                [node, "--test", "test_ui.cjs", "test_audio.cjs", "test_render_assets.cjs"],
                cwd=ROOT / "tests",
            ).returncode
    if solver_status == 1 or ui_status != 0:
        return 1
    return solver_status


if __name__ == "__main__":
    raise SystemExit(main())
