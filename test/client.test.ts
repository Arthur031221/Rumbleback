import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { HttpError, RECENT_LIMIT, isUnknownEvent, loadQuake, quakeDetail, recentQuakes, searchQuakes } from '../src/core/client.ts';
import type { QuakeData } from '../src/core/quake.ts';

const read = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const feature = JSON.parse(read('event-us7000m9g4.json'));
const urls = feature.properties.products;
const url = (kind: string, file: string) => urls[kind][0].contents[file].url as string;

const ok = (body: string) => new Response(body, { status: 200 });

function router(routes: Record<string, () => Response>, calls: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const u = String(input);
    calls.push(u);
    const key = Object.keys(routes).find((k) => u.includes(k));
    if (!key) return new Response('not found', { status: 404 });
    return routes[key]!();
  }) as typeof fetch;
}

const all = {
  'eventid=us7000m9g4': () => ok(JSON.stringify(feature)),
  'quakeml.xml': () => ok(read('phase-sample.xml')),
  coverage_mmi_low_res: () => ok(read('grid-sample.json')),
  'stationlist.json': () => ok(read('stations-sample.json')),
};

test('loadQuake fetches the summary first, then each layer, and reports progress', async () => {
  const seen: QuakeData[] = [];
  const data = await loadQuake('us7000m9g4', (d) => seen.push({ ...d, picks: [...d.picks] }), router(all));
  assert.equal(data.quake.mag, 7.4);
  assert.equal(data.picks.length, 5);
  assert.equal(data.instruments.length, 1);
  assert.ok(data.grid);
  assert.equal(seen[0]!.picks.length, 0, 'the first report is the summary alone');
  assert.ok(seen.length >= 4);
});

test('picks are put on the summary clock', async () => {
  const shifted = feature.properties.time + 1000;
  const f = { ...feature, properties: { ...feature.properties, time: shifted } };
  const data = await loadQuake('us7000m9g4', undefined, router({ ...all, 'eventid=us7000m9g4': () => ok(JSON.stringify(f)) }));
  const base = await loadQuake('us7000m9g4', undefined, router(all));
  const pn = (d: QuakeData) => d.picks.find((p) => p.phase === 'Pn')!.t;
  assert.ok(Math.abs(pn(base) - pn(data) - 1) < 1e-6);
});

test('a layer that fails leaves that layer empty and the others intact', async () => {
  const data = await loadQuake(
    'us7000m9g4',
    undefined,
    router({
      ...all,
      'stationlist.json': () => new Response('boom', { status: 500 }),
      'quakeml.xml': () => {
        throw new Error('network down');
      },
    }),
  );
  assert.equal(data.picks.length, 0);
  assert.equal(data.instruments.length, 0);
  assert.ok(data.grid);
});

test('an unknown event id is an error', async () => {
  await assert.rejects(loadQuake('nope', undefined, router({ 'eventid=nope': () => new Response('{}', { status: 404 }) })));
  await assert.rejects(
    loadQuake('nope', undefined, router({ 'eventid=nope': () => ok('{"type":"Feature","id":"nope","properties":{"mag":null}}') })),
  );
});

test('an aborted load stops with the abort error', async () => {
  const ctl = new AbortController();
  const f = (async (_: RequestInfo | URL, init?: RequestInit) => {
    ctl.abort();
    init?.signal?.throwIfAborted();
    return ok('{}');
  }) as typeof fetch;
  await assert.rejects(loadQuake('us7000m9g4', undefined, f, ctl.signal), { name: 'AbortError' });
});

test('search builds a USGS query with the box and the date range', async () => {
  const calls: string[] = [];
  const f = router({ 'fdsnws/event/1/query': () => ok(JSON.stringify({ features: [feature] })) }, calls);
  const list = await searchQuakes(
    { minMag: 6.5, start: '2024-01-01', end: '2024-12-31', box: { minLat: 21, maxLat: 26, minLon: 119, maxLon: 123 } },
    f,
  );
  assert.equal(list.length, 1);
  const q = new URL(calls[0]!).searchParams;
  assert.equal(q.get('minmagnitude'), '6.5');
  assert.equal(q.get('endtime'), '2024-12-31T23:59:59');
  assert.equal(q.get('minlatitude'), '21');
  assert.equal(q.get('orderby'), 'magnitude');
});

test('recent quakes ask for the last 30 days at magnitude 5 and up, newest first and capped', async () => {
  const calls: string[] = [];
  await recentQuakes(router({ query: () => ok('{"features":[]}') }, calls), undefined, Date.parse('2026-10-10T00:00:00Z'));
  const q = new URL(calls[0]!).searchParams;
  assert.equal(q.get('starttime'), '2026-09-10');
  assert.equal(q.get('minmagnitude'), '5');
  assert.equal(q.get('orderby'), 'time');
  assert.equal(q.get('limit'), String(RECENT_LIMIT));
});

test('recent quakes take another minimum magnitude', async () => {
  const calls: string[] = [];
  await recentQuakes(router({ query: () => ok('{"features":[]}') }, calls), undefined, Date.parse('2026-10-10T00:00:00Z'), 4.5);
  assert.equal(new URL(calls[0]!).searchParams.get('minmagnitude'), '4.5');
});

test('an answer that is not a success carries its status', async () => {
  const f = router({ 'eventid=nope': () => new Response('Not Found', { status: 404 }) });
  await assert.rejects(quakeDetail('nope', f), (e) => e instanceof HttpError && e.status === 404);
});

test('pick distances are measured to the summary epicenter', async () => {
  const moved = {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: [feature.geometry.coordinates[0] + 0.5, feature.geometry.coordinates[1], feature.geometry.coordinates[2]],
    },
  };
  const a = await loadQuake('us7000m9g4', undefined, router(all));
  const b = await loadQuake('us7000m9g4', undefined, router({ ...all, 'eventid=us7000m9g4': () => ok(JSON.stringify(moved)) }));
  const pn = (d: QuakeData) => d.picks.find((p) => p.phase === 'Pn' && p.sta === 'IU.TATO')!.dist;
  assert.ok(Math.abs(pn(a) - pn(b)) > 0.05, `${pn(a)} ${pn(b)}`);
});

test('an id USGS does not have is told apart from a USGS that cannot be reached', () => {
  const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
  assert.equal(isUnknownEvent(new HttpError(404, url)), true);
  assert.equal(isUnknownEvent(new HttpError(400, url)), true);
  assert.equal(isUnknownEvent(new Error('no earthquake with id us7000none')), true);
  assert.equal(isUnknownEvent(new HttpError(503, url)), false);
  assert.equal(isUnknownEvent(new TypeError('Failed to fetch')), false);
  assert.equal(isUnknownEvent(new DOMException('timed out', 'TimeoutError')), false);
  assert.equal(isUnknownEvent('no earthquake'), false);
});
