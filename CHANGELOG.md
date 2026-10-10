# Changelog

## 0.4.1

Released 2026-10-10.

New

- The search can look in sixteen more countries (Iceland, Tonga, the Solomon Islands, Costa Rica, El Salvador,
  Nicaragua, Panama, Puerto Rico, the Dominican Republic, South Korea, Algeria, Albania, Romania, Tajikistan,
  Kyrgyzstan and Argentina) and in two areas that are not countries: Hawaii, and Kamchatka with the Kurils. The
  names follow the language of the page.
- The README opens with one plain sentence on what the page does, in all nine languages.

Fixed

- A shared link's pin and language beat what the browser had saved, and they came back on every reload. Someone who
  opened a friend's link, moved the pin to their own home and reloaded found the friend's pin again, and a removed pin
  came back too. The address now drops the link's pin and language once the viewer chooses their own.
- On a Safari before 17.4 (and a Chrome before 116) every request to USGS and EarthScope failed before it was sent,
  because `AbortSignal.any` is missing there, so a quake that is not on the featured shelf, the Recent, Search and
  Link tabs and the seismogram did not load. `AbortSignal.timeout`, missing before Safari 16.4, has the same fallback.
- On a phone the prompt to drop a pin was cut off at the bottom of the sheet for anyone whose time zone is not UTC,
  and on a 640 pixel high screen in every zone, because the quake card spent four lines on its facts. They run on as a
  row that wraps, and the cards take a little less padding on a screen of 700 pixels or fewer, so the prompt shows at
  390 by 664, 375 by 667 and 360 by 640 in all nine languages.
- Opening the check card scrolled it into view with an animation even when the viewer had asked for less motion.
- The dots for strong motion stations and felt reports built a colour string for every dot on every frame, about 0.4
  milliseconds a frame for 5,000 dots on a desktop processor and more on a phone. Each dot's colour is made once per quake.

## 0.4.0

Released 2026-10-10.

New

- A key in the quake card names the colours of the ShakeMap, the strong motion dots and the felt reports, from
  intensity I (white) to X (dark red). It shows while one of those layers is on and the quake has data for it.
- The pin card has a "Watch the waves reach this place" button. It moves the clock to five seconds before the P wave
  reaches your pin and plays, so a pin dropped after the waves have passed is not a dead end. The seconds it skips
  are not read out to a screen reader as if the replay had reached them.
- The "Checked against real data" card lists up to ten stations spread from the nearest to the farthest, with the
  analyst's P pick, the model's arrival and the difference. It is plain text, so a keyboard, a touch screen and a
  screen reader reach the picks that the hover card shows only to a mouse. In a narrow panel it scrolls sideways.
- The README opens with four links that each load one quake with a pin already on a city: Tokyo for Tohoku 2011,
  Bangkok for Mandalay 2025, Santiago for Maule 2010 and Taipei for Hualien 2024. A test checks the seconds beside
  each link against the library, in all nine READMEs.

Fixed

- A pin outside the area the ShakeMap covers said "No ShakeMap for this quake", although the map showed one. It now
  says the ShakeMap has no estimate for that place, and keeps the old message for a quake that has no ShakeMap.
- In a window between 820 and 1240 pixels wide (an iPad Air or Pro held upright, a small laptop window) the timeline
  beside the panel had no room for its slider, which shrank to 0 pixels at 834 wide. The timeline takes the whole
  width there now, which the panel leaves free.
- In the share dialog on a phone 390 pixels wide, "Save square card" and "Record a video clip" ran past the edge of
  the dialog, and the longer languages did worse. The labels wrap now, at 320 pixels as well, in all nine languages.

## 0.3.2

Released 2026-10-10.

Fixed

- Sideways, the six layer chips were two or three rows that covered a third of the map. They are one row that scrolls.
- The map's opening view and the P and S letters on the wavefronts followed fixed numbers, so a notch or a home
  indicator put the epicenter or a letter behind the chips, the sheet or the timeline. They follow where those really
  are now, and the letters keep out of the strip of map they cover.
