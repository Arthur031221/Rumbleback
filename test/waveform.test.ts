import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Pick, QuakeSummary } from '../src/core/quake.ts';
import { candidates, condense, loadSeismogram, parseGeoCsv } from '../src/core/waveform.ts';

const sample = readFileSync(new URL('./fixtures/geocsv-sample.csv', import.meta.url), 'utf8');
const origin = Date.parse('2024-04-02T23:58:12.173Z');

const quake: QuakeSummary = {
  id: 'us7000m9g4',
  place: '',
  mag: 7.4,
  magType: 'mww',
  time: origin,
  lat: 23.8356,
  lon: 121.5976,
  depthKm: 40,
};
const pick = (sta: string, dist: number, cha = 'BHZ', loc = '00'): Pick => ({
  sta,
  phase: 'P',
  wave: 'P',
  lat: 0,
  lon: 0,
  dist,
  t: 0,
  cha,
  loc,
});

test('GeoCSV from EarthScope: station, rate, start and samples', () => {
  const trace = parseGeoCsv(sample)!;
  assert.equal(trace.sid, 'IU_TATO_10_BHZ');
  assert.equal(trace.rate, 40);
  assert.equal(trace.values.length, 1200);
  assert.equal(new Date(trace.startMs).toISOString(), '2024-04-02T23:58:00.019Z');
  assert.ok(Math.abs(trace.lat - 24.9735) < 1e-6 && Math.abs(trace.lon - 121.4971) < 1e-6);
  assert.equal(trace.values[0], 125197);
});

test('a response with a gap keeps its longest block', () => {
  const block = (start: string, n: number) =>
    `# dataset: GeoCSV 2.0\n# SID: XX_AAA_00_BHZ\n# sample_rate_hz: 10\n# start_time: ${start}\n# latitude_deg: 1\n# longitude_deg: 2\nTime, Sample\n` +
    Array.from({ length: n }, (_, i) => `2024-01-01T00:00:00.000Z, ${i}`).join('\n') +
    '\n';
  const trace = parseGeoCsv(block('2024-01-01T00:00:00Z', 30) + block('2024-01-01T00:05:00Z', 80))!;
  assert.equal(trace.values.length, 80);
  assert.equal(new Date(trace.startMs).toISOString(), '2024-01-01T00:05:00.000Z');
});

test('things that are not GeoCSV give nothing', () => {
  assert.equal(parseGeoCsv(''), null);
  assert.equal(parseGeoCsv('Error 204: no data'), null);
  assert.equal(parseGeoCsv('# SID: A\nTime, Sample\n2024-01-01T00:00:00Z, 5\n'), null);
});

test('condense removes the pre-event mean, bins by quarter second and scales to 1000', () => {
  const c = condense(parseGeoCsv(sample)!, origin);
  assert.equal(c.bin, 0.25);
  assert.equal(c.min.length, 120);
  assert.ok(Math.abs(c.t0 - -12.154) < 0.01, `t0 ${c.t0}`);
  assert.equal(Math.max(...c.max.map(Math.abs), ...c.min.map(Math.abs)), 1000);
  assert.ok(c.min.every((v, i) => v <= c.max[i]!));
});

test('condense of a constant trace is flat, not NaN', () => {
  const flat = condense({ sid: '', lat: 0, lon: 0, startMs: origin - 20000, rate: 10, values: new Array(400).fill(7) }, origin);
  assert.ok(flat.min.every((v) => v === 0) && flat.max.every((v) => v === 0));
});

test('stations to try: vertical channels, broadband first, nearest first, one per station', () => {
  const picks = [
    pick('A.FAR', 11.5),
    pick('B.NEAR', 1.2),
    pick('B.NEAR', 1.2, 'BHZ', '10'),
    pick('C.SHORT', 0.5, 'EHZ'),
    pick('D.HORIZ', 0.6, 'BHN'),
    pick('E.TOOFAR', 90),
    pick('F.TOOCLOSE', 0.05),
    pick('G.LONGPERIOD', 2, 'LHZ'),
    pick('H.EDGE', 14),
  ];
  assert.deepEqual(
    candidates(picks).map((p) => p.sta),
    ['B.NEAR', 'A.FAR', 'C.SHORT'],
  );
  assert.equal(candidates(picks, 1).length, 1);
});

