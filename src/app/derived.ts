import { cityName, parseCities, type City, type CityFile, type Lang } from '../core/cities.ts';
import { distanceDeg } from '../core/geo.ts';
import type { QuakeData } from '../core/quake.ts';
import { pickResiduals, summarize, type ResidualStats } from '../core/residuals.ts';
import { timingAt, type PinTiming } from '../core/warning.ts';
import { t } from './i18n.ts';
import type { AppState, Pin } from './state.ts';

let cityList: { order: Lang[]; list: City[] } | null = null;
let loading: Promise<{ order: Lang[]; list: City[] }> | null = null;

/** The city list is a separate file, fetched the first time a pin or a search needs it. */
export function loadCities(): Promise<{ order: Lang[]; list: City[] }> {
  if (cityList) return Promise.resolve(cityList);
  loading ??= fetch(new URL('data/cities.json', document.baseURI))
    .then((r) => {
      if (!r.ok) throw new Error(`cities.json ${r.status}`);
      return r.json() as Promise<CityFile>;
    })
    .then((file) => (cityList = parseCities(file)))
    .catch((err) => {
      loading = null; // the next call tries again
      throw err;
    });
  return loading;
}

export const cities = () => cityList;

export function pinTiming(s: AppState): PinTiming | null {
  if (!s.pin || !s.tt || !s.quake) return null;
  const d = distanceDeg([s.quake.quake.lat, s.quake.quake.lon], [s.pin.lat, s.pin.lon]);
  return timingAt(s.tt, d, s.alertSec);
}

export function pinLabel(pin: Pin, lang: Lang): string {
  if (pin.city !== null && cityList) {
    const city = cityList.list[pin.city];
    // A saved index could point at a different city after the list changes, so the position has to agree.
    if (city && Math.abs(city.lat - pin.lat) < 1e-6 && Math.abs(city.lon - pin.lon) < 1e-6) return cityName(city, cityList.order, lang);
  }
  return t('pin.myPlace');
}

/** The nearest big city within a few tens of km of a pin, to name the pin on a share card. */
export function nearestCityName(lat: number, lon: number, lang: Lang, maxKm = 40): string | null {
  if (!cityList) return null;
  let best: { c: City; d: number } | null = null;
  for (const c of cityList.list) {
    const d = distanceDeg([lat, lon], [c.lat, c.lon]) * 111.195;
    if (d <= maxKm && (!best || d < best.d)) best = { c, d };
  }
  return best ? cityName(best.c, cityList.order, lang) : null;
}

export function quakeTitle(q: QuakeData['quake']): string {
  const key = `featured.${q.id}`;
  const text = t(key);
  return text === key ? q.place || `M${q.mag}` : text;
}

const memo = new WeakMap<QuakeData, { P: ResidualStats | null; S: ResidualStats | null; residuals: number[] }>();

export function checkStats(data: QuakeData) {
  let m = memo.get(data);
  if (!m) {
    const r = pickResiduals(data, 95);
    m = { P: summarize(r.P), S: summarize(r.S), residuals: r.P };
    memo.set(data, m);
  }
  return m;
}
