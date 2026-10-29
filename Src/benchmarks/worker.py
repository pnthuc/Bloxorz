"""Bounded, isolated measurements using the existing, unmodified solvers."""
import multiprocessing as mp


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


def _run_worker(worker, args, limit_ms):
    context = mp.get_context("spawn")
    receiving, sending = context.Pipe(duplex=False)
    process = context.Process(target=worker, args=(sending, *args),
                              name="bloxorz-benchmark", daemon=True)
    try:
        process.start()
        sending.close()
        if not receiving.poll(15):
            return {"status": "error", "error": "Không khởi động được lượt đo. Hãy thử lại."}
        message = receiving.recv()
        if message.get("status") != "ready":
            return message
        if not receiving.poll(limit_ms / 1000):
            return {"status": "timeout"}
        # Read before joining: a long DFS answer may exceed the pipe's buffer.
        return receiving.recv()
    except (EOFError, OSError, RuntimeError) as exc:
        return {"status": "error", "error": "Lượt đo bị gián đoạn: " + str(exc)}
    finally:
        receiving.close()
        sending.close()
        if process.pid is not None:
            process.join(.2)
            if process.is_alive():
                process.terminate()
                process.join(1)
            if process.is_alive():
                process.kill()
                process.join()
            process.close()


def measure_solver(level, solver_name, limit_ms):
    return _run_worker(_solve, (level, solver_name), limit_ms)
