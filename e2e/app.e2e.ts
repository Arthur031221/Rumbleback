import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, afterEach, before, test } from 'node:test';
import { decodeQuake } from '../src/core/codec.ts';
import { distanceDeg } from '../src/core/geo.ts';
import { stationSample } from '../src/core/residuals.ts';
import { TravelTimes } from '../src/core/traveltime.ts';
import { harness, LIVE_ID, MISSING_ID, pause, ready, seek, SLOW_ID, type Harness } from './helpers.ts';

let h: Harness;
before(async () => (h = await harness()));
afterEach(async () => h.closeContexts());
after(async () => h.close());

const hualien = decodeQuake(readFileSync(new URL('../public/events/us7000m9g4.json', import.meta.url), 'utf8'));
const cities = JSON.parse(readFileSync(new URL('../public/data/cities.json', import.meta.url), 'utf8')) as {
  cities: [number, number, number, string][];
};
const axeSource = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const seconds = (n: number) => `${n.toFixed(Math.abs(n) < 10 ? 1 : 0)} s`;

test('before the app script arrives the page already has its theme and a placeholder, and the placeholder goes', async () => {
  const context = await h.browser.newContext({ colorScheme: 'light', viewport: { width: 1280, height: 800 } });
  try {
    const page = await context.newPage();
    // The script request never finishes, which is what a slow connection looks like.
    await page.route('**/assets/app.js*', () => {});
    await page.goto(h.url, { waitUntil: 'commit' });
    await page.locator('#boot').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
    assert.equal(await page.locator('.topbar').count(), 0);
    await page.unroute('**/assets/app.js*');
    await page.reload();
    await ready(page);
    await page.locator('#boot').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  } finally {
    await context.close();
  }
});

test('when the app cannot start the page says so: no JavaScript, a script that fails, a script that is missing', async () => {
  const visit = async (options: { javaScriptEnabled?: boolean }, route?: (r: import('playwright').Route) => Promise<void>) => {
    const context = await h.browser.newContext({ viewport: { width: 1000, height: 700 }, ...options });
    try {
      const page = await context.newPage();
      if (route) await page.route('**/assets/app.js*', route);
      await page.goto(h.url);
      return page;
    } catch (e) {
      await context.close();
      throw e;
    }
  };
  const noScript = await visit({ javaScriptEnabled: false });
  assert.equal(await noScript.locator('#boot').isVisible(), false);
  assert.match(await noScript.evaluate(() => document.body.innerText), /Rumbleback needs JavaScript/);
  await noScript.context().close();
  const broken = await visit({}, (r) => r.fulfill({ contentType: 'text/javascript', body: 'throw new Error("boom")' }));
  await broken.locator('.boot-error').waitFor();
  assert.match(await broken.locator('.boot-error').innerText(), /could not start/);
  assert.equal(await broken.locator('#boot').getAttribute('aria-hidden'), null);
  await broken.context().close();
  const missing = await visit({}, (r) => r.abort());
  await missing.locator('.boot-error').waitFor();
  await missing.context().close();
});

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

test("the quake card also gives the time in the viewer's own time zone, unless that is UTC", async () => {
  const taipei = await h.open({ timezone: 'Asia/Taipei', locale: 'en-US' });
  const lines = await taipei.page.locator('.quake-facts span').allInnerTexts();
  assert.deepEqual(lines.slice(0, 2), ['Apr 2, 2024, 11:58:12 PM UTC', 'Your time: Apr 3, 2024, 7:58:12 AM GMT+8']);
  await h.closeContexts(); // software WebGL is slow with several maps open
  const utc = await h.open();
  assert.equal(await utc.page.locator('.quake-facts span').count(), 3, 'UTC viewers get the date, the depth and the felt reports');
  await h.closeContexts();
  const ja = await h.open({ timezone: 'Asia/Tokyo', locale: 'ja-JP' });
  assert.match(await ja.page.locator('.quake-facts span').nth(1).innerText(), /^あなたの時刻：2024年4月3日 8:58:12 (JST|GMT\+9)$/);
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

test('a mouse over a lit dot says what it is, and a finger, a dot not yet lit or a hidden layer does not', async () => {
  const { page } = await h.open();
  await pause(page);
  // Moves a mouse (or a finger) over a grid of points in the page and keeps the first card of each kind it opens.
  const sweep = () =>
    page.evaluate(() => {
      const map = document.querySelector('#map')!;
      const seen: Record<string, string> = {};
      const outside: string[] = [];
      const texts: string[] = [];
      for (const pointerType of ['touch', 'mouse']) {
        for (let y = 90; y < 700; y += 5) {
          for (let x = 390; x < 1430; x += 5) {
            map.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y, pointerType }));
            const box = document.querySelector<HTMLElement>('.inspector');
            if (!box || box.hidden) continue;
            const r = box.getBoundingClientRect();
            if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) outside.push(`${x},${y}`);
            const text = box.innerText;
            const kind = /analyst/.test(text)
              ? 'pick'
              : /Strong motion/.test(text)
                ? 'instrument'
                : /Felt reports/.test(text)
                  ? 'felt'
                  : text;
            seen[`${pointerType} ${kind}`] ??= text;
            if (texts.length < 600 && !texts.includes(text)) texts.push(text);
          }
        }
      }
      map.dispatchEvent(new PointerEvent('pointerleave'));
      return { seen, texts, outside, open: !document.querySelector<HTMLElement>('.inspector')!.hidden };
    });
  await seek(page, -1);
  assert.deepEqual((await sweep()).seen, {}, 'nothing has reached any dot yet');
  await seek(page, 45);
  const { seen, outside, open } = await sweep();
  assert.deepEqual(Object.keys(seen).sort(), ['mouse felt', 'mouse instrument', 'mouse pick'], 'a finger opens no card');
  assert.deepEqual(outside, [], 'the card stays on the screen');
  assert.equal(open, false, 'the card goes when the mouse leaves the map');
  const lines = (text: string) => text.split(/\n+/);
  const [pickTitle, pickAway, pickSays] = lines(seen['mouse pick']!);
  assert.match(pickTitle!, /^[A-Z0-9]+\.[A-Z0-9]+$/);
  assert.match(pickAway!, /^\d+ km from the epicenter$/);
  assert.match(pickSays!, /^An analyst picked the [PS] wave at \d+\.\d s after the origin\. The model says \d+\.\d s\.$/);
  const instrument = lines(seen['mouse instrument']!);
  assert.match(instrument[1]!, /^[IVX]+$/);
  assert.match(instrument[2]!, /^Strong motion instrument, network \w+$/);
  assert.match(instrument[3]!, /^\w+( \w+)? \(MMI \d\.\d\)$/);
  assert.match(instrument.slice(4, -1).join(' '), /Peak acceleration [\d.]+ %g Peak velocity [\d.]+ cm\/s/);
  assert.match(instrument.at(-1)!, /^\d+ km from the epicenter$/);
  const felt = lines(seen['mouse felt']!);
  assert.match(felt[0]!, /^Felt reports here: \d+$/);
  assert.match(felt[1]!, /^[IVX]+$/);
  assert.match(felt[2]!, /^\w+( \w+)? \(MMI \d\.\d\)$/);
  // The card speaks the language of the page.
  await page.selectOption('#lang', 'ja');
  const japanese = (await sweep()).texts;
  assert.ok(japanese.some((text) => text.includes('解析者')) && japanese.some((text) => text.includes('強震計')), japanese.join(' | '));
  // Layers that are off show no dots, so they have no card either.
  await page.selectOption('#lang', 'en');
  for (const layer of ['Seismometers', 'Strong motion', 'Felt reports'])
    await page.locator('.layers-strip .chip', { hasText: layer }).click();
  // The overlay redraws on the next animation frame, and the cards follow what it drew.
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  assert.deepEqual((await sweep()).seen, {});
});

