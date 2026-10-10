#!/usr/bin/env python3
"""Precompute first-arrival P and S travel times for the iasp91 Earth model.

Needs ObsPy (pip install obspy). Writes src/data/traveltime.json, which the
library interpolates, and test/fixtures/taup-reference.json, a set of random
(depth, distance) points that are not grid nodes, used to check the
interpolation.

  python3 scripts/build_tables.py
"""
from __future__ import annotations

import base64
import json
import random
import struct
import sys
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from obspy.taup import TauPyModel

ROOT = Path(__file__).resolve().parent.parent
P_PHASES = ["p", "P", "Pn", "Pdiff", "PKP", "PKIKP", "PKiKP"]
S_PHASES = ["s", "S", "Sn", "Sdiff", "SKS", "SKIKS"]
STEP = 0.05  # seconds per stored unit; Uint16 reaches 3276 s, past any first arrival

DEPTHS = [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100,
          125, 150, 175, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700]
DISTANCES = [round(x, 4) for x in np.concatenate([np.arange(0, 12, 0.05), np.arange(12, 180.0001, 0.25)])]

_model = None


def first(depth: float, dist: float, phases: list[str]) -> float:
    global _model
    if _model is None:
        _model = TauPyModel("iasp91")
    arrivals = _model.get_travel_times(depth, dist, phase_list=phases)
    if not arrivals:
        return float("nan")
    return min(a.time for a in arrivals)


def row(args: tuple[float, list[str]]) -> list[float]:
    depth, phases = args
    return [first(depth, d, phases) for d in DISTANCES]


def pack(rows: list[list[float]]) -> str:
    flat = []
    for r in rows:
        for v in r:
            if v != v:
                raise SystemExit("gap in the table: no arrival in the phase group")
            flat.append(round(v / STEP))
    if max(flat) > 65535:
        raise SystemExit("travel time does not fit in Uint16")
    return base64.b64encode(struct.pack(f"<{len(flat)}H", *flat)).decode()


def main() -> None:
    with Pool(3) as pool:
        p_rows = pool.map(row, [(d, P_PHASES) for d in DEPTHS])
        s_rows = pool.map(row, [(d, S_PHASES) for d in DEPTHS])
    table = {
        "model": "iasp91",
        "source": "ObsPy TauP, first arrival of " + "/".join(P_PHASES) + " and " + "/".join(S_PHASES),
        "step": STEP,
        "depths": DEPTHS,
        "distances": DISTANCES,
        "p": pack(p_rows),
        "s": pack(s_rows),
    }
    out = ROOT / "src" / "data" / "traveltime.json"
    out.write_text(json.dumps(table, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size // 1024} KiB)")

    rng = random.Random(20261010)
    points = []
    while len(points) < 600:
        depth = round(rng.choice([rng.uniform(0, 100), rng.uniform(0, 700)]), 2)
        dist = round(rng.choice([rng.uniform(0, 12), rng.uniform(0, 180)]), 3)
        p, s = first(depth, dist, P_PHASES), first(depth, dist, S_PHASES)
        points.append({"depth": depth, "dist": dist, "p": round(p, 3), "s": round(s, 3)})
    ref = ROOT / "test" / "fixtures" / "taup-reference.json"
    ref.write_text(json.dumps({"model": "iasp91", "obspy": __import__("obspy").__version__, "points": points}) + "\n")
    print(f"wrote {ref}")


if __name__ == "__main__":
    sys.exit(main())
