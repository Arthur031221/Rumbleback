import { readFileSync } from 'node:fs';
import { chromium, firefox, type Browser, type BrowserContext, type Page } from 'playwright';
import { serve } from '../scripts/serve.mjs';

const dist = new URL('../dist/', import.meta.url).pathname;
export const fixture = (name: string) => readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), 'utf8');

/** The id the catalog fixtures give the Hualien quake, so the page loads it as a live quake and not from the shipped files. */
export const LIVE_ID = 'us7000live';
/** An id the catalog fixtures answer with 404, the way USGS does for an event it does not have. */
export const MISSING_ID = 'us7000none';
/** An id the catalog fixtures answer only after four seconds, for a viewer who changes their mind meanwhile. */
export const SLOW_ID = 'us7000slow';

export interface Session {
  page: Page;
  context: BrowserContext;
  /** Page errors and console errors, apart from the aborted map tiles. */
  errors: string[];
  /** Every request the page made to a host other than the one serving it, with its body and referrer. */
  external: string[];
  /** External requests the fixtures do not cover. The page should make none. */
  unexpected: string[];
  /** Every request the serving host received, the way its access log would show it. */
  served: string[];
}

export interface Harness {
  browser: Browser;
  url: string;
  close(): Promise<void>;
  /** Closes every page opened so far, so one test's map and replay loop do not slow the next. */
  closeContexts(): Promise<void>;
  open(options?: {
    width?: number;
    height?: number;
    query?: string;
    locale?: string;
    colorScheme?: 'dark' | 'light';
    geolocation?: { latitude: number; longitude: number };
    /** Serve the tile source's description, so the map shows its credit. The tiles themselves stay blocked. */
    tileJson?: boolean;
    /** Runs in the page before any of its own scripts. */
    script?: () => void;
    /** The browser's time zone. UTC unless said, so the times on the page do not depend on the machine. */
    timezone?: string;
    reducedMotion?: 'reduce' | 'no-preference';
  }): Promise<Session>;
}

/** GeoCSV for the requested window, 10 samples a second, in the shape EarthScope returns. */
function geoCsv(params: URLSearchParams): string {
  const start = Date.parse(params.get('starttime')! + 'Z');
  const end = Date.parse(params.get('endtime')! + 'Z');
  const n = Math.floor((end - start) / 100);
  const head = `# dataset: GeoCSV 2.0\n# SID: ${params.get('net')}_${params.get('sta')}_${params.get('loc')}_${params.get('cha')}\n# sample_rate_hz: 10\n# start_time: ${new Date(start).toISOString()}\n# latitude_deg: 24.97\n# longitude_deg: 121.49\nTime, Sample\n`;
  return (
    head +
    Array.from(
      { length: n },
      (_, i) => `${new Date(start + i * 100).toISOString()}, ${Math.round(400 * Math.sin(i / 5) * Math.exp(-Math.abs(i - 300) / 400))}`,
    ).join('\n') +
    '\n'
  );
}

