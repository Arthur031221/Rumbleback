import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodeQuake } from '../src/core/codec.ts';
import { pickResiduals, stationSample, summarize } from '../src/core/residuals.ts';
import { TravelTimes } from '../src/core/traveltime.ts';
import { FEATURED } from '../src/data/featured.ts';

const load = (id: string) => decodeQuake(readFileSync(new URL(`../public/events/${id}.json`, import.meta.url), 'utf8'));

test('summaries', () => {
  assert.equal(summarize([]), null);
  const s = summarize([-3, -1, 0, 1, 2])!;
  assert.deepEqual([s.n, s.median, s.medianAbs], [5, 0, 1]);
});

test('the model agrees with the real P picks of every featured event to within 2 seconds at the median', () => {
  const all: number[] = [];
  for (const { id } of FEATURED) {
    const { P } = pickResiduals(load(id), 95);
    const s = summarize(P)!;
    assert.ok(s.n > 40, `${id} has ${s.n} picks`);
    assert.ok(s.medianAbs < 2, `${id} median abs ${s.medianAbs}`);
    all.push(...P);
  }
  const total = summarize(all)!;
  assert.ok(total.n > 3500, `n ${total.n}`);
  assert.ok(total.medianAbs < 0.8, `median abs ${total.medianAbs}`);
  assert.ok(total.p90Abs < 2.5, `p90 abs ${total.p90Abs}`);
});

test('picks beyond the distance limit are left out', () => {
  const d = load('us7000m9g4');
  assert.ok(pickResiduals(d, 95).P.length < pickResiduals(d, 180).P.length);
});

test('the station sample spreads from the nearest to the farthest, once per station, and agrees with the model', () => {
  const d = load('us7000m9g4');
  const { rows, total } = stationSample(d, 10);
  assert.equal(rows.length, 10);
  assert.equal(total, pickResiduals(d, 95).P.length);
  assert.deepEqual(
    rows.map((r) => r.distKm),
    rows.map((r) => r.distKm).sort((a, b) => a - b),
  );
  assert.equal(new Set(rows.map((r) => r.sta)).size, 10);
  const all = d.picks.filter((p) => p.wave === 'P' && p.dist <= 95).sort((a, b) => a.dist - b.dist);
  assert.equal(rows[0]!.sta, all[0]!.sta);
  assert.equal(rows.at(-1)!.sta, all.at(-1)!.sta);
  // The model column is the arrival the app draws, so a row is the same comparison as the hover card.
  const tt = new TravelTimes(d.quake.depthKm);
  for (const r of rows) {
    const p = all.find((x) => x.sta === r.sta)!;
    assert.equal(r.picked, p.t);
    assert.equal(r.model, tt.time('P', p.dist));
  }
});

test('the station sample copes with few picks and with none, and counts a station with two picks once', () => {
  const d = load('us7000m9g4');
  const p = d.picks.find((x) => x.wave === 'P')!;
  const two = { ...d, picks: [p, { ...p, t: p.t + 1 }, { ...p, sta: 'XX.TWO', dist: p.dist + 1 }] };
  assert.deepEqual(
    stationSample(two, 10).rows.map((r) => r.sta),
    [p.sta, 'XX.TWO'],
  );
  assert.equal(stationSample(two, 10).total, 2);
  assert.equal(stationSample({ ...d, picks: [p] }, 10).rows.length, 1);
  assert.deepEqual(stationSample({ ...d, picks: [] }, 10), { rows: [], total: 0 });
});
