// Records assets/demo.gif: the real page, frame by frame at fixed clock steps, so the result does not
// depend on how fast this machine draws. Needs ffmpeg.
//   node scripts/record-demo.mjs
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { open, pinCity, seek, setAlert } from './lib/browser.mjs';

const tmp = process.env.FRAMES_DIR ?? '/tmp/rumbleback-frames';
const out = new URL('../assets/demo.gif', import.meta.url).pathname;
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });

const { page, close } = await open({ width: 1280, height: 720 });
let n = 0;
const shot = async () => page.screenshot({ path: `${tmp}/f${String(n++).padStart(4, '0')}.png` });

// The replay opens on the waves already moving, then a pin goes down, then the alert slider is dragged.
await seek(page, 6.5);
for (let t = 6.5; t <= 20; t += 0.45) {
  await seek(page, t);
  await shot();
}
await pinCity(page, 'Taipei');
await page.waitForTimeout(500);
for (let t = 20; t <= 52; t += 0.45) {
  await seek(page, t);
  await shot();
}
for (let a = 8; a <= 34; a += 1.4) {
  await setAlert(page, Math.round(a));
  await shot();
}
for (let i = 0; i < 14; i++) await shot();
await close();

const fps = 12;
const filter = `fps=${fps},scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=112:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
const r = spawnSync(
  'ffmpeg',
  ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${tmp}/f%04d.png`, '-vf', filter, '-loop', '0', out],
  { stdio: 'inherit' },
);
if (r.status !== 0) process.exit(1);
console.log(`${n} frames, ${(n / fps).toFixed(1)} s -> ${out}`);
