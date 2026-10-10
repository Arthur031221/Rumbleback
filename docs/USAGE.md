# Using Rumbleback

## The screen

- **Map.** Coastlines, borders and place names in your language. Drag and zoom as usual.
- **Left panel.** The quake, your pin, and a card that checks the model against real picks.
- **Chips over the map.** Turn layers on and off.
- **Timeline at the bottom.** Play, scrub, and change the playback speed.

## Replay a quake

1. Press "Choose a quake". The *Featured* tab has fourteen well known events and works without
   calling USGS. *Recent* lists the newest quakes of the last 30 days, at most 60, and a menu raises the minimum
   magnitude (4.5, 5, 6 or 7) to reach further back. *Search* takes a minimum magnitude, a region (sorted by name in your language) and a date
   range. *Link* takes the address of a USGS event page (news stories often link to one) or an event id such as
   `us7000m9g4`, and opens that quake once USGS confirms it exists.
2. The replay starts by itself, at a speed chosen so the whole thing takes about half a minute.
   Space plays and pauses. Left and right step one second, with Shift ten seconds. Plus and minus zoom the map.
3. Drag the timeline to any moment. `T+12.4 s` is seconds since the earthquake began.

## What you are looking at

| On the map | Meaning | Real or modelled |
|---|---|---|
| Blue ring, letter P | Where the first P wave has reached the surface | Modelled (iasp91) |
| Orange ring, letter S | Where the first S wave has reached the surface | Modelled (iasp91) |
| Small blue dots that flash | Seismometers whose operator picked a P arrival, at the picked time | Real (USGS phase data) |
| Coloured dots with a white edge | Strong motion instruments, coloured by the instrumental intensity USGS computed from their recording, appearing when the S wave reaches them | Recorded value, modelled timing |
| Tiny coloured dots | Did You Feel It reports, one colour per intensity | Reported value, modelled timing |
| Green to red wash inside the S ring | The USGS ShakeMap, revealed behind the S wave | Estimated by USGS |
| Ring with a station name | The station whose seismogram is in the strip above the timeline | Real (EarthScope) |
| Dashed ring | The blind zone for the alert time you chose | Modelled |

The first P and S fronts are drawn at the surface. Because the waves start underground, a deep quake shows
no ring for the first seconds: the wave has not reached the surface yet.

Rest a mouse on a dot that has lit up and a small card says what it is. For a seismometer it names the station and
gives its distance, the time the analyst picked and the time the model gives, to a tenth of a second. For a strong motion
instrument it gives the network, the intensity, the peak acceleration and the peak velocity USGS has for it. For a
felt report it gives the number of responses and their intensity. A dot that has not lit yet, or whose layer is
off, shows no card. A finger does not open it, because a tap on the map drops the pin.

## The seismogram strip

When a station near the quake has data in the EarthScope archive, a strip above the timeline draws its vertical
ground motion. The trace fills in as the replay reaches it. Dashed lines mark the model's P and S arrival at that
station, and the triangle marks the P arrival an analyst picked. The model line and the analyst's triangle usually
fall within a second or two of each other, with the first motion of the real trace coming in close to both.
The size is relative and not corrected for the instrument, so read it for
timing and shape, not for how many centimetres per second. It is a little shorter on a phone, hidden for quakes with no usable station,
and hidden on a short screen such as a phone held sideways.

## Your seconds

Tap the map, search a city, or use your location. The pin card shows:

- **P wave and S wave:** seconds after the quake began until each arrives where you are.
- **S minus P:** the time between the two arrivals where you are. An early warning can reach you before P if the quake is detected near its source, which is what the slider below shows.
- **Shaking here:** the ShakeMap intensity at the pin, with the USGS word for it.
- **If an alert went out:** move the slider to the number of seconds after the quake began at which a
  warning could have been issued. The card then shows how long before the S wave you would have heard it,
  or says you were inside the blind zone. This is arithmetic on the model, not a record of any real alert.

On a phone the panel is a sheet, and a new pin scrolls it to these numbers. Removing the pin scrolls it back to the quake.
Held sideways, the panel stays at the left as on a desktop, the timeline shrinks to one row and the map keeps the rest
of the screen.

Drag the pin to move it. The pin is kept in your browser only. A click on the map drops the pin after a short wait
(0.3 s with a mouse, 0.4 s on a touch screen), so that a double click can zoom without moving it. A double click slower
than that wait moves the pin.

## Keyboard and screen readers

Space plays and pauses, the arrow keys step the clock, and plus and minus zoom the map, wherever the focus is. A
screen reader is told when the replay reaches your pin: one polite message when the P wave arrives (with the
seconds until the S wave), one when the S wave arrives (with the shaking there) and one at the alert time (with
the seconds it would have given you). Nothing is read out while you scrub or jump to another moment. The hover card
for dots is for a mouse, and the numbers on the pin card give the same facts as text.

## Share

*Share this replay* offers a link, a square card, a story card (9:16) and a video clip of the replay.
The link leaves your pin out unless you tick the box, and then rounds it to about a kilometre. Cards show a
city name or "My place", never coordinates. Cards show the moment the timeline is on, so scrub to the
frame you like first. On a phone a card opens the system share sheet, and anywhere else it downloads as a PNG.

The clip is a plain video file you can post anywhere. It is saved as MP4 when the browser can record that, which
is what an iPhone, WhatsApp and most social apps accept, and as WebM in a browser that records only that, such as
Firefox. The file name tells you which one you got.

## Deep links

`?event=us7000m9g4&t=20&alert=10&lang=ja#pin=25.03,121.56`

| Parameter | Meaning |
|---|---|
| `event` | A USGS event id, for example `us7000m9g4` |
| `#pin` | Latitude and longitude of the pin. It sits in the part after `#`, which a browser never sends to a server |
| `t` | Clock in seconds after the origin. When present the replay opens paused |
| `alert` | Alert issue time in seconds after the origin, 0 to 60 |
| `lang` | `en`, `zh-TW`, `zh-CN`, `ja`, `ko`, `es`, `fr`, `de` or `pt-BR` |

A link to an id USGS does not have says "USGS has no earthquake with that id" and offers no retry. When USGS cannot
be reached, the quake card says so and has a "Try again" button.
