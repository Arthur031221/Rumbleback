import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { distanceDeg } from '../src/core/geo.ts';
import { gridMmiAt, parseGrid, parsePhaseData, parseProducts, parseStations, parseSummary, waveOfPhase } from '../src/core/usgs.ts';

const read = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('summary of the 2024 Hualien quake from a USGS feature', () => {
  const q = parseSummary(JSON.parse(read('event-us7000m9g4.json')))!;
  assert.deepEqual(
    { id: q.id, mag: q.mag, lat: q.lat, lon: q.lon, depthKm: q.depthKm, magType: q.magType, tsunami: q.tsunami },
    { id: q.id, mag: 7.4, lat: 23.8356, lon: 121.5976, depthKm: 40, magType: 'mww', tsunami: true },
  );
  assert.equal(new Date(q.time).toISOString(), '2024-04-02T23:58:12.173Z');
});

test('features without a magnitude, a time or an earthquake type are skipped', () => {
  const ok = JSON.parse(read('event-us7000m9g4.json'));
  assert.equal(parseSummary({ ...ok, id: undefined }), null);
  assert.equal(parseSummary({ ...ok, properties: { ...ok.properties, mag: null } }), null);
  assert.equal(parseSummary({ ...ok, properties: { ...ok.properties, type: 'quarry blast' } }), null);
  assert.equal(parseSummary({ ...ok, geometry: { coordinates: [1] } }), null);
});

test('product URLs come from the first product of each kind', () => {
  const urls = parseProducts(JSON.parse(read('event-us7000m9g4.json')));
  assert.match(urls.phases!, /phase-data\/us7000m9g4\/.*quakeml\.xml$/);
  assert.match(urls.grid!, /coverage_mmi_low_res\.covjson$/);
  assert.match(urls.stations!, /stationlist\.json$/);
  assert.deepEqual(parseProducts({ properties: {} }), { phases: undefined, grid: undefined, stations: undefined });
});

test('which phases can be a first arrival', () => {
  for (const p of ['P', 'p', 'Pn', 'Pg', 'Pdiff', 'PKPdf']) assert.equal(waveOfPhase(p), 'P', p);
  for (const p of ['S', 's', 'Sn', 'Sg', 'SKS', 'SKIKS']) assert.equal(waveOfPhase(p), 'S', p);
  for (const p of ['pP', 'sP', 'PcP', 'PP', 'ScS', 'Lg', 'amp', '']) assert.equal(waveOfPhase(p), null, p);
});

test('phase data: weighted first arrivals only, placed from distance and azimuth, timed from the origin', () => {
  const data = parsePhaseData(read('phase-sample.xml'))!;
  assert.equal(new Date(data.originTime).toISOString(), '2024-04-02T23:58:12.173Z');
  assert.equal(data.depthKm, 40);
  // 9 arrivals in the file: two have zero weight, one is a depth phase and one has no pick.
  assert.equal(data.picks.length, 5);
  assert.deepEqual(data.picks.map((p) => p.phase).sort(), ['P', 'PKPbc', 'PKPdf', 'Pn', 'Sn']);
  for (let i = 1; i < data.picks.length; i++) assert.ok(data.picks[i]!.t >= data.picks[i - 1]!.t);
  const pn = data.picks.find((p) => p.phase === 'Pn')!;
  assert.equal(pn.sta, 'IU.TATO');
  assert.ok(Math.abs(pn.dist - 1.13656) < 1e-9 && Math.abs(pn.t - 18.417) < 0.01, `t ${pn.t}`);
  // The station lands where the reported distance says.
  assert.ok(Math.abs(distanceDeg([data.lat, data.lon], [pn.lat, pn.lon]) - pn.dist) < 1e-6);
  assert.equal(data.picks.find((p) => p.phase === 'Sn')!.wave, 'S');
});

