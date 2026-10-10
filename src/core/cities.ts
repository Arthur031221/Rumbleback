import { distanceKm } from './geo.ts';

export type Lang = 'en' | 'zh-TW' | 'zh-CN' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'pt-BR';

export interface City {
  lat: number;
  lon: number;
  pop: number;
  /** Names in the order of `CityFile.order`. Empty when Natural Earth has none. */
  names: string[];
}

export interface CityFile {
  order: Lang[];
  cities: [number, number, number, ...string[]][];
}

export function parseCities(file: CityFile): { order: Lang[]; list: City[] } {
  return { order: file.order, list: file.cities.map(([lat, lon, pop, ...names]) => ({ lat, lon, pop, names })) };
}

export function cityName(city: City, order: Lang[], lang: Lang): string {
  const at = (l: Lang) => city.names[order.indexOf(l)] ?? '';
  return at(lang) || at('en');
}

const fold = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** Cities whose name in any language starts with, or contains, the query. Bigger cities first within each group. */
export function searchCities(cities: City[], query: string, limit = 6): City[] {
  const q = fold(query.trim());
  if (!q) return [];
  const starts: City[] = [];
  const contains: City[] = [];
  for (const c of cities) {
    const names = c.names.map(fold).filter(Boolean);
    if (names.some((n) => n.startsWith(q))) starts.push(c);
    else if (q.length > 1 && names.some((n) => n.includes(q))) contains.push(c);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

/** The biggest cities within `radiusKm` of a point, biggest first. */
export function citiesNear(cities: City[], lat: number, lon: number, radiusKm: number, limit = 6): City[] {
  return cities
    .filter((c) => distanceKm([lat, lon], [c.lat, c.lon]) <= radiusKm)
    .sort((a, b) => b.pop - a.pop)
    .slice(0, limit);
}
