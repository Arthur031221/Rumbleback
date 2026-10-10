<h1 align="center">
  <img src="public/logo.svg" width="84" alt="Rumbleback logo: two rings spreading from a dot"><br>
  Rumbleback
</h1>

<p align="center"><strong>Replay any earthquake. See your seconds.</strong></p>

<p align="center">
  <a href="https://arthur031221.github.io/Rumbleback/"><img src="https://img.shields.io/badge/live_demo-open-ff7b42?style=for-the-badge&labelColor=0b1118" alt="Live demo"></a>
  <a href="https://github.com/Arthur031221/Rumbleback/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Arthur031221/Rumbleback/ci.yml?branch=main&style=for-the-badge&labelColor=0b1118&color=4cc3ff&label=CI" alt="CI"></a>
  <a href="https://github.com/Arthur031221/Rumbleback/releases/latest"><img src="https://img.shields.io/github/v/release/Arthur031221/Rumbleback?style=for-the-badge&labelColor=0b1118&color=4cc3ff" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Arthur031221/Rumbleback?style=for-the-badge&labelColor=0b1118&color=4cc3ff" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/languages-9-4cc3ff?style=for-the-badge&labelColor=0b1118" alt="9 languages">
</p>

<p align="center">
  <a href="#try-it">Try it</a> | <a href="#before-and-after">Before and after</a> | <a href="#features">Features</a> | <a href="#how-it-works">How it works</a> | <a href="#benchmarks">Benchmarks</a> | <a href="docs/INSTALL.md">Docs</a>
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-TW.md">zh-TW</a> | <a href="README.zh-CN.md">zh-CN</a> | <a href="README.ja.md">ja</a> | <a href="README.ko.md">ko</a> | <a href="README.es.md">es</a> | <a href="README.fr.md">fr</a> | <a href="README.de.md">de</a> | <a href="README.pt-BR.md">pt-BR</a>
</p>