test('phase data that is not QuakeML or has no arrivals gives nothing', () => {
  assert.equal(parsePhaseData('<html>nope</html>'), null);
  assert.equal(parsePhaseData(''), null);
  assert.equal(parsePhaseData('<q:quakeml xmlns:q="x"><eventParameters><event/></eventParameters></q:quakeml>'), null);
});

test('ShakeMap grid: values become MMI times ten, and bilinear lookups', () => {
  const grid = parseGrid(JSON.parse(read('grid-sample.json')))!;
  assert.deepEqual([grid.cols, grid.rows, grid.west, grid.south, grid.dx, grid.dy], [3, 3, 121, 23, 0.5, 0.5]);
  assert.deepEqual([...grid.mmi], [40, 50, 60, 50, 60, 70, 60, 70, 80]);
  assert.equal(gridMmiAt(grid, 23, 121), 4);
  assert.equal(gridMmiAt(grid, 24, 122), 8);
  assert.ok(Math.abs(gridMmiAt(grid, 23.25, 121.25)! - 5) < 1e-9);
  assert.equal(gridMmiAt(grid, 22.9, 121.5), null);
  assert.equal(gridMmiAt(grid, 23.5, 123), null);
  assert.equal(gridMmiAt(grid, 23.5, 121.5 - 360), 6);
});

test('a grid with holes returns null near them, and a malformed one is rejected', () => {
  const json = JSON.parse(read('grid-sample.json'));
  json.ranges.MMI.values[4] = null;
  const grid = parseGrid(json)!;
  assert.equal(grid.mmi[4], 0);
  assert.equal(gridMmiAt(grid, 23.5, 121.5), null);
  assert.equal(parseGrid({ ...json, ranges: { MMI: { values: [1, 2] } } }), null);
  assert.equal(parseGrid({}), null);
});

test('station list: instruments and felt reports are told apart, entries without intensity are dropped', () => {
  const { instruments, felt } = parseStations(JSON.parse(read('stations-sample.json')));
  assert.equal(instruments.length, 1);
  assert.equal(felt.length, 1);
  assert.ok(instruments[0]!.mmi > 0 && instruments[0]!.pga! > 0);
  assert.ok(felt[0]!.n >= 1 && felt[0]!.mmi > 0);
  assert.deepEqual(parseStations({}), { instruments: [], felt: [] });
});

test('a grid written with x varying fastest is read in the right order', () => {
  const json = JSON.parse(read('grid-sample.json'));
  json.domain.axes = { x: { start: 121, stop: 122, num: 3 }, y: { start: 23, stop: 23.5, num: 2 } };
  json.ranges.MMI = { axisNames: ['x', 'y'], shape: [3, 2], values: [1, 4, 2, 5, 3, 6] };
  const grid = parseGrid(json)!;
  // With x first, each column of y is listed in turn: x0 y0, x0 y1, x1 y0 ...
  assert.deepEqual([...grid.mmi], [10, 20, 30, 40, 50, 60]);
  assert.equal(gridMmiAt(grid, 23, 121.5), 2);
  assert.equal(gridMmiAt(grid, 23.5, 121.5), 5);
});

test('a grid whose axes run backwards is turned around', () => {
  const json = JSON.parse(read('grid-sample.json'));
  // Same grid as the sample, written from the north-east corner: both axes descend.
  json.domain.axes = { x: { start: 122, stop: 121, num: 3 }, y: { start: 24, stop: 23, num: 3 } };
  json.ranges.MMI.values = [8, 7, 6, 7, 6, 5, 6, 5, 4];
  const grid = parseGrid(json)!;
  assert.deepEqual([grid.west, grid.south, grid.dx, grid.dy], [121, 23, 0.5, 0.5]);
  assert.deepEqual([...grid.mmi], [40, 50, 60, 50, 60, 70, 60, 70, 80]);
  assert.equal(gridMmiAt(grid, 24, 122), 8);
  assert.equal(parseGrid({ ...json, domain: { axes: { x: { start: 1, stop: 1, num: 3 }, y: json.domain.axes.y } } }), null);
});
