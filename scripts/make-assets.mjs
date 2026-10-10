// Renders the README screenshots and the social card from the real page.
//   node scripts/make-assets.mjs [shots|phone|card]    all three by default
import { writeFileSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { open, pinCity, seek } from './lib/browser.mjs';

const assets = (name) => new URL(`../assets/${name}`, import.meta.url).pathname;

const only = process.argv[2];

for (const theme of only === 'card' || only === 'phone' ? [] : ['dark', 'light']) {
  const { page, close } = await open({ width: 1440, height: 900, theme });
  await seek(page, 3);
  await pinCity(page, 'Taipei');
  await seek(page, 24);
  await page.waitForTimeout(800);
  await page.screenshot({ path: assets(`hero-${theme}.png`) });
  await close();
}

if (only === 'shots') process.exit(0);

// The phone layout: the replay with a pin and the seismogram strip, and the quake picker on its Recent tab.
if (only !== 'card') {
  const { page, close } = await open({ width: 390, height: 844, scale: 2 });
  await seek(page, 3);
  await pinCity(page, 'Taipei');
  await seek(page, 24);
  await page.waitForTimeout(800);
  await page.screenshot({ path: assets('phone-replay.png') });
  await page.getByRole('button', { name: 'Choose a quake' }).click();
  await page.getByRole('tab', { name: 'Recent' }).click();
  await page.selectOption('#recent-mag', '6');
  await page.locator('.quake-row').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: assets('phone-picker.png') });
  await close();
  if (only === 'phone') process.exit(0);
}

const hero = readFileSync(assets('hero-dark.png')).toString('base64');
const font = (pkg, file) =>
  readFileSync(new URL(`../node_modules/@fontsource-variable/${pkg}/files/${file}.woff2`, import.meta.url)).toString('base64');
const logo = readFileSync(new URL('../public/logo.svg', import.meta.url), 'utf8');
const html = `<!doctype html><meta charset="utf-8"><style>
  @font-face { font-family: 'B'; src: url(data:font/woff2;base64,${font('bricolage-grotesque', 'bricolage-grotesque-latin-wght-normal')}); font-weight: 200 800; }
  @font-face { font-family: 'M'; src: url(data:font/woff2;base64,${font('jetbrains-mono', 'jetbrains-mono-latin-wght-normal')}); font-weight: 100 800; }
  html, body { margin: 0; width: 1200px; height: 675px; overflow: hidden; background: #080d13; color: #e9f0f7; font-family: B, system-ui, sans-serif; }
  .shot { position: absolute; left: 585px; top: 56px; width: 700px; height: 700px; border-radius: 22px; border: 1px solid rgba(150,178,205,.3); background: url(data:image/png;base64,${hero}) 64% 56% / 1560px auto no-repeat; box-shadow: 0 30px 80px rgba(0,0,0,.6); }
  .text { position: absolute; left: 64px; top: 70px; width: 480px; }
  .logo { width: 72px; height: 72px; }
  h1 { margin: 26px 0 0; font-size: 72px; line-height: 1; letter-spacing: -0.04em; font-weight: 780; }
  p { margin: 22px 0 0; font-size: 32px; line-height: 1.2; color: #a9bccf; letter-spacing: -0.01em; }
  .stat { position: absolute; left: 64px; bottom: 64px; font-family: M, monospace; font-size: 22px; color: #a9bccf; line-height: 1.4; }
  .stat b { color: #ff7b42; font-size: 40px; display: block; letter-spacing: -0.03em; }
</style>
<div class="shot"></div>
<div class="text"><div class="logo">${logo}</div><h1>Rumbleback</h1><p>Replay any earthquake. See your seconds.</p></div>
<div class="stat"><b>0.66 s</b>median P error against 3,933 real picks</div>`;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1200, height: 675 } })).newPage();
await page.setContent(html);
await page.waitForTimeout(500);
await page.screenshot({ path: assets('social-card.png') });
await browser.close();
console.log('assets written');
