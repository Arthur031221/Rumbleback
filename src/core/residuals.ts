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
