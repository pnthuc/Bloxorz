"""Discover the level catalog from JSON files; IDs need not be contiguous."""
import json
import os
from pathlib import Path

BASE_DIR = str(Path(__file__).resolve().parents[1])

def load_all_levels(directory=None) -> dict:
    """Đọc toàn bộ các file màn chơi .json trong thư mục Src/levels/."""
    levels_dir = str(Path(directory) if directory is not None else Path(BASE_DIR) / "levels")
    levels = {}
    if os.path.exists(levels_dir):
        for fname in sorted(os.listdir(levels_dir)):
            if fname.endswith(".json"):
                fpath = os.path.join(levels_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        lvl_id = str(data["id"])
                    if not lvl_id or lvl_id in levels:
                        raise ValueError(f"Duplicate or empty level ID: {lvl_id}")
                    levels[lvl_id] = data
                except Exception as e:
                    raise ValueError(f"Invalid level file {fname}: {e}") from e
    return dict(sorted(levels.items(),
                       key=lambda item: (0, int(item[0])) if item[0].isdigit() else (1, item[0])))

