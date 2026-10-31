"""Load engine-owned level JSON, with the existing four-level fallback."""
import json
import os
from pathlib import Path

BASE_DIR = str(Path(__file__).resolve().parents[1])

DEFAULT_LEVELS = {
    "1": {
        "id": "1",
        "name": "Stage 1: Basic Moves",
        "description": "Reach the goal.",
        "difficulty": "Easy",
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
    },
    "2": {
        "id": "2",
        "name": "Stage 2: Fragile Tiles",
        "description": "Cross the fragile tiles.",
        "difficulty": "Medium",
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
    },
    "3": {
        "id": "3",
        "name": "Stage 3: Two Bridges",
        "description": "Open both bridges.",
        "difficulty": "Medium",
        "start_pos": [1, 1],
        "initial_bridges": [False, False],
        "switches": {
            "1,3": {"behavior": "toggle", "targets": [0]},
            "1,8": {"behavior": "open", "targets": [1]}
        },
        "grid": [
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
            [1, 1, 1, 3, 0, 0, 1, 1, 4, 1, 1, 1],
            [1, 1, 1, 1, 10, 10, 1, 1, 1, 1, 11, 11],
            [1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 9],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]
        ]
    },
    "4": {
        "id": "4",
        "name": "Stage 4: Split and Merge",
        "description": "Split the block and join it again.",
        "difficulty": "Hard",
        "start_pos": [1, 1],
        "initial_bridges": [False],
        "switches": {
            "1,4": {"behavior": "split", "targets": [[0, 4], [2, 4]]},
            "0,6": {"behavior": "toggle", "targets": [0]}
        },
        "grid": [
            [0, 0, 0, 1, 1, 1, 3, 0, 0, 1],
            [1, 1, 2, 1, 5, 1, 1, 10, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 0, 1, 9],
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1]
        ]
    }
}


def load_all_levels() -> dict:
    """Đọc toàn bộ các file màn chơi .json trong thư mục Src/levels/."""
    levels_dir = os.path.join(BASE_DIR, "levels")
    levels = {}
    if os.path.exists(levels_dir):
        for fname in sorted(os.listdir(levels_dir)):
            if fname.endswith(".json"):
                fpath = os.path.join(levels_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        lvl_id = str(data.get("id", len(levels) + 1))
                        levels[lvl_id] = data
                except Exception as e:
                    print(f"[Warning] Lỗi đọc file {fname}: {e}")
    return dict(sorted((levels or DEFAULT_LEVELS).items(),
                       key=lambda item: (0, int(item[0])) if item[0].isdigit() else (1, item[0])))
