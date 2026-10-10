# Library API

`dist/rumbleback.js` (built from `src/index.ts`) exports the part of the page that has no DOM. It is plain ESM and
runs in Node 22 or newer and in browsers. Types are in the TypeScript sources in `src/core`.

## Travel times

```ts
import { TravelTimes } from './rumbleback.js';

const tt = new TravelTimes(40);        // source depth in km, 0 to 700
tt.time('P', 1.1);                      // seconds from origin to the first P arrival 1.1 degrees away
tt.time('S', 1.1);
tt.distanceAt('S', 20);                 // degrees the S front has reached after 20 s, or null while it is underground
tt.surfaceDelay;                        // { P, S }: seconds until each wave reaches the surface above the source
```

The values are the iasp91 first arrivals from ObsPy TauP. See [ACCURACY.md](ACCURACY.md) for the error against TauP.

## A pin and an alert

```ts
import { TravelTimes, timingAt, blindRadiusKm, distanceDeg } from './rumbleback.js';

const epicenter = [23.8356, 121.5976];
const tt = new TravelTimes(40);
const pin = distanceDeg(epicenter, [24.15, 120.67]);
timingAt(tt, pin, 10);   // { distanceKm, pSec, sSec, gapSec, warningSec, blind }
blindRadiusKm(tt, 10);   // km around the epicenter where S arrives before an alert 10 s after the origin
```

## Geometry

`distanceDeg`, `distanceKm`, `bearingDeg`, `destination`, `ring` and `wrapLon` work on `[lat, lon]` pairs in degrees on a
sphere of radius 6371.0088 km. `ring(center, degrees, steps)` returns `[lon, lat]` points of a circle of constant arc
distance with longitudes unwrapped across the antimeridian.

## Loading USGS data

```ts
import { loadQuake, pickResiduals, summarize } from './rumbleback.js';

const quake = await loadQuake('us7000m9g4');                  // summary, picks, ShakeMap, instruments, felt reports
summarize(pickResiduals(quake, 95).P);                          // { n, median, medianAbs, p90Abs }
```

`loadQuake(id, onProgress?, fetch?, signal?)` fetches the summary first and each layer on its own. A layer that is
missing or fails leaves that part of the result empty. The parsers are exported on their own as `parseSummary`,
`parseProducts`, `parsePhaseData`, `parseGrid`, `parseStations` and `gridMmiAt`, and `searchQuakes` and `recentQuakes`
query the catalog. `encodeQuake` and `decodeQuake` convert a loaded event to and from the compact JSON the
featured shelf uses.

## Seismogram

`loadSeismogram(quake, picks)` fetches the vertical seismogram of a nearby usable station, broadband channels first, from the EarthScope
dataselect service as GeoCSV and condenses it. `parseGeoCsv` and `condense` are exported separately. The result is a
`Seismogram`: the station, its distance, and a min and max per time bin scaled to -1000 to 1000.

## Intensity helpers

`mmiColor(mmi, alpha?)`, `mmiRoman(mmi)` and `shaking(mmi)` follow the USGS ShakeMap scale.
