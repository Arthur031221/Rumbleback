import type { Map } from 'maplibre-gl';
import { distanceDeg, ring, type LatLon } from '../core/geo.ts';
import { nearestPoint } from '../core/hit.ts';
import { mmiColor, mmiRgb } from '../core/intensity.ts';
import type { IntensityGrid, QuakeData } from '../core/quake.ts';
import type { TravelTimes } from '../core/traveltime.ts';
import { blindRadiusKm } from '../core/warning.ts';
import { t } from './i18n.ts';
import type { LayerKey } from './state.ts';
import type { Theme } from './style.ts';

export interface PinFrame {
  lat: number;
  lon: number;
  pSec: number;
  sSec: number;
}

export interface Frame {
  t: number;
  quake: QuakeData;
  tt: TravelTimes;
  theme: Theme;
  layers: Record<LayerKey, boolean>;
  pin: PinFrame | null;
  alertSec: number;
  /** Playback speed, used to keep ripples visible for a similar time on screen at any speed. */
  speed: number;
}

/** The dot under the pointer: which kind, and its place in the quake's list of that kind. */
export interface Hit {
  kind: 'pick' | 'instrument' | 'felt';
  index: number;
}

const COLORS = {
  dark: { p: '76,195,255', s: '255,123,66', outline: 'rgba(7,11,16,0.85)', text: '#06101a', muted: 'rgba(214,226,238,0.8)' },
  light: { p: '10,116,196', s: '191,58,9', outline: 'rgba(255,255,255,0.95)', text: '#ffffff', muted: 'rgba(37,50,63,0.8)' },
} as const;

const BAND_SECONDS = { P: 2.2, S: 3.4 } as const;
const MAX_LAT = 85.05;
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (Math.min(Math.max(lat, -MAX_LAT), MAX_LAT) * Math.PI) / 360));

interface GridImage {
  canvas: HTMLCanvasElement;
  west: number;
  east: number;
  south: number;
  north: number;
}

