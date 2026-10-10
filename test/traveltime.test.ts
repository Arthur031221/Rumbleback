import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TravelTimes } from '../src/core/traveltime.ts';
import { blindRadiusKm, timingAt } from '../src/core/warning.ts';

interface Reference {
  points: { depth: number; dist: number; p: number; s: number }[];
}
const reference: Reference = JSON.parse(readFileSync(new URL('./fixtures/taup-reference.json', import.meta.url), 'utf8'));

function errors(wave: 'p' | 's'): number[] {
  return reference.points.map((pt) => Math.abs(new TravelTimes(pt.depth).time(wave === 'p' ? 'P' : 'S', pt.dist) - pt[wave]));
}

const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

test('P travel times match ObsPy TauP at 600 points off the table grid', () => {
  const e = sorted(errors('p'));
  assert.ok(e[Math.floor(e.length / 2)]! < 0.05, `median ${e[Math.floor(e.length / 2)]}`);
  assert.ok(e[Math.floor(e.length * 0.99)]! < 0.5, `p99 ${e[Math.floor(e.length * 0.99)]}`);
});

test('S travel times match ObsPy TauP at 600 points off the table grid', () => {
  const e = sorted(errors('s'));
  assert.ok(e[Math.floor(e.length / 2)]! < 0.08, `median ${e[Math.floor(e.length / 2)]}`);
  assert.ok(e[Math.floor(e.length * 0.99)]! < 0.8, `p99 ${e[Math.floor(e.length * 0.99)]}`);
});

test('well known values: P at 10 degrees for a 10 km source is 143.7 s', () => {
  assert.ok(Math.abs(new TravelTimes(10).time('P', 10) - 143.69) < 0.1);
});

test('S is later than P and both grow with distance', () => {
  for (const depth of [0, 15, 40, 300]) {
    const tt = new TravelTimes(depth);
    let lastP = -1;
    let lastS = -1;
    for (let d = 0.5; d <= 180; d += 0.5) {
      const [p, s] = [tt.time('P', d), tt.time('S', d)];
      assert.ok(s > p && p >= lastP && s >= lastS, `${depth} ${d}`);
      [lastP, lastS] = [p, s];
    }
  }
});

test('distanceAt inverts time', () => {
  const tt = new TravelTimes(25);
  for (const wave of ['P', 'S'] as const) {
    for (const d of [0.4, 1.7, 5, 22, 64, 111, 150]) {
      const back = tt.distanceAt(wave, tt.time(wave, d));
      assert.ok(back !== null && Math.abs(back - d) < 0.02, `${wave} ${d} ${back}`);
    }
  }
});

test('a deep source has no wave at the surface until the vertical travel time has passed', () => {
  const tt = new TravelTimes(40);
  assert.equal(tt.distanceAt('P', 3), null);
  assert.ok(tt.distanceAt('P', tt.surfaceDelay.P + 0.5)! > 0);
  assert.ok(tt.surfaceDelay.S > tt.surfaceDelay.P);
});

test('timing at a pin and the blind zone', () => {
  const tt = new TravelTimes(15);
  const near = timingAt(tt, 0.1, 10);
  assert.ok(near.blind && near.warningSec === 0);
  const far = timingAt(tt, 3, 10);
  assert.ok(!far.blind && far.warningSec > 20 && Math.abs(far.warningSec - (far.sSec - 10)) < 1e-9);
  assert.ok(Math.abs(far.gapSec - (far.sSec - far.pSec)) < 1e-9);
  const radius = blindRadiusKm(tt, 10);
  assert.ok(radius > 20 && radius < 80, `radius ${radius}`);
  assert.equal(blindRadiusKm(new TravelTimes(40), 2), 0);
});
