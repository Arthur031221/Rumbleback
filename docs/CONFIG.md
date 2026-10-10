# Configuration

Rumbleback has no config file. What can be set lives in the address, in the browser's local storage and
in a few constants in the source.

## Address parameters

See the table in [USAGE.md](USAGE.md#deep-links).

## What the browser remembers

All keys start with `rumbleback.` and stay on your device.

| Key | Value |
|---|---|
| `rumbleback.lang` | The language code you picked |
| `rumbleback.theme` | `dark` or `light`. Not set means "follow the system" |
| `rumbleback.pin` | Your pin as JSON: latitude, longitude and, for a pin set by city name, the city's index |

Clear them from the browser's site data, or remove the pin with the cross on the pin card.

## Constants worth knowing

| Where | What | Default |
|---|---|---|
| `src/core/replay.ts` `BAND_SECONDS` in `src/app/overlay.ts` | Width of the soft band behind each front | P 2.2 s, S 3.4 s |
| `src/core/replay.ts` `SPEEDS` | Playback speeds on the timeline | 1, 2, 5, 10, 20, 50 |
| `src/core/replay.ts` `openingBounds` | Where the map opens: the area with ShakeMap intensity 4.5 or more, at least two degrees wide | 4.5 |
| `src/app/state.ts` `alertSec` | Alert time the slider starts at | 10 s |
| `src/core/link.ts` `MAX_ALERT` | Longest alert delay the slider and a link accept | 60 s |
| `src/data/featured.ts` | The featured shelf | 14 quakes |
| `scripts/build_tables.py` `DEPTHS`, `DISTANCES` | Grid of the travel-time table | 34 depths, 913 distances |

## Map tiles

`src/app/style.ts` builds the style. Tiles and glyphs come from OpenFreeMap (`TILES` and `GLYPHS`).
To use another OpenMapTiles-compatible source, change those two constants and `ATTRIBUTION`.
The coastline layer is bundled and does not depend on them.

## Adding a featured quake

1. Add its USGS id to `src/data/featured.ts`.
2. Add a `featured.<id>` label to every file in `src/app/locales`.
3. Run `npm run events <id>`, then `npm run events` once to refresh `public/events/index.json`.
4. Run `npm test`.
