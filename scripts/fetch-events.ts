// Downloads the featured earthquakes from USGS and writes them to public/events/.
//   node scripts/fetch-events.ts            all featured events
//   node scripts/fetch-events.ts us7000m9g4 one event by id
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { decodeQuake, encodeQuake } from '../src/core/codec.ts';
import { loadQuake } from '../src/core/client.ts';
import { FEATURED } from '../src/data/featured.ts';

const out = new URL('../public/events/', import.meta.url);
mkdirSync(out, { recursive: true });
const wanted = process.argv.slice(2);
const index: unknown[] = [];
for (const { id } of FEATURED.filter((e) => wanted.length === 0 || wanted.includes(e.id))) {
  const data = await loadQuake(id);
  const file = new URL(`${id}.json`, out);
  if (existsSync(file)) {
    // The loader leaves a layer empty when its download fails, so a refresh must not wipe out what a
    // good run saved. Stop on a lost layer, and keep an old seismogram when only that one is missing.
    const old = decodeQuake(readFileSync(file, 'utf8'));
    const lost = [
      data.picks.length === 0 && old.picks.length > 0 && 'picks',
      data.instruments.length === 0 && old.instruments.length > 0 && 'instruments',
      data.felt.length === 0 && old.felt.length > 0 && 'felt reports',
      !data.grid && old.grid && 'ShakeMap grid',
    ].filter(Boolean);
    if (lost.length) throw new Error(`${id}: ${lost.join(', ')} did not download this time. Nothing was written, try again.`);
    // A saved seismogram is timed and placed from the origin it was made with, so it only stays if that did not change.
    const same =
      old.quake.time === data.quake.time &&
      old.quake.lat === data.quake.lat &&
      old.quake.lon === data.quake.lon &&
      old.quake.depthKm === data.quake.depthKm;
    if (same) data.seismogram ??= old.seismogram;
  }
  writeFileSync(file, encodeQuake(data) + '\n');
  const { quake, picks, instruments, felt, grid } = data;
  index.push(quake);
  console.log(
    `${id} M${quake.mag} ${quake.place}: ${picks.length} picks, ${instruments.length} instruments, ${felt.length} felt, grid ${grid ? `${grid.cols}x${grid.rows}` : 'none'}`,
  );
}
if (wanted.length === 0) writeFileSync(new URL('index.json', out), JSON.stringify(index) + '\n');
