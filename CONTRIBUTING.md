# Contributing to Rumbleback

Thanks for looking. Bug reports, wrong numbers, new languages and small fixes are all welcome.

## Set up

You need Node 22.18 or newer. Python and ObsPy are only needed if you regenerate the travel-time tables.

```sh
git clone https://github.com/Arthur031221/Rumbleback
cd Rumbleback
npm install
npm run build
npm run serve        # http://127.0.0.1:4173/
```

## Checks to run before a pull request

```sh
npm run typecheck    # TypeScript, no emit
npm run format       # Prettier, then npm run format:check passes
npm test             # unit tests, about two seconds
npx playwright install chromium
npm run test:e2e     # drives the built site in Chromium
```

The unit tests import the TypeScript sources directly through Node's type stripping, so there is no
compile step to forget. The end-to-end tests run against `dist/`, so run `npm run build` first.

## Where things live

- `src/core` is the library: travel times, geometry, USGS parsers. It has no DOM code and no
  framework. Anything that changes a number belongs here, with a test.
- `src/app` is the page: map, overlay canvas, panels, dialogs, language files in `src/app/locales`.
- `scripts` builds the site and the data. `scripts/build_tables.py` is the only Python and the only
  place ObsPy is used.
- `public/events` holds the featured earthquakes as downloaded from USGS by `npm run events`.
- `docs` explains the model, the data and the privacy choices.

## A number that looks wrong

Open an issue with the event id (for example `us7000m9g4`), the place you pinned and what you expected.
If you can say where the expectation comes from, such as a seismogram or an official bulletin, include it.
The check card on the page and `npm run validate` show how the model compares with the picks USGS used.

## Adding or fixing a language

Each language is one file in `src/app/locales`, with the same keys as `en.json`. `npm test` fails if a
key is missing, empty, or has different `{placeholders}`. Please write the text the way a native speaker
would say it, not word for word. To add a language, also add it to `LOCALES` in `src/app/i18n.ts`, to
`NAME_FIELD` in `src/app/style.ts` for the map labels, and to the order in `scripts/make-data.mjs` if
Natural Earth has city names for it.

## Style

- TypeScript with `strict`, formatted by Prettier (`npm run format`). Only syntax that Node can strip, so no enums and no parameter properties.
- Comments say why, not what. A function name and a type already say what.
- No new runtime dependency without a clear reason. The site ships MapLibre, a small XML parser and nothing else.
- Keep the page working with no network for the map: the coastlines are bundled on purpose.

## Commits

Short imperative subject lines that say what changed and why it matters. One logical change per commit.
