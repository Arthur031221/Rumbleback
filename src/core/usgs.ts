import { XMLParser } from 'fast-xml-parser';
import { destination } from './geo.ts';
import type { FeltReport, Instrument, IntensityGrid, Pick, ProductUrls, QuakeSummary } from './quake.ts';
import type { Wave } from './traveltime.ts';

// Phase names that can be the first arrival of each wave; later phases (pP, PcP, PP, sP, ...) are ignored.
const FIRST_P = new Set(['p', 'P', 'Pn', 'Pg', 'Pb', 'Pdif', 'Pdiff', 'PKP', 'PKPdf', 'PKPbc', 'PKPab', 'PKIKP', 'PKiKP']);
const FIRST_S = new Set(['s', 'S', 'Sn', 'Sg', 'Sb', 'Sdif', 'Sdiff', 'SKS', 'SKIKS']);

export function waveOfPhase(phase: string): Wave | null {
  if (FIRST_P.has(phase)) return 'P';
  if (FIRST_S.has(phase)) return 'S';
  return null;
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

interface Feature {
  id?: string;
  properties?: Record<string, unknown> & { products?: Record<string, { contents?: Record<string, { url?: string }> }[]> };
  geometry?: { coordinates?: number[] };
}

/** A GeoJSON feature from the USGS FDSN event service or one of its feeds. */
export function parseSummary(feature: Feature): QuakeSummary | null {
  const p = feature.properties;
  const c = feature.geometry?.coordinates;
  const mag = num(p?.mag);
  const time = num(p?.time);
  if (!feature.id || !p || !c || c.length < 2 || mag === undefined || time === undefined) return null;
  if (p.type !== undefined && p.type !== 'earthquake') return null;
  return {
    id: feature.id,
    place: typeof p.place === 'string' ? p.place : '',
    mag,
    magType: typeof p.magType === 'string' ? p.magType : '',
    time,
    lat: c[1]!,
    lon: c[0]!,
    depthKm: Math.max(0, c[2] ?? 10),
    felt: num(p.felt),
    mmi: num(p.mmi),
    alert: typeof p.alert === 'string' ? p.alert : undefined,
    tsunami: p.tsunami === 1 ? true : undefined,
  };
}

/** The URLs of the phase data, the ShakeMap intensity grid and the ShakeMap station list for one event. */
export function parseProducts(feature: Feature): ProductUrls {
  const products = feature.properties?.products ?? {};
  const url = (name: string, file: string) => products[name]?.[0]?.contents?.[file]?.url;
  return {
    phases: url('phase-data', 'quakeml.xml'),
    grid: url('shakemap', 'download/coverage_mmi_low_res.covjson'),
    stations: url('shakemap', 'download/stationlist.json'),
  };
}

interface QuakeMl {
  quakeml?: { eventParameters?: { event?: { origin?: QOrigin[]; pick?: QPick[]; preferredOriginID?: string } } };
}
interface QOrigin {
  '@_publicID'?: string;
  time?: { value?: string };
  latitude?: { value?: number };
  longitude?: { value?: number };
  depth?: { value?: number };
  arrival?: QArrival[];
}
interface QArrival {
  pickID?: string;
  phase?: string;
  azimuth?: number;
  distance?: number;
  timeWeight?: number;
}
interface QPick {
  '@_publicID'?: string;
  time?: { value?: string };
  waveformID?: { '@_networkCode'?: string; '@_stationCode'?: string; '@_channelCode'?: string; '@_locationCode'?: string };
}

const xml = new XMLParser({
  ignoreAttributes: false,
  parseAttributeValue: false,
  removeNSPrefix: true,
  isArray: (name) => name === 'origin' || name === 'arrival' || name === 'pick',
});

export interface PhaseData {
  originTime: number;
  lat: number;
  lon: number;
  depthKm: number;
  picks: Pick[];
}

/**
 * The picks behind an event's location, from the USGS phase-data QuakeML product. USGS does not ship
 * station coordinates here, so each station is placed from the distance and azimuth in its arrival.
 * Arrivals that USGS gave zero weight when locating the event are dropped, and so are phases that
 * cannot be a first arrival.
 */
export function parsePhaseData(text: string): PhaseData | null {
  const event = (xml.parse(text) as QuakeMl).quakeml?.eventParameters?.event;
  if (!event) return null;
  const origins = (event.origin ?? []).filter((o) => (o.arrival?.length ?? 0) > 0);
  const origin =
    origins.find((o) => o['@_publicID'] === event.preferredOriginID) ?? origins.sort((a, b) => b.arrival!.length - a.arrival!.length)[0];
  const lat = num(origin?.latitude?.value);
  const lon = num(origin?.longitude?.value);
  const originTime = Date.parse(origin?.time?.value ?? '');
  if (!origin || lat === undefined || lon === undefined || Number.isNaN(originTime)) return null;

  const byId = new Map<string, QPick>();
  for (const p of event.pick ?? []) if (p['@_publicID']) byId.set(p['@_publicID'], p);

  const picks: Pick[] = [];
  for (const a of origin.arrival ?? []) {
    const wave = a.phase ? waveOfPhase(a.phase) : null;
    const pick = a.pickID ? byId.get(a.pickID) : undefined;
    const [dist, az, weight] = [num(a.distance), num(a.azimuth), num(a.timeWeight)];
    const at = Date.parse(pick?.time?.value ?? '');
    if (!wave || !pick || dist === undefined || az === undefined || Number.isNaN(at)) continue;
    if (weight !== undefined && weight <= 0) continue;
    const [sLat, sLon] = destination([lat, lon], az, dist);
    picks.push({
      sta: `${pick.waveformID?.['@_networkCode'] ?? ''}.${pick.waveformID?.['@_stationCode'] ?? ''}`,
      phase: a.phase!,
      wave,
      lat: sLat,
      lon: sLon,
      dist,
      t: (at - originTime) / 1000,
      cha: pick.waveformID?.['@_channelCode'] ?? '',
      loc: pick.waveformID?.['@_locationCode'] ?? '',
    });
  }
  picks.sort((a, b) => a.t - b.t);
  return { originTime, lat, lon, depthKm: Math.max(0, (num(origin.depth?.value) ?? 0) / 1000), picks };
}

interface CovJson {
  domain?: { axes?: { x?: { start: number; stop: number; num: number }; y?: { start: number; stop: number; num: number } } };
  ranges?: { MMI?: { shape?: number[]; axisNames?: string[]; values?: (number | null)[] } };
}

/**
 * The ShakeMap MMI coverage (CoverageJSON) as a byte grid, MMI times ten, south row first and west
 * column first. CoverageJSON allows either axis to run backwards, so those are turned around here.
 */
export function parseGrid(json: CovJson): IntensityGrid | null {
  const { x, y } = json.domain?.axes ?? {};
  const values = json.ranges?.MMI?.values;
  if (!x || !y || !values || values.length !== x.num * y.num || x.num < 2 || y.num < 2) return null;
  const [dx, dy] = [(x.stop - x.start) / (x.num - 1), (y.stop - y.start) / (y.num - 1)];
  if (dx === 0 || dy === 0) return null;
  // CoverageJSON says which axis varies fastest. USGS writes y first (rows of x), but x first is legal too.
  const xFirst = json.ranges?.MMI?.axisNames?.[0] === 'x';
  const mmi = new Uint8Array(values.length);
  for (let r = 0; r < y.num; r++) {
    for (let c = 0; c < x.num; c++) {
      const v = values[xFirst ? c * y.num + r : r * x.num + c];
      const [row, col] = [dy < 0 ? y.num - 1 - r : r, dx < 0 ? x.num - 1 - c : c];
      mmi[row * x.num + col] = v === null || v === undefined || !Number.isFinite(v) ? 0 : Math.min(100, Math.max(0, Math.round(v * 10)));
    }
  }
  return {
    west: Math.min(x.start, x.stop),
    south: Math.min(y.start, y.stop),
    dx: Math.abs(dx),
    dy: Math.abs(dy),
    cols: x.num,
    rows: y.num,
    mmi,
  };
}

/** MMI at a point by bilinear interpolation, or null outside the grid or where the grid has no estimate. */
export function gridMmiAt(grid: IntensityGrid, lat: number, lon: number): number | null {
  const fx = ((((lon - grid.west) % 360) + 360) % 360) / grid.dx;
  const fy = (lat - grid.south) / grid.dy;
  if (fx < 0 || fy < 0 || fx > grid.cols - 1 || fy > grid.rows - 1) return null;
  const [x0, y0] = [Math.min(Math.floor(fx), grid.cols - 2), Math.min(Math.floor(fy), grid.rows - 2)];
  const [tx, ty] = [fx - x0, fy - y0];
  const at = (cx: number, cy: number) => grid.mmi[cy * grid.cols + cx]!;
  const corners = [at(x0, y0), at(x0 + 1, y0), at(x0, y0 + 1), at(x0 + 1, y0 + 1)];
  if (corners.some((v) => v === 0)) return null;
  const v = corners[0]! * (1 - tx) * (1 - ty) + corners[1]! * tx * (1 - ty) + corners[2]! * (1 - tx) * ty + corners[3]! * tx * ty;
  return v / 10;
}

interface StationFeature {
  id?: string;
  geometry?: { coordinates?: number[] };
  properties?: {
    code?: string;
    name?: string | null;
    network?: string;
    station_type?: string;
    intensity?: number | null;
    pga?: number | string | null;
    pgv?: number | string | null;
    nresp?: number | string | null;
  };
}

/** The ShakeMap station list: seismic instruments with a measured intensity, and Did You Feel It? groups. */
export function parseStations(json: { features?: StationFeature[] }): { instruments: Instrument[]; felt: FeltReport[] } {
  const instruments: Instrument[] = [];
  const felt: FeltReport[] = [];
  for (const f of json.features ?? []) {
    const p = f.properties;
    const c = f.geometry?.coordinates;
    const mmi = num(p?.intensity);
    if (!p || !c || c.length < 2 || mmi === undefined) continue;
    if (p.station_type === 'seismic') {
      instruments.push({
        id: f.id ?? `${p.network}.${p.code}`,
        name: p.name ?? p.code ?? '',
        network: p.network ?? '',
        lat: c[1]!,
        lon: c[0]!,
        mmi,
        pga: num(p.pga),
        pgv: num(p.pgv),
      });
    } else if (p.station_type === 'macroseismic') {
      felt.push({ lat: c[1]!, lon: c[0]!, mmi, n: num(p.nresp) ?? 1 });
    }
  }
  return { instruments, felt };
}
