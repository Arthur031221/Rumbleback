import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodeQuake } from '../src/core/codec.ts';
import { pickResiduals, summarize } from '../src/core/residuals.ts';
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
