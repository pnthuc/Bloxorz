"""Bounded, isolated measurements using the existing, unmodified solvers."""
import json
import logging
from pathlib import Path
from queue import Empty, Queue
import subprocess
import sys
from tempfile import TemporaryFile
from threading import Thread


def _solve(connection, level, solver_name):
    try:
        from core.board import BloxorzBoard
        from solvers import solve_bfs, solve_dfs, solve_ucs, solve_astar
        from solvers.costs import step_cost

        board = BloxorzBoard(level)
        solver = {"bfs": solve_bfs, "dfs": solve_dfs,
                  "ucs": solve_ucs, "astar": solve_astar}[solver_name]
        # Imports, process startup and board construction are outside the budget.
        connection.send({"status": "ready"})
        result = solver(board)
        # BFS/DFS report action count as their own cost. Compare every answer
        # with the same existing weighted cost, outside search profiling.
        if result["found"]:
            state, cost = board.get_initial_state(), 0.0
            for action in result["moves"]:
                state = board.apply_move(state, action)
                if state is None:
                    raise ValueError("Lời giải có nước đi không hợp lệ.")
                cost += step_cost(board, state)
            if not board.is_goal(state):
                raise ValueError("Lời giải chưa tới đích.")
            result = {**result, "solver_reported_cost": result["total_cost"],
                      "total_cost": round(cost, 2)}
        connection.send({"status": "solved" if result["found"] else "unsolved",
                         "result": result})
    except NotImplementedError:
        connection.send({"status": "unavailable", "error": "Thuật toán chưa được triển khai."})
    except Exception as exc:
        connection.send({"status": "error", "error": str(exc)})
    finally:
        connection.close()


def _run_worker(command, payload, limit_ms, startup_seconds=15):
    # Execute our module directly. multiprocessing's spawn re-imports the web
    # host's __main__, which can start its server loop before reaching _solve.
    messages = Queue()
    process = None
    reader = None
    errors = TemporaryFile()

    def read_messages():
        try:
            for line in process.stdout:
                messages.put(json.loads(line))
        except (ValueError, OSError) as exc:
            messages.put({"status": "error", "error": str(exc)})
        finally:
            messages.put(None)

    def receive(seconds):
        message = messages.get(timeout=seconds)
        if message is None:
            raise EOFError("Worker kết thúc trước khi gửi kết quả.")
        return message

    try:
        process = subprocess.Popen(command, cwd=Path(__file__).resolve().parents[1],
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=errors, text=True, encoding="utf-8")
        reader = Thread(target=read_messages, name="benchmark-output", daemon=True)
        reader.start()
        process.stdin.write(json.dumps(payload) + "\n")
        process.stdin.close()
        try:
            message = receive(startup_seconds)
        except Empty:
            return {"status": "error", "error": "Không khởi động được lượt đo. Hãy thử lại."}
        if message.get("status") != "ready":
            return message
        try:
            return receive(limit_ms / 1000)
        except Empty:
            return {"status": "timeout"}
    except (EOFError, OSError, RuntimeError) as exc:
        return {"status": "error", "error": "Lượt đo bị gián đoạn: " + str(exc)}
    finally:
        if process is not None:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=1)
                except subprocess.TimeoutExpired:
                    process.kill()
            process.wait()
            if reader:
                reader.join(timeout=1)
            process.stdout.close()
            process.stdin.close()
        errors.seek(0)
        detail = errors.read(4000).decode("utf-8", errors="replace").strip()
        errors.close()
        if detail:
            logging.getLogger(__name__).warning("Benchmark worker: %s", detail)


def measure_solver(level, solver_name, limit_ms):
    return _run_worker([sys.executable, "-B", "-m", "benchmarks.worker"],
                       {"level": level, "solver": solver_name}, limit_ms)


class _Output:
    def send(self, message):
        print(json.dumps(message), flush=True)

    def close(self):
        pass


if __name__ == "__main__":
    request = json.loads(sys.stdin.readline())
    _solve(_Output(), request["level"], request["solver"])
