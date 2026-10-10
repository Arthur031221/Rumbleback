import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bearingDeg, destination, distanceDeg, distanceKm, KM_PER_DEGREE, ring, wrapLon } from '../src/core/geo.ts';
import { nearestPoint } from '../src/core/hit.ts';

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

test('nearestPoint finds the closest point within the radius, among the points that count', () => {
  const xy = Float32Array.from([10, 10, 30, 10, 31, 10, 100, 100]);
  const near = (x: number, counts: (i: number) => boolean = () => true) => nearestPoint(xy, x, 10, 8, counts);
  assert.equal(near(12), 0);
  assert.equal(near(30.4), 1);
  assert.equal(near(30.6), 2);
  // A point that does not count (not lit yet) is skipped, and the next one in range is taken.
  assert.equal(
    near(30.4, (i) => i !== 1),
    2,
  );
  assert.equal(
    near(30.4, (i) => i === 3),
    -1,
  );
  // The edge of the radius counts and a pixel beyond it does not.
  assert.equal(near(18), 0);
  assert.equal(
    near(18.5, (i) => i === 0),
    -1,
  );
  // Of two points the same distance away, the later one is drawn on top, so it is the one that answers.
  assert.equal(
    nearestPoint(Float32Array.from([0, 0, 4, 0]), 2, 0, 5, () => true),
    1,
  );
  assert.equal(
    nearestPoint(Float32Array.from([2, 0, 2, 0]), 2, 0, 5, () => true),
    1,
  );
  assert.equal(
    nearestPoint(Float32Array.from([2, 0, 2, 0]), 2, 0, 5, (i) => i === 0),
    0,
  );
  assert.equal(
    nearestPoint(new Float32Array(0), 0, 0, 5, () => true),
    -1,
  );
});