test('a click that is still waiting does not bring back a pin that was removed, and two clicks apart are two choices', async () => {
  const { page } = await h.open();
  await pause(page);
  await page.locator('.chip', { hasText: 'Taichung' }).click();
  await page.locator('.pin').waitFor();
  const stored = () => page.evaluate(() => localStorage.getItem('rumbleback.pin'));
  const remove = () => page.locator('.pin-card .icon-btn').first().click();
  await page.mouse.click(900, 400);
  await remove();
  await page.waitForTimeout(900);
  assert.equal(await stored(), null, 'the removed pin stays removed');
  // Two clicks far apart, one right after the other, are two choices and the later one wins.
  await page.mouse.click(900, 400);
  await page.mouse.click(1100, 300);
  await page.waitForFunction(() => localStorage.getItem('rumbleback.pin') !== null);
  const both = await stored();
  await remove();
  await page.mouse.click(1100, 300);
  await page.waitForFunction(() => localStorage.getItem('rumbleback.pin') !== null);
  assert.equal(await stored(), both);
});

test('a double tap on a phone leaves the pin where it was, and a single tap still moves it', async () => {
  const { page } = await h.open({ width: 390, height: 844 });
  await pause(page);
  const stored = () => page.evaluate(() => localStorage.getItem('rumbleback.pin'));
  await page.touchscreen.tap(200, 250);
  await page.locator('.pin').waitFor();
  const pin = await stored();
  await page.touchscreen.tap(120, 200);
  await page.waitForTimeout(40);
  await page.touchscreen.tap(120, 200);
  await page.waitForTimeout(900);
  assert.equal(await stored(), pin);
  await page.touchscreen.tap(300, 300);
  await page.waitForFunction((was) => localStorage.getItem('rumbleback.pin') !== was, pin);
});