/** The ShakeMap resampled so rows are even in Web Mercator, which is how the map draws latitude. */
function renderGrid(g: IntensityGrid): GridImage {
  const north = g.south + (g.rows - 1) * g.dy;
  const east = g.west + (g.cols - 1) * g.dx;
  const [yS, yN] = [mercY(g.south), mercY(north)];
  const canvas = document.createElement('canvas');
  canvas.width = g.cols * 2;
  canvas.height = g.rows * 2;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(canvas.width, canvas.height);
  for (let py = 0; py < canvas.height; py++) {
    const y = yN - ((yN - yS) * py) / (canvas.height - 1);
    const lat = ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
    const fy = Math.min(g.rows - 1.0001, Math.max(0, (lat - g.south) / g.dy));
    const [y0, ty] = [Math.floor(fy), fy - Math.floor(fy)];
    for (let px = 0; px < canvas.width; px++) {
      const fx = Math.min(g.cols - 1.0001, (px / (canvas.width - 1)) * (g.cols - 1));
      const [x0, tx] = [Math.floor(fx), fx - Math.floor(fx)];
      const v = [
        g.mmi[y0 * g.cols + x0]!,
        g.mmi[y0 * g.cols + x0 + 1]!,
        g.mmi[(y0 + 1) * g.cols + x0]!,
        g.mmi[(y0 + 1) * g.cols + x0 + 1]!,
      ];
      if (v.some((n) => n === 0)) continue;
      const mmi = (v[0]! * (1 - tx) * (1 - ty) + v[1]! * tx * (1 - ty) + v[2]! * (1 - tx) * ty + v[3]! * tx * ty) / 10;
      const alpha = Math.min(1, Math.max(0, (mmi - 2.6) / 3.2)) * 0.52;
      if (alpha <= 0) continue;
      const [r, gr, b] = mmiRgb(mmi);
      const i = (py * canvas.width + px) * 4;
      img.data[i] = r;
      img.data[i + 1] = gr;
      img.data[i + 2] = b;
      img.data[i + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas, west: g.west, east, south: g.south, north };
}

export class Overlay {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private quake: QuakeData | null = null;
  private tt: TravelTimes | null = null;
  private gridImage: GridImage | null = null;
  /** Distance in degrees from the epicenter to the farthest corner of the ShakeMap grid. */
  private gridReach = 0;
  private instrumentT = new Float32Array(0);
  private feltT = new Float32Array(0);
  /** Each dot's fill, made once per quake: building the string takes longer than drawing the dot, and it ran per dot per frame. */
  private instrumentFill: string[] = [];
  private feltFill: string[] = [];
  private proj = { picks: new Float32Array(0), instruments: new Float32Array(0), felt: new Float32Array(0), dirty: true };

  /** The frame on screen, which says what is lit and which layers show. */
  private shown: Frame | null = null;
  /** How far from the top and from the bottom of the map a wavefront's letter may sit and still be seen. */
  private clear = { top: 62, bottom: 130 };
  /** Whether the seismogram strip, and so the station it comes from, is on screen. */
  private station = true;

  private readonly map: Map;
  readonly canvas: HTMLCanvasElement;

  constructor(map: Map, canvas: HTMLCanvasElement) {
    this.map = map;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    map.on('move', () => (this.proj.dirty = true));
    map.on('resize', () => this.resize());
    this.resize();
  }

  setClear(clear: { top: number; bottom: number }): void {
    this.clear = clear;
  }

  setStation(show: boolean): void {
    this.station = show;
  }

  resize(): void {
    const el = this.map.getContainer();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = el.clientWidth;
    this.height = el.clientHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.proj.dirty = true;
  }

  setQuake(quake: QuakeData, tt: TravelTimes): void {
    this.quake = quake;
    this.tt = tt;
    const epi: LatLon = [quake.quake.lat, quake.quake.lon];
    this.instrumentT = Float32Array.from(quake.instruments, (i) => tt.time('S', distanceDeg(epi, [i.lat, i.lon])));
    this.feltT = Float32Array.from(quake.felt, (f) => tt.time('S', distanceDeg(epi, [f.lat, f.lon])));
    this.instrumentFill = quake.instruments.map((i) => mmiColor(i.mmi, 0.95));
    this.feltFill = quake.felt.map((f) => mmiColor(f.mmi, 0.8));
    this.gridImage = quake.grid ? renderGrid(quake.grid) : null;
    const g = this.gridImage;
    this.gridReach = g
      ? Math.max(
          ...[
            [g.south, g.west],
            [g.south, g.east],
            [g.north, g.west],
            [g.north, g.east],
          ].map((c) => distanceDeg(epi, [c[0]!, c[1]!])),
        )
      : 0;
    this.proj.dirty = true;
  }

  /**
   * The lit dot at a point of the map, for the inspector: a seismometer first, then a strong motion instrument,
   * then a felt report. A dot that has not lit yet, or whose layer is off, is not there.
   */
  hit(x: number, y: number): Hit | null {
    const f = this.shown;
    // New data may have arrived since the last frame: the dots are the new ones, and the frame still says the old.
    if (!f || f.quake !== this.quake) return null;
    if (this.proj.dirty) this.reproject();
    if (f.layers.picks) {
      const i = nearestPoint(this.proj.picks, x, y, 8, (n) => f.quake.picks[n]!.t <= f.t);
      if (i >= 0) return { kind: 'pick', index: i };
    }
    if (f.layers.instruments) {
      const i = nearestPoint(this.proj.instruments, x, y, 9, (n) => this.instrumentT[n]! <= f.t);
      if (i >= 0) return { kind: 'instrument', index: i };
    }
    if (f.layers.felt) {
      const i = nearestPoint(this.proj.felt, x, y, 6, (n) => this.feltT[n]! <= f.t);
      if (i >= 0) return { kind: 'felt', index: i };
    }
    return null;
  }

  private screen(lat: number, lon: number, center: number): [number, number] {
    const lng = lon + 360 * Math.round((center - lon) / 360);
    const p = this.map.project([lng, Math.min(Math.max(lat, -MAX_LAT), MAX_LAT)]);
    return [p.x, p.y];
  }

  private reproject(): void {
    if (!this.quake) return;
    const center = this.map.getCenter().lng;
    const fill = (items: { lat: number; lon: number }[]) => {
      const out = new Float32Array(items.length * 2);
      items.forEach((it, i) => {
        const [x, y] = this.screen(it.lat, it.lon, center);
        out[i * 2] = x;
        out[i * 2 + 1] = y;
      });
      return out;
    };
    this.proj.picks = fill(this.quake.picks);
    this.proj.instruments = fill(this.quake.instruments);
    this.proj.felt = fill(this.quake.felt);
    this.proj.dirty = false;
  }

  /**
   * Screen points of a wavefront at an epicentral distance, one per bearing. `closed` is false for a ring
   * that goes over a pole: its longitude winds a full turn, so its two ends are a world apart on the map and
   * it can only be drawn as an open line.
   */
  private ringScreen(epi: LatLon, deg: number): { pts: [number, number][]; closed: boolean } {
    const steps = deg < 0.5 ? 48 : deg < 4 ? 120 : 220;
    // Dots, the ShakeMap and the rings all use the world copy nearest the middle of the view.
    const shift = 360 * Math.round((this.map.getCenter().lng - epi[1]) / 360);
    const raw = ring(epi, deg, steps);
    const pts = raw.map(([lon, lat]): [number, number] => {
      const p = this.map.project([lon + shift, Math.min(Math.max(lat, -MAX_LAT), MAX_LAT)]);
      return [p.x, p.y];
    });
    return { pts, closed: Math.abs(raw[0]![0] - raw[raw.length - 1]![0]) < 180 };
  }

  draw(f: Frame | null): void {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    this.shown = null;
    if (!f || !this.quake || !this.tt || this.quake !== f.quake) return;
    this.shown = f;
    if (this.proj.dirty) this.reproject();

    const c = COLORS[f.theme];
    const q = f.quake.quake;
    const epi: LatLon = [q.lat, q.lon];
    const center = this.map.getCenter().lng;
    const ripple = 1.1 * Math.max(1, Math.sqrt(f.speed));
    const sFront = f.tt.distanceAt('S', f.t);

    if (f.layers.shaking && this.gridImage && sFront !== null) this.drawShakeMap(this.gridImage, epi, sFront);
    if (f.layers.blind && f.pin) this.drawBlindZone(f, epi, c);
    if (f.layers.felt) this.drawFelt(f);
    if (f.layers.instruments) this.drawInstruments(f, ripple, c);
    if (f.layers.picks) {
      this.drawPicks(f, ripple, c);
      if (this.station) this.drawStation(f, center, c);
    }
    if (f.layers.waves) {
      for (const wave of ['S', 'P'] as const) this.drawWave(f, wave, epi, c);
    }
    this.drawEpicenter(f, epi, center, c);
    if (f.pin) this.drawPinFlash(f, center, ripple, c);
  }

  private drawShakeMap(img: GridImage, epi: LatLon, sFront: number): void {
    const { ctx } = this;
    const nw = this.map.project([img.west, img.north]);
    const se = this.map.project([img.east, img.south]);
    const center = this.map.getCenter().lng;
    // Draw the world copy nearest the view centre.
    const shift = this.map.project([img.west + 360 * Math.round((center - (img.west + img.east) / 2) / 360), img.north]).x - nw.x;
    ctx.save();
    // Once the front has passed the farthest corner of the grid the whole map is shown, with no clip to get wrong.
    const front = sFront < this.gridReach ? this.ringScreen(epi, sFront) : null;
    if (front?.closed) {
      ctx.beginPath();
      front.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.clip();
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img.canvas, nw.x + shift, nw.y, se.x - nw.x, se.y - nw.y);
    ctx.restore();
  }

  private drawWave(f: Frame, wave: 'P' | 'S', epi: LatLon, c: (typeof COLORS)[Theme]): void {
    const { ctx } = this;
    const outerDeg = f.tt.distanceAt(wave, f.t);
    if (outerDeg === null || outerDeg <= 0) return;
    const innerDeg = f.tt.distanceAt(wave, f.t - BAND_SECONDS[wave]);
    const rgb = wave === 'P' ? c.p : c.s;
    const { pts: outer, closed } = this.ringScreen(epi, outerDeg);

    // The soft band behind the front needs closed rings. A front over a pole is just the line.
    if (closed) {
      ctx.beginPath();
      outer.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      const inner = innerDeg !== null && innerDeg > 0 ? this.ringScreen(epi, innerDeg) : null;
      if (inner?.closed) {
        inner.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
      }
      ctx.fillStyle = `rgba(${rgb},${wave === 'P' ? 0.1 : 0.14})`;
      ctx.fill('evenodd');
    }

    ctx.beginPath();
    outer.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (closed) ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(${rgb},0.2)`;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = `rgb(${rgb})`;
    ctx.lineWidth = wave === 'P' ? 2 : 2.6;
    ctx.stroke();

    // The letter sits on the highest part of the ring that is on screen, below the top bar.
    let top: [number, number] | null = null;
    for (const p of outer) {
      if (p[1] < this.clear.top || p[1] > this.height - this.clear.bottom || p[0] < 16 || p[0] > this.width - 16) continue;
      if (!top || p[1] < top[1]) top = p;
    }
    if (!top) return;
    const [bx, by] = top;
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.fill();
    ctx.fillStyle = c.text;
    ctx.font = '700 11px "Bricolage Grotesque Variable", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(wave, bx, by + 0.5);
  }

  private dot(x: number, y: number, r: number, fill: string, outline: string): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = outline;
    ctx.stroke();
  }

  private ripple(x: number, y: number, age: number, span: number, base: number, rgb: string): void {
    if (age < 0 || age > span) return;
    const k = age / span;
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, base + 16 * k, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${rgb},${0.9 * (1 - k)})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  private visible(x: number, y: number): boolean {
    return x > -20 && y > -20 && x < this.width + 20 && y < this.height + 20;
  }

  private drawPicks(f: Frame, span: number, c: (typeof COLORS)[Theme]): void {
    const xy = this.proj.picks;
    const picks = f.quake.picks;
    for (let i = 0; i < picks.length; i++) {
      const pick = picks[i]!;
      if (pick.t > f.t) break; // picks are sorted by time
      const [x, y] = [xy[i * 2]!, xy[i * 2 + 1]!];
      if (!this.visible(x, y)) continue;
      const rgb = pick.wave === 'P' ? c.p : c.s;
      this.ripple(x, y, f.t - pick.t, span, 3, rgb);
      this.dot(x, y, 2.8, `rgb(${rgb})`, c.outline);
    }
  }

  private drawInstruments(f: Frame, span: number, c: (typeof COLORS)[Theme]): void {
    const xy = this.proj.instruments;
    const list = f.quake.instruments;
    for (let i = 0; i < list.length; i++) {
      if (this.instrumentT[i]! > f.t) continue;
      const [x, y] = [xy[i * 2]!, xy[i * 2 + 1]!];
      if (!this.visible(x, y)) continue;
      const mmi = list[i]!.mmi;
      this.ripple(x, y, f.t - this.instrumentT[i]!, span, 4, c.s);
      this.dot(x, y, 3.4 + Math.max(0, mmi - 3) * 0.7, this.instrumentFill[i]!, c.outline);
    }
  }

  private drawFelt(f: Frame): void {
    const { ctx } = this;
    const xy = this.proj.felt;
    const list = f.quake.felt;
    for (let i = 0; i < list.length; i++) {
      if (this.feltT[i]! > f.t) continue;
      const [x, y] = [xy[i * 2]!, xy[i * 2 + 1]!];
      if (!this.visible(x, y)) continue;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = this.feltFill[i]!;
      ctx.fill();
    }
  }

  /** The station whose seismogram is in the timeline strip: a ring and its name. */
  private drawStation(f: Frame, center: number, c: (typeof COLORS)[Theme]): void {
    const seis = f.quake.seismogram;
    if (!seis) return;
    const { ctx } = this;
    const [x, y] = this.screen(seis.lat, seis.lon, center);
    if (!this.visible(x, y)) return;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = c.muted;
    ctx.stroke();
    ctx.font = '600 11px "JetBrains Mono Variable", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = f.theme === 'dark' ? 'rgba(7,11,16,0.9)' : 'rgba(255,255,255,0.95)';
    ctx.strokeText(seis.sta, x + 13, y);
    ctx.fillStyle = c.muted;
    ctx.fillText(seis.sta, x + 13, y);
  }

  private drawBlindZone(f: Frame, epi: LatLon, c: (typeof COLORS)[Theme]): void {
    const { ctx } = this;
    const km = blindRadiusKm(f.tt, f.alertSec);
    if (km <= 0) return;
    const deg = km / 111.195;
    const { pts } = this.ringScreen(epi, deg);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = f.theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(20,30,40,0.06)';
    ctx.fill();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.setLineDash([]);
    let top = pts[0]!;
    for (const p of pts) if (p[1] < top[1]) top = p;
    if (this.visible(top[0], top[1])) {
      ctx.font = '600 11px "Bricolage Grotesque Variable", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3;
      ctx.strokeStyle = f.theme === 'dark' ? 'rgba(7,11,16,0.9)' : 'rgba(255,255,255,0.95)';
      ctx.strokeText(t('layer.blind'), top[0], top[1] - 4);
      ctx.fillStyle = c.muted;
      ctx.fillText(t('layer.blind'), top[0], top[1] - 4);
    }
  }

  private drawEpicenter(f: Frame, epi: LatLon, center: number, c: (typeof COLORS)[Theme]): void {
    const { ctx } = this;
    const [x, y] = this.screen(epi[0], epi[1], center);
    if (f.t >= 0 && f.t < 2.4) {
      const k = f.t / 2.4;
      ctx.beginPath();
      ctx.arc(x, y, 8 + 54 * k, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${c.s},${0.85 * (1 - k)})`;
      ctx.lineWidth = 3 * (1 - k) + 0.8;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = f.t >= 0 ? `rgb(${c.s})` : 'transparent';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = f.theme === 'dark' ? '#fff' : '#142130';
    ctx.stroke();
  }

  private drawPinFlash(f: Frame, center: number, span: number, c: (typeof COLORS)[Theme]): void {
    const pin = f.pin!;
    const [x, y] = this.screen(pin.lat, pin.lon, center);
    this.ripple(x, y, f.t - pin.pSec, span, 6, c.p);
    this.ripple(x, y, f.t - pin.sSec, span * 1.4, 6, c.s);
  }
}