/** Serves dist/ and opens pages whose network is replaced by fixtures. */
export async function harness(): Promise<Harness> {
  const served: string[] = [];
  const { server, url } = await serve(dist, 0, (req) => served.push(`${req.url} referer=${req.headers.referer ?? ''}`));
  const name = process.env.BROWSER === 'firefox' ? 'firefox' : 'chromium';
  const browser = await (name === 'firefox' ? firefox : chromium).launch(
    name === 'chromium' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {},
  );
  const feature = JSON.parse(fixture('event-us7000m9g4.json'));
  feature.id = LIVE_ID;
  const contexts: BrowserContext[] = [];
  return {
    browser,
    url,
    async closeContexts() {
      await Promise.all(contexts.splice(0).map((c) => c.close().catch(() => {})));
    },
    async close() {
      await browser.close();
      server.close();
    },
    async open({
      width = 1440,
      height = 900,
      query = '',
      locale = 'en-US',
      colorScheme = 'dark',
      geolocation,
      tileJson = false,
      script,
      timezone = 'UTC',
      reducedMotion = 'no-preference',
    } = {}) {
      const permissions = [...(name === 'chromium' ? ['clipboard-read', 'clipboard-write'] : []), ...(geolocation ? ['geolocation'] : [])];
      const context = await browser.newContext({
        viewport: { width, height },
        locale,
        colorScheme,
        timezoneId: timezone,
        reducedMotion,
        hasTouch: width < 600,
        permissions,
        geolocation,
      });
      contexts.push(context);
      if (script) await context.addInitScript(script);
      const page = await context.newPage();
      const errors: string[] = [];
      const external: string[] = [];
      const unexpected: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on(
        'console',
        (m) =>
          m.type() === 'error' &&
          !/Failed to load resource|net::ERR|tiles\.openfreemap|NetworkError/.test(m.text()) &&
          errors.push(m.text()),
      );
      await context.route(
        (u) => u.hostname !== '127.0.0.1',
        async (route) => {
          const request = route.request();
          const u = new URL(request.url());
          external.push(`${request.method()} ${request.url()} body=${request.postData() ?? ''} referer=${request.headers().referer ?? ''}`);
          if (tileJson && u.hostname === 'tiles.openfreemap.org' && u.pathname === '/planet')
            return route.fulfill({
              json: { tilejson: '3.0.0', tiles: ['https://tiles.openfreemap.org/planet/0/{z}/{x}/{y}.pbf'], maxzoom: 14 },
            });
          if (u.hostname === 'tiles.openfreemap.org') return route.abort();
          if (u.hostname === 'earthquake.usgs.gov' && u.pathname.endsWith('/query')) {
            if (u.searchParams.get('eventid') === MISSING_ID) return route.fulfill({ status: 404, body: 'Not Found' });
            if (u.searchParams.get('eventid') === SLOW_ID) await new Promise((r) => setTimeout(r, 4000));
            return route.fulfill({ json: u.searchParams.has('eventid') ? feature : { type: 'FeatureCollection', features: [feature] } });
          }
          if (u.hostname === 'earthquake.usgs.gov' && u.pathname.endsWith('quakeml.xml'))
            return route.fulfill({ body: fixture('phase-sample.xml'), contentType: 'application/xml' });
          if (u.hostname === 'earthquake.usgs.gov' && u.pathname.endsWith('.covjson'))
            return route.fulfill({ body: fixture('grid-sample.json'), contentType: 'application/json' });
          if (u.hostname === 'earthquake.usgs.gov' && u.pathname.endsWith('stationlist.json'))
            return route.fulfill({ body: fixture('stations-sample.json'), contentType: 'application/json' });
          if (u.hostname === 'service.earthscope.org') return route.fulfill({ body: geoCsv(u.searchParams), contentType: 'text/csv' });
          unexpected.push(request.url());
          return route.abort();
        },
      );
      await page.goto(url + query);
      await ready(page);
      return { page, context, errors, external, unexpected, served };
    },
  };
}

/** The quake card has its quake (not the loading placeholder) and the timeline is usable. */
export async function ready(page: Page): Promise<void> {
  await page.locator('.quake-card:not(.is-loading) .quake-title:not(:empty)').waitFor();
  await page.locator('.scrub:not([disabled])').waitFor();
}

export async function pause(page: Page): Promise<void> {
  const play = page.locator('.play-btn');
  if ((await play.getAttribute('aria-label')) === 'Pause') await play.click();
}

export async function seek(page: Page, t: number): Promise<void> {
  await page.evaluate((v) => {
    const s = document.querySelector<HTMLInputElement>('.scrub')!;
    s.value = String(v);
    s.dispatchEvent(new Event('input', { bubbles: true }));
  }, t);
  // The overlay is drawn on the next animation frame, so wait for two before anyone reads pixels.
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
}
