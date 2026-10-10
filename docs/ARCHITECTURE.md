# Architecture

```
USGS API ----> client.ts ----> QuakeData ----> Overlay (2D canvas) ----> screen
 geojson       usgs.ts         picks                  ^
 quakeml                       instruments            | distanceAt(wave, t)
 shakemap                      felt reports           |
 stations                      intensity grid         |
                                                      |
iasp91 table ----> TravelTimes -----------------------+
(ObsPy TauP)       time(wave, distance), distanceAt(wave, t)
```

## Library: `src/core`

Pure functions and small classes. No DOM, so it runs under Node for the tests and the build scripts.

| File | Job |
|---|---|
| `traveltime.ts` | `TravelTimes`: first-arrival P and S times for one source depth. The depth row of the table is interpolated once, then `time()` and `distanceAt()` are cheap |
| `warning.ts` | Seconds at a pin, the warning time for an alert, the blind zone radius |
| `geo.ts` | Great-circle distance, bearing, destination point, constant-distance rings that stay continuous across the antimeridian |
| `usgs.ts` | Parsers for the USGS event feature, phase data QuakeML, ShakeMap CoverageJSON and the ShakeMap station list |
| `client.ts` | Fetches an event: the summary first, then each layer on its own so one failing file does not fail the replay |
| `codec.ts` | The compact JSON form of a loaded event, used for the featured shelf |
| `residuals.ts` | Observed minus modelled arrival for every pick |
| `waveform.ts` | Picks a station, fetches its GeoCSV from EarthScope, keeps a min and max per time bin (a quarter second or two samples) |
| `replay.ts` | Opening view, replay length, default speed |
| `intensity.ts`, `cities.ts`, `link.ts`, `regions.ts` | MMI colours and words, city search, deep links and the event id in a pasted USGS address, the search regions |

### The travel-time table

`scripts/build_tables.py` asks ObsPy TauP for the first arrival of each wave group on a grid:

- P group: `p P Pn Pdiff PKP PKIKP PKiKP`, S group: `s S Sn Sdiff SKS SKIKS`. Phases that cannot be a first arrival,
  such as `pP` or `PcP`, are left out. Mantle S that turns into a P wave in the core (`SKiKP`) is also left out,
  because it is not what shakes the ground.
- 34 depths from 0 to 700 km, distances every 0.05 degrees to 12 and every 0.25 degrees to 180.
- Stored as Uint16 in units of 0.05 s, base64 in `src/data/traveltime.json` (166 KB).

At run time the table is interpolated linearly in depth and in distance. The unit test compares the result
with 600 random ObsPy results that are not on the grid: median error 0.01 s, 99th percentile under 0.2 s.

`distanceAt(wave, t)` inverts the table by bisection. It returns null while the wave is still underground, which
is why a deep quake has no ring for its first seconds.

## Page: `src/app`

| File | Job |
|---|---|
| `app.ts` | Wires everything. Owns loading, the playback loop, the pin and the address bar: a quake the viewer chooses is a history entry, so Back returns to the one before |
| `state.ts` | A small store. The replay clock is kept apart so a frame does not wake every subscriber |
| `map.ts`, `style.ts` | MapLibre with a bundled coastline layer under OpenFreeMap vector tiles. Labels follow the language. A click waits a moment before it drops the pin, so a double click zooms without moving it |
| `overlay.ts` | A 2D canvas above the map. Draws the ShakeMap wash clipped to the S front, the two fronts, instruments, picks, felt reports and the blind zone. Screen positions are cached and recomputed when the map moves |
| `panel.ts`, `dock.ts`, `layers.ts` | The left panel, the timeline and the layer chips |
| `strip.ts` | The seismogram strip above the timeline, lined up with the scrubber. A caption row, a row for the P and S letters, then the trace. Shorter on a phone |
| `picker.ts`, `learn.ts`, `share.ts` | The three dialogs. `share.ts` also composes the cards and records the clip from the map and overlay canvases |
| `i18n.ts`, `locales/*.json` | Messages, number and date formatting |

`index.html` carries a small placeholder (two rings, the P one running ahead of the S one) and a script that sets the theme
before the first paint, so the page is not blank while the 480 KB script downloads. The app removes the placeholder once its
own screen is up.

Drawing the waves on a separate canvas, instead of as map layers, means a frame costs a few hundred projected
points and no map re-render, and the same canvas is what the share card and the clip copy from.

## Build

`scripts/build.mjs` runs esbuild twice: the app (`dist/assets/app.js`, with MapLibre's worker copied next to
it) and the library (`dist/rumbleback.js`). It then copies `public/` and writes `index.html` with the
version in the asset URLs. `dist/` is not committed, so CI builds it fresh.

## Tests

- `test/*.test.ts` run under `node --test` with Node's type stripping. They cover the table against ObsPy,
  geometry, the USGS parsers (with excerpts of real USGS files), the client with a fake `fetch`, the
  featured events, the picks check and the language files.
- `e2e/*.e2e.ts` drive the built site in Chromium. The USGS catalog, the product downloads and EarthScope are answered
  from fixtures, the map tiles are blocked, and any other outside request fails the test.
