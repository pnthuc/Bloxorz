"""Forwarder to handoff.phuc.plot.

The canonical plotting script is now maintained in handoff/phuc/plot.py.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from handoff.phuc.plot import *
from handoff.phuc.plot import main

if __name__ == "__main__":
    raise SystemExit(main())
