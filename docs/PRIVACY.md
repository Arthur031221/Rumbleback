# Privacy

Rumbleback has no server of its own, no account, no analytics and no cookies.

## What stays on your device

- Your pin, your language and your theme choice, in the browser's local storage.
- Everything you type in the city search. The city list is a file the page downloads once, and the search runs
  in your browser.
- The position from "Use my location". The browser asks first, and the position is used on the page only.

## What leaves your device

Opening the page makes requests to these hosts, and your browser sends its normal request headers
(IP address, user agent) to each of them:

| Host | When | What is requested |
|---|---|---|
| GitHub Pages (`arthur031221.github.io`, or the host serving your copy) | Always | The page and its scripts, fonts and styles, the coastline and city files, the featured quake list and the featured quake you open |
| `tiles.openfreemap.org` | Always, and again as you pan and zoom | The style, map tiles and fonts. Tile coordinates tell the tile server which area of the map is on screen |
| `earthquake.usgs.gov` | Only for quakes that are not featured, and for the Recent and Search tabs | The catalog query or the event id, then the event's phase picks, ShakeMap and station list. The product addresses come from the USGS answer |
| `service.earthscope.org` | Only for quakes that are not featured | A few minutes of one station's vertical seismogram, up to eight tries. The station is chosen from the earthquake, not from your pin |

Your pin is never part of any request. The map does not move to it either, because tiles around your home
would tell the tile server where it is. If you pan or zoom to your home yourself, the tiles for that area are
requested like any other.

Three more things can reach a network. The attribution links and the GitHub link open other sites only when you
click them. "Use my location" asks the browser, which may ask its own location service. Saving a card or a clip
and copying a link stay on your device.

The end-to-end tests check the first claim: they record every request the page makes and every request the host
receives while a pin is set, moved by location, reloaded and opened from a shared link, and look for the coordinates.

## Sharing

A shared link contains the event, the moment and your language. It contains your pin only if you tick the box in the share
dialog, and then rounded to two decimals (about a kilometre) and placed after the `#`, which browsers keep to themselves.
Whoever you send that link to can read the pin in it. Cards and clips show a city name when the pin is
within 40 km of one, or the words "My place", never coordinates. A clip or card you save is a file on your device.

## Running your own copy

The same requests apply to a copy of the site. To avoid third-party tile requests, replace `TILES` and
`GLYPHS` in `src/app/style.ts` with a tile server you run. The coastline layer will still show without tiles.
