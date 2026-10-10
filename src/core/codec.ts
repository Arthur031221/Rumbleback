import type { IntensityGrid, QuakeData } from './quake.ts';

interface SavedGrid extends Omit<IntensityGrid, 'mmi'> {
  mmi: string;
}
type Saved = Omit<QuakeData, 'grid'> & { grid: SavedGrid | null };

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** A compact JSON form of a loaded event, used for the featured events shipped with the app. */
export function encodeQuake(d: QuakeData): string {
  const saved: Saved = {
    quake: d.quake,
    picks: d.picks.map((p) => ({ ...p, lat: round(p.lat, 3), lon: round(p.lon, 3), dist: round(p.dist, 3), t: round(p.t, 2) })),
    instruments: d.instruments.map((i) => ({ ...i, lat: round(i.lat, 4), lon: round(i.lon, 4) })),
    felt: d.felt.map((r) => ({ ...r, lat: round(r.lat, 3), lon: round(r.lon, 3) })),
    grid: d.grid && { ...d.grid, mmi: toBase64(d.grid.mmi) },
    seismogram: d.seismogram,
  };
  return JSON.stringify(saved);
}

export function decodeQuake(text: string): QuakeData {
  const s = JSON.parse(text) as Saved;
  const grid = s.grid && { ...s.grid, mmi: Uint8Array.from(atob(s.grid.mmi), (c) => c.charCodeAt(0)) };
  return { ...s, grid, seismogram: s.seismogram ?? null };
}
