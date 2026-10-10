import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodeQuake, encodeQuake } from '../src/core/codec.ts';
import { TravelTimes } from '../src/core/traveltime.ts';
import { FEATURED } from '../src/data/featured.ts';

const file = (id: string) => readFileSync(new URL(`../public/events/${id}.json`, import.meta.url), 'utf8');

test('every featured event decodes and has a plausible shape', () => {
  for (const { id } of FEATURED) {
    const d = decodeQuake(file(id));
    assert.equal(d.quake.id, id);
    assert.ok(d.quake.mag >= 6.5 && d.quake.depthKm >= 0, id);
    assert.ok(d.picks.length > 50, `${id} picks`);
    assert.ok(d.grid && d.grid.mmi.length === d.grid.cols * d.grid.rows, `${id} grid`);
    for (const p of d.picks) assert.ok(Number.isFinite(p.t) && p.dist >= 0 && p.dist <= 180, `${id} ${p.sta}`);
  }
});

test('encode and decode are inverses', () => {
  const original = decodeQuake(file('us7000m9g4'));
  const again = decodeQuake(encodeQuake(original));
  assert.deepEqual(again, original);
});

test('the index lists every featured event in shelf order with a summary', () => {
  const index = JSON.parse(readFileSync(new URL('../public/events/index.json', import.meta.url), 'utf8')) as { id: string; mag: number }[];
  assert.deepEqual(
    index.map((q) => q.id),
    FEATURED.map((f) => f.id),
  );
});

test('most featured events carry a real seismogram that covers the P and S arrival', () => {
  let withTrace = 0;
  for (const { id } of FEATURED) {
    const { quake, seismogram: s } = decodeQuake(file(id));
    if (!s) continue;
    withTrace++;
    const tt = new TravelTimes(quake.depthKm);
    assert.ok(s.t0 <= tt.time('P', s.dist) - 5, `${id} starts after the P wave`);
    assert.ok(s.t0 + s.min.length * s.bin >= tt.time('S', s.dist) + 45, `${id} ends too early`);
    assert.equal(s.min.length, s.max.length);
    assert.ok(
      s.min.every((v, i) => v >= -1000 && s.max[i]! <= 1000 && v <= s.max[i]!),
      id,
    );
    assert.ok(Math.max(...s.max, ...s.min.map(Math.abs)) === 1000, `${id} is not scaled`);
  }
  assert.ok(withTrace >= 9, `${withTrace} of ${FEATURED.length}`);
});
