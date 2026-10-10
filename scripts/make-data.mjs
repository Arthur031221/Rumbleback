// Builds the map data the app ships with, from public domain Natural Earth data.
//   node scripts/make-data.mjs [populated-places.geojson]
// Without an argument the populated places file is downloaded from the Natural Earth GitHub mirror.
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';

const out = (name) => new URL(`../public/data/${name}`, import.meta.url);
const round = (n, p) => Math.round(n * 10 ** p) / 10 ** p;

// Land polygons at 1:50m, the fallback map when the vector tiles cannot load.
const land = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/land-50m.json', import.meta.url), 'utf8'));
const geo = feature(land, land.objects.land);
const trim = (c) => (typeof c[0] === 'number' ? [round(c[0], 3), round(c[1], 3)] : c.map(trim));
for (const f of geo.features ?? [geo]) f.geometry.coordinates = trim(f.geometry.coordinates);
writeFileSync(out('land-50m.json'), JSON.stringify(geo));

// Cities of at least 250 thousand people, with the names the app's languages need.
const src = process.argv[2];
const places = src
  ? JSON.parse(readFileSync(src, 'utf8'))
  : await (
      await fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson')
    ).json();
const cities = places.features
  .map((f) => f.properties)
  .filter((p) => p.POP_MAX >= 250000)
  .sort((a, b) => b.POP_MAX - a.POP_MAX)
  .map((p) => [
    round(p.LATITUDE, 3),
    round(p.LONGITUDE, 3),
    p.POP_MAX,
    // en, zh-TW, zh-CN, ja, ko, es, fr, de, pt
    p.NAME_EN || p.NAME,
    p.NAME_ZHT || p.NAME_ZH || '',
    p.NAME_ZH || '',
    p.NAME_JA || '',
    p.NAME_KO || '',
    p.NAME_ES || '',
    p.NAME_FR || '',
    p.NAME_DE || '',
    p.NAME_PT || '',
  ]);
writeFileSync(out('cities.json'), JSON.stringify({ order: ['en', 'zh-TW', 'zh-CN', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR'], cities }));
console.log(`land ${geo.features?.length ?? 1} features, ${cities.length} cities`);
