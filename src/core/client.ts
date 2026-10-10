import { distanceDeg } from './geo.ts';
import type { ProductUrls, QuakeData, QuakeSummary } from './quake.ts';
import { within } from './signal.ts';
import { parseGrid, parsePhaseData, parseProducts, parseStations, parseSummary } from './usgs.ts';
import { loadSeismogram } from './waveform.ts';

const FDSN = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

type Fetch = typeof fetch;

export interface SearchOptions {
  minMag: number;
  /** Inclusive, ISO dates. */
  start: string;
  end: string;
  /** A bounding box, or null for anywhere. */
  box: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
  limit?: number;
}

/** A USGS answer that is not a success, with its HTTP status. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, url: string) {
    super(`${status} ${url}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * True when USGS has no such earthquake. It answers 404 for an id it does not know and 400 for one that is
 * malformed, and the detail call refuses a feature that is not an earthquake.
 */
export function isUnknownEvent(e: unknown): boolean {
  return e instanceof HttpError ? e.status === 404 || e.status === 400 : e instanceof Error && /^no earthquake/.test(e.message);
}

async function json<T>(url: string, f: Fetch, signal?: AbortSignal): Promise<T> {
  // A request that stalls for half a minute fails, so a list or a replay cannot stay loading for ever.
  const res = await f(url, { signal: within(30000, signal) });
  if (!res.ok) throw new HttpError(res.status, url);
  return (await res.json()) as T;
}

function summaries(collection: { features?: unknown[] }): QuakeSummary[] {
  return (collection.features ?? []).map((f) => parseSummary(f as never)).filter((q): q is QuakeSummary => q !== null);
}

/** Earthquakes from the USGS catalog, strongest first. */
export async function searchQuakes(o: SearchOptions, f: Fetch = fetch, signal?: AbortSignal): Promise<QuakeSummary[]> {
  const q = new URLSearchParams({
    format: 'geojson',
    eventtype: 'earthquake',
    orderby: 'magnitude',
    limit: String(o.limit ?? 40),
    minmagnitude: String(o.minMag),
    starttime: o.start,
    endtime: `${o.end}T23:59:59`,
  });
  if (o.box) {
    q.set('minlatitude', String(o.box.minLat));
    q.set('maxlatitude', String(o.box.maxLat));
    q.set('minlongitude', String(o.box.minLon));
    q.set('maxlongitude', String(o.box.maxLon));
  }
  return summaries(await json(`${FDSN}?${q}`, f, signal));
}

/** How many earthquakes the recent list asks for, and how far back it looks, in days. */
export const RECENT_LIMIT = 60;
export const RECENT_DAYS = 30;

/** The newest earthquakes of the last 30 days at the given magnitude and up (5 unless said), at most `RECENT_LIMIT`. */
export async function recentQuakes(f: Fetch = fetch, signal?: AbortSignal, now = Date.now(), minMag = 5): Promise<QuakeSummary[]> {
  const q = new URLSearchParams({
    format: 'geojson',
    eventtype: 'earthquake',
    orderby: 'time',
    limit: String(RECENT_LIMIT),
    minmagnitude: String(minMag),
    starttime: new Date(now - RECENT_DAYS * 86400000).toISOString().slice(0, 10),
  });
  return summaries(await json(`${FDSN}?${q}`, f, signal));
}

/** A summary and the product URLs for one event id. */
export async function quakeDetail(id: string, f: Fetch = fetch, signal?: AbortSignal) {
  const feature = await json<never>(`${FDSN}?eventid=${encodeURIComponent(id)}&format=geojson`, f, signal);
  const quake = parseSummary(feature);
  if (!quake) throw new Error(`no earthquake with id ${id}`);
  return { quake, urls: parseProducts(feature) as ProductUrls };
}

/**
 * Everything the replay shows for one event. The summary comes first; each layer is fetched on its own
 * and a missing or failing one leaves that layer empty instead of failing the whole replay.
 */
export async function loadQuake(
  id: string,
  onProgress: (data: QuakeData) => void = () => {},
  f: Fetch = fetch,
  signal?: AbortSignal,
): Promise<QuakeData> {
  const { quake, urls } = await quakeDetail(id, f, signal);
  const data: QuakeData = { quake, picks: [], instruments: [], felt: [], grid: null, seismogram: null };
  onProgress(data);
  // A layer that takes more than half a minute is left out instead of holding the rest up.
  const limited = () => within(30000, signal);
  const optional = async (url: string | undefined, apply: (res: Response) => Promise<void>) => {
    if (!url) return;
    try {
      const res = await f(url, { signal: limited() });
      if (res.ok) await apply(res);
    } catch (err) {
      if (signal?.aborted) throw err;
    }
    onProgress(data);
  };
  const phases = (async () => {
    await optional(urls.phases, async (r) => {
      const parsed = parsePhaseData(await r.text());
      // Picks are timed from the origin they were located with; shift them onto the summary's clock.
      // Distances are taken again from the summary's epicenter, the one the replay is drawn around.
      if (parsed) {
        data.picks = parsed.picks.map((p) => ({
          ...p,
          t: p.t - (quake.time - parsed.originTime) / 1000,
          dist: distanceDeg([quake.lat, quake.lon], [p.lat, p.lon]),
        }));
      }
    });
    // The seismogram needs the picks to know which stations to ask for.
    try {
      data.seismogram = await loadSeismogram(quake, data.picks, f, signal);
    } catch (err) {
      if (signal?.aborted) throw err;
    }
    onProgress(data);
  })();
  await Promise.all([
    phases,
    optional(urls.grid, async (r) => void (data.grid = parseGrid(await r.json()))),
    optional(urls.stations, async (r) => void Object.assign(data, parseStations(await r.json()))),
  ]);
  return data;
}
