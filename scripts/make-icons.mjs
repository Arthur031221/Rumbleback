// Renders the app icons from public/icon.svg: 192 and 512 pixel PNGs for the web manifest and a 180 pixel
// square one for iOS, which rounds the corners itself.
//   node scripts/make-icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const pub = (name) => new URL(`../public/${name}`, import.meta.url).pathname;
const svg = readFileSync(pub('icon.svg'), 'utf8');
const square = svg.replace('rx="15"', 'rx="0"');

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, source, transparent] of [
  ['icon-192.png', 192, svg, true],
  ['icon-512.png', 512, svg, true],
  ['apple-touch-icon.png', 180, square, false],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${source}`,
  );
  await page.screenshot({ path: pub(name), omitBackground: transparent });
  console.log(name);
}
await browser.close();
