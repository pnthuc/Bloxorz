# Source/test_solvers.py
import sys
from typing import Tuple, List
from game_logic import BloxorzBoard
from main import load_all_levels
from solvers import solve_bfs, solve_dfs, solve_ucs, solve_astar, heuristic

# Các kịch bản kiểm thử chuyên biệt, tách biệt với dữ liệu màn chơi.
UNIT_TEST_CASES = [
    {
        "title": "Test 1 - Màn Cơ Bản (Kiểm tra BFS tìm đúng đường ngắn nhất = 7 bước)",
        "expected_bfs_len": 7,
        "solvable": True,
        "level": {
            "id": "T1",
            "name": "Unit Test 1: Basic",
            "start_pos": [1, 1],
            "initial_bridges": [],
            "switches": {},
            "grid": [
                [1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                [0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [0, 0, 0, 0, 0, 1, 1, 9, 1, 1],
                [0, 0, 0, 0, 0, 0, 1, 1, 1, 0]
            ]
        }
    },
    {
        "title": "Test 2 - Bẫy Gạch Cam (Kiểm tra UCS & A* biết né gạch cam có chi phí cao)",
        "expected_bfs_len": None,
        "solvable": True,
        "level": {
            "id": "T2",
            "name": "Unit Test 2: Fragile Cost Trap",
            "start_pos": [2, 1],
            "initial_bridges": [],
            "switches": {},
            "grid": [
                [1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 1, 2, 2, 2, 2, 1, 9, 1],
                [1, 1, 2, 2, 2, 2, 1, 1, 1],
                [0, 0, 0, 0, 0, 0, 1, 1, 1]
            ]
        }
    },
    {
        "title": "Test 3 - Công Tắc Phân Tách & Cầu (Kiểm tra Split Switch + Spacebar + Bridge)",
        "expected_bfs_len": None,
        "solvable": True,
        "level": {
            "id": "T3",
            "name": "Unit Test 3: Split & Bridge",
            "start_pos": [1, 1],
            "initial_bridges": [False],
            "switches": {
                "1,4": {"behavior": "split", "targets": [[0, 4], [2, 4]]},
                "0,6": {"behavior": "toggle", "targets": [0]}
            },
            "grid": [
                [0, 0, 0, 1, 1, 1, 3, 0, 0, 1],
                [1, 1, 1, 1, 5, 1, 1, 10, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 0, 1, 9],
                [0, 0, 0, 0, 0, 0, 0, 0, 1, 1]
            ]
        }
    },
    {
        "title": "Test 4 - Màn Vô Nghiệm (Kiểm tra chống lặp vô tận khi đích bị cô lập)",
        "expected_bfs_len": 0,
        "solvable": False,
        "level": {
            "id": "T4",
            "name": "Unit Test 4: Unsolvable Island",
            "start_pos": [1, 1],
            "initial_bridges": [],
            "switches": {},
            "grid": [
                [1, 1, 1, 0, 0, 0],
                [1, 1, 1, 0, 9, 1],
                [1, 1, 1, 0, 1, 1]
            ]
        }
    }
]


# Small fixtures with hand-checkable outcomes: four RIGHT rolls reach cell 6.
for id, title, row, switches, solvable, length in [
    ('T5', 'Đích thẳng hai bước', [1, 1, 1, 9], {}, True, 2),
    ('T6', 'Gạch mỏng chặn vị trí đứng', [1, 1, 1, 2, 1, 1, 9], {}, False, 0),
    ('T7', 'Soft switch mở cầu giữa hành lang', [1, 1, 3, 10, 1, 1, 9],
     {'0,2': {'behavior': 'toggle', 'targets': [0]}}, True, 4),
    ('T8', 'Heavy switch được nhấn khi đứng', [1, 1, 1, 4, 10, 10, 9],
     {'0,3': {'behavior': 'open', 'targets': [0]}}, True, 4),
    ('T9', 'Nằm trên heavy switch không mở cầu', [1, 1, 4, 1, 10, 10, 9],
     {'0,2': {'behavior': 'open', 'targets': [0]}}, False, 0),
]:
    UNIT_TEST_CASES.append({
        'title': id + ' - ' + title, 'solvable': solvable, 'expected_bfs_len': length,
        'level': {'id': id, 'name': title, 'grid': [row], 'start_pos': [0, 0],
                  'initial_bridges': [False] if switches else [], 'switches': switches}})


def verify_solution_walk(board: BloxorzBoard, moves: List[str]) -> Tuple[bool, str, float]:
    """
    Mô phỏng lại toàn bộ danh sách bước đi (moves) từ trạng thái đầu.
    Đảm bảo không bước nào vi phạm luật và bước cuối cùng đứng thẳng tại ô GOAL.
    """
    state = board.get_initial_state()
    total_cost = 0.0

    for idx, action in enumerate(moves):
        next_state = board.apply_move(state, action)
        if next_state is None:
            return (
                False,
                f"Bước thứ {idx + 1} ('{action}') không hợp lệ (rơi khỏi sàn hoặc vỡ gạch cam)!",
                total_cost
            )
        total_cost += 1 + 0.5 * sum(board.grid[r][c] == 2 for r, c in next_state.get_occupied_cells())
        state = next_state

    if not board.is_goal(state):
        return (
            False,
            f"Đi hết {len(moves)} bước nhưng trạng thái cuối ({state.orientation} tại {state.r},{state.c}) chưa vào ô GOAL!",
            total_cost
        )

    return True, "Hợp lệ", round(total_cost, 2)



def run_all_tests():
    import argparse
    import json
    import math
    from pathlib import Path
    parser = argparse.ArgumentParser(description="Kiểm tra thuật toán độc lập: exit 0=PASS, 1=FAIL, 2=PENDING")
    parser.add_argument('--solver', choices=['all', 'bfs', 'dfs', 'ucs', 'astar'], default='all')
    args = parser.parse_args()
    solvers = {'bfs': solve_bfs, 'dfs': solve_dfs, 'ucs': solve_ucs, 'astar': solve_astar}
    selected = solvers if args.solver == 'all' else {args.solver: solvers[args.solver]}
    expected = json.loads((Path(__file__).parent / 'tests/level_expectations.json').read_text())
    cases = list(UNIT_TEST_CASES)
    # Boundary fixture: no action is needed when starting at the goal.
    cases.append({'title':'T10 - Start already at goal', 'solvable':True, 'expected_bfs_len':0,
                  'level':{'id':'T10','name':'Start goal','grid':[[9]],'start_pos':[0,0]}})
    fixture_costs = {'T1':7,'T2':7.5,'T3':17,'T5':2,'T7':4,'T8':4,'T10':0}
    for case in cases:
        case['expected_ucs_cost'] = fixture_costs.get(case['level']['id'])
    for id, lv in load_all_levels().items():
        cases.append({'title':'Level '+id, 'solvable':True, 'level':lv,
                      'expected_bfs_len':expected[id]['bfs_moves'], 'expected_ucs_cost':expected[id]['ucs_cost']})
    passed = failed = pending = 0
    for name, solve in selected.items():
        for case in cases:
            label = name.upper() + ' / ' + case['title']; b = BloxorzBoard(case['level'])
            try:
                result = solve(b)
                required = {'found','moves','solution_length','expanded_nodes','search_time_ms','memory_kb','total_cost'}
                assert isinstance(result, dict) and required <= result.keys(), 'Sai schema kết quả'
                assert type(result['found']) is bool and isinstance(result['moves'], list), 'Sai kiểu found/moves'
                assert type(result['expanded_nodes']) is int and result['expanded_nodes'] >= 0, 'Sai expanded_nodes'
                if not b.is_goal(b.get_initial_state()):
                    assert result['expanded_nodes'] > 0, 'expanded_nodes phải > 0 khi đã mở rộng trạng thái; kiểm tra tên key trả về'
                for key in ('search_time_ms','memory_kb','total_cost'):
                    assert math.isfinite(result[key]) and result[key] >= 0, 'Sai metric '+key
                assert result['found'] == case['solvable'], 'Sai found'
                assert result['solution_length'] == len(result['moves']), 'Sai solution_length'
                if not case['solvable']:
                    assert result['moves'] == [] and result['total_cost'] == 0, 'Vô nghiệm phải có moves=[] và cost=0'
                else:
                    ok, reason, weighted = verify_solution_walk(b, result['moves'])
                    assert ok, reason
                    expected_cost = len(result['moves']) if name in ('bfs','dfs') else weighted
                    assert abs(result['total_cost']-expected_cost) < 1e-6, 'Sai tổng chi phí đường đi'
                    if case['level']['id'] == 'T10':
                        assert result['expanded_nodes'] == 0, 'Start=goal không cần mở rộng'
                    if name == 'astar':
                        goal_pos = next((r,c) for r,row in enumerate(b.grid) for c,tile in enumerate(row) if tile == 9)
                        h0 = heuristic(b, b.get_initial_state(), goal_pos)
                        assert math.isfinite(h0) and h0 >= 0, 'Heuristic phải hữu hạn, không âm'
                        if case.get('expected_ucs_cost') is not None:
                            assert h0 <= case['expected_ucs_cost'], 'Heuristic đầu màn vượt cost tối ưu đã biết'
                        goal_state = b.get_initial_state()
                        for action in result['moves']:
                            goal_state = b.apply_move(goal_state, action)
                        assert abs(heuristic(b, goal_state, goal_pos)) < 1e-6, 'h(goal) phải bằng 0'
                    if name == 'bfs' and case['expected_bfs_len'] is not None:
                        assert len(result['moves']) == case['expected_bfs_len'], 'BFS chưa tối ưu số bước'
                    if name in ('ucs','astar') and case.get('expected_ucs_cost') is not None:
                        assert result['total_cost'] == case['expected_ucs_cost'], 'Chưa tối ưu chi phí'
                print('PASS:',label); passed += 1
            except NotImplementedError as error:
                print('PENDING:',label,'-',error); pending += 1
            except Exception as error:
                print('FAIL:',label,'-',error); failed += 1
    print(f'Kết quả: {passed} PASS / {failed} FAIL / {pending} PENDING')
    return 1 if failed else 2 if pending else 0


if __name__ == '__main__':
    sys.exit(run_all_tests())
