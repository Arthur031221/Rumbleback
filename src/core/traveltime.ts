import table from '../data/traveltime.json' with { type: 'json' };

export type Wave = 'P' | 'S';

const DISTANCES: number[] = table.distances;
const DEPTHS: number[] = table.depths;
const COLS = DISTANCES.length;
const FINE_END = 12; // degrees: the table is every 0.05 up to here and every 0.25 after
const FINE_STEP = 0.05;
const COARSE_STEP = 0.25;
const FINE_COUNT = Math.round(FINE_END / FINE_STEP);

function decode(b64: string): Uint16Array {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const out = new Uint16Array(bytes.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = view.getUint16(i * 2, true);
  return out;
}

const GRIDS: Record<Wave, Uint16Array> = { P: decode(table.p), S: decode(table.s) };

function columnIndex(distDeg: number): number {
  if (distDeg <= FINE_END) return distDeg / FINE_STEP;
  return FINE_COUNT + (distDeg - FINE_END) / COARSE_STEP;
}

/** The depth row of the table at an arbitrary depth, interpolated linearly between the two nearest rows. */
function profileAt(wave: Wave, depthKm: number): Float64Array {
  const grid = GRIDS[wave];
  const depth = Math.min(Math.max(depthKm, DEPTHS[0]!), DEPTHS[DEPTHS.length - 1]!);
  let hi = DEPTHS.findIndex((d) => d >= depth);
  if (hi <= 0) hi = 1;
  const lo = hi - 1;
  const w = (depth - DEPTHS[lo]!) / (DEPTHS[hi]! - DEPTHS[lo]!);
  const out = new Float64Array(COLS);
  for (let c = 0; c < COLS; c++) {
    out[c] = (grid[lo * COLS + c]! * (1 - w) + grid[hi * COLS + c]! * w) * table.step;
  }
  // First arrivals never get earlier with distance; the max guards against rounding in the table.
  for (let c = 1; c < COLS; c++) out[c] = Math.max(out[c]!, out[c - 1]!);
  return out;
}

/**
 * First-arrival travel times of P and S waves for one source depth, from the iasp91 Earth model.
 * Build one per earthquake: the depth interpolation is done once, then every lookup is cheap.
 */
export class TravelTimes {
  readonly depthKm: number;
  private readonly profiles: Record<Wave, Float64Array>;

  constructor(depthKm: number) {
    this.depthKm = depthKm;
    this.profiles = { P: profileAt('P', depthKm), S: profileAt('S', depthKm) };
  }

  /** Seconds from origin until the wave first arrives at an epicentral distance in degrees (0 to 180). */
  time(wave: Wave, distDeg: number): number {
    const profile = this.profiles[wave];
    const x = Math.min(Math.max(columnIndex(distDeg), 0), COLS - 1);
    const i = Math.min(Math.floor(x), COLS - 2);
    return profile[i]! + (profile[i + 1]! - profile[i]!) * (x - i);
  }

  /** Seconds until the wave reaches the surface straight above the source. */
  get surfaceDelay(): { P: number; S: number } {
    return { P: this.time('P', 0), S: this.time('S', 0) };
  }

  /**
   * The epicentral distance in degrees the wavefront has reached at the surface after `seconds`,
   * or null while the wave is still underground (before it gets to the epicenter's surface point).
   */
  distanceAt(wave: Wave, seconds: number): number | null {
    const profile = this.profiles[wave];
    if (seconds < profile[0]!) return null;
    if (seconds >= profile[COLS - 1]!) return DISTANCES[COLS - 1]!;
    let lo = 0;
    let hi = COLS - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (profile[mid]! <= seconds) lo = mid;
      else hi = mid;
    }
    const span = profile[hi]! - profile[lo]!;
    const f = span > 0 ? (seconds - profile[lo]!) / span : 0;
    return DISTANCES[lo]! + (DISTANCES[hi]! - DISTANCES[lo]!) * f;
  }
}
