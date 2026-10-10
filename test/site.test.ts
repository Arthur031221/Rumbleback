import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const attr = (tag: string, name: string) => new RegExp(`${tag}[^>]*?${name}="([^"]*)"`, 's').exec(html)?.[1];
const meta = (key: string) => new RegExp(`<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`, 's').exec(html)?.[1];
const pngSize = (file: URL) => {
  const b = readFileSync(file);
  assert.equal(b.subarray(1, 4).toString(), 'PNG', file.pathname);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

test('the web manifest names icons that exist at the sizes it gives', () => {
  const href = html.match(/<link rel="manifest" href="([^"]+)"/)?.[1];
  assert.equal(href, 'manifest.webmanifest');
  const manifest = JSON.parse(readFileSync(new URL(`public/${href}`, root), 'utf8'));
  assert.equal(manifest.name, 'Rumbleback');
  assert.equal(manifest.display, 'standalone');
  const png = manifest.icons.filter((i: { type: string }) => i.type === 'image/png');
  assert.deepEqual(
    png.map((i: { sizes: string }) => i.sizes),
    ['192x192', '512x512'],
  );
  for (const icon of manifest.icons) {
    const file = new URL(`public/${icon.src}`, root);
    if (icon.type === 'image/png') assert.deepEqual(pngSize(file).join('x'), icon.sizes, icon.src);
    else assert.ok(readFileSync(file, 'utf8').includes('<svg'), icon.src);
  }
});

test('the touch icon and the link preview image are shipped at the sizes the page says', () => {
  const touch = html.match(/<link rel="apple-touch-icon" href="([^"]+)"/)?.[1];
  assert.deepEqual(pngSize(new URL(`public/${touch}`, root)), [180, 180]);
  assert.match(meta('og:image')!, /\/social-card\.png$/);
  assert.deepEqual(pngSize(new URL('assets/social-card.png', root)), [Number(meta('og:image:width')), Number(meta('og:image:height'))]);
  assert.equal(meta('twitter:image'), meta('og:image'));
  assert.equal(meta('og:url'), attr('<link rel="canonical"', 'href'));
});

test('the page states its title and description once for search results and link previews', () => {
  assert.ok(meta('description')!.length > 60 && meta('description')!.length < 200);
  assert.ok(meta('og:title') && meta('twitter:title') && meta('og:description') && meta('twitter:description'));
  assert.ok(meta('og:image:alt'));
});
