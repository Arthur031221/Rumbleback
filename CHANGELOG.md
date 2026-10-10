# Changelog

## 0.2.0

Released 2026-10-10.

New

- The quake picker has a Link tab. Paste the address of a USGS event page, a catalog query or an event id such as
  `us7000m9g4`, and it opens that quake once USGS confirms it exists.
- The Recent tab takes a minimum magnitude (4.5, 5, 6 or 7), lists up to 60 quakes of the last 30 days, and says
  how far back it reaches.
- Search has eleven more regions, and the list is sorted by name in your language.
- Back and Forward move between the quakes you opened, and Back to a shared link returns to its moment.
- The seismogram strip is on phones too, and its caption has its own row, so the P and S letters never sit on it.
- Cards open the system share sheet on a phone.
- The quake card gives the time in your own time zone as well as in UTC.
- A placeholder and the right theme show while the script downloads. First content appears at about 0.5 s instead of
  3 s on a simulated slow 4G connection.
- A web manifest, app icons and full link preview tags.
- The library exports `eventIdFrom`, `HttpError`, `RECENT_LIMIT` and `RECENT_DAYS`, and `recentQuakes` takes a minimum
  magnitude. Releases attach the type declarations as a zip.

Fixed

- A double click or double tap that zoomed the map also moved the pin. A click now waits a moment, and a second
  click on the same spot, a double click or a zoom cancels it. A click still waiting no longer brings back a pin that
  was removed.
- The arrow keys did nothing after a button had focus, and panned the map after a click on it. They step the clock
  every time now, and plus and minus zoom the map.
- The map credit was hidden on phones. It is a small (i) button there that opens the text.
- A search whose start date was after the end date said that USGS could not be reached.
- The city list was cut off by the card below it. It is now a combobox with up and down keys, a row for no match
  and an announcement for screen readers.
- The picker tabs follow the arrow keys, and all four fit a phone in every language.
- Closing the picker while a link was being looked up could still open the quake.
- The orange text in the light theme was below the contrast minimum. The browser tests now run axe over both themes
  on a desktop and a phone screen, with every dialog open.
- A reduced motion setting now also stops the map from flying to a newly chosen quake.

## 0.1.0

Released 2026-10-10.

First public version.

- Replays a real earthquake as P and S wavefronts on a map. The travel times are the iasp91 first arrivals
  from ObsPy TauP, interpolated for the quake's depth.
- Real data from USGS: analyst P picks lighting up at their observed time, ShakeMap intensity,
  strong motion instruments with their measured intensity, and Did You Feel It reports.
- A strip above the timeline draws the real seismogram of a nearby station from EarthScope, with the model's P and S arrival and the analyst's pick over it.
- A pin on your home gives the P and S arrival, the gap between them and the ShakeMap intensity there,
  and an alert slider that shows the warning time or the blind zone.
- A check card that compares the model with the picks USGS used, for every quake.
- Fourteen featured earthquakes that work without a network call to USGS, plus recent and searchable
  quakes from the USGS catalog.
- Share links, square and story cards and a recorded video clip, none of which include coordinates by default.
- Nine languages: English, Traditional Chinese, Simplified Chinese, Japanese, Korean, Spanish, French,
  German and Brazilian Portuguese.
- The travel-time and parsing code is a small library, built as `dist/rumbleback.js`.
