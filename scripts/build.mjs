// Builds the static site into dist/ and the library into dist/rumbleback.js.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const path = (p) => new URL(p, root).pathname;
const { version } = JSON.parse(readFileSync(path('package.json'), 'utf8'));

rmSync(path('dist'), { recursive: true, force: true });
mkdirSync(path('dist/assets'), { recursive: true });

await build({
  entryPoints: { app: path('src/main.ts') },
  outdir: path('dist/assets'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  loader: { '.svg': 'text', '.woff2': 'file', '.woff': 'file' },
  assetNames: 'fonts/[name]-[hash]',
  external: ['../logo.svg'],
  logLevel: 'info',
});

await build({
  entryPoints: [path('src/index.ts')],
  outfile: path('dist/rumbleback.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  minify: false,
  legalComments: 'none',
  logLevel: 'info',
});

// Type declarations for the library. The sources import each other with .ts extensions, which a
// consumer's compiler would not find next to .d.ts files, so the specifiers are pointed at .js.
const tsc = spawnSync(process.execPath, [path('node_modules/typescript/bin/tsc'), '-p', path('tsconfig.lib.json')], { stdio: 'inherit' });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);
for (const entry of readdirSync(path('dist/types'), { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.d.ts')) continue;
  const file = `${entry.parentPath}/${entry.name}`;
  writeFileSync(file, readFileSync(file, 'utf8').replaceAll(/(from '\.[^']*)\.ts'/g, "$1.js'"));
}

cpSync(path('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'), path('dist/assets/maplibre-gl-worker.mjs'));
cpSync(path('public'), path('dist'), { recursive: true });
cpSync(path('assets/social-card.png'), path('dist/social-card.png')); // the link preview image named in index.html
writeFileSync(path('dist/index.html'), readFileSync(path('index.html'), 'utf8').replaceAll('__VERSION__', version));
console.log(`built ${version}`);
