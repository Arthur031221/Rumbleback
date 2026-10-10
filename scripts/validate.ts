// Compares the travel-time model with the real picks of every featured event.
//   node scripts/validate.ts
import { readFileSync } from 'node:fs';
import { decodeQuake } from '../src/core/codec.ts';
import { pickResiduals, summarize } from '../src/core/residuals.ts';
import { FEATURED } from '../src/data/featured.ts';

const all: number[] = [];
const rows: string[] = [];
for (const { id } of FEATURED) {
  const data = decodeQuake(readFileSync(new URL(`../public/events/${id}.json`, import.meta.url), 'utf8'));
  const { P, S } = pickResiduals(data, 95);
  all.push(...P);
  const p = summarize(P);
  const s = summarize(S);
  rows.push(
    `| ${id} | M${data.quake.mag} | ${data.quake.depthKm.toFixed(0)} | ${p?.n ?? 0} | ${p?.medianAbs.toFixed(2) ?? '-'} | ${p?.p90Abs.toFixed(2) ?? '-'} | ${s?.n ?? 0} |`,
  );
}
console.log('| event | mag | depth km | P picks | median abs s | p90 abs s | S picks |\n|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
const total = summarize(all)!;
console.log(
  `\nall P picks: n=${total.n} median ${total.median.toFixed(2)} median abs ${total.medianAbs.toFixed(2)} p90 abs ${total.p90Abs.toFixed(2)}`,
);
