"""Check intended contrasts using the actual playable levels and edge catalog."""
import unittest

from core.replay import replay_solution
from solvers import solve_bfs, solve_dfs, solve_ucs, solve_astar
from tests.helpers import load_cases, validate_result


class LevelContrastTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cases = {case.id: case for case in load_cases()}

    def test_all_four_shallow_rotations_have_two_move_optimum(self):
        for lid in ('17', '18', '19', '20'):
            with self.subTest(level=lid):
                case = self.cases[lid]
                result = solve_bfs(case.make_board())
                validate_result('bfs', case, case.make_board(), result)
                self.assertEqual(result['solution_length'], 2)

    def test_weighted_routes_trade_more_moves_for_lower_cost(self):
        for lid in ('24', '25'):
            with self.subTest(level=lid):
                case = self.cases[lid]
                bfs, ucs = solve_bfs(case.make_board()), solve_ucs(case.make_board())
                validate_result('bfs', case, case.make_board(), bfs)
                validate_result('ucs', case, case.make_board(), ucs)
                bfs_path = replay_solution(case.make_board(), bfs['moves'])
                ucs_path = replay_solution(case.make_board(), ucs['moves'])
                self.assertEqual((bfs['solution_length'], bfs_path.cost), (16, 23))
                self.assertEqual((ucs['solution_length'], ucs_path.cost), (20, 20))

    def test_all_solvers_exhaust_the_unreachable_goal_case(self):
        case = self.cases['T11']
        counts = []
        for name, solve in [('bfs', solve_bfs), ('dfs', solve_dfs), ('ucs', solve_ucs), ('astar', solve_astar)]:
            result = solve(case.make_board())
            validate_result(name, case, case.make_board(), result)
            self.assertFalse(result['found'])
            counts.append(result['expanded_nodes'])
        self.assertEqual(len(set(counts)), 1)
