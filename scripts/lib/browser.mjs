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
