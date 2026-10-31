"""Catalog consumers follow files and metadata, not a fixed level count."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from core.levels import load_all_levels
from web.app import app
from benchmarks.cli import level_groups


class LevelCatalogTests(unittest.TestCase):
    def test_discovery_add_remove_and_noncontiguous_ids(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertEqual(load_all_levels(root), {})
            for lid in ('42', '2', 'bonus'):
                (root / f'{lid}.json').write_text(json.dumps(dict(id=lid, name=lid,
                    grid=[[1, 1, 1, 9]], start_pos=[0, 0])), encoding='utf-8')
            self.assertEqual(list(load_all_levels(root)), ['2', '42', 'bonus'])
            (root / '2.json').unlink()
            self.assertEqual(list(load_all_levels(root)), ['42', 'bonus'])
            with patch('web.app.load_all_levels', return_value=load_all_levels(root)):
                client = app.test_client()
                self.assertEqual(set(client.get('/api/levels').json), {'42', 'bonus'})
                self.assertEqual(client.get('/api/level/2').status_code, 404)
                self.assertEqual(client.get('/api/level/42').json['level']['name'], '42')
                result = client.post('/api/solve', json={'solver': 'bfs'})
                self.assertTrue(result.json['found'])

    def test_empty_catalog_has_no_old_fallback(self):
        with patch('web.app.load_all_levels', return_value={}):
            client = app.test_client()
            self.assertEqual(client.get('/api/levels').json, {})
            self.assertEqual(client.get('/api/level/1').status_code, 404)
            self.assertEqual(client.post('/api/solve', json={}).status_code, 404)

    def test_duplicate_or_invalid_files_fail_explicitly(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ('one', 'two'):
                (root / f'{name}.json').write_text('{"id":"same"}', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Duplicate'):
                load_all_levels(root)
            (root / 'two.json').write_text('{', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Invalid level file'):
                load_all_levels(root)

    def test_grouping_uses_mechanics_and_metadata(self):
        levels = {name: dict(id=name, name=name, grid=[tiles], initial_bridges=[])
                  for name, tiles in [('plain', [1, 9]), ('orange', [1, 2, 9]),
                                      ('bridge', [1, 3, 9]), ('split', [2, 3, 5, 9])]}
        groups = level_groups(levels)
        self.assertEqual([r['primary_group'] for r in groups.values()],
                         ['Cơ bản', 'Gạch cam', 'Công tắc - Cầu', 'Tách/ghép'])


if __name__ == '__main__':
    unittest.main()
