/** What a shared link carries. Everything is optional; the app opens on a featured quake without it. */
export interface LinkState {
  event?: string;
  pin?: [lat: number, lon: number];
  /** Replay clock in seconds after the origin. */
  t?: number;
  /** Alert issue time in seconds after the origin. */
  alert?: number;
  lang?: string;
}

/** The longest alert delay the slider and a link can express, in seconds. */
export const MAX_ALERT = 60;

const finite = (s: string | null): number | undefined => {
  const n = s === null || s.trim() === '' ? NaN : Number(s);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Reads a link. The pin travels in the fragment (`#pin=lat,lon`) because a browser never sends the
 * fragment to the server, while the query string is part of the request. A pin in the query is still
 * understood, for links made by earlier versions.
 */
export function parseLink(search: string, hash = ''): LinkState {
  const q = new URLSearchParams(search);
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  const out: LinkState = {};
  const event = q.get('event');
  if (event && /^[\w.-]{3,40}$/.test(event)) out.event = event;
  const [lat, lon] = (h.get('pin') ?? q.get('pin') ?? '').split(',').map((s) => finite(s));
  if (lat !== undefined && lon !== undefined && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) out.pin = [lat, lon];
  const t = finite(q.get('t'));
  if (t !== undefined) out.t = Math.min(Math.max(t, -60), 3600);
  const alert = finite(q.get('alert'));
  if (alert !== undefined) out.alert = Math.min(Math.max(alert, 0), MAX_ALERT);
  const lang = q.get('lang');
  if (lang && /^[A-Za-z-]{2,8}$/.test(lang)) out.lang = lang;
  return out;
}

/** The pin is rounded to two decimals, about a kilometre, so a link does not give out an exact address. */
export function buildLink(base: string, s: LinkState): string {
  const q = new URLSearchParams();
  if (s.event) q.set('event', s.event);
  if (s.t !== undefined) q.set('t', String(Math.round(s.t * 10) / 10));
  if (s.alert !== undefined) q.set('alert', String(Math.round(s.alert)));
  if (s.lang) q.set('lang', s.lang);
  const query = q.toString();
  const pin = s.pin ? `#pin=${s.pin[0].toFixed(2)},${s.pin[1].toFixed(2)}` : '';
  return `${base}${query ? `?${query}` : ''}${pin}`;
}

/**
 * The USGS event id in what a person pasted: the id itself (`us7000m9g4`), a USGS event page
 * (`.../earthquakes/eventpage/us7000m9g4/executive`), a catalog query with `eventid=` or a Rumbleback link.
 * Returns null when nothing in it looks like an id.
 */
export function eventIdFrom(text: string): string | null {
  // Network code, then the rest. Some ids are long and carry an underscore, such as official20110311054624120_30.
  const id = /^[a-z]{2}[a-z0-9_]{6,40}$/i;
  const given = text.trim();
  if (id.test(given)) return given.toLowerCase();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(given) ? given : `https://${given}`);
  } catch {
    return null;
  }
  const found = url.searchParams.get('eventid') ?? url.searchParams.get('event') ?? /\/eventpage\/([^/?#]+)/i.exec(url.pathname)?.[1];
  return found && id.test(found) ? found.toLowerCase() : null;
}
