import assert from 'node:assert/strict';
import { test } from 'node:test';
import { letterBand, mapPadding, type Metrics } from '../src/app/layout.ts';

const desktop: Metrics = { width: 1440, height: 900, panelRight: 372, chipsBottom: 112, dockTop: 900 - 14 - 142 };
const phone: Metrics = { width: 390, height: 844, panelRight: 382, chipsBottom: 102, dockTop: 844 - 8 - 150 };
const sideways: Metrics = { width: 844, height: 390, panelRight: 316, chipsBottom: 94, dockTop: 390 - 8 - 56 };

test('the map keeps clear of the panels on a desktop, as it always has', () => {
  assert.deepEqual(mapPadding('desktop', desktop), { left: 396, right: 24, top: 76, bottom: 142 + 14 + 22 });
});

test('on a phone the top follows the chips and the bottom the timeline plus the sheet above it', () => {
  const p = mapPadding('phone', phone);
  assert.equal(p.top, 110);
  assert.equal(p.bottom, 8 + 150 + 8 + 330 - 0 + 0 - 0 + 0 - 0 + 0 - 0 + 0 - 0 + 0 - 0 + 0 - 0 + 0 + 0 - 0);
  assert.equal(p.left, 12);
  // A notch moves the chips down and a home indicator moves the timeline up, and the padding follows both.
  const notched = mapPadding('phone', { ...phone, chipsBottom: phone.chipsBottom + 47, dockTop: phone.dockTop - 34 });
  assert.equal(notched.top, p.top + 47);
  assert.equal(notched.bottom, p.bottom + 34);
  // The sheet is never more than 42 percent of a short screen.
  assert.equal(mapPadding('phone', { ...phone, height: 600, dockTop: 600 - 158 }).bottom, 158 + 8 + 0.42 * 600);
});

test('sideways the map keeps what is right of the panel, below the chips and above the timeline', () => {
  assert.deepEqual(mapPadding('short', sideways), { left: 332, right: 16, top: 102, bottom: 56 + 8 + 16 });
});

test('the letters of the wavefronts stay in what is clear of the bar, the chips and the sheet', () => {
  assert.deepEqual(letterBand('desktop', mapPadding('desktop', desktop)), { top: 62, bottom: 178 + 6 });
  assert.deepEqual(letterBand('desktop', { left: 0, right: 0, top: 76, bottom: 90 }), { top: 62, bottom: 130 });
  assert.deepEqual(letterBand('phone', mapPadding('phone', phone)), { top: 110, bottom: mapPadding('phone', phone).bottom + 6 });
});