> [!TIP]
> Open the [live page](https://arthur031221.github.io/Rumbleback/). It starts on the 2024 Hualien quake and plays by itself. Tap the map to drop a pin on your home. Press "Choose a quake" for a recent one, or paste the USGS link from a news story.

<p align="center">
  <img src="assets/demo.gif" alt="The 2024 Hualien M7.4 earthquake replayed: a blue P ring and an orange S ring spread across Taiwan, seismometers and strong motion stations light up as the waves reach them, a real seismogram runs under the timeline, then a pin on Taipei shows 20 seconds to the P wave and 36 to the S wave" width="100%">
</p>

**0.66 s median error against 3,933 real P picks from 14 earthquakes.**
<sub>Observed arrival minus the iasp91 first P arrival, stations up to 95 degrees away, picks that USGS used to locate each quake (M6.8 to M9.1). Reproduce with `npm run validate`. Details in [docs/ACCURACY.md](docs/ACCURACY.md).</sub>

## Why

When an earthquake makes the news you get a magnitude and a shaded map. I wanted the rest: what the waves did, and how many seconds I would have had at my place. Rumbleback replays a real earthquake, and you can check every claim on the screen.

- **Real data.** Every dot is a real instrument, pick or felt report from USGS. A real seismogram runs under the timeline, so the model's P and S arrival sits next to the signal the station recorded. The two rings come from a published Earth model that I check against ObsPy at 600 random points and against real picks on every quake.
- **Your place.** Pin your home and read the numbers for it: when the P wave got there, when the S wave got there, how strong it was, and how many seconds an alert issued at any moment would have given you.
- **No server.** It's a static page. No account, no analytics, and your pin never leaves the browser.

## Before and after

The same quake, the 2024 Hualien M7.4, seen from Taipei.

| What a news page gives you | What Rumbleback gives you |
|---|---|
| "M7.4, 15 km S of Hualien City, depth 40 km" | The same facts, plus how the P and S fronts crossed the island, second by second |
| A shaded intensity map | The ShakeMap revealed behind the S wave, with 354 strong motion instruments lighting up as it reaches them |
| Nothing about where you are | A pin on Taipei: P wave at 20 s, S wave at 36 s, shaking of intensity VI (MMI 5.9) |
| "Early warning exists" | A slider for the alert second: an alert at 10 s gives Taipei 26 s before the S wave |
| A model you have to trust | The model's P and S arrival drawn over a real seismogram, and a check card with 298 real P picks for this quake |

## Features

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/hero-dark.png">
    <img src="assets/hero-light.png" alt="Rumbleback at 24 seconds into the Hualien replay: the orange S ring inside the blue P ring over a ShakeMap of Taiwan, a pin on Taipei showing 20 s to the P wave and 36 s to the S wave, and the real seismogram of station TW.YULB under the timeline" width="100%">
  </picture>
</p>

- **Waves.** The first P and S wavefronts at the surface, depth aware, so a deep quake shows no ring until the wave comes up.
- **Seismometers.** A dot that flashes at the moment an analyst picked the P arrival at a real station (USGS phase data).
- **Seismogram.** The real vertical trace of a nearby station along the timeline, with the model's P and S arrival and the analyst's pick drawn over it (EarthScope archive).
- **ShakeMap, strong motion and felt reports.** The USGS intensity map, instruments coloured by the instrumental intensity USGS computed from their recording, and Did You Feel It groups.
- **Blind zone.** The area where the S wave beat an alert issued at the time you choose.
- **Your seconds.** P and S arrival at your pin, the gap between them, the ShakeMap intensity there and an alert slider. It's arithmetic on the model and doesn't reflect any real alert.
- **Sound.** An optional low thump for P, a rumble for S that grows with the intensity at your pin, and a soft chime at the alert second.
- **Share.** A link, a square card, a story card and a recorded video clip. On a phone a card opens the system share sheet. The link leaves your pin out unless you tick a box, and then keeps it after the `#`, which browsers never send to a server. Cards show a city name, never coordinates.
- **Any quake.** Fourteen featured events work with no call to USGS, and ten of them carry a seismogram. Recent and Search tabs read the live USGS catalog, a Link tab opens any USGS event page or id you paste, and a seismogram comes from EarthScope when one is available.
- **Your time zone.** The quake card gives the time in UTC and again in your own time zone.
- **Phones and keyboards.** On a phone the panel is a bottom sheet and the seismogram stays above the timeline. With a keyboard, Space plays and pauses, the arrows step the clock, and plus and minus zoom the map. The browser tests run axe over both themes, on a desktop and a phone screen, with each dialog open.
- **Nine languages.** English, Traditional and Simplified Chinese, Japanese, Korean, Spanish, French, German and Brazilian Portuguese, including the map labels.

## Try it

<details open>
<summary><strong>Run it locally</strong> (Node 22.18 or newer)</summary>

```sh
git clone https://github.com/Arthur031221/Rumbleback
cd Rumbleback
npm install && npm run build && npm run serve
```

Then open <http://127.0.0.1:4173/>.

</details>

<details>
<summary>Host your own copy</summary>

`npm run build` writes a plain static site to `dist/`. Put that folder on GitHub Pages, Netlify or any file host. All links are relative, so a sub-folder works. The Pages workflow in this repository does it for a fork once Pages is set to "GitHub Actions". See [docs/INSTALL.md](docs/INSTALL.md).

</details>

<details>
<summary>Use the travel-time library in Node or a browser</summary>

`npm run build` writes `dist/rumbleback.js`, one ES module with no DOM code. The live page serves the same file at `/rumbleback.js`, and tagged releases attach it.

```js
import { TravelTimes, timingAt } from './rumbleback.js';

const tt = new TravelTimes(40);        // source depth in km
console.log(timingAt(tt, 1.1, 10));    // 1.1 degrees away, alert 10 s after the origin
// { distanceKm: 122.3, pSec: 18.9, sSec: 33.4, gapSec: 14.5, warningSec: 23.4, blind: false } (rounded)
```

See [docs/API.md](docs/API.md).

</details>

<details>
<summary>Regenerate the Earth model table or the featured quakes</summary>

```sh
pip install obspy numpy && npm run tables   # travel-time table from ObsPy TauP, about two minutes
npm run events                              # featured quakes from the USGS and EarthScope APIs
```

</details>

## How it works

| | Real | Modelled |
|---|---|---|
| Where, when and how deep | USGS origin | |
| P arrivals at stations | Analyst picks, drawn at the picked time | |
| Wavefronts on the map | | iasp91 first arrivals (ObsPy TauP), interpolated for the quake's depth |
| Shaking at stations and in between | Instrument recordings, felt reports, the ShakeMap | The moment the S front reaches each of them |
| Seconds at your pin | | The same table, at your distance |
| One station's ground motion | EarthScope waveform, not corrected for the instrument | |

A small Python script asks ObsPy TauP for the first P and S arrival on a grid of 34 source depths and about 900 distances and stores a 166 KB table. The browser interpolates it and inverts it to get the front's radius at each moment. Fronts and dots are drawn on a canvas over MapLibre, so a frame costs a few hundred projected points. The browser parses the USGS and EarthScope data one layer at a time, so a layer that fails leaves the rest working. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) has the long version.

## Benchmarks

| What I measured | Result | Method |
|---|---|---|
| P arrival, model vs real picks | median 0.66 s, 90% within 1.75 s | 3,933 picks from 14 quakes, stations up to 95 degrees, `npm run validate` |
| Best and worst featured quake | 0.33 s (2024 Noto) and 1.80 s (1999 Chi-Chi) | Same run, median absolute error per quake |
| Table vs ObsPy TauP | median 0.01 s, 99th percentile 0.11 s (P) and 0.19 s (S) | 600 random depth and distance pairs that are not on the table grid |
| iasp91 vs ak135 (the model the USGS solutions name) | at most 0.15 s for the first P arrival | `python3 scripts/compare_models.py`, 0.5 to 95 degrees, depths 10 and 40 km |
| Lookup cost | about 160 million `TravelTimes.time()` calls per second | 30 million calls in a loop over `dist/rumbleback.js`, one core of my development machine, Node 24 |

The model reproduces the first P arrivals real instruments recorded, for quakes 8 to 48 km deep. That's all these numbers show. They don't show it can forecast a quake it hasn't seen, since USGS picks and origin times come from the same data, and they say nothing about deeper quakes. S waves have almost no picks in USGS data, so the S ring is the model alone. The page says so on every quake.

## Common commands

| Command | What it does |
|---|---|
| `npm run build` | Build the site into `dist/` and the library into `dist/rumbleback.js` |
| `npm run serve` | Serve `dist/` on <http://127.0.0.1:4173/> |
| `npm test` | Unit tests: table vs ObsPy, geometry, parsers on real USGS excerpts, languages |
| `npm run test:e2e` | Drive the built site in Chromium with the network replaced by fixtures |
| `npm run typecheck` | TypeScript, no emit |
| `npm run validate` | Print the model vs picks table for the featured quakes |
| `npm run events` | Re-download the featured quakes from USGS and EarthScope |

## Docs

[Install](docs/INSTALL.md) | [Usage](docs/USAGE.md) | [Configuration](docs/CONFIG.md) | [Architecture](docs/ARCHITECTURE.md) | [Accuracy](docs/ACCURACY.md) | [Privacy](docs/PRIVACY.md) | [Library API](docs/API.md) | [Contributing](CONTRIBUTING.md)

## Credits

Earthquake data, phase picks, ShakeMap and Did You Feel It come from the [USGS Earthquake Hazards Program](https://earthquake.usgs.gov). Seismograms come from the [EarthScope](https://www.earthscope.org) data services. Travel times come from the iasp91 model (Kennett and Engdahl, 1991) through [ObsPy TauP](https://docs.obspy.org/packages/obspy.taup.html). Map tiles are from [OpenFreeMap](https://openfreemap.org) with data from OpenStreetMap contributors, drawn by [MapLibre GL JS](https://maplibre.org). Coastlines and city names are from [Natural Earth](https://www.naturalearthdata.com). Full list in [THIRD_PARTY.md](THIRD_PARTY.md).

## License

[MIT](LICENSE)
