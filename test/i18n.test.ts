import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { FEATURED } from '../src/data/featured.ts';

const dir = new URL('../src/app/locales/', import.meta.url);
const locales = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f.slice(0, -5), JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as Record<string, string>]),
);
const en = locales.en!;
const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(',');

test('the shipped languages', () => {
  assert.deepEqual(Object.keys(locales).sort(), ['de', 'en', 'es', 'fr', 'ja', 'ko', 'pt-BR', 'zh-CN', 'zh-TW']);
});

test('every language has exactly the English keys with the same placeholders', () => {
  for (const [code, messages] of Object.entries(locales)) {
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(en).sort(), code);
    for (const [key, text] of Object.entries(messages)) {
      assert.ok(text.trim().length > 0, `${code} ${key} is empty`);
      assert.equal(placeholders(text), placeholders(en[key]!), `${code} ${key}`);
    }
  }
});

test('translations are not copies of the English text, apart from names, units and shared words', () => {
  const same = new Set(['unit.km', 'unit.s', 'quake.when', 'layer.shaking', 'theme.auto', 'pin.searchHint', 'pin.gap']);
  const latin = new Set(['es', 'fr', 'de', 'pt-BR']);
  for (const [code, messages] of Object.entries(locales)) {
    if (code === 'en') continue;
    for (const [key, text] of Object.entries(messages)) {
      if (text !== en[key] || same.has(key) || /^(featured|shaking|region)\./.test(key)) continue;
      // Cognates such as "Pause" are fine in a Latin-script language; a long sentence is not.
      if (latin.has(code) && text.length <= 20) continue;
      assert.fail(`${code} ${key} still reads "${text}"`);
    }
  }
});

test('every message key used in the source exists', () => {
  const sources = ['app', 'panel', 'dock', 'picker', 'learn', 'share', 'layers', 'derived', 'overlay'].map((f) =>
    readFileSync(new URL(`../src/app/${f}.ts`, import.meta.url), 'utf8'),
  );
  const used = new Set<string>();
  for (const src of sources) for (const m of src.matchAll(/\bt\('([\w.]+)'/g)) if (!m[1]!.endsWith('.')) used.add(m[1]!);
  for (const key of used) assert.ok(key in en, `missing key ${key}`);
  for (const f of FEATURED) assert.ok(`featured.${f.id}` in en, f.id);
  for (const key of ['notFelt', 'weak', 'light', 'moderate', 'strong', 'veryStrong', 'severe', 'violent', 'extreme'])
    assert.ok(`shaking.${key}` in en, key);
  for (const key of ['waves', 'picks', 'shaking', 'instruments', 'felt', 'blind']) assert.ok(`layer.${key}` in en, key);
  for (const key of ['p', 'depth', 'mmi', 'real']) assert.ok(`learn.${key}.title` in en && `learn.${key}.body` in en, key);
});

test('no English key is unused', () => {
  const sources = readdirSync(new URL('../src/app/', import.meta.url))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => readFileSync(new URL(`../src/app/${f}`, import.meta.url), 'utf8'))
    .join('\n');
  const dynamic = ['featured.', 'shaking.', 'layer.', 'learn.', 'picker.', 'region.', 'theme.', 'meta.'];
  for (const key of Object.keys(en)) {
    if (dynamic.some((p) => key.startsWith(p))) continue;
    assert.ok(sources.includes(`'${key}'`) || sources.includes(`"${key}"`), `unused key ${key}`);
  }
});
