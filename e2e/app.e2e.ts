import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, afterEach, before, test } from 'node:test';
import { decodeQuake } from '../src/core/codec.ts';
import { distanceDeg } from '../src/core/geo.ts';
import { TravelTimes } from '../src/core/traveltime.ts';
import { harness, pause, ready, seek, type Harness } from './helpers.ts';

let h: Harness;
before(async () => (h = await harness()));
afterEach(async () => h.closeContexts());
after(async () => h.close());

const hualien = decodeQuake(readFileSync(new URL('../public/events/us7000m9g4.json', import.meta.url), 'utf8'));
const cities = JSON.parse(readFileSync(new URL('../public/data/cities.json', import.meta.url), 'utf8')) as {
  cities: [number, number, number, string][];
};
const seconds = (n: number) => `${n.toFixed(Math.abs(n) < 10 ? 1 : 0)} s`;

test('opens on the 2024 Hualien quake and starts the replay', async () => {
  const { page, errors, unexpected, external } = await h.open();
  assert.equal(await page.locator('.quake-title').innerText(), '2024 Hualien, Taiwan');
  assert.equal(await page.locator('.mag-num').innerText(), '7.4');
  assert.match(await page.locator('.quake-facts').innerText(), /Apr 2, 2024.*UTC[\s\S]*Depth 40 km[\s\S]*635 felt reports/);
  assert.equal(await page.locator('.play-btn').getAttribute('aria-label'), 'Pause');
  // Software WebGL can be slow to produce its first frames, so wait for the clock instead of a fixed delay.
  await page.waitForFunction(() => Number(document.querySelector<HTMLInputElement>('.scrub')!.value) > 0, null, { timeout: 20000 });
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, [], 'no request outside the fixtures');
  // A featured quake needs no catalog or product request. Only the map tiles go out.
  assert.deepEqual([...new Set(external.map((r) => new URL(r.split(' ')[1]!).hostname))], ['tiles.openfreemap.org']);
});

test('the overlay draws the waves: with every other layer off, pixels appear as the replay advances', async () => {
  const { page } = await h.open();
  await pause(page);
  for (const chip of ['Seismometers', 'ShakeMap', 'Strong motion', 'Felt reports'])
    await page.locator('.layers-strip .chip', { hasText: chip }).click();
  const painted = async () =>
    page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('canvas.overlay')!;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
      return n;
    });
  await seek(page, -1);
  const before = await painted();
  await seek(page, 30);
  const during = await painted();
  assert.ok(during > before + 1000, `${before} then ${during} painted pixels`);
  await page.locator('.layers-strip .chip', { hasText: 'Waves' }).click();
  await seek(page, 31);
  assert.ok((await painted()) < before + 300, 'with the waves off the overlay is almost empty again');
});

test('a pin on Taichung shows the same seconds as the library computes', async () => {
  const { page } = await h.open();
  await pause(page);
  await page.locator('.chip', { hasText: 'Taichung' }).click();
  const [, lat, lon] = [0, ...cities.cities.find((c) => c[3] === 'Taichung')!].slice(0, 3) as [number, number, number];
  const tt = new TravelTimes(hualien.quake.depthKm);
  const d = distanceDeg([hualien.quake.lat, hualien.quake.lon], [lat, lon]);
  assert.equal(await page.locator('.stat.p .stat-value').innerText(), seconds(tt.time('P', d)));
  assert.equal(await page.locator('.stat.s .stat-value').innerText(), seconds(tt.time('S', d)));
  assert.equal(await page.locator('.pin-card .card-title').innerText(), 'Taichung');
  assert.match(await page.locator('.shake-text').innerText(), /Strong|Moderate|Very strong/);
  assert.equal(await page.locator('.mark-p').isVisible(), true);
  await seek(page, 5);
  assert.match(await page.locator('.pin-status').innerText(), /^P wave arrives in /);
  await seek(page, tt.time('S', d) + 5);
  assert.equal(await page.locator('.pin-status').innerText(), 'Both waves have arrived');
});

