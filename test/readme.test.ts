import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodeQuake } from '../src/core/codec.ts';
import { distanceDeg } from '../src/core/geo.ts';
import { TravelTimes } from '../src/core/traveltime.ts';
import { gridMmiAt } from '../src/core/usgs.ts';
import { FEATURED } from '../src/data/featured.ts';
import { parseLink } from '../src/core/link.ts';

const root = new URL('../', import.meta.url);
const readmes = readdirSync(root).filter((f) => /^README(\.[\w-]+)?\.md$/.test(f));
const SITE = 'https://arthur031221.github.io/Rumbleback/';

/** The table rows of "Pick a story": the link, then the numbers the page shows for that pin. */
function stories(text: string) {
  return text
    .split('\n')
    .filter((line) => line.startsWith('|') && line.includes(`${SITE}?event=`))
    .map((line) => {
      const cells = line.split('|').slice(1, -1);
      const href = /\]\((https:[^)\s]+)\)/.exec(cells[0]!)![1]!;
      const url = new URL(href);
      const link = parseLink(url.search, url.hash);
      const digits = (cell: string) => Number(cell.replace(/\D/g, ''));
      const decimal = Number(/MMI\s+(\d+[.,]\d)/.exec(cells[4]!)![1]!.replace(',', '.'));
      return { href, link, km: digits(cells[1]!), p: digits(cells[2]!), s: digits(cells[3]!), mmi: decimal };
    });
}

test('every README has the same story links, and each names a featured quake and a pin', () => {
  assert.ok(readmes.length >= 9, `found ${readmes.join(', ')}`);
  const english = stories(readFileSync(new URL('README.md', root), 'utf8')).map((s) => s.href);
  assert.ok(english.length >= 3);
  for (const file of readmes) {
    const rows = stories(readFileSync(new URL(file, root), 'utf8'));
    assert.deepEqual(
      rows.map((r) => r.href),
      english,
      file,
    );
    for (const r of rows) {
      assert.ok(
        FEATURED.some((f) => f.id === r.link.event),
        `${file}: ${r.href} is not a featured quake`,
      );
      assert.ok(r.link.pin, `${file}: ${r.href} has no pin`);
    }
  }
});

test('the seconds, distance and shaking beside each story link are what the page shows for that pin', () => {
  for (const file of readmes) {
    for (const r of stories(readFileSync(new URL(file, root), 'utf8'))) {
      const d = decodeQuake(readFileSync(new URL(`public/events/${r.link.event}.json`, root), 'utf8'));
      const [lat, lon] = r.link.pin!;
      const deg = distanceDeg([d.quake.lat, d.quake.lon], [lat, lon]);
      const tt = new TravelTimes(d.quake.depthKm);
      const where = `${file} ${r.link.event}`;
      assert.equal(r.p, Math.round(tt.time('P', deg)), `${where} P`);
      assert.equal(r.s, Math.round(tt.time('S', deg)), `${where} S`);
      assert.equal(r.km, Math.round(deg * 111.195), `${where} km`);
      const mmi = gridMmiAt(d.grid!, lat, lon)!;
      assert.equal(
        r.mmi,
        Number(new Intl.NumberFormat('en', { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(mmi)),
        `${where} MMI`,
      );
    }
  }
});
