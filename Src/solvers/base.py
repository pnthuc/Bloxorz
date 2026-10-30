# Source/solvers/base.py
import time
import tracemalloc
from threading import Lock
from typing import List, Dict, Any, Callable
from core.board import BloxorzBoard


# tracemalloc is process-wide; two browser requests must not reset one another.
_PROFILER_LOCK = Lock()


def format_metrics(
    found: bool,
    moves: List[str],
    expanded_nodes: int,
    elapsed_sec: float,
    peak_mem_bytes: int,
    total_cost: float = 0.0
) -> Dict[str, Any]:
    return {
        "found": bool(found),
        "moves": list(moves) if found else [],
        "solution_length": len(moves) if found else 0,
        "expanded_nodes": int(expanded_nodes),
        "search_time_ms": round(elapsed_sec * 1000.0, 3),
        "memory_kb": round(peak_mem_bytes / 1024.0, 2),
        "total_cost": round(float(total_cost), 2) if found else 0.0
    }


def run_with_profiler(solver_core_fn: Callable[[BloxorzBoard], Dict[str, Any]], board: BloxorzBoard) -> Dict[str, Any]:
    with _PROFILER_LOCK:
        tracemalloc.start()
        t0 = time.perf_counter()
        try:
            raw = solver_core_fn(board)
        finally:
            elapsed = time.perf_counter() - t0
            _, peak_bytes = tracemalloc.get_traced_memory()
            tracemalloc.stop()

        return format_metrics(
            found=raw.get("found", False),
            moves=raw.get("moves", []),
            expanded_nodes=raw.get("expanded_nodes", 0),
            elapsed_sec=elapsed,
            peak_mem_bytes=peak_bytes,
            total_cost=raw.get("total_cost", len(raw.get("moves", [])))
        )