test('the alert slider moves the result from a warning to the blind zone', async () => {
  const { page } = await h.open();
  await pause(page);
  await page.locator('.chip', { hasText: 'Taichung' }).click();
  const range = page.locator('#alert-range');
  await range.fill('5');
  assert.match(await page.locator('.alert-result').innerText(), /^You would have had \d+ s before the S wave$/);
  await range.fill('50');
  assert.match(await page.locator('.alert-result').innerText(), /^Blind zone: the S wave got here before this alert$/);
  assert.ok(await page.locator('.alert-result.is-blind').isVisible());
});

test('removing the pin brings back the search', async () => {
  const { page } = await h.open();
  await page.locator('.chip', { hasText: 'Taichung' }).click();
  await page.getByRole('button', { name: 'Remove pin' }).click();
  assert.ok(await page.locator('#city-search').isVisible());
  await page.fill('#city-search', 'tok');
  await page.locator('.result', { hasText: 'Tokyo' }).click();
  assert.equal(await page.locator('.pin-card .card-title').innerText(), 'Tokyo');
});

test('the pin survives a reload', async () => {
  const { page } = await h.open();
  await page.locator('.chip', { hasText: 'Taichung' }).click();
  await page.reload();
  await ready(page);
  assert.equal(await page.locator('.pin-card .card-title').innerText(), 'Taichung');
});

