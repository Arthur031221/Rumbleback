import { KM_PER_DEGREE } from '../core/geo.ts';
import type { Seismogram } from '../core/quake.ts';
import { TravelTimes } from '../core/traveltime.ts';
import { km, t } from './i18n.ts';
import { get, START } from './state.ts';

/** The strip is shorter on a phone, where the dock shares the screen with the sheet. */
export const stripHeight = (): number => (window.matchMedia('(max-width: 820px)').matches ? 52 : 70);
/** Rows at the top of the strip: the caption, then the letters that name the P and S lines. */
const CAPTION_ROW = 13;
const LETTER_ROW = 11;
const THUMB = 18; // width of the timeline thumb, so the strip lines up with the track above and below it

const MONO = '"JetBrains Mono Variable", ui-monospace, monospace';
const SANS = '"Bricolage Grotesque Variable", system-ui, sans-serif';

/**
 * The real seismogram of one station along the timeline: the trace appears as the replay reaches it,
 * with the model's P and S arrival at that station and the arrival an analyst picked drawn on top.
 */
export function createStrip(canvas: HTMLCanvasElement) {
  let width = 0;
  let height = 0;
  let dpr = 1;
  let marks: { p: number; s: number; picked: number | null } | null = null;
  let source: Seismogram | null = null;
  let picksSeen: unknown = null;

  function resize(): void {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = stripHeight();
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  /** Call after any state change. The marks and the size are only worked out again when the quake changes. */
  function update(): void {
    const s = get();
    const seis = s.quake?.seismogram ?? null;
    canvas.hidden = !seis;
    if (!seis || !s.tt || !s.quake) {
      source = null;
      marks = null;
      return;
    }
    if (seis !== source || s.quake.picks !== picksSeen) {
      source = seis;
      picksSeen = s.quake.picks;
      const picked = s.quake.picks.find((p) => p.sta === seis.sta && p.wave === 'P');
      const tt = new TravelTimes(s.quake.quake.depthKm);
      marks = { p: tt.time('P', seis.dist), s: tt.time('S', seis.dist), picked: picked?.t ?? null };
    }
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', t('seismogram.note', { sta: seis.sta, km: km(seis.dist * KM_PER_DEGREE) }));
    if (canvas.clientWidth !== width || stripHeight() !== height) resize();
    tick(clockNow);
  }

  let clockNow = START;

  function tick(time: number): void {
    clockNow = time;
    const s = get();
    if (!source || !marks || canvas.hidden || !s.quake) return;
    if (!width) resize();
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const dark = document.documentElement.dataset.theme !== 'light';
    const ink = dark ? '233,240,247' : '15,26,37';
    const [pc, sc] = dark ? ['76,195,255', '255,123,66'] : ['10,111,189', '191,58,9'];
    const x = (sec: number) => {
      const pct = (sec - START) / (s.length - START);
      return pct * width + (0.5 - pct) * THUMB;
    };
    // The trace has the space under the two label rows. A full-scale swing fills it.
    const top = CAPTION_ROW + LETTER_ROW;
    const mid = top + (height - top) / 2;
    const amp = ((height - top) / 2 - 2) / 1000;

    // The whole trace faintly, and the part the replay has reached in full strength.
    for (const [alpha, until] of [
      [0.2, Infinity],
      [0.85, time],
    ] as const) {
      ctx.strokeStyle = `rgba(${ink},${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      source.min.forEach((lo, i) => {
        const at = source!.t0 + i * source!.bin;
        if (at > until || at < START || at > s.length) return;
        const px = Math.round(x(at)) + 0.5;
        ctx.moveTo(px, mid - source!.max[i]! * amp);
        ctx.lineTo(px, mid - lo * amp - (lo === source!.max[i] ? 1 : 0));
      });
      ctx.stroke();
    }

    ctx.font = `700 10px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const [sec, rgb, letter] of [
      [marks.p, pc, 'P'],
      [marks.s, sc, 'S'],
    ] as const) {
      if (sec < START || sec > s.length) continue;
      const px = Math.round(x(sec)) + 0.5;
      ctx.strokeStyle = `rgba(${rgb},0.9)`;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px, height);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.fillText(letter, px, CAPTION_ROW);
    }
    if (marks.picked !== null && marks.picked >= START && marks.picked <= s.length) {
      const px = x(marks.picked);
      ctx.fillStyle = `rgb(${pc})`;
      ctx.beginPath();
      ctx.moveTo(px, height - 1);
      ctx.lineTo(px - 4, height - 8);
      ctx.lineTo(px + 4, height - 8);
      ctx.closePath();
      ctx.fill();
    }

    const head = Math.round(x(Math.min(Math.max(time, START), s.length))) + 0.5;
    ctx.strokeStyle = `rgba(${ink},0.9)`;
    ctx.beginPath();
    ctx.moveTo(head, 0);
    ctx.lineTo(head, height);
    ctx.stroke();

    ctx.font = `600 11.5px ${SANS}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = `rgba(${ink},0.62)`;
    const distance = km(source.dist * KM_PER_DEGREE);
    // A long caption in a narrow strip falls back to the station and its distance.
    let caption = t('seismogram.label', { sta: source.sta, km: distance });
    if (ctx.measureText(caption).width > width - 8) caption = `${source.sta}, ${distance}`;
    ctx.fillText(caption, width - 4, 1);
  }

  window.addEventListener('resize', () => {
    resize();
    tick(clockNow);
  });

  return { update, tick };
}
