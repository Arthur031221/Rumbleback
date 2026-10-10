import type { Pick, QuakeSummary, Seismogram } from './quake.ts';
import { TravelTimes } from './traveltime.ts';

export const DATASELECT = 'https://service.earthscope.org/fdsnws/dataselect/1/query';

export interface Trace {
  sid: string;
  lat: number;
  lon: number;
  /** Time of the first sample, ms since the epoch. */
  startMs: number;
  /** Samples per second. */
  rate: number;
  values: number[];
}

/**
 * Reads GeoCSV time series from the EarthScope dataselect service. A response with gaps holds one block
 * per continuous stretch.
 */
export function parseGeoCsvBlocks(text: string): Trace[] {
  const blocks: Trace[] = [];
  let cur: Trace | null = null;
  const header: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#')) {
      cur = null;
      const m = /^#\s*(\w+):\s*(.*)$/.exec(line);
      if (m) header[m[1]!] = m[2]!.trim();
      continue;
    }
    if (!line || line.startsWith('Time')) continue;
    if (!cur) {
      const startMs = Date.parse(header.start_time ?? line.split(',')[0]!.trim());
      const rate = Number(header.sample_rate_hz);
      if (Number.isNaN(startMs) || !(rate > 0)) return blocks;
      cur = { sid: header.SID ?? '', lat: Number(header.latitude_deg), lon: Number(header.longitude_deg), startMs, rate, values: [] };
      blocks.push(cur);
    }
    const value = Number(line.slice(line.indexOf(',') + 1));
    if (Number.isFinite(value)) cur.values.push(value);
  }
  return blocks;
}

/** The longest continuous stretch of a GeoCSV response, or null. */
export function parseGeoCsv(text: string): Trace | null {
  return parseGeoCsvBlocks(text).reduce<Trace | null>((best, t) => (t.values.length > (best?.values.length ?? 0) ? t : best), null);
}

/**
 * Keeps the shape of a trace in a few hundred numbers: the mean before the earthquake is removed,
 * each time bin keeps its smallest and largest value, and the whole is scaled to the range -1000 to 1000.
 */
export function condense(trace: Trace, originMs: number, minBin = 0.25): Omit<Seismogram, 'sta' | 'cha' | 'dist'> {
  // A bin has to hold at least two samples, or a slow channel would leave empty bins.
  const bin = Math.max(minBin, 2 / trace.rate);
  const t0 = (trace.startMs - originMs) / 1000;
  const quiet = trace.values.filter((_, i) => t0 + i / trace.rate < 0);
  const base =
    quiet.length >= trace.rate
      ? quiet.reduce((a, b) => a + b, 0) / quiet.length
      : trace.values.reduce((a, b) => a + b, 0) / trace.values.length;
  const bins = Math.ceil(trace.values.length / trace.rate / bin);
  const lo = new Array<number>(bins).fill(Infinity);
  const hi = new Array<number>(bins).fill(-Infinity);
  trace.values.forEach((v, i) => {
    const k = Math.min(bins - 1, Math.floor(i / trace.rate / bin));
    const x = v - base;
    if (x < lo[k]!) lo[k] = x;
    if (x > hi[k]!) hi[k] = x;
  });
  const peak = Math.max(1, ...hi.filter(Number.isFinite).map(Math.abs), ...lo.filter(Number.isFinite).map(Math.abs));
  const scale = (x: number) => (Number.isFinite(x) ? Math.round((x / peak) * 1000) : 0);
  return { lat: trace.lat, lon: trace.lon, t0, bin, min: lo.map(scale), max: hi.map(scale) };
}

/**
 * Stations to try: one per station, vertical channels of broadband, short-period or strong-motion
 * instruments, broadband before the rest and nearer before farther. Stations beyond 12 degrees are
 * left out because the S wave there comes too late for the window that is requested.
 */
export function candidates(picks: Pick[], limit = 8): Pick[] {
  const seen = new Set<string>();
  return picks
    .filter((p) => /^[BHES]\w*Z$/.test(p.cha) && p.dist >= 0.5 && p.dist <= 12)
    .sort((a, b) => Number(a.cha[0] !== 'B') - Number(b.cha[0] !== 'B') || a.dist - b.dist)
    .filter((p) => !seen.has(p.sta) && seen.add(p.sta))
    .slice(0, limit);
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 23);

/**
 * The seismogram of the nearest station that has data, from 15 s before the origin to well after the
 * S wave. Returns null when none of the candidates has any.
 */
export async function loadSeismogram(
  quake: QuakeSummary,
  picks: Pick[],
  f: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<Seismogram | null> {
  const tt = new TravelTimes(quake.depthKm);
  // All the tries together get under a minute, so a slow archive cannot hold the layer up for long.
  const deadline = AbortSignal.timeout(45000);
  for (const p of candidates(picks)) {
    if (deadline.aborted) break;
    const [net, sta] = p.sta.split('.');
    const after = Math.min(330, Math.max(150, tt.time('S', p.dist) + 120));
    const q = new URLSearchParams({
      net: net!,
      sta: sta!,
      loc: p.loc || '--',
      cha: p.cha,
      starttime: iso(quake.time - 15000),
      endtime: iso(quake.time + after * 1000),
      format: 'geocsv',
    });
    try {
      const each = AbortSignal.any([deadline, AbortSignal.timeout(20000), ...(signal ? [signal] : [])]);
      const res = await f(`${DATASELECT}?${q}`, { signal: each });
      if (!res.ok) continue;
      // The trace has to show the P wave coming in and the shaking after the S wave, or it tells little.
      // The analyst's P pick is drawn on the strip too, so the trace has to reach back to whichever is earlier.
      const tP = Math.min(tt.time('P', p.dist), p.wave === 'P' ? p.t : Infinity);
      const tS = tt.time('S', p.dist);
      const trace = parseGeoCsvBlocks(await res.text()).find((b) => {
        const t0 = (b.startMs - quake.time) / 1000;
        return t0 <= tP - 5 && t0 + b.values.length / b.rate >= tS + 45;
      });
      if (!trace) continue;
      const c = condense(trace, quake.time);
      return { sta: p.sta, cha: p.cha, dist: p.dist, ...c };
    } catch (err) {
      if (signal?.aborted) throw err;
    }
  }
  return null;
}
