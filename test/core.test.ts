import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodeQuake } from '../src/core/codec.ts';
import { citiesNear, parseCities, searchCities, type CityFile } from '../src/core/cities.ts';
import { mmiColor, mmiRoman, shaking } from '../src/core/intensity.ts';
import { buildLink, eventIdFrom, parseLink } from '../src/core/link.ts';
import { REGIONS } from '../src/core/regions.ts';
import { defaultSpeed, feltRadiusKm, openingBounds, replayLength } from '../src/core/replay.ts';
import { TravelTimes } from '../src/core/traveltime.ts';

const load = (id: string) => decodeQuake(readFileSync(new URL(`../public/events/${id}.json`, import.meta.url), 'utf8'));

test('intensity labels and colours', () => {
  assert.equal(mmiRoman(6.6), 'VII');
  assert.equal(mmiRoman(0.2), 'I');
  assert.equal(shaking(2), 'weak');
  assert.equal(shaking(7.2), 'veryStrong');
  assert.equal(shaking(9.4), 'violent');
  assert.equal(shaking(11), 'extreme');
  assert.equal(mmiColor(6), 'rgba(255,255,0,1)');
  assert.equal(mmiColor(6.5, 0.5), 'rgba(255,228,0,0.5)');
});

test('links round trip and reject junk', () => {
  const url = buildLink('https://x.test/', { event: 'us7000m9g4', pin: [25.03312, 121.56481], t: 20.04, alert: 10.2, lang: 'ja' });
  assert.equal(url, 'https://x.test/?event=us7000m9g4&t=20&alert=10&lang=ja#pin=25.03,121.56');
  const parsed = new URL(url);
  assert.deepEqual(parseLink(parsed.search, parsed.hash), { event: 'us7000m9g4', pin: [25.03, 121.56], t: 20, alert: 10, lang: 'ja' });
  assert.deepEqual(parseLink('?event=<script>&pin=95,10&t=abc&alert=-4'), { alert: 0 });
  assert.equal(parseLink('?alert=500').alert, 60);
  assert.equal(buildLink('https://x.test/', {}), 'https://x.test/');
});

test('the pin is in the fragment, so the server that hosts the page never sees it', () => {
  const url = buildLink('https://x.test/', { event: 'us7000m9g4', pin: [25.03, 121.56], alert: 10 });
  assert.ok(!new URL(url).search.includes('25.03') && new URL(url).hash === '#pin=25.03,121.56');
  assert.deepEqual(parseLink('', '#pin=25.03,121.56').pin, [25.03, 121.56]);
  // Links made by earlier versions carried the pin in the query.
  assert.deepEqual(parseLink('?pin=25.03,121.56').pin, [25.03, 121.56]);
});

test('the opening view of the Hualien quake covers the island, and the replay is long enough to cross it', () => {
  const data = load('us7000m9g4');
  const b = openingBounds(data);
  assert.ok(b.west < 121 && b.east > 122.2 && b.south < 23.5 && b.north > 24.2, JSON.stringify(b));
  assert.ok(b.east - b.west < 20);
  const tt = new TravelTimes(data.quake.depthKm);
  const len = replayLength(tt, data, b);
  assert.ok(len > 40 && len < 400, `length ${len}`);
  const far = replayLength(tt, data, b, { lat: -33.9, lon: 151.2 });
  assert.ok(far > len);
  assert.ok(len / defaultSpeed(len) <= 32 || defaultSpeed(len) === 50);
});

test('without a ShakeMap the view comes from the magnitude', () => {
  const data = load('us7000m9g4');
  const b = openingBounds({ ...data, grid: null });
  assert.ok(b.north - b.south > 2 * (feltRadiusKm(7.4) / 111) - 0.1);
  assert.ok(feltRadiusKm(5) < feltRadiusKm(7) && feltRadiusKm(9.5) <= 2500);
});

