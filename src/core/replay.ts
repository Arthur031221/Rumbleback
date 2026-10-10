import { KM_PER_DEGREE, distanceDeg } from './geo.ts';
import type { QuakeData } from './quake.ts';
import type { TravelTimes } from './traveltime.ts';

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** How far out people felt it, in km, when no ShakeMap is available. A rough fit to the USGS "felt" radii. */
export function feltRadiusKm(mag: number): number {
  return Math.min(2500, Math.max(60, 14 * 10 ** (0.38 * (mag - 3))));
}

/**
 * The area the map opens on: where the ShakeMap says shaking reached intensity 4.5 or more, at least two
 * degrees wide around the epicenter. Falls back to a circle sized from the magnitude.
 */
export function openingBounds(data: QuakeData): Bounds {
  const { lat, mag } = data.quake;
  const g = data.grid;
  // Everything is placed in the longitude copy the grid lives in, so a quake at -179 and a grid from
  // 170 to 190 stay together instead of spanning the whole world.
  const gridMid = g ? g.west + ((g.cols - 1) * g.dx) / 2 : data.quake.lon;
  const lon = data.quake.lon + 360 * Math.round((gridMid - data.quake.lon) / 360);
  let box: Bounds | null = null;
  if (g) {
    let [west, east, south, north] = [Infinity, -Infinity, Infinity, -Infinity];
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        if (g.mmi[r * g.cols + c]! < 45) continue;
        west = Math.min(west, g.west + c * g.dx);
        east = Math.max(east, g.west + c * g.dx);
        south = Math.min(south, g.south + r * g.dy);
        north = Math.max(north, g.south + r * g.dy);
      }
    }
    if (east > west && north > south) box = { west, south, east, north };
  }
  if (!box) {
    const dLat = feltRadiusKm(mag) / KM_PER_DEGREE;
    const dLon = dLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    box = { west: lon - dLon, east: lon + dLon, south: lat - dLat, north: lat + dLat };
  }
  const pad = (a: number, b: number, min: number): [number, number] => {
    const mid = (a + b) / 2;
    const half = Math.max((b - a) / 2, min / 2);
    return [mid - half, mid + half];
  };
  const [west, east] = pad(Math.min(box.west, lon), Math.max(box.east, lon), 2);
  let [south, north] = pad(Math.min(box.south, lat), Math.max(box.north, lat), 2);
  // Web Mercator stops near the poles. Slide the box back inside instead of squeezing it.
  const LIMIT = 85;
  if (north > LIMIT) [south, north] = [Math.max(south - (north - LIMIT), -LIMIT), LIMIT];
  if (south < -LIMIT) [south, north] = [-LIMIT, Math.min(north + (-LIMIT - south), LIMIT)];
  return { west, south, east, north };
}

/**
 * How long the replay runs: until the S wave has reached the farthest corner of the opening view
 * (or the pin, or the seismogram station, if that is farther), plus a few seconds to see it arrive.
 */
export function replayLength(tt: TravelTimes, data: QuakeData, view: Bounds, pin?: { lat: number; lon: number }): number {
  const c: [number, number] = [data.quake.lat, data.quake.lon];
  const corners: [number, number][] = [
    [view.south, view.west],
    [view.south, view.east],
    [view.north, view.west],
    [view.north, view.east],
  ];
  if (pin) corners.push([pin.lat, pin.lon]);
  const far = Math.max(...corners.map((p) => distanceDeg(c, p)));
  let length = Math.ceil(tt.time('S', Math.min(far, 180)) + 4);
  // The seismogram strip is drawn along the same timeline, so the replay has to reach its S wave too.
  if (data.seismogram) length = Math.max(length, Math.ceil(tt.time('S', data.seismogram.dist) + 20));
  return Math.max(20, length);
}

export const SPEEDS = [1, 2, 5, 10, 20, 50] as const;

/** The slowest preset that plays the whole replay in about half a minute. */
export function defaultSpeed(length: number): (typeof SPEEDS)[number] {
  return SPEEDS.find((s) => length / s <= 32) ?? SPEEDS[SPEEDS.length - 1]!;
}