- Sideways, the ring and name of the station behind the seismogram were still drawn, with no strip for them to point at.
- A window shaped exactly between the upright phone layout and the sideways one could match both or neither. Each
  window shape now gets exactly one, and a test checks the windows on both sides of the edge.
- The clip asks for MP4 without a codec level. A low level pinned in the request is too small for a 720p frame.
- The usage guide said the pin card gives the same facts as the hover cards on dots. It does not: station picks,
  instrument readings and felt counts are for a mouse only, and the guide says so.
- The announcements and the hover cards read better in Traditional and Simplified Chinese, Korean, French, Spanish and
  Brazilian Portuguese: the pick sentence names the arrival time, a shaking level no longer clashes in gender, and the
  felt reports are named the way USGS names them.
- The zoom key test pressed minus while the map was still zooming in, and failed on a slow machine.

## 0.3.1

Released 2026-10-10.

Fixed

- The sideways layout needs a screen that is both short and wide. On a browser that shrinks a phone held upright
  when the keyboard opens (390 by 330 pixels, say), typing a city name no longer switches the page to it.
- The browser test for reduced motion looked for the map's flight too briefly on a slow machine, and the one for a
  closed picker depended on a lookup that finished too fast. Both wait longer now.

## 0.3.0

Released 2026-10-10.

New

- Rest a mouse on a dot that has lit up and a card says what it is. A seismometer gives its distance and the time the
  analyst picked next to the time the model gives. A strong motion instrument gives its network, intensity, peak
  acceleration and peak velocity. A felt report gives the number of responses and their intensity. A finger does not
  open it, because a tap drops the pin.
- A screen reader is told when the P wave, the S wave and the alert reach your pin, with the seconds that are left. Nothing
  is read out while you scrub or jump to another moment.
- The video clip is saved as MP4 where the browser can record it, so it plays on an iPhone, in WhatsApp and in social
  apps. A browser that records only WebM still gets WebM.
- A phone held sideways keeps the map. The panel stays at the side, the timeline is one row without the seismogram strip
  and the share dialog drops its preview, where before the panel and a tall timeline covered nearly the whole screen.
- A link to a quake USGS does not have says so and offers no retry. A quake that fails to load no longer says
  "Loading real station data" and no longer shows an empty magnitude box.

Fixed

- On a phone the numbers of a new pin sat below the part of the sheet you could see. A new pin now scrolls the sheet to
  them, and removing the pin scrolls it back to the quake.
- The controls ignored the notch and the home indicator of an iPhone, which the page extends under. The top bar, the
  panel, the layer chips and the timeline now keep clear of them, whichever way the phone is held.
- Safari 17 and older drew no blur behind the panels, because it knows only the prefixed property.

Tests

- New browser tests for the hover cards, the screen reader messages, the phone sheet, the safe areas and the failed
  load, a check that a recorded MP4 starts with a valid header, and unit tests for the clip format and for telling a
  missing quake from an unreachable USGS.

## 0.2.1

Released 2026-10-10.

Fixed

- Pasting the address of a quake with a long id was refused, as it was for the 2011 Tohoku and 2010 Chile quakes on
  the featured shelf. A test now pastes every featured quake back as an id, an event page address and a Rumbleback link.
- Once the timeline had the focus, Space did nothing and the arrow keys stepped a tenth of a second instead of a second.
  They act on the replay now, and the language menu gives the focus back after a choice.
- The city list stayed open when the field lost the focus, which on a phone hid the location button and the city
  chips, and an old search came back after the pin was removed. The list closes with the focus and a pin ends the search.
- The "no match" row was not an option of the list. The accessibility scan now covers the list with matches and without.
- The browser's own bar stayed dark in the light theme. It follows the theme in use, the system's or the one chosen
  in the page.
- A copy of the site named the upstream address as its canonical link. `SITE_URL` sets the address when you build, the
  Pages workflow passes it, and without it the canonical link and `og:url` are left out.

Tests

- New browser tests for the plus and minus keys, the reduced motion setting, the timeline keys and the city list.

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