test('the city list closes when the field loses the focus and comes back with it', async () => {
  const { page } = await h.open();
  await pause(page);
  await page.fill('#city-search', 'tok');
  await page.locator('.result').first().waitFor();
  await page.locator('.pin-prompt').click();
  await page.locator('#city-results').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#city-search').getAttribute('aria-expanded'), 'false');
  await page.locator('#city-search').focus();
  await page.locator('.result').first().waitFor();
  // A pin placed some other way ends the search it leaves behind.
  await page.mouse.click(900, 400);
  await page.locator('.pin').waitFor();
  await page.locator('.pin-card .icon-btn').first().click();
  assert.equal(await page.locator('#city-search').inputValue(), '');
  assert.equal(await page.locator('#city-results').isHidden(), true);
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

test('a pin the ShakeMap does not reach says so, where a pin inside it gives the shaking', async () => {
  const outside = await h.open({ query: '?event=us7000m9g4#pin=35.69,139.75' });
  assert.equal(await outside.page.locator('.shake-text').innerText(), 'The ShakeMap has no estimate for this place');
  assert.equal(await outside.page.locator('.shake-row .mmi-chip').isVisible(), false);
  const inside = await h.open({ query: '?event=us7000m9g4#pin=24.15,120.68' });
  assert.match(await inside.page.locator('.shake-text').innerText(), /^Strong \(MMI 5\.\d\)$/);
  assert.equal(await inside.page.locator('.shake-row .mmi-chip').innerText(), 'VI');
});

test('a key names the colours of the shaking layers, in the language of the page, and goes when none of them is on', async () => {
  const { page } = await h.open();
  const key = page.locator('.mmi-key');
  await key.waitFor();
  assert.equal(await key.locator('.mmi-key-title').innerText(), 'Shaking on the map (MMI)');
  assert.deepEqual((await key.locator('.mmi-key-ticks').innerText()).split(/\s+/), ['II', 'IV', 'VI', 'VIII', 'X']);
  assert.match(await key.locator('.mmi-key-bar').evaluate((el) => getComputedStyle(el).backgroundImage), /^linear-gradient\(/);
  for (const layer of ['shaking', 'instruments', 'felt']) await page.locator(`.layer-${layer}`).click();
  assert.equal(await key.isVisible(), false);
  await page.locator('.layer-felt').click();
  assert.equal(await key.isVisible(), true);
  await page.locator('.select').selectOption('de');
  assert.equal(await key.locator('.mmi-key-title').innerText(), 'Erschütterung auf der Karte (MMI)');
});

test('the colour key sits in the quake card on a desktop and after the pin card on a phone, so the pin prompt stays in view, and it follows the window', async () => {
  const { page } = await h.open({ width: 390, height: 664 });
  assert.equal(await page.locator('.pin-card + .mmi-key.card').count(), 1);
  const promptShown = () =>
    page.evaluate(() => {
      const prompt = document.querySelector('.pin-prompt')!.getBoundingClientRect();
      const panel = document.querySelector('.panel')!.getBoundingClientRect();
      return prompt.top >= panel.top && prompt.bottom <= panel.bottom;
    });
  assert.equal(await promptShown(), true, 'the prompt to drop a pin is below the fold of the sheet');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.quake-card > .mmi-key:not(.card)').waitFor();
  await page.setViewportSize({ width: 390, height: 664 });
  await page.locator('.pin-card + .mmi-key.card').waitFor();
  // Held sideways, the panel is at the side of the map and the key follows the pin card there as well.
  await page.setViewportSize({ width: 740, height: 360 });
  await page.locator('.pin-card + .mmi-key.card').waitFor();
});

test('on a phone the prompt to drop a pin stays in the sheet in every language, in a time zone that is not UTC', async () => {
  for (const [width, height] of [
    [390, 664],
    [375, 667],
    [360, 640],
  ] as const) {
    for (const lang of ['en', 'zh-TW', 'zh-CN', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR']) {
      await h.closeContexts();
      const { page } = await h.open({ width, height, timezone: 'Asia/Taipei', query: `?event=us7000m9g4&lang=${lang}` });
      await page.locator('.quake-facts span').nth(1).waitFor();
      const gap = await page.evaluate(() => {
        const prompt = document.querySelector('.pin-prompt')!.getBoundingClientRect();
        const panel = document.querySelector('.panel')!.getBoundingClientRect();
        return prompt.bottom - panel.bottom;
      });
      assert.ok(gap <= 0, `${lang} at ${width}x${height}: the prompt runs ${gap} px past the sheet`);
    }
  }
});

test('the watch button stays inside the pin card in every language, on a small phone and in a panel held sideways', async () => {
  for (const [width, height] of [
    [320, 568],
    [740, 360],
  ] as const) {
    for (const lang of ['en', 'zh-TW', 'zh-CN', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR']) {
      await h.closeContexts();
      const { page } = await h.open({ width, height, query: `?event=us7000m9g4&t=36&lang=${lang}#pin=25.03,121.56` });
      const right = (selector: string) => page.locator(selector).evaluate((el) => el.getBoundingClientRect().right);
      const [card, button] = [await right('.pin-card'), await right('.pin-watch')];
      assert.ok(button <= card, `${lang} at ${width}x${height}: the button ends at ${button}, the card at ${card}`);
    }
  }
});

test('the share buttons stay inside the dialog on a phone in every language', async () => {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ] as const) {
    for (const lang of ['en', 'zh-TW', 'zh-CN', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR']) {
      await h.closeContexts();
      const { page } = await h.open({ width, height, query: `?lang=${lang}` });
      await page.locator('.topbar-actions button').nth(2).click();
      await page.locator('.share-actions .btn').first().waitFor();
      const outside = await page.evaluate(() => {
        const dialog = document.querySelector('dialog[open]')!.getBoundingClientRect();
        return [...document.querySelectorAll('.share-actions .btn')]
          .filter((b) => b.getBoundingClientRect().right > dialog.right - 8 || b.getBoundingClientRect().left < dialog.left + 8)
          .map((b) => b.textContent!.trim());
      });
      assert.deepEqual(outside, [], `${lang} at ${width}x${height}`);
    }
  }
});

test('the timeline slider keeps a usable width at every window size from a tablet to a wide desktop', async () => {
  for (const [width, height] of [
    [834, 1194],
    [900, 700],
    [1024, 768],
    [1100, 800],
    [1240, 800],
    [1280, 720],
    [1440, 900],
  ] as const) {
    await h.closeContexts();
    const { page } = await h.open({ width, height });
    const box = await page.locator('.scrub').boundingBox();
    assert.ok(box && box.width >= 240, `at ${width}x${height} the slider is ${box?.width} px wide`);
    // The panel stops above the timeline, so a wider timeline does not run over it.
    const overlap = await page.evaluate(
      () => document.querySelector('.panel')!.getBoundingClientRect().bottom > document.querySelector('.dock')!.getBoundingClientRect().top,
    );
    assert.equal(overlap, false, `at ${width}x${height} the panel runs into the timeline`);
  }
});

test('the pin card runs the replay again from five seconds before the P wave reaches the pin', async () => {
  const { page } = await h.open();
  await pause(page);
  await page.locator('.chip', { hasText: 'Taichung' }).click();
  const [, lat, lon] = [0, ...cities.cities.find((c) => c[3] === 'Taichung')!].slice(0, 3) as [number, number, number];
  const pSec = new TravelTimes(hualien.quake.depthKm).time('P', distanceDeg([hualien.quake.lat, hualien.quake.lon], [lat, lon]));
  await seek(page, 80);
  assert.equal(await page.locator('.pin-status').innerText(), 'Both waves have arrived');
  await page.locator('.pin-watch').click();
  const now = Number(/T\+(-?\d+(?:\.\d+)?)/.exec(await page.locator('.time-now').innerText())![1]);
  assert.ok(now >= pSec - 5 - 0.6 && now < pSec - 5 + 4, `the clock is at ${now} s, the P wave reaches the pin at ${pSec} s`);
  assert.equal(await page.locator('.play-btn').getAttribute('aria-label'), 'Pause');
  assert.match(await page.locator('.pin-status').innerText(), /^P wave arrives in /);
});

test('the city search works from the keyboard and tells a screen reader what it offers', async () => {
  const { page } = await h.open();
  await pause(page);
  const field = page.locator('#city-search');
  await field.fill('tok');
  await page.locator('.result').first().waitFor();
  assert.equal(await field.getAttribute('aria-expanded'), 'true');
  assert.match(await page.locator('.pin-setup [role=status]').innerText(), /arrow keys/);
  const options = page.locator('[role=option]');
  assert.ok((await options.count()) >= 1);
  // The list drops over the cards below it, so every row has to be the thing under its own middle.
  const covered = await options.evaluateAll(
    (rows) =>
      rows.filter((row) => {
        const r = row.getBoundingClientRect();
        return !row.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }).length,
  );
  assert.equal(covered, 0);
  if ((await options.count()) > 1) {
    await page.keyboard.press('ArrowUp');
    assert.equal(
      await field.getAttribute('aria-activedescendant'),
      await options.last().getAttribute('id'),
      'Up from nothing lands on the last row',
    );
    await page.keyboard.press('ArrowDown');
  } else await page.keyboard.press('ArrowDown');
  const first = await options.first().getAttribute('id');
  assert.equal(await field.getAttribute('aria-activedescendant'), first);
  assert.equal(await options.first().getAttribute('aria-selected'), 'true');
  if ((await options.count()) > 1) {
    await page.keyboard.press('ArrowDown');
    assert.notEqual(await field.getAttribute('aria-activedescendant'), first);
    await page.keyboard.press('ArrowUp');
    assert.equal(await field.getAttribute('aria-activedescendant'), first);
  }
  const name = await options.first().innerText();
  await page.keyboard.press('Enter');
  await page.locator('.pin-live').waitFor({ state: 'visible' });
  assert.ok(name.length > 0);
  await page.locator('.pin-card .icon-btn').first().click();
  await field.fill('zzzzzz');
  await page.locator('.result.none', { hasText: 'No city matches.' }).waitFor();
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

test("a shared link's pin only starts the page: a pin the viewer sets, or removes, is still there after a reload", async () => {
  const { page } = await h.open({ query: '?event=us7000m9g4#pin=35.69,139.75' });
  assert.equal(await page.locator('.pin-card .card-title').innerText(), 'Tokyo');
  assert.match(page.url(), /pin=35\.69/);
  await page.getByRole('button', { name: 'Remove pin' }).click();
  await page.fill('#city-search', 'Taichung');
  await page.locator('.result', { hasText: 'Taichung' }).first().click();
  assert.doesNotMatch(page.url(), /pin=/);
  await page.reload();
  await ready(page);
  assert.equal(await page.locator('.pin-card .card-title').innerText(), 'Taichung');
  await page.getByRole('button', { name: 'Remove pin' }).click();
  await page.reload();
  await ready(page);
  assert.ok(await page.locator('#city-search').isVisible());
  assert.doesNotMatch(page.url(), /pin=/);
});

test("a shared link's language only starts the page: the one the viewer picks is the one after a reload", async () => {
  const { page } = await h.open({ query: '?event=us7000m9g4&t=12&lang=ja' });
  assert.equal(await page.locator('#lang').inputValue(), 'ja');
  await page.selectOption('#lang', 'en');
  assert.doesNotMatch(page.url(), /lang=/);
  assert.match(page.url(), /t=12/, 'the link keeps its moment');
  await page.reload();
  await ready(page);
  assert.equal(await page.locator('#lang').inputValue(), 'en');
  assert.equal(await page.locator('.quake-title').innerText(), '2024 Hualien, Taiwan');
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

test("the browser's own bar takes the colour of the theme in use, the one chosen in the page included", async () => {
  const { page } = await h.open({ colorScheme: 'light' });
  const bars = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => `${m.getAttribute('content')} ${m.hasAttribute('media')}`),
    );
  assert.deepEqual(await bars(), ['#e9eef3 false', '#e9eef3 false']);
  await page.getByRole('button', { name: /^Theme/ }).click();
  assert.deepEqual(await bars(), ['#090d12 false', '#090d12 false']);
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
  const places = await page.locator('#search-region option').allInnerTexts();
  assert.equal(places[0], 'Anywhere');
  assert.ok(places.includes('Afghanistan') && places.includes('Taiwan') && places.includes('California'));
  assert.deepEqual(
    places.slice(1),
    [...places.slice(1)].sort((a, b) => a.localeCompare(b, 'en')),
    'sorted by name',
  );
  await page.selectOption('#search-region', 'tw');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.locator('.quake-row', { hasText: 'Hualien City' }).waitFor();
});

test('the search offers Hawaii and Kamchatka, and an area that is not a country sends its own rectangle', async () => {
  const { page } = await h.open();
  await page.getByRole('button', { name: 'Choose a quake' }).click();
  await page.getByRole('tab', { name: 'Search' }).click();
  const places = await page.locator('#search-region option').allInnerTexts();
  for (const name of ['Hawaii', 'Kamchatka and the Kurils', 'Iceland', 'Tonga', 'Costa Rica', 'Puerto Rico', 'South Korea']) {
    assert.ok(places.includes(name), name);
  }
  await page.selectOption('#search-region', 'hi');
  const query = page.waitForRequest(
    (r) => r.url().includes('fdsnws/event') && r.url().includes('minlatitude=18.5') && r.url().includes('maxlongitude=-154.5'),
  );
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await query;
});

test('the tab is named after the quake that is open', async () => {
  const { page } = await h.open();
  assert.equal(await page.title(), '2024 Hualien, Taiwan | Rumbleback');
  await page.getByRole('button', { name: 'Choose a quake' }).click();
  await page.locator('.quake-row', { hasText: '2022 Chishang, Taiwan' }).click();
  await page.waitForFunction(() => document.title.startsWith('2022 Chishang'));
  await page.selectOption('#lang', 'ja');
  await page.waitForFunction(() => document.title.endsWith('| Rumbleback') && !document.title.startsWith('2022 Chishang'));
  assert.match(await page.title(), /^2022 .*池上/);
});

test('Back and Forward move between the quakes that were opened', async () => {
  const { page } = await h.open();
  const choose = async (name: string) => {
    await page.getByRole('button', { name: 'Choose a quake' }).click();
    await page.locator('.quake-row', { hasText: name }).click();
    await page.locator('.quake-title', { hasText: name }).waitFor();
  };
  const entries = () => page.evaluate(() => history.length);
  const start = await entries();
  await choose('2022 Chishang, Taiwan');
  await choose('1999 Chi-Chi, Taiwan');
  assert.equal(await entries(), start + 2);
  // Choosing the quake that is already open adds nothing.
  await choose('1999 Chi-Chi, Taiwan');
  assert.equal(await entries(), start + 2);
  await page.goBack();
  await page.locator('.quake-title', { hasText: '2022 Chishang, Taiwan' }).waitFor();
  assert.ok(page.url().includes('event=us7000i90q'));
  await page.goBack();
  await page.locator('.quake-title', { hasText: '2024 Hualien, Taiwan' }).waitFor();
  await page.goForward();
  await page.locator('.quake-title', { hasText: '2022 Chishang, Taiwan' }).waitFor();
});

test('the recent list can ask for a higher magnitude, and says how far back it reaches', async () => {
  const { page, external } = await h.open();
  await page.getByRole('button', { name: 'Choose a quake' }).click();
  await page.getByRole('tab', { name: 'Recent' }).click();
  await page.locator('.quake-row').first().waitFor();
  assert.match(await page.locator('.recent-note').first().innerText(), /last 30 days, newest first/);
  assert.ok(external.some((r) => r.includes('minmagnitude=5') && r.includes('orderby=time')));
  await page.selectOption('#recent-mag', '6');
  await page.locator('.quake-row').first().waitFor();
  assert.ok(external.some((r) => r.includes('minmagnitude=6')));
});

test('a search whose start date is after the end date says so instead of blaming the network', async () => {
  const { page, external } = await h.open();
  await page.getByRole('button', { name: 'Choose a quake' }).click();
  await page.getByRole('tab', { name: 'Search' }).click();
  await page.locator('.quake-row').first().waitFor();
  const before = external.length;
  await page.fill('#search-from', '2025-05-01');
  await page.fill('#search-to', '2025-01-01');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByText('The start date is after the end date.').waitFor();
  assert.equal(await page.locator('.quake-row').count(), 0);
  assert.equal(external.length, before, 'no request for a range that cannot hold anything');
});

test('the picker tabs follow the arrow keys', async () => {
  const { page } = await h.open();
  await page.getByRole('button', { name: 'Choose a quake' }).click();
  await page.locator('.quake-row').first().waitFor();
  await page.getByRole('tab', { name: 'Featured' }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab', { name: 'Recent' }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByRole('tab', { name: 'Recent' }).getAttribute('tabindex'), '0');
  assert.equal(await page.getByRole('tab', { name: 'Featured' }).getAttribute('tabindex'), '-1');
  await page.keyboard.press('End');
  assert.equal(await page.getByRole('tab', { name: 'Link', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'picker-tab-lookup', 'the arrow keys keep the focus on the tabs');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.getByRole('tab', { name: 'Search' }).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('End');
  assert.equal(await page.getByRole('tabpanel').getAttribute('aria-labelledby'), 'picker-tab-lookup');
});

test('closing the picker while a link is being looked up opens nothing', async () => {
  const { page } = await h.open();
  await pause(page);
  await page.getByRole('button', { name: 'Choose a quake' }).click();
  await page.getByRole('tab', { name: 'Link', exact: true }).click();
  await page.fill('#lookup-id', SLOW_ID);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByText('Looking it up').waitFor();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(4500);
  assert.ok(page.url().includes('event=us7000m9g4'), page.url());
  assert.ok(!page.url().includes(SLOW_ID));
  assert.equal(await page.locator('.quake-title').innerText(), '2024 Hualien, Taiwan');
});

test('Back to the first entry of a shared link returns to its moment', async () => {
  const { page } = await h.open({ query: '?event=us7000m9g4&t=15' });
  assert.match(await page.locator('.time-now').innerText(), /^T\+15/);
  await page.getByRole('button', { name: 'Choose a quake' }).click();
  await page.locator('.quake-row', { hasText: '2022 Chishang, Taiwan' }).click();
  await page.locator('.quake-title', { hasText: '2022 Chishang, Taiwan' }).waitFor();
  await page.goBack();
  await page.locator('.quake-title', { hasText: '2024 Hualien, Taiwan' }).waitFor();
  await page.waitForFunction(() => /^T\+15/.test(document.querySelector('.time-now')!.textContent ?? ''));
  assert.equal(await page.locator('.play-btn').getAttribute('aria-label'), 'Play', 'it opens paused at that moment');
});

test('the four picker tabs fit a phone in every language', async () => {
  const { page } = await h.open({ width: 390, height: 844 });
  await pause(page);
  const codes = await page.locator('#lang option').evaluateAll((o) => o.map((e) => (e as HTMLOptionElement).value));
  assert.equal(codes.length, 9);
  for (const code of codes) {
    await page.selectOption('#lang', code);
    await page.locator('.topbar-actions .btn-primary').click();
    await page.locator('.tabs').waitFor();
    const [scroll, client] = await page.locator('.tabs').evaluate((e) => [e.scrollWidth, e.clientWidth]);
    assert.ok(scroll <= client, `${code}: the tabs are ${scroll}px wide in ${client}px`);
    await page.keyboard.press('Escape');
  }
});

test('a pasted USGS link opens that earthquake, and a wrong one says what is wrong', async () => {
  const { page } = await h.open();
  await page.getByRole('button', { name: 'Choose a quake' }).click();
  await page.getByRole('tab', { name: 'Link', exact: true }).click();
  await page.fill('#lookup-id', 'not an event');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByText('That does not look like a USGS event link or id.').waitFor();
  await page.fill('#lookup-id', MISSING_ID);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByText('USGS has no earthquake with that id.').waitFor();
  assert.equal(await page.locator('dialog[open]').count(), 1, 'the picker stays open');
  await page.fill('#lookup-id', `https://earthquake.usgs.gov/earthquakes/eventpage/${LIVE_ID}/executive`);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.locator('dialog[open]').waitFor({ state: 'detached' });
  await page.waitForFunction((id) => location.search.includes(`event=${id}`), LIVE_ID);
  await page.locator('.quake-title', { hasText: 'Hualien' }).waitFor();
});

test('a link to a quake USGS does not have says so with no retry, and a failed load can be tried again', async () => {
  const { page } = await h.open();
  await page.goto(`${h.url}?event=${MISSING_ID}`);
  const error = page.locator('.quake-error');
  await error.waitFor();
  assert.match(await error.innerText(), /USGS has no earthquake with that id\./);
  assert.equal(await error.locator('.btn').isVisible(), false, 'a retry cannot find what is not there');
  assert.equal(await page.locator('.quake-title').innerText(), '');
  // A server error is another matter: the same link works once USGS answers again.
  const down = () => page.route('https://earthquake.usgs.gov/**', (route) => route.fulfill({ status: 503, body: 'Service Unavailable' }));
  await down();
  await page.goto(`${h.url}?event=${LIVE_ID}`);
  await error.waitFor();
  assert.match(await error.innerText(), /Could not load this quake/);
  await page.unroute('https://earthquake.usgs.gov/**');
  await error.getByRole('button', { name: 'Try again' }).click();
  await ready(page);
  assert.equal(await error.isVisible(), false);
  assert.match(await page.locator('.quake-title').innerText(), /Hualien/);
});

test('the failure message stays in view when the phone sheet is collapsed', async () => {
  const { page } = await h.open({ width: 390, height: 844 });
  await page.goto(`${h.url}?event=${MISSING_ID}`);
  await page.locator('.quake-error').waitFor();
  await page.locator('.sheet-handle').click();
  assert.equal(await page.locator('.panel').getAttribute('data-collapsed'), 'true');
  assert.equal(await page.locator('.quake-error').isVisible(), true);
  assert.match(await page.locator('.quake-error').innerText(), /USGS has no earthquake with that id\./);
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

test('after the timeline has been used, Space still plays and the arrows still step a second', async () => {
  const { page } = await h.open();
  await pause(page);
  await seek(page, 10);
  await page.locator('.scrub').focus();
  const label = () => page.locator('.play-btn').getAttribute('aria-label');
  // On its own the range steps a tenth of a second, and ignores Space.
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('.time-now').innerText(), /^T\+11/);
  await page.keyboard.press('Shift+ArrowRight');
  assert.match(await page.locator('.time-now').innerText(), /^T\+21/);
  await page.keyboard.press('Space');
  assert.equal(await label(), 'Pause');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await label(), 'Play', 'an arrow key stops the replay, as dragging the timeline does');
});

test('plus and minus zoom the map', async () => {
  const { page } = await h.open();
  await pause(page);
  // Far from the middle of the map, where a zoom moves a point the most.
  await page.mouse.click(1200, 250);
  await page.locator('.pin').waitFor();
  const at = async () => {
    const box = (await page.locator('.pin').boundingBox())!;
    return [box.x, box.y] as [number, number];
  };
  // A zoom is an animation, and the second key has to find the map at rest: zooming out from halfway through the
  // zoom in would end somewhere else than where it began.
  const settle = () =>
    page.evaluate(
      () =>
        new Promise<void>((done) => {
          let last = '';
          let still = 0;
          const check = () => {
            const r = document.querySelector('.pin')!.getBoundingClientRect();
            const here = `${r.x.toFixed(1)},${r.y.toFixed(1)}`;
            still = here === last ? still + 1 : 0;
            last = here;
            if (still >= 10) done();
            else requestAnimationFrame(check);
          };
          check();
        }),
    );
  const start = await at();
  await page.keyboard.press('+');
  await page.waitForFunction(([x, y]) => {
    const r = document.querySelector('.pin')!.getBoundingClientRect();
    return Math.hypot(r.x - x!, r.y - y!) > 60;
  }, start);
  await settle();
  await page.keyboard.press('-');
  await page.waitForFunction(([x, y]) => {
    const r = document.querySelector('.pin')!.getBoundingClientRect();
    return Math.hypot(r.x - x!, r.y - y!) < 5;
  }, start);
});

test('with reduced motion the map jumps to a new quake, and without it the map flies', async () => {
  const positions = async (reducedMotion: 'reduce' | 'no-preference') => {
    await h.closeContexts();
    const { page } = await h.open({ reducedMotion });
    await pause(page);
    await page.mouse.click(900, 400);
    await page.locator('.pin').waitFor();
    await page.getByRole('button', { name: 'Choose a quake' }).click();
    await page.locator('.quake-row', { hasText: '2022 Chishang, Taiwan' }).click();
    // The flight starts once the quake's file has arrived and lasts about a second, so on a slow machine look for longer.
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const box = (await page.locator('.pin').boundingBox())!;
      seen.add(`${Math.round(box.x)},${Math.round(box.y)}`);
      await page.waitForTimeout(50);
    }
    return seen.size;
  };
  assert.ok((await positions('no-preference')) >= 4, 'the control: the map does fly when motion is allowed');
  assert.ok((await positions('reduce')) <= 3, 'it only jumps');
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

test('the seismogram strip is in the dock on a phone too, inside the screen and clear of the sheet', async () => {
  const { page } = await h.open({ width: 390, height: 844 });
  await pause(page);
  const strip = page.locator('canvas.strip');
  await strip.waitFor();
  const [s, dock, sheet] = await Promise.all(['canvas.strip', '.dock', '.panel'].map((sel) => page.locator(sel).boundingBox()));
  assert.ok(s!.x >= 0 && s!.x + s!.width <= 390, JSON.stringify(s));
  assert.ok(s!.y >= dock!.y && s!.y + s!.height <= dock!.y + dock!.height, 'the strip sits inside the dock');
  assert.ok(sheet!.y + sheet!.height <= dock!.y + 1, 'the sheet ends where the dock starts');
  assert.ok(dock!.y + dock!.height <= 844, 'the dock is on screen');
  const ink = await strip.evaluate((c: HTMLCanvasElement) =>
    c
      .getContext('2d')!
      .getImageData(0, 0, c.width, c.height)
      .data.some((v, i) => i % 4 === 3 && v > 0),
  );
  assert.ok(ink, 'something is drawn');
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

test('the check card lists a sample of the stations as a table, with the analyst pick next to the model, in the language of the page', async () => {
  const { page } = await h.open();
  await pause(page);
  await page.locator('.check-card summary').click();
  const { rows, total } = stationSample(hualien, 10);
  const table = page.locator('table.stations');
  assert.equal(
    await table.locator('caption').innerText(),
    `10 of the ${total} stations, nearest to farthest (P arrival, seconds after the origin)`,
  );
  assert.deepEqual(await table.locator('thead th').allInnerTexts(), ['Station', 'Distance', 'Picked', 'Model', 'Difference']);
  assert.equal(await table.locator('tbody tr').count(), 10);
  const first = await table.locator('tbody tr').first().locator('th, td').allInnerTexts();
  assert.deepEqual(first.slice(0, 1), [rows[0]!.sta]);
  assert.equal(first[2], `${rows[0]!.picked.toFixed(1)} s`);
  assert.equal(first[3], `${rows[0]!.model.toFixed(1)} s`);
  const diff = rows[0]!.picked - rows[0]!.model;
  assert.equal(first[4], `${diff > 0.05 ? '+' : ''}${diff.toFixed(1)} s`);
  await page.locator('.select').selectOption('de');
  assert.deepEqual(await table.locator('thead th').allInnerTexts(), ['Station', 'Entfernung', 'Gepickt', 'Modell', 'Differenz']);
});

test('the station table follows the quake: a new quake brings its own stations, and none are left while it loads', async () => {
  const { page } = await h.open();
  await pause(page);
  await page.locator('.check-card summary').click();
  const caption = page.locator('table.stations caption');
  const tohoku = decodeQuake(readFileSync(new URL('../public/events/official20110311054624120_30.json', import.meta.url), 'utf8'));
  const [first, second] = [stationSample(hualien, 10), stationSample(tohoku, 10)];
  assert.notEqual(first.total, second.total);
  assert.match(await caption.innerText(), new RegExp(`^10 of the ${first.total} stations`));
  await page.getByRole('button', { name: 'Choose a quake' }).click();
  await page.locator('.quake-row', { hasText: '2011 Tohoku, Japan' }).click();
  await page.locator('.quake-title', { hasText: '2011 Tohoku, Japan' }).waitFor();
  await page.locator('.stations-wrap').waitFor({ state: 'visible' });
  assert.match(await caption.innerText(), new RegExp(`^10 of the ${second.total} stations`));
  assert.equal(await page.locator('table.stations tbody th').first().innerText(), second.rows[0]!.sta);
});

test('on a small phone the station table scrolls sideways inside the card, and the arrow keys scroll it instead of stepping the clock', async () => {
  const { page } = await h.open({ width: 320, height: 640 });
  await pause(page);
  await page.locator('.check-card summary').click();
  const wrap = page.locator('.stations-wrap');
  await wrap.scrollIntoViewIfNeeded();
  const sizes = await wrap.evaluate((el) => ({
    scroll: el.scrollWidth,
    client: el.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  assert.ok(sizes.scroll > sizes.client, `the table needs ${sizes.scroll} px in a card ${sizes.client} px wide`);
  assert.ok(sizes.page <= 320, `the page is ${sizes.page} px wide`);
  assert.equal(await wrap.getAttribute('role'), 'region');
  assert.match((await page.locator('#stations-caption').innerText()) ?? '', /^10 of the \d+ stations/);
  await wrap.focus();
  const before = await page.locator('.time-now').innerText();
  await page.keyboard.press('ArrowRight');
  // The browser scrolls with a short animation.
  await page.waitForFunction(() => document.querySelector('.stations-wrap')!.scrollLeft > 0);
  assert.equal(await page.locator('.time-now').innerText(), before);
});

test('watching the waves reach the pin does not read out the seconds it skips', async () => {
  const { page } = await h.open();
  await pause(page);
  await page.locator('.chip', { hasText: /^Taipei$/ }).click();
  // The jump from just before 10 s to 15 s passes the alert at 14 s, which a viewer who skipped there has not waited for.
  await page.locator('#alert-range').fill('14');
  await seek(page, 9);
  await page.locator('.play-btn').click();
  await page.locator('.pin-watch').click();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#announcer').innerText(), '');
  assert.equal(await page.locator('.play-btn').getAttribute('aria-label'), 'Pause');
  // From there the replay runs on, and the P wave is read out when it arrives.
  await page.waitForFunction(() => document.querySelector('#announcer')!.textContent!.startsWith('P wave at your place.'));
});

test('opening the check card scrolls it into view with a jump for a viewer who asked for less motion, and smoothly for the rest', async () => {
  const script = () => {
    const real = Element.prototype.scrollIntoView;
    const seen: unknown[] = ((window as unknown as { scrolled: unknown[] }).scrolled = []);
    Element.prototype.scrollIntoView = function (this: Element, arg?: boolean | ScrollIntoViewOptions) {
      seen.push(typeof arg === 'object' ? arg.behavior : null);
      return real.call(this, arg as ScrollIntoViewOptions);
    };
  };
  for (const [reducedMotion, expected] of [
    ['reduce', 'auto'],
    ['no-preference', 'smooth'],
  ] as const) {
    await h.closeContexts();
    const { page } = await h.open({ reducedMotion, script });
    await page.locator('.check-card > summary').click();
    await page.waitForFunction(() => (window as unknown as { scrolled: unknown[] }).scrolled.length > 0);
    const seen = await page.evaluate(() => (window as unknown as { scrolled: unknown[] }).scrolled);
    assert.deepEqual(seen, [expected], reducedMotion);
  }
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

test('on a phone a card goes to the system share sheet, and closing the sheet saves nothing', async () => {
  let downloads = 0;
  const { page } = await h.open({
    width: 390,
    height: 844,
    script: () => {
      const w = window as unknown as { __shared: string[][]; __mode: string };
      w.__shared = [];
      w.__mode = 'share';
      navigator.canShare = () => true;
      navigator.share = async (data) => {
        if (w.__mode === 'cancel') throw new DOMException('closed', 'AbortError');
        w.__shared.push((data?.files ?? []).map((f) => `${f.name} ${f.type} ${f.size > 1000}`));
      };
    },
  });
  page.on('download', () => downloads++);
  await pause(page);
  assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true, 'the page is a touch device');
  await page.getByRole('button', { name: 'Share this replay' }).click();
  await page.getByRole('button', { name: 'Save square card' }).click();
  await page.waitForFunction(() => (window as unknown as { __shared: unknown[] }).__shared.length === 1);
  assert.deepEqual(await page.evaluate(() => (window as unknown as { __shared: string[][] }).__shared), [
    ['rumbleback-square.png image/png true'],
  ]);
  await page.evaluate(() => ((window as unknown as { __mode: string }).__mode = 'cancel'));
  await page.getByRole('button', { name: 'Save story card' }).click();
  await page.waitForTimeout(800);
  assert.equal(downloads, 0, 'a sheet that was used or closed leaves no download behind');
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
  if (download.suggestedFilename().endsWith('.mp4')) assert.equal(bytes.subarray(4, 8).toString('latin1'), 'ftyp');
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

test('on a phone a new pin scrolls the sheet to its numbers, and removing it scrolls back to the quake', async () => {
  const { page } = await h.open({ width: 390, height: 844 });
  await pause(page);
  const inSheet = (selector: string) =>
    page.evaluate((sel) => {
      const sheet = document.querySelector('.panel')!.getBoundingClientRect();
      const r = document.querySelector(sel)!.getBoundingClientRect();
      return r.height > 0 && r.top >= sheet.top - 1 && r.bottom <= sheet.bottom + 1;
    }, selector);
  assert.equal(await inSheet('.quake-title'), true);
  await page.touchscreen.tap(200, 250);
  await page.locator('.pin-live').waitFor();
  await page.waitForFunction(() => document.querySelector('.panel')!.scrollTop > 0);
  await page.waitForTimeout(700);
  for (const selector of ['.pin-card .card-title', '.stat.p', '.stat.s']) {
    assert.equal(await inSheet(selector), true, `${selector} is inside the sheet once the pin is placed`);
  }
  await page.locator('.pin-card .icon-btn').first().click();
  await page.waitForFunction(() => document.querySelector('.panel')!.scrollTop === 0);
  assert.equal(await inSheet('.quake-title'), true);
});

test('a screen reader hears the P wave, the S wave and the alert reach the pin, and nothing when the viewer jumps around', async () => {
  const { page } = await h.open();
  await pause(page);
  await page.locator('.chip', { hasText: /^Taipei$/ }).click();
  await page.locator('.pin').waitFor();
  const region = page.locator('#announcer');
  assert.equal(await region.getAttribute('aria-live'), 'polite');
  const say = () => region.innerText();
  const playFrom = async (t: number) => {
    await seek(page, t);
    await page.locator('.play-btn').click();
  };
  // Jumping across both arrivals, paused, says nothing.
  await seek(page, 40);
  await seek(page, 5);
  await page.waitForTimeout(300);
  assert.equal(await say(), '');
  await playFrom(8);
  await page.waitForFunction(() => document.querySelector('#announcer')!.textContent!.startsWith('The alert goes out now.'));
  assert.match(await say(), /You would have had 2\d s before the S wave\.$/);
  await pause(page);
  await playFrom(18);
  await page.waitForFunction(() => document.querySelector('#announcer')!.textContent!.startsWith('P wave at your place.'));
  assert.match(await say(), /^P wave at your place\. S wave in 1\d s\.$/);
  await pause(page);
  await playFrom(33);
  await page.waitForFunction(() => document.querySelector('#announcer')!.textContent!.startsWith('S wave at your place.'));
  assert.match(await say(), /^S wave at your place\. Shaking here: Strong, MMI 5\.9\.$/);
  // The same sentence is read again on the next run.
  await pause(page);
  await seek(page, 5);
  await playFrom(8);
  await page.waitForFunction(() => document.querySelector('#announcer')!.textContent!.startsWith('The alert goes out now.'));
});

test('a phone held sideways keeps the map: the panel stays at the side, the timeline is one row and the pin shows its numbers', async () => {
  for (const [width, height] of [
    [844, 390],
    [667, 375],
  ] as const) {
    const { page } = await h.open({ width, height });
    await pause(page);
    const rect = (selector: string) => page.locator(selector).first().boundingBox();
    const where = `at ${width} by ${height}`;
    const [dock, panel] = [(await rect('.dock'))!, (await rect('.panel'))!];
    assert.ok(dock.height <= 64, `the timeline is one row ${where}: ${dock.height}`);
    assert.equal(await page.locator('.dock canvas').isVisible(), false, `no seismogram strip ${where}`);
    assert.ok(dock.x + dock.width <= width && panel.x + panel.width <= width, `nothing leaves the screen ${where}`);
    assert.ok(panel.x + panel.width <= dock.x || panel.y + panel.height <= dock.y, `the panel and the timeline do not overlap ${where}`);
    // The chips are one row, which scrolls, so they do not cover a third of the map.
    const tops = await page
      .locator('.layers-strip .chip')
      .evaluateAll((chips) => chips.map((c) => Math.round(c.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size, 1, `one row of chips ${where}: ${tops}`);
    const chipsBottom = (await rect('.layers-strip'))!.y + (await rect('.layers-strip'))!.height;
    // What is left for the map: to the right of the panel, below the chips and above the timeline.
    const [free, high] = [width - (panel.x + panel.width), dock.y - chipsBottom];
    assert.ok(free >= 330 && high >= 190, `the map keeps ${free} by ${high} pixels ${where}`);
    // A pin scrolls the panel to its numbers, as it does on an upright phone.
    await page.mouse.click(panel.x + panel.width + free / 2, 150);
    await page.locator('.pin-live').waitFor();
    await page.waitForFunction(() => document.querySelector('.panel')!.scrollTop > 0);
    await page.waitForTimeout(700);
    const [stat, sheet] = [(await rect('.stat.p'))!, (await rect('.panel'))!];
    assert.ok(stat.y >= sheet.y && stat.y + stat.height <= sheet.y + sheet.height, `the P wave number is in view ${where}`);
    // The dialogs fit, and the share one gives up its preview for the buttons.
    await page.getByRole('button', { name: 'Share this replay' }).click();
    const [dialog, copy] = [(await rect('dialog[open]'))!, (await rect('dialog[open] .btn-primary'))!];
    assert.ok(dialog.y >= 0 && dialog.y + dialog.height <= height, `the share dialog fits ${where}`);
    assert.ok(copy.y >= dialog.y && copy.y + copy.height <= dialog.y + dialog.height, `the buttons are in the dialog ${where}`);
    assert.equal(await page.locator('.share-preview').isVisible(), false);
  }
});

test('a phone held upright keeps its layout when a keyboard shrinks the screen, and a sideways one does not get it', async () => {
  const upright = await h.open({ width: 390, height: 330 });
  await pause(upright.page);
  assert.equal(await upright.page.locator('.sheet-handle').isVisible(), true, 'still a sheet');
  const dock = (await upright.page.locator('.dock').boundingBox())!;
  assert.ok(dock.x < 12 && dock.width > 360, `the timeline still spans the screen: ${dock.x} ${dock.width}`);
  const sideways = await h.open({ width: 740, height: 360 });
  await pause(sideways.page);
  assert.equal(await sideways.page.locator('.sheet-handle').isVisible(), false, 'no sheet');
  const side = (await sideways.page.locator('.panel').boundingBox())!;
  assert.ok(side.x + side.width < 330, `the panel stays at the side: ${side.width}`);
});

test('every window shape gets exactly one of the phone layout and the sideways layout, also at the edge between them', async () => {
  // [width, height, the layout]. 17 to 10 is the edge: it is sideways, and a hair under it is upright.
  const windows = [
    [680, 400, 'sideways'],
    [679, 400, 'upright'],
    [816, 480, 'sideways'],
    [815, 480, 'upright'],
    [821, 480, 'sideways'],
    [820, 481, 'upright'],
    [390, 330, 'upright'],
  ] as const;
  for (const [width, height, layout] of windows) {
    await h.closeContexts();
    const { page } = await h.open({ width, height });
    await pause(page);
    const [dock, panel] = [(await page.locator('.dock').boundingBox())!, (await page.locator('.panel').boundingBox())!];
    const sheet = await page.locator('.sheet-handle').isVisible();
    const where = `${width} by ${height}`;
    assert.equal(sheet, layout === 'upright', `${where} is ${layout}`);
    if (layout === 'upright') assert.ok(dock.x < 12 && panel.x + panel.width > width - 12, `a sheet and a full width timeline at ${where}`);
    else
      assert.ok(
        panel.width < 330 && dock.height <= 64 && panel.x + panel.width <= width,
        `a side panel and a one row timeline at ${where}`,
      );
  }
});

test('the controls keep clear of a notch and a home indicator', async () => {
  const insets = { top: 47, right: 44, bottom: 34, left: 44 };
  for (const [width, height] of [
    [390, 844],
    [1280, 800],
  ] as const) {
    const { page } = await h.open({ width, height });
    await pause(page);
    await page.evaluate((inset) => {
      for (const [side, px] of Object.entries(inset)) document.documentElement.style.setProperty(`--sa${side[0]}`, `${px}px`);
    }, insets);
    const box = (selector: string) => page.locator(selector).first().boundingBox();
    const [topbar, dock, panel] = [await box('.topbar > *'), await box('.dock'), await box('.panel')];
    const where = `at ${width} px wide`;
    assert.ok(topbar!.y >= insets.top, `the top bar starts under the notch ${where}: ${topbar!.y}`);
    assert.ok(topbar!.x >= insets.left, `the logo starts under the notch edge ${where}: ${topbar!.x}`);
    const chips = (await box('.layers-strip'))!;
    assert.ok(chips.y >= insets.top && chips.x >= insets.left, `the chips start under the notch ${where}: ${chips.x},${chips.y}`);
    assert.ok(dock!.y + dock!.height <= height - insets.bottom, `the timeline sits on the home indicator ${where}`);
    assert.ok(dock!.x + dock!.width <= width - insets.right, `the timeline reaches under the notch edge ${where}`);
    assert.ok(panel!.x >= insets.left, `the panel starts under the notch edge ${where}: ${panel!.x}`);
    assert.ok(panel!.y + panel!.height <= dock!.y, `the panel sits on the timeline ${where}`);
  }
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

for (const colorScheme of ['dark', 'light'] as const)
  test(
    `axe finds no accessibility violations in the ${colorScheme} theme: desktop and phone, with a pin and in every dialog`,
    { timeout: 300000 },
    async () => {
      type Axe = {
        run(
          root: Document,
          options: object,
        ): Promise<{ violations: { id: string; nodes: { target: string[]; failureSummary?: string }[] }[] }>;
      };
      for (const [width, height] of [
        [1440, 900],
        [390, 844],
      ] as const) {
        await h.closeContexts();
        const { page } = await h.open({ width, height, colorScheme, tileJson: true });
        await pause(page);
        const scan = async (what: string) => {
          // Dialogs and cards fade in, and a scan in the middle of that measures colours that are not final.
          // A slow machine takes longer over it, so wait for the animations and transitions themselves.
          await page.waitForTimeout(200);
          await page.evaluate(() =>
            Promise.all(
              document
                .getAnimations()
                .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime))
                .map((a) => a.finished.catch(() => {})),
            ),
          );
          await page.waitForTimeout(100);
          await page.evaluate(axeSource);
          const found = await page.evaluate(async () => {
            const r = await (window as unknown as { axe: Axe }).axe.run(document, { resultTypes: ['violations'] });
            return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
          });
          assert.deepEqual(found, [], `${colorScheme} ${width}x${height} ${what}`);
        };
        await page.fill('#city-search', 'tok');
        await page.locator('.result').first().waitFor();
        await scan('the city list');
        await page.fill('#city-search', 'zzzzzz');
        await page.locator('.result.none').waitFor();
        await scan('the city list with no match');
        await page.fill('#city-search', '');
        await page.locator('.chip', { hasText: 'Taichung' }).click();
        await page.locator('.pin-live').waitFor({ state: 'visible' });
        await page.locator('.check-card summary').click();
        await scan('with a pin');
        await page.getByRole('button', { name: 'Choose a quake' }).click();
        for (const tab of ['Featured', 'Recent', 'Search', 'Link']) {
          await page.getByRole('tab', { name: tab, exact: true }).click();
          await scan(`picker, ${tab}`);
        }
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Share this replay' }).click();
        await scan('share');
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'How it works' }).click();
        await scan('how it works');
      }
    },
  );
