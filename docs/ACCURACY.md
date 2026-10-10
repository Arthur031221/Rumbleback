# How accurate is it

Short version: the first P arrival is good to about a second where USGS has analyst picks, and the page
shows you that comparison for every quake. The check covers P arrivals of quakes 8 to 48 km deep. S arrivals,
deeper quakes and the shaking itself are not checked against picks. This is not an official warning system and it does not model
everything that shakes the ground.

## The check against real picks

For every quake the *Checked against real data* card compares the model with the arrival times that analysts
picked at real stations and that USGS used to locate the event. Run `npm run validate` to print the same
table for the fourteen featured quakes.

Observed minus modelled first P arrival, stations up to 95 degrees from the epicenter:

| Quakes | P picks | Median absolute error | 90% within |
|---|---|---|---|
| 14 featured events, M6.8 to M9.1 | 3,933 | 0.66 s | 1.75 s |
| 2024 Hualien, M7.4 | 298 | 0.71 s | 1.55 s |
| 2022 Chishang, M6.9 | 209 | 0.44 s | 1.12 s |
| 2024 Noto, M7.5 | 256 | 0.33 s | 0.86 s |

The worst featured event is the 1999 Chi-Chi quake (median 1.8 s), whose picks are from an older network and
location. The other thirteen have a median under 1 s. The per-event table is printed by the command above.

What this does and does not show:

- The picks are the ones USGS located the quake with, so they are not independent of the origin time and
  depth. A bad origin time would shift every residual together. The check shows that the table reproduces
  what real instruments recorded, not that it forecasts an unseen quake.
- The USGS solutions name ak135 as their Earth model, and this page uses iasp91. Contributing networks can
  use regional models of their own. `python3 scripts/compare_models.py` prints how far the two global models
  are apart for the first P arrival at depths of 10 and 40 km, every half degree from 0.5 to 95 degrees:
  at most 0.15 s. For those depths and distances the model choice is not where the half second comes from.
  Pick noise, three dimensional structure and origin time are the likelier sources.
- Picks beyond 95 degrees are left out. There the first arrival in the model is the diffracted wave or a core
  phase, and the phase an analyst picked is often a different one, so the comparison would not be like for like.
- The table itself is checked against ObsPy TauP at 600 random points: median error 0.01 s for P and 0.01 s
  for S, 99th percentile 0.11 s for P and 0.19 s for S, largest 0.2 s and 0.56 s.

## The seismogram

The strip uses a station between 0.5 and 12 degrees whose vertical channel has continuous data from before
the P wave to 45 seconds after the S wave. Broadband channels are tried before the others and nearer stations
before farther ones. Stations that fail are skipped and the next is tried, up to eight.
The strip is the raw counts with the mean of the quiet time before the quake removed (the mean of the whole trace if
there is less than a second of quiet time), so a saturated or clipped record looks saturated or clipped. Each time bin
is a quarter of a second, or two samples for a slow channel, and keeps its smallest and largest value. Ten of the fourteen featured quakes have one. For the others, such as Chi-Chi in 1999, no usable
trace turned up within that bounded search.

## S waves

USGS publishes very few S picks for large events, so the S front is the model alone, and the card says how many
S picks there were. The model gives the first S-type arrival (`S`, `Sn`, `Sdiff`, `SKS`). The strongest shaking
often comes a little after that, from the S wave train and from surface waves, which are not modelled.

## "Seconds you had"

The pin card and the alert slider are arithmetic on the model:

- Distance is the great-circle distance between the epicenter and the pin on a spherical Earth. The error against
  an ellipsoid is under half a percent.
- The depth is the USGS depth. For large quakes it can be a fixed or a modelled depth and can change after
  review, and the P and S arrival at a pin near the epicenter move by about a quarter of a second per kilometre.
- The alert time is a number you choose. Real systems differ in how fast they send a first alert and in how
  accurate it is.
- Local ground is not modelled. A soft basin can delay the arrival at a pin, make the shaking stronger and make it
  last longer.

## Intensity

The ShakeMap is a USGS estimate that blends a ground motion model with real instrument readings. The strong
motion dots show the instrumental intensity USGS computed from what each instrument recorded, which is a
conversion from ground motion and not a direct reading. The ShakeMap value at your pin is interpolated between
grid cells that are about 3 to 15 km apart in the shipped quakes (7 km north to south for Hualien, and less east to west the farther from the equator), so a pin close to a station
can differ from that station's reading.
Intensity colours follow the USGS ShakeMap scale. A conversion to the Japanese or Taiwanese intensity scales
is not included yet.

## Known limits

- Surface waves and local site effects are not modelled.
- A front that goes over a pole, which a long replay with a pin on the far side of the Earth can reach, is drawn as an open line without its soft band, and the ShakeMap is shown whole once the S front has passed the edge of its grid.
- Only the first P and S arrivals are drawn, not reflections or depth phases.
- Quakes outside the USGS catalog (small local events, or ones a national agency alone reports) are not available.
- The ShakeMap and the Did You Feel It layers exist only for events where USGS produced them. The page says
  which layers a quake lacks.
