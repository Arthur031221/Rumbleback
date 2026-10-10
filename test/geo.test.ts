import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bearingDeg, destination, distanceDeg, distanceKm, KM_PER_DEGREE, ring, wrapLon } from '../src/core/geo.ts';

test('a degree of arc is 111.19 km', () => {
  assert.ok(Math.abs(KM_PER_DEGREE - 111.195) < 0.01);
});

test('Taipei to Hualien City is about 120 km', () => {
  const km = distanceKm([25.033, 121.5654], [23.9739, 121.6044]);
  assert.ok(Math.abs(km - 117.8) < 1, `got ${km}`);
});

test('distance and destination are inverses', () => {
  const from: [number, number] = [23.8356, 121.5976];
  for (const brg of [0, 45, 90, 181, 270, 333]) {
    for (const arc of [0.3, 4, 37, 120]) {
      const to = destination(from, brg, arc);
      assert.ok(Math.abs(distanceDeg(from, to) - arc) < 1e-9, `${brg} ${arc}`);
      if (arc < 90) assert.ok(Math.abs(((bearingDeg(from, to) - brg + 540) % 360) - 180) < 1e-6);
    }
  }
});

test('longitudes wrap', () => {
  assert.equal(wrapLon(190), -170);
  assert.equal(wrapLon(-190), 170);
  assert.equal(wrapLon(180), -180);
});

test('a ring across the antimeridian stays continuous', () => {
  const pts = ring([0, 179], 5, 96);
  for (let i = 1; i < pts.length; i++) assert.ok(Math.abs(pts[i]![0] - pts[i - 1]![0]) < 5);
  assert.ok(pts.some(([lon]) => lon > 180));
  assert.deepEqual(
    pts[0]!.map((v) => Math.round(v * 1e6)),
    pts.at(-1)!.map((v) => Math.round(v * 1e6)),
  );
});
