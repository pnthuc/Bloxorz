"""Generate level-groups.csv directly from the installed level JSON files."""
import argparse
import csv
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'Src'))
from core.levels import load_all_levels

HEADERS = ['level_id', 'level_name', 'grid_size', 'floor_cells', 'bridges_count',
           'switches_count', 'split_switches', 'fragile_cells']


def level_groups(levels=None):
    result = {}
    for lid, level in (load_all_levels() if levels is None else levels).items():
        tiles = [tile for row in level['grid'] for tile in row]
        split = tiles.count(5)
        switches = sum(tiles.count(tile) for tile in (3, 4, 5))
        bridges = len(level.get('initial_bridges', []))
        fragile = tiles.count(2)
        result[lid] = dict(level_id=lid, level_name=level.get('name', f'Stage {lid}'),
                           grid_size=f"{len(level['grid'])}x{len(level['grid'][0])}",
                           floor_cells=sum(tile != 0 for tile in tiles), bridges_count=bridges,
                           switches_count=switches, split_switches=split, fragile_cells=fragile)
    return result


def generate(output=None, directory=None):
    rows = list(level_groups(load_all_levels(directory)).values())
    target = Path(output) if output is not None else Path(__file__).with_name('level-groups.csv')
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=HEADERS)
        writer.writeheader()
        writer.writerows(rows)
    return rows


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='Defaults to handoff/quan/level-groups.csv')
    parser.add_argument('--levels-dir', type=Path, help='Defaults to Src/levels')
    args = parser.parse_args(argv)
    rows = generate(args.output, args.levels_dir)
    print(f'Generated {len(rows)} levels.')


if __name__ == '__main__':
    main()
