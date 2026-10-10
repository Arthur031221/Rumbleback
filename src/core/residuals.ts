import { KM_PER_DEGREE } from './geo.ts';
import type { QuakeData } from './quake.ts';
import { TravelTimes, type Wave } from './traveltime.ts';

export interface ResidualStats {
  n: number;
  /** Signed median of observed minus modelled, seconds. A positive value means the wave came later than the model says. */
  median: number;
  /** Median of the absolute residuals, seconds. */
  medianAbs: number;
  p90Abs: number;
}

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;

export function summarize(residuals: number[]): ResidualStats | null {
  if (residuals.length === 0) return null;
  const signed = [...residuals].sort((a, b) => a - b);
  const abs = residuals.map(Math.abs).sort((a, b) => a - b);
  return { n: residuals.length, median: quantile(signed, 0.5), medianAbs: quantile(abs, 0.5), p90Abs: quantile(abs, 0.9) };
}

/**
 * Observed arrival minus the iasp91 first arrival for every pick of an event, by wave.
 * Picks farther than `maxDist` degrees are left out of the statistics (not off the map).
 */
export function pickResiduals(data: QuakeData, maxDist = 180): Record<Wave, number[]> {
  const tt = new TravelTimes(data.quake.depthKm);
  const out: Record<Wave, number[]> = { P: [], S: [] };
  for (const p of data.picks) if (p.dist <= maxDist) out[p.wave].push(p.t - tt.time(p.wave, p.dist));
  return out;
}

export interface StationRow {
  sta: string;
  distKm: number;
  /** The analyst's P arrival and the model's, in seconds after the origin. */
  picked: number;
  model: number;
}

/**
 * `count` of the stations with a P pick, spread from the nearest to the farthest, each with the pick and the model's arrival.
 * A station with two picks counts once. `total` is how many stations there were to choose from.
 */
export function stationSample(data: QuakeData, count: number, maxDist = 95): { rows: StationRow[]; total: number } {
  const tt = new TravelTimes(data.quake.depthKm);
  const seen = new Set<string>();
  const picks = data.picks
    .filter((p) => p.wave === 'P' && p.dist <= maxDist)
    .sort((a, b) => a.dist - b.dist)
    .filter((p) => !seen.has(p.sta) && !!seen.add(p.sta));
  const take = Math.min(count, picks.length);
  const rows = Array.from({ length: take }, (_, i) => picks[take === 1 ? 0 : Math.round((i * (picks.length - 1)) / (take - 1))]!).map(
    (p) => ({
      sta: p.sta,
      distKm: p.dist * KM_PER_DEGREE,
      picked: p.t,
      model: tt.time('P', p.dist),
    }),
  );
  return { rows, total: picks.length };
}