const file: CityFile = {
  order: ['en', 'zh-TW', 'zh-CN', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR'],
  cities: [
    [25.04, 121.56, 7000000, 'Taipei', '臺北市', '台北', '台北市', '타이베이시', 'Taipéi', 'Taipei', 'Taipeh', 'Taipé'],
    [24.15, 120.67, 2800000, 'Taichung', '臺中市', '台中', '台中市', '', 'Taichung', 'Taichung', 'Taichung', 'Taichung'],
    [35.68, 139.69, 35000000, 'Tokyo', '東京', '东京', '東京', '도쿄', 'Tokio', 'Tokyo', 'Tokio', 'Tóquio'],
  ],
};

test('city search matches any language and ignores accents', () => {
  const { list } = parseCities(file);
  assert.deepEqual(
    searchCities(list, 'tai').map((c) => c.names[0]),
    ['Taipei', 'Taichung'],
  );
  assert.deepEqual(
    searchCities(list, '東京').map((c) => c.names[0]),
    ['Tokyo'],
  );
  assert.deepEqual(
    searchCities(list, 'taipei').map((c) => c.names[0]),
    ['Taipei'],
  );
  assert.deepEqual(
    searchCities(list, 'peí').map((c) => c.names[0]),
    ['Taipei'],
  );
  assert.deepEqual(searchCities(list, ''), []);
  assert.deepEqual(
    citiesNear(list, 23.9, 121.6, 200).map((c) => c.names[0]),
    ['Taipei', 'Taichung'],
  );
  assert.deepEqual(
    citiesNear(list, 23.9, 121.6, 200, 1).map((c) => c.names[0]),
    ['Taipei'],
  );
  assert.deepEqual(citiesNear(list, 23.9, 121.6, 50), []);
});

test('the opening view stays in one piece across the antimeridian and away from the poles', () => {
  const base = load('us6000qw60');
  const grid = { west: 170, south: 40, dx: 1, dy: 1, cols: 21, rows: 21, mmi: new Uint8Array(21 * 21).fill(60) };
  const across = openingBounds({ ...base, quake: { ...base.quake, lat: 50, lon: -179 }, grid });
  assert.ok(across.east - across.west < 25 && across.west >= 168 && across.east <= 192, JSON.stringify(across));
  for (const lat of [89, -89, 84.5, -84.5, 84, -84]) {
    const b = openingBounds({ ...base, quake: { ...base.quake, lat }, grid: null });
    assert.ok(b.south < b.north && b.north <= 85 && b.south >= -85 && b.north - b.south >= 1.9, `${lat} ${JSON.stringify(b)}`);
    // Web Mercator stops at 85 degrees, so only an epicenter inside that can be in view.
    if (Math.abs(lat) <= 85) assert.ok(b.south <= lat && lat <= b.north, `the epicenter stays in view at ${lat}: ${JSON.stringify(b)}`);
  }
});

test('the replay lasts until the S wave reaches the seismogram station', () => {
  const data = load('us7000kufc');
  const tt = new TravelTimes(data.quake.depthKm);
  const view = openingBounds(data);
  const without = replayLength(tt, { ...data, seismogram: null }, view);
  const withStation = replayLength(tt, data, view);
  assert.ok(data.seismogram && withStation >= Math.ceil(tt.time('S', data.seismogram.dist) + 20), `${without} ${withStation}`);
  assert.ok(withStation > without);
});

test('an event id is found in an id, a USGS event page, a catalog query or a Rumbleback link', () => {
  const id = 'us7000m9g4';
  for (const text of [
    id,
    `  ${id.toUpperCase()}\n`,
    `https://earthquake.usgs.gov/earthquakes/eventpage/${id}/executive`,
    `earthquake.usgs.gov/earthquakes/eventpage/${id}`,
    `https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=${id}&format=geojson`,
    `https://arthur031221.github.io/Rumbleback/?event=${id}&t=20#pin=25.03,121.56`,
  ])
    assert.equal(eventIdFrom(text), id, text);
  assert.equal(eventIdFrom('ci40123456'), 'ci40123456');
  assert.equal(eventIdFrom('https://earthquake.usgs.gov/earthquakes/eventpage/nc73999999'), 'nc73999999');
});

test('text that is not an event id is refused', () => {
  for (const text of [
    '',
    '   ',
    'hello world',
    'us70',
    'https://example.com/',
    'https://earthquake.usgs.gov/earthquakes/map/',
    '<script>',
    'us7000m9g4 and more',
  ])
    assert.equal(eventIdFrom(text), null, JSON.stringify(text));
});

test('every search region is a real rectangle with a unique id, and its name is a country code or a locale key', () => {
  assert.equal(REGIONS[0]!.id, 'world');
  assert.equal(REGIONS[0]!.box, null);
  assert.equal(new Set(REGIONS.map((r) => r.id)).size, REGIONS.length);
  const en = JSON.parse(readFileSync(new URL('../src/app/locales/en.json', import.meta.url), 'utf8')) as Record<string, string>;
  for (const r of REGIONS.slice(1)) {
    const b = r.box!;
    assert.ok(b.minLat < b.maxLat && b.minLon < b.maxLon, r.id);
    assert.ok(b.minLat >= -90 && b.maxLat <= 90 && b.minLon >= -180 && b.maxLon <= 180, r.id);
    if ('iso' in r.label) assert.match(r.label.iso, /^[A-Z]{2}$/);
    else assert.ok(r.label.key in en, r.label.key);
  }
});