test('the pin never reaches any server: not when set, moved by location, reloaded or opened from a shared link', async () => {
  const [lat, lon] = [25.0123, 121.5432];
  const { page, context, external, served } = await h.open({ geolocation: { latitude: lat, longitude: lon } });
  await pause(page);
  await page.getByRole('button', { name: 'Use my location' }).click();
  await page
    .locator('.pin-card .card-title')
    .filter({ hasText: /Taipei|My place/ })
    .waitFor();
  await page.reload();
  await ready(page);
  // A pin far from the quake is not on screen and the map does not travel to it.
  await page.getByRole('button', { name: 'Remove pin' }).click();
  await page.fill('#city-search', 'Sydney');
  await page.locator('.result', { hasText: 'Sydney' }).first().click();
  await page.locator('.pin-offscreen').waitFor();
  await page.getByRole('button', { name: 'Remove pin' }).click();
  await page.getByRole('button', { name: 'Use my location' }).click();
  await page
    .locator('.pin-card .card-title')
    .filter({ hasText: /Taipei|My place/ })
    .waitFor();
  await page.getByRole('button', { name: 'Share this replay' }).click();
  await page.locator('#share-pin').check();
  await page.getByRole('button', { name: 'Copy link' }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(link, /#pin=25\.01,121\.54$/);
  await page.goto(link);
  await ready(page);
  await page.locator('.pin-card .card-title').waitFor();
  const seen = [...external, ...served].join('\n');
  assert.ok(seen.length > 100, 'the logs are not empty');
  const leaks = seen.split('\n').filter((line) => /25\.0|121\.5|pin=/.test(line));
  assert.deepEqual(leaks, []);
  await context.close();
});

test('the language switcher translates the interface and is remembered', async () => {
  const { page } = await h.open();
  await page.selectOption('#lang', 'ja');
  assert.equal(await page.locator('.quake-title').innerText(), '2024 花蓮（台湾）');
  assert.equal(await page.locator('html').getAttribute('lang'), 'ja');
  assert.match(await page.locator('.layers-strip').innerText(), /地震波/);
  await page.reload();
  await ready(page);
  assert.equal(await page.locator('#lang').inputValue(), 'ja');
  for (const code of ['zh-TW', 'zh-CN', 'ko', 'es', 'fr', 'de', 'pt-BR']) {
    await page.selectOption('#lang', code);
    assert.ok((await page.locator('.quake-title').innerText()).includes('2024'), code);
    assert.ok((await page.locator('.topbar-actions .btn-primary').innerText()).length > 2, code);
  }
});

test('the browser language picks the first language', async () => {
  const { page } = await h.open({ locale: 'zh-TW' });
  assert.equal(await page.locator('#lang').inputValue(), 'zh-TW');
  assert.equal(await page.locator('.quake-title').innerText(), '2024 花蓮（臺灣）');
});

test('theme toggle switches and is remembered', async () => {
  const { page } = await h.open();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.locator('.topbar-actions .icon-btn').first().click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.reload();
  await ready(page);
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
});

test('the quake picker lists the featured shelf and switches quake', async () => {
  const { page } = await h.open();
  await page.getByRole('button', { name: 'Choose a quake' }).click();
  await page.locator('.quake-row').first().waitFor();
  assert.equal(await page.locator('.quake-row').count(), 14);
  await page.locator('.quake-row', { hasText: '2022 Chishang, Taiwan' }).click();
  await page.locator('.quake-title', { hasText: '2022 Chishang, Taiwan' }).waitFor();
  assert.equal(await page.locator('.mag-num').innerText(), '6.9');
  assert.ok(page.url().includes('event=us7000i90q'));
});

test('recent and search tabs read the USGS catalog', async () => {
  const { page } = await h.open();
  await page.getByRole('button', { name: 'Choose a quake' }).click();
  await page.getByRole('tab', { name: 'Recent' }).click();
  await page.locator('.quake-row', { hasText: 'Hualien City' }).waitFor();
  await page.getByRole('tab', { name: 'Search' }).click();
  await page.selectOption('#search-region', 'tw');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.locator('.quake-row', { hasText: 'Hualien City' }).waitFor();
});

test('a deep link restores the quake, the pin, the clock, the alert and the language', async () => {
  const { page } = await h.open({ query: '?event=us7000i90q&t=15&alert=7&lang=es#pin=25.03,121.56' });
  assert.equal(await page.locator('.quake-title').innerText(), '2022 Chishang, Taiwán');
  assert.equal(await page.locator('#alert-range').inputValue(), '7');
  assert.match(await page.locator('.time-now').innerText(), /^T\+15/);
  assert.equal(await page.locator('.play-btn').getAttribute('aria-label'), 'Reproducir');
  assert.equal(await page.locator('.stat.p .stat-label').innerText(), 'Onda P');
});

test('keyboard: space plays and pauses, arrows step the clock', async () => {
  const { page } = await h.open();
  await page
    .locator('body')
    .click({ position: { x: 800, y: 300 } })
    .catch(() => {});
  await page.keyboard.press('Space');
  assert.equal(await page.locator('.play-btn').getAttribute('aria-label'), 'Play');
  await seek(page, 10);
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('.time-now').innerText(), /^T\+11/);
  await page.keyboard.press('Shift+ArrowLeft');
  assert.match(await page.locator('.time-now').innerText(), /^T\+1\.0/);
});

test('the arrow keys still step the clock after a button has focus, and never pan the map', async () => {
  const { page } = await h.open();
  await pause(page);
  await seek(page, 10);
  // The pause button keeps the focus after a click, which used to swallow every arrow key.
  await page.locator('.play-btn').focus();
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('.time-now').innerText(), /^T\+11/);
  // A click on the map focuses it. Arrows must step the clock and leave the map where it is.
  await page.mouse.click(900, 400);
  await page.locator('.pin').waitFor();
  const before = await page.locator('.pin').boundingBox();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  assert.match(await page.locator('.time-now').innerText(), /^T\+12/);
  assert.deepEqual(await page.locator('.pin').boundingBox(), before);
});

test('a double click zooms the map and leaves the pin where it was', async () => {
  const { page } = await h.open();
  await pause(page);
  await page.mouse.click(900, 400);
  await page.locator('.pin').waitFor();
  const stored = () => page.evaluate(() => localStorage.getItem('rumbleback.pin'));
  const pin = await stored();
  assert.ok(pin);
  await page.mouse.dblclick(1100, 250);
  await page.waitForTimeout(800);
  assert.equal(await stored(), pin);
  // A single click later still moves it.
  await page.mouse.click(1100, 250);
  await page.waitForFunction((was) => localStorage.getItem('rumbleback.pin') !== was, pin);
});

