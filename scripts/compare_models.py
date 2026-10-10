#!/usr/bin/env python3
"""How far apart are iasp91 and ak135 for the first P arrival?

USGS locates earthquakes with ak135 and this app uses iasp91, so the picks in the check card are
compared with a model USGS did not use. This prints how much the two models differ between 0.5 and
95 degrees for source depths of 10 and 40 km. Needs ObsPy.
"""
import numpy as np
from obspy.taup import TauPyModel

PHASES = ["p", "P", "Pn", "Pdiff"]
iasp91, ak135 = TauPyModel("iasp91"), TauPyModel("ak135")


def first(model, depth, dist):
    return min(a.time for a in model.get_travel_times(depth, dist, phase_list=PHASES))


diff = np.array([first(ak135, depth, dist) - first(iasp91, depth, dist) for depth in (10, 40) for dist in np.arange(0.5, 95, 0.5)])
print(f"ak135 minus iasp91, first P: median abs {np.median(abs(diff)):.2f} s, p90 abs {np.percentile(abs(diff), 90):.2f} s, max abs {abs(diff).max():.2f} s")
