import type { StyleSpecification, ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import type { Lang } from '../core/cities.ts';

export type Theme = 'dark' | 'light';

interface Palette {
  ocean: string;
  land: string;
  coast: string;
  border: string;
  borderSoft: string;
  road: string;
  text: string;
  textSoft: string;
  halo: string;
}

const PALETTES: Record<Theme, Palette> = {
  dark: {
    ocean: '#080d13',
    land: '#1a2635',
    coast: '#50657d',
    border: '#52667e',
    borderSoft: '#2d4056',
    road: '#2c3e52',
    text: '#d5e0ec',
    textSoft: '#8296ac',
    halo: '#080d13',
  },
  light: {
    ocean: '#c6d6e5',
    land: '#f1f3f5',
    coast: '#8396aa',
    border: '#8a9bad',
    borderSoft: '#b4c1cf',
    road: '#d3dbe4',
    text: '#25323f',
    textSoft: '#566a7e',
    halo: '#f4f7fa',
  },
};

// OpenMapTiles carries a name per language; the other languages fall back to English, then the local name.
const NAME_FIELD: Record<Lang, string> = {
  en: 'name:en',
  'zh-TW': 'name:zh-Hant',
  'zh-CN': 'name:zh-Hans',
  ja: 'name:ja',
  ko: 'name:ko',
  es: 'name:es',
  fr: 'name:fr',
  de: 'name:de',
  'pt-BR': 'name:pt',
};

const name = (lang: Lang): ExpressionSpecification => ['coalesce', ['get', NAME_FIELD[lang]], ['get', 'name:en'], ['get', 'name']];

export const TILES = 'https://tiles.openfreemap.org/planet';
export const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">&copy; OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, ' +
  '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>';

const nonMaritime: ExpressionSpecification = ['!=', ['get', 'maritime'], 1];

/**
 * A quiet base map: ocean, land, borders, main roads and place names, so the wavefronts are the
 * brightest thing on the screen. The land polygons come from the app itself, so with no network
 * the map still shows coastlines.
 */
export function buildStyle(theme: Theme, lang: Lang, landUrl: string): StyleSpecification {
  const c = PALETTES[theme];
  const font = (weight: 'Regular' | 'Bold' | 'Italic') => [`Noto Sans ${weight}`];
  const label = (
    id: string,
    filter: ExpressionSpecification,
    layer: 'place' | 'water_name',
    extra: Partial<LayerSpecification> & { layout?: object; paint?: object },
  ): LayerSpecification =>
    ({
      id,
      type: 'symbol',
      source: 'tiles',
      'source-layer': layer,
      filter,
      ...extra,
      layout: { 'text-field': name(lang), 'text-font': font('Regular'), 'text-max-width': 7, ...(extra.layout ?? {}) },
      paint: { 'text-color': c.text, 'text-halo-color': c.halo, 'text-halo-width': 1.4, ...(extra.paint ?? {}) },
    }) as LayerSpecification;

  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      land: { type: 'geojson', data: landUrl },
      tiles: { type: 'vector', url: TILES, attribution: ATTRIBUTION },
    },
    layers: [
      { id: 'ocean', type: 'background', paint: { 'background-color': c.ocean } },
      { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': c.land } },
      { id: 'water', type: 'fill', source: 'tiles', 'source-layer': 'water', paint: { 'fill-color': c.ocean } },
      { id: 'coast', type: 'line', source: 'land', paint: { 'line-color': c.coast, 'line-width': 0.8, 'line-opacity': 0.75 } },
      {
        id: 'admin1',
        type: 'line',
        source: 'tiles',
        'source-layer': 'boundary',
        minzoom: 4,
        filter: [
          'all',
          ['>=', ['to-number', ['get', 'admin_level'], 99], 3],
          ['<=', ['to-number', ['get', 'admin_level'], 99], 6],
          nonMaritime,
        ],
        paint: { 'line-color': c.borderSoft, 'line-width': 0.7, 'line-dasharray': [3, 2] },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'tiles',
        'source-layer': 'transportation',
        minzoom: 6,
        filter: ['match', ['get', 'class'], ['motorway', 'trunk'], true, false],
        paint: { 'line-color': c.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 12, 2] },
      },
      {
        id: 'country',
        type: 'line',
        source: 'tiles',
        'source-layer': 'boundary',
        filter: ['all', ['==', ['to-number', ['get', 'admin_level'], 99], 2], nonMaritime],
        paint: { 'line-color': c.border, 'line-width': 1 },
      },
      label('sea', ['match', ['get', 'class'], ['ocean', 'sea'], true, false], 'water_name', {
        minzoom: 2,
        layout: { 'text-font': font('Italic'), 'text-size': 12, 'text-letter-spacing': 0.15 },
        paint: { 'text-color': c.textSoft, 'text-halo-width': 0 },
      }),
      label('state', ['==', ['get', 'class'], 'state'], 'place', {
        minzoom: 5,
        maxzoom: 9,
        layout: { 'text-size': 11, 'text-transform': 'uppercase', 'text-letter-spacing': 0.1, 'text-font': font('Regular') },
        paint: { 'text-color': c.textSoft },
      }),
      label('country-name', ['==', ['get', 'class'], 'country'], 'place', {
        minzoom: 1,
        maxzoom: 7,
        layout: {
          'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10, 6, 15],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.12,
          'text-font': font('Bold'),
        },
        paint: { 'text-color': c.textSoft },
      }),
      label('town', ['match', ['get', 'class'], ['town', 'village'], true, false], 'place', {
        minzoom: 7,
        layout: { 'text-size': ['interpolate', ['linear'], ['zoom'], 7, 11, 12, 14] },
      }),
      label('city', ['==', ['get', 'class'], 'city'], 'place', {
        minzoom: 3,
        layout: { 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 10, 17], 'text-font': font('Bold') },
      }),
    ],
  };
}