test('the timeline carries the real seismogram of a nearby station', async () => {
  const { page } = await h.open();
  await pause(page);
  const strip = page.locator('canvas.strip');
  await strip.waitFor();
  assert.match((await strip.getAttribute('aria-label'))!, /^Vertical ground motion at TW\.\w+, \d+ km from the epicenter/);
  const painted = () =>
    strip.evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i]! > 200) n++;
      return n;
    });
  await seek(page, -1);
  const before = await painted();
  await seek(page, 40);
  assert.ok((await painted()) > before + 50, 'more of the trace is drawn once the replay has reached it');
  await page.getByRole('button', { name: 'Choose a quake' }).click();
  await page.locator('.quake-row', { hasText: '1999 Chi-Chi' }).click();
  await page.locator('.quake-title', { hasText: 'Chi-Chi' }).waitFor();
  assert.equal(await strip.isHidden(), true, 'an event with no seismogram has no strip');
});

test('sound turns on and off from the timeline', async () => {
  const { page, errors } = await h.open();
  const button = page.locator('.sound-btn');
  assert.equal(await button.getAttribute('aria-pressed'), 'false');
  await button.click();
  await page.waitForFunction(() => document.querySelector('.sound-btn')!.getAttribute('aria-pressed') === 'true');
  await button.click();
  assert.equal(await button.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(errors, []);
});

test('model check card shows the residual summary', async () => {
  const { page } = await h.open();
  await page.locator('.check-card summary').click();
  const text = await page.locator('.check-summary').innerText();
  assert.match(text, /^\d+ real P picks, median error \d\.\d s, 90% within \d\.\d s$/);
  assert.ok(await page.locator('canvas.histogram').isVisible());
});

test('without map tiles the coastlines and the waves still draw, and the app says so', async () => {
  const { page } = await h.open();
  await page.locator('.toast').waitFor({ timeout: 15000 });
  assert.equal(await page.locator('.toast').innerText(), 'Map tiles did not load, showing coastlines only');
  // The bundled land polygons are drawn: the map canvas holds more than one colour, land and sea.
  await page.waitForTimeout(1500);
  const colours = await page.evaluate(() => {
    const map = document.querySelector<HTMLCanvasElement>('canvas.maplibregl-canvas')!;
    const copy = document.createElement('canvas');
    copy.width = 64;
    copy.height = 40;
    const ctx = copy.getContext('2d')!;
    ctx.drawImage(map, 0, 0, 64, 40);
    const seen = new Set<string>();
    const d = ctx.getImageData(0, 0, 64, 40).data;
    for (let i = 0; i < d.length; i += 4) seen.add(`${d[i]! >> 4},${d[i + 1]! >> 4},${d[i + 2]! >> 4}`);
    return seen.size;
  });
  assert.ok(colours >= 2, `${colours} colours on the map canvas`);
});

test('share dialog: link without the pin by default, square card as a PNG', async () => {
  const { page, context } = await h.open();
  await pause(page);
  await page.locator('.chip', { hasText: 'Taichung' }).click();
  await seek(page, 20);
  await page.getByRole('button', { name: 'Share this replay' }).click();
  await page.getByRole('button', { name: 'Copy link' }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(link, /event=us7000m9g4/);
  assert.ok(!link.includes('pin='), link);
  await page.locator('#share-pin').check();
  await page.getByRole('button', { name: 'Copy link' }).click();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /#pin=\d+\.\d\d,\d+\.\d\d$/);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save square card' }).click()]);
  const bytes = readFileSync((await download.path())!);
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1080, 1080]);
  const story = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save story card' }).click()]);
  const png = readFileSync((await story[0].path())!);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1080, 1920]);
  await context.close();
});