/** A response that starts at `from` seconds after the origin and lasts `seconds`, at 10 samples per second. */
function response(from: number, seconds: number): string {
  const start = new Date(origin + from * 1000).toISOString();
  const n = seconds * 10;
  return (
    `# SID: IU_TATO_10_BHZ\n# sample_rate_hz: 10\n# start_time: ${start}\n# latitude_deg: 24.97\n# longitude_deg: 121.49\nTime, Sample\n` +
    Array.from({ length: n }, (_, i) => `${start}, ${Math.round(100 * Math.sin(i / 7))}`).join('\n') +
    '\n'
  );
}

test('loadSeismogram skips stations without data and condenses the first one that has some', async () => {
  const asked: string[] = [];
  const f = (async (input: RequestInfo | URL) => {
    const u = new URL(String(input));
    asked.push(`${u.searchParams.get('net')}.${u.searchParams.get('sta')}`);
    if (u.searchParams.get('sta') === 'TATO') return new Response(response(-15, 200), { status: 200 });
    return new Response('no data', { status: 204 });
  }) as typeof fetch;
  const s = await loadSeismogram(quake, [pick('TW.KMNB', 1.1), pick('IU.TATO', 1.14, 'BHZ', '10'), pick('II.FAR', 8)], f);
  assert.deepEqual(asked, ['TW.KMNB', 'IU.TATO']);
  assert.equal(s?.sta, 'IU.TATO');
  assert.equal(s?.cha, 'BHZ');
  assert.equal(s?.dist, 1.14);
  assert.ok(s!.min.length > 100);
});

test('a trace that misses the P wave or stops early is skipped', async () => {
  const late = (async () => new Response(response(60, 200), { status: 200 })) as typeof fetch;
  assert.equal(await loadSeismogram(quake, [pick('IU.TATO', 1.14)], late), null);
  const short = (async () => new Response(response(-15, 30), { status: 200 })) as typeof fetch;
  assert.equal(await loadSeismogram(quake, [pick('IU.TATO', 1.14)], short), null);
  const gap = (async () => new Response(response(-15, 20) + response(40, 160), { status: 200 })) as typeof fetch;
  assert.equal(await loadSeismogram(quake, [pick('IU.TATO', 1.14)], gap), null);
});

test('the request covers 15 s before the origin and well past the S wave', async () => {
  let url = '';
  const f = (async (input: RequestInfo | URL) => ((url = String(input)), new Response('', { status: 204 }))) as typeof fetch;
  assert.equal(await loadSeismogram(quake, [pick('IU.TATO', 1.14, 'BHZ', '--')], f), null);
  const q = new URL(url).searchParams;
  assert.equal(q.get('starttime'), '2024-04-02T23:57:57.173');
  assert.equal(q.get('loc'), '--');
  assert.equal(q.get('format'), 'geocsv');
  const end = Date.parse(q.get('endtime') + 'Z') - origin;
  assert.ok(end >= 150000 && end <= 330000, `window ${end}`);
});

test('no stations, no seismogram, and no request', async () => {
  let calls = 0;
  const f = (async () => (calls++, new Response('', { status: 204 }))) as typeof fetch;
  assert.equal(await loadSeismogram(quake, [], f), null);
  assert.equal(calls, 0);
});

test('a slow channel gets wider bins instead of NaN', () => {
  const slow = condense(
    {
      sid: '',
      lat: 0,
      lon: 0,
      startMs: origin - 20000,
      rate: 1,
      values: Array.from({ length: 200 }, (_, i) => Math.round(100 * Math.sin(i / 3))),
    },
    origin,
  );
  assert.ok(slow.bin >= 2);
  assert.ok([...slow.min, ...slow.max].every(Number.isFinite));
  assert.equal(Math.max(...slow.max.map(Math.abs), ...slow.min.map(Math.abs)), 1000);
});
