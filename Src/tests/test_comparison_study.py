"""Verify the intended experimental contrasts against the real engine."""
import unittest

from comparison_study import HERE, engine, load_cases, rotate_board, validate


class ComparisonCaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cases = load_cases(HERE)
        cls.board_module, cls.solvers, cost = engine(HERE)
        cls.step_cost = staticmethod(cost)

    def test_rotations_preserve_two_move_shallow_optimum(self):
        shallow = [c for c in self.cases if c['family'] == 'shallow_goal']
        self.assertEqual({c['angle'] for c in shallow}, {0, 90, 180, 270})
        for case in shallow:
            with self.subTest(case=case['id']):
                result = self.solvers.solve_bfs(self.board_module.BloxorzBoard(case['board']))
                self.assertEqual(result['solution_length'], 2)
                self.assertEqual(validate(case, 'bfs', result, self.board_module, self.step_cost), 2)

    def test_weighted_case_requires_different_optimization_objectives(self):
        for case in self.cases:
            if case['family'] != 'fragile_tradeoff':
                continue
            with self.subTest(case=case['id']):
                bfs = self.solvers.solve_bfs(self.board_module.BloxorzBoard(case['board']))
                ucs = self.solvers.solve_ucs(self.board_module.BloxorzBoard(case['board']))
                bfs_cost = validate(case, 'bfs', bfs, self.board_module, self.step_cost)
                ucs_cost = validate(case, 'ucs', ucs, self.board_module, self.step_cost)
                self.assertLess(bfs['solution_length'], ucs['solution_length'])
                self.assertGreater(bfs_cost, ucs_cost)

    def test_unreachable_control_is_exhausted_by_all_solvers(self):
        case = next(c for c in self.cases if c['family'] == 'unreachable_goal')
        counts = []
        for name in ('bfs', 'dfs', 'ucs', 'astar'):
            raw = getattr(self.solvers, 'solve_' + name)(self.board_module.BloxorzBoard(case['board']))
            self.assertIsNone(validate(case, name, raw, self.board_module, self.step_cost))
            self.assertFalse(raw['found'])
            counts.append(raw['expanded_nodes'])
        self.assertEqual(len(set(counts)), 1)

    def test_rotation_transforms_split_destinations_without_rotating_bridge_indices(self):
        board = {'grid': [[1, 5, 10], [3, 1, 9]], 'start_pos': [0, 0],
                 'initial_bridges': [False], 'switches': {
                     '0,1': {'behavior': 'split', 'targets': [[0, 0], [1, 2]]},
                     '1,0': {'behavior': 'toggle', 'targets': [0]}}}
        turned = rotate_board(board)
        self.assertEqual(turned['switches']['1,1']['targets'], [[0, 1], [2, 0]])
        self.assertEqual(turned['switches']['0,0']['targets'], [0])
        for _ in range(3):
            turned = rotate_board(turned)
        self.assertEqual(turned, board)


if __name__ == '__main__':
    unittest.main()
