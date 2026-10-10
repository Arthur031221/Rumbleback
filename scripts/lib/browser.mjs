// Shared by the media scripts: serve dist/, open the page in Chromium with software WebGL, drive the timeline.
import { chromium } from 'playwright';
import { serve } from '../serve.mjs';

const dist = new URL('../../dist/', import.meta.url).pathname;

export async function open({ width, height, theme = 'dark', query = '?event=us7000m9g4', scale = 1 }) {
  const { server, url } = await serve(dist);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: theme,
    locale: 'en-US',
    timezoneId: 'UTC',
  });
  const page = await context.newPage();
  await page.goto(url + query, { waitUntil: 'networkidle' });
  await page.locator('.quake-title:not(:empty)').waitFor();
  await pause(page);
  // Give the vector tiles a moment to draw after the network goes quiet.
  await page.waitForTimeout(2500);
  return { page, close: async () => (await browser.close(), server.close()) };
}

export async function pause(page) {
  const play = page.locator('.play-btn');
  if ((await play.getAttribute('aria-label')) === 'Pause') await play.click();
}

export async function seek(page, t) {
  await page.evaluate((v) => {
    const s = document.querySelector('.scrub');
    s.value = String(v);
    s.dispatchEvent(new Event('input', { bubbles: true }));
  }, t);
}

export async function pinCity(page, name) {
  await page.fill('#city-search', name);
  await page.locator('.result', { hasText: name }).first().click();
}

export async function setAlert(page, seconds) {
  await page.locator('#alert-range').fill(String(seconds));
}

/**
 * Where on the map a mouse opens the card of a dot whose text matches `pattern` and whose intensity (MMI) is at
 * least `minMmi`, or null. It moves a synthetic mouse over a grid in the page, so no real pointer is needed.
 */
export async function findDot(page, pattern, minMmi = 0, region = { x: [400, 1240], y: [100, 560] }) {
  return page.evaluate(
    ({ source, minMmi, region }) => {
      const map = document.querySelector('#map');
      const box = document.querySelector('.inspector');
      let found = null;
      for (let y = region.y[0]; y < region.y[1] && !found; y += 4) {
        for (let x = region.x[0]; x < region.x[1] && !found; x += 4) {
          map.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y, pointerType: 'mouse' }));
          if (!box || box.hidden || !new RegExp(source).test(box.innerText)) continue;
          const mmi = /MMI (\d+(\.\d)?)/.exec(box.innerText);
          if (!minMmi || (mmi && Number(mmi[1]) >= minMmi)) found = [x, y];
        }
      }
      map.dispatchEvent(new PointerEvent('pointerleave'));
      return found;
    },
    { source: pattern.source, minMmi, region },
  );
}