test('records a video clip of the replay', { timeout: 180000 }, async () => {
  const { page } = await h.open({ width: 900, height: 600 });
  await pause(page);
  await seek(page, 12);
  await page.getByRole('button', { name: 'Share this replay' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 150000 }),
    page.getByRole('button', { name: 'Record a video clip' }).click(),
  ]);
  assert.match(download.suggestedFilename(), /^rumbleback\.(webm|mp4)$/);
  const bytes = readFileSync((await download.path())!);
  assert.ok(bytes.length > 100_000, `${bytes.length} bytes`);
  if (download.suggestedFilename().endsWith('.webm')) assert.deepEqual([...bytes.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3]);
  // The replay is back where it was: paused at the same moment, and the exports are usable again.
  assert.match(await page.locator('.time-now').innerText(), /^T\+12/);
  assert.equal(await page.locator('.play-btn').getAttribute('aria-label'), 'Play');
  assert.equal(await page.getByRole('button', { name: 'Copy link' }).isEnabled(), true);
});

test('without WebGL 2 the page says what it needs instead of staying blank', async () => {
  const context = await h.browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      return kind === 'webgl2' ? null : (original as (k: string, ...r: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof original;
  });
  await page.goto(h.url);
  assert.match(await page.locator('.fatal p').innerText(), /WebGL 2/);
  await context.close();
});

test('a quake that is not featured loads its layers from USGS and EarthScope', async () => {
  const { page, unexpected, external } = await h.open();
  await pause(page);
  await page.getByRole('button', { name: 'Choose a quake' }).click();
  await page.getByRole('tab', { name: 'Recent' }).click();
  await page.locator('.quake-row').first().click();
  await page.locator('.quake-title', { hasText: 'Hualien City' }).waitFor();
  assert.equal(await page.locator('.mag-num').innerText(), '7.4');
  // The picks, the ShakeMap and the stations arrive after the summary, and the seismogram after the picks.
  await page.locator('canvas.strip:not([hidden])').waitFor({ timeout: 30000 });
  assert.match((await page.locator('canvas.strip').getAttribute('aria-label'))!, /^Vertical ground motion at IU\.TATO/);
  for (const chip of ['Seismometers', 'ShakeMap', 'Strong motion', 'Felt reports']) {
    assert.equal(await page.locator('.layers-strip .chip', { hasText: chip }).isDisabled(), false, chip);
  }
  assert.deepEqual(unexpected, []);
  const hosts = new Set(external.map((r) => new URL(r.split(' ')[1]!).hostname));
  assert.ok(hosts.has('service.earthscope.org') && hosts.has('earthquake.usgs.gov'), [...hosts].join(','));
  assert.ok(await page.locator('.play-btn').getAttribute('aria-label'));
});

test('layout on a phone: nothing spills out of the screen and the sheet collapses', async () => {
  const { page } = await h.open({ width: 390, height: 844 });
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll('.topbar-actions > *, .brand, .dock, .dock *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > window.innerWidth + 0.5 || r.left < -0.5);
      })
      .map((el) => el.className),
  );
  assert.deepEqual(overflow, []);
  await page.locator('.sheet-handle').click();
  assert.equal(await page.locator('.panel').getAttribute('data-collapsed'), 'true');
  assert.equal(await page.locator('.pin-card').isVisible(), false);
});

test('the map credit stays reachable on a phone: a small button that opens the text', async () => {
  const { page } = await h.open({ width: 390, height: 844, tileJson: true });
  const credit = page.locator('.maplibregl-ctrl-attrib');
  await page.locator('.maplibregl-ctrl-attrib.maplibregl-compact').waitFor();
  const button = credit.locator('summary');
  assert.equal(await button.isVisible(), true);
  assert.equal(await credit.locator('.maplibregl-ctrl-attrib-inner').isVisible(), false);
  const box = (await button.boundingBox())!;
  assert.ok(box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, JSON.stringify(box));
  await button.click();
  assert.match(await credit.locator('.maplibregl-ctrl-attrib-inner').innerText(), /OpenStreetMap/);
});
