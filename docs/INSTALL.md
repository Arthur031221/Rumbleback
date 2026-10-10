# Install

Rumbleback is a static site. There is nothing to install to use it: open the
[live page](https://arthur031221.github.io/Rumbleback/). The rest of this page is for running your own copy.

## Run it from source

You need Node 22.18 or newer.

```sh
git clone https://github.com/Arthur031221/Rumbleback
cd Rumbleback
npm install
npm run build
npm run serve
```

Open <http://127.0.0.1:4173/>. `npm run build` writes the whole site to `dist/`. Any static host can
serve that folder as it is: GitHub Pages, Netlify, an S3 bucket, `python3 -m http.server -d dist`. Set `SITE_URL` when you
build for a public address.
All links inside the site are relative, so it also works from a sub-folder such as `/Rumbleback/`.

## Host it on GitHub Pages

Fork the repository, then in the fork open Settings, Pages, and choose "GitHub Actions" as the source.
The `Publish demo page` workflow runs after the CI workflow passes on `main` and deploys `dist/`, with `SITE_URL` set to
your Pages address (see [CONFIG.md](CONFIG.md#the-address-of-your-copy)).

## Use the library alone

`dist/rumbleback.js` is one ES module with no DOM code. It runs in Node 22 or newer and in browsers.
The live page serves it at `/rumbleback.js`, and each tagged release attaches it. TypeScript declarations are in `dist/types`. See [API.md](API.md).

```js
import { TravelTimes, timingAt } from './rumbleback.js';

const tt = new TravelTimes(40); // source depth in km
console.log(timingAt(tt, 1.1, 10)); // 1.1 degrees away, alert 10 s after the origin
```

## Regenerate the data

Only needed if you change the Earth model, the featured quakes or the map data.

| Command | What it rebuilds | Needs |
|---|---|---|
| `npm run tables` | `src/data/traveltime.json` and `test/fixtures/taup-reference.json` | Python 3, `pip install obspy numpy`, about two minutes |
| `npm run events` | `public/events/*.json` from the USGS API | network |
| `npm run data` | `public/data/land-50m.json` and `cities.json` | network for the city file |

Running `npm run tables` reproduces the committed table exactly when ObsPy is version 1.5.1.

## Requirements for the browser

A browser with WebGL 2: any current Chrome, Edge, Firefox or Safari. Requests to USGS and EarthScope also work on
a Safari before 17.4 and a Chrome before 116, which lack `AbortSignal.any`. The replay needs `canvas`, and the
video clip needs `MediaRecorder` (Chrome, Edge, Firefox and recent Safari) and is saved as MP4 where the
browser can record it and as WebM otherwise. Without `MediaRecorder` the clip button says so and everything
else works.
