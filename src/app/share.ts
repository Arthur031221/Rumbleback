import { h } from './dom.ts';
import { icon } from './icons.ts';
import { seconds, t } from './i18n.ts';

export interface HudInfo {
  title: string;
  magnitude: string;
  /** Replay clock, seconds after the origin. */
  time: number;
  /** Present when the viewer has a pin. The name is a city or a generic label, never coordinates. */
  pin?: { name: string; pSec: number; sSec: number; alertSec: number; warningSec: number; blind: boolean };
}

export interface ShareSources {
  /** The map and the overlay canvases, drawn one over the other. */
  layers(): { map: HTMLCanvasElement; overlay: HTMLCanvasElement; width: number; height: number };
  hud(): HudInfo;
  /** A point on the map (in CSS pixels) that a card crop should keep, such as the pin. */
  focus(): [number, number][];
  link(includePin: boolean): string;
  hasPin(): boolean;
  dark(): boolean;
  /** The pin in CSS pixels on the map, or null without a pin. */
  pinPoint(): [number, number] | null;
  /** Pauses the replay, so the card, the link and the preview all show the same moment. */
  freeze(): void;
  hasQuake(): boolean;
  /** Plays the replay from the start. Calls `onFrame` after each drawn frame and resolves true if it ran to the end. */
  playForClip(onFrame: () => void): Promise<boolean>;
  clipSeconds(): number;
}

const SANS = '"Bricolage Grotesque Variable", system-ui, sans-serif';
const MONO = '"JetBrains Mono Variable", ui-monospace, monospace';

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h2: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h2, r);
  ctx.arcTo(x + w, y + h2, x, y + h2, r);
  ctx.arcTo(x, y + h2, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The caption block drawn over a frame, for cards and clips. `unit` is the frame width divided by 1080. */
function drawHud(ctx: CanvasRenderingContext2D, w: number, h2: number, info: HudInfo, unit: number, dark: boolean, bottom: number): void {
  const ink = '#f1f6fb';
  const soft = 'rgba(225,235,245,0.78)';
  const pad = 48 * unit;
  // A scrim keeps the text readable over any part of the map.
  const scrim = ctx.createLinearGradient(0, h2 - bottom - 80 * unit, 0, h2);
  scrim.addColorStop(0, 'rgba(6,10,15,0)');
  scrim.addColorStop(0.35, dark ? 'rgba(6,10,15,0.78)' : 'rgba(6,10,15,0.82)');
  scrim.addColorStop(1, 'rgba(6,10,15,0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h2 - bottom - 80 * unit, w, bottom + 80 * unit);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  let y = h2 - pad;
  ctx.font = `500 ${22 * unit}px ${SANS}`;
  ctx.fillStyle = soft;
  ctx.fillText(t('share.credit'), pad, y);
  y -= 46 * unit;

  if (info.pin) {
    const p = info.pin;
    const cols = [
      [t('pin.p'), seconds(p.pSec), '#4cc3ff'],
      [t('pin.s'), seconds(p.sSec), '#ff7b42'],
    ] as const;
    ctx.font = `600 ${26 * unit}px ${SANS}`;
    ctx.fillStyle = soft;
    ctx.fillText(p.blind ? t('alert.blind') : t('share.cardLine', { s: seconds(p.warningSec), a: seconds(p.alertSec) }), pad, y);
    y -= 70 * unit;
    let x = pad;
    for (const [label, value, color] of cols) {
      ctx.font = `600 ${24 * unit}px ${SANS}`;
      ctx.fillStyle = color;
      ctx.fillText(label, x, y - 62 * unit);
      ctx.font = `700 ${74 * unit}px ${MONO}`;
      ctx.fillStyle = ink;
      ctx.fillText(value, x, y);
      x += 330 * unit;
    }
    y -= 112 * unit;
    ctx.font = `600 ${32 * unit}px ${SANS}`;
    ctx.fillStyle = ink;
    ctx.fillText(p.name, pad, y);
    y -= 56 * unit;
  }

  ctx.font = `700 ${50 * unit}px ${SANS}`;
  ctx.fillStyle = ink;
  ctx.fillText(info.title, pad, y);
  y -= 58 * unit;
  ctx.font = `600 ${24 * unit}px ${MONO}`;
  ctx.fillStyle = soft;
  ctx.fillText(`M${info.magnitude}   T${info.time < 0 ? '' : '+'}${seconds(info.time)}`, pad, y);
}

/** The pin as it looks on the page: a round head and a point, so a card shows where the numbers belong. */
function drawPinMarker(ctx: CanvasRenderingContext2D, x: number, y: number, u: number): void {
  ctx.fillStyle = '#f1f6fb';
  ctx.strokeStyle = 'rgba(8,13,19,0.85)';
  ctx.lineWidth = 1.5 * u;
  ctx.beginPath();
  ctx.arc(x, y - 22 * u, 11 * u, 0, Math.PI * 2);
  ctx.moveTo(x - 8 * u, y - 15 * u);
  ctx.lineTo(x, y);
  ctx.lineTo(x + 8 * u, y - 15 * u);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#0b1118';
  ctx.beginPath();
  ctx.arc(x, y - 22 * u, 4 * u, 0, Math.PI * 2);
  ctx.fill();
}

function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number): void {
  ctx.fillStyle = '#f1f6fb';
  ctx.font = `700 ${30 * unit}px ${SANS}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.beginPath();
  ctx.arc(x + 16 * unit, y, 11 * unit, 0, Math.PI * 2);
  ctx.strokeStyle = '#ff7b42';
  ctx.lineWidth = 4 * unit;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 16 * unit, y, 4 * unit, 0, Math.PI * 2);
  ctx.fillStyle = '#ff7b42';
  ctx.fill();
  ctx.fillStyle = '#f1f6fb';
  ctx.fillText('Rumbleback', x + 40 * unit, y + 1 * unit);
}

interface Run {
  text: string;
  font: string;
  color: string;
}

/** The caption for a clip: a small panel in the corner, so the map stays the subject. `u` is the frame width divided by 1280. */
function drawClipHud(ctx: CanvasRenderingContext2D, h2: number, info: HudInfo, u: number): void {
  const [ink, soft, p, s] = ['#f1f6fb', 'rgba(225,235,245,0.78)', '#4cc3ff', '#ff7b42'];
  const lines: Run[][] = [
    [{ text: info.title, font: `700 ${28 * u}px ${SANS}`, color: ink }],
    [{ text: `M${info.magnitude}   T${info.time < 0 ? '' : '+'}${seconds(info.time)}`, font: `600 ${19 * u}px ${MONO}`, color: soft }],
  ];
  if (info.pin) {
    const font = `700 ${21 * u}px ${MONO}`;
    lines.push([
      { text: info.pin.name, font: `600 ${21 * u}px ${SANS}`, color: ink },
      { text: `${t('pin.p')} ${seconds(info.pin.pSec)}`, font, color: p },
      { text: `${t('pin.s')} ${seconds(info.pin.sSec)}`, font, color: s },
    ]);
  }
  const [pad, inset, gap] = [20 * u, 18 * u, 20 * u];
  const widthOf = (runs: Run[]) =>
    runs.reduce((sum, r) => {
      ctx.font = r.font;
      return sum + ctx.measureText(r.text).width + gap;
    }, -gap);
  const panelW = Math.max(...lines.map(widthOf)) + 2 * inset;
  const panelH = (lines.length === 3 ? 124 : 84) * u;
  ctx.fillStyle = 'rgba(8,13,19,0.84)';
  roundedRect(ctx, pad, h2 - pad - panelH, panelW, panelH, 14 * u);
  ctx.fill();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  let y = h2 - pad - panelH + 38 * u;
  for (const runs of lines) {
    let x = pad + inset;
    for (const r of runs) {
      ctx.font = r.font;
      ctx.fillStyle = r.color;
      ctx.fillText(r.text, x, y);
      x += ctx.measureText(r.text).width + gap;
    }
    y += (runs === lines[0] ? 30 : 36) * u;
  }
  // The name sits on a dark pill because the map under it can be light.
  ctx.font = `700 ${22 * u}px ${SANS}`;
  const nameW = ctx.measureText('Rumbleback').width;
  ctx.fillStyle = 'rgba(8,13,19,0.84)';
  roundedRect(ctx, pad, pad, nameW + 56 * u, 40 * u, 20 * u);
  ctx.fill();
  drawMark(ctx, pad + 6 * u, pad + 20 * u, u * 0.72);
}

/** A card of the current frame: the map cropped to the card shape around what matters, with the numbers over it. */
export function composeCard(src: ShareSources, kind: 'square' | 'story'): HTMLCanvasElement {
  const { map, overlay, width, height } = src.layers();
  const [cw, ch] = kind === 'square' ? [1080, 1080] : [1080, 1920];
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const ctx = out.getContext('2d')!;
  // The largest crop of the screen with the card's shape, nudged to keep the focus points inside.
  const aspect = cw / ch;
  let cropW = Math.min(width, height * aspect);
  let cropH = cropW / aspect;
  if (cropH > height) [cropW, cropH] = [height * aspect, height];
  const focus = src.focus();
  const fx = focus.length ? focus.reduce((a, p) => a + p[0], 0) / focus.length : width / 2;
  const fy = focus.length ? focus.reduce((a, p) => a + p[1], 0) / focus.length : height / 2;
  const x0 = Math.min(Math.max(fx - cropW / 2, 0), width - cropW);
  const y0 = Math.min(Math.max(fy - cropH * 0.42, 0), height - cropH);
  // The two canvases can have different pixel ratios, so each one is scaled on its own.
  for (const layer of [map, overlay]) {
    const [kx, ky] = [layer.width / width, layer.height / height];
    ctx.drawImage(layer, x0 * kx, y0 * ky, cropW * kx, cropH * ky, 0, 0, cw, ch);
  }
  const unit = cw / 1080;
  const pin = src.pinPoint();
  if (pin && pin[0] >= x0 && pin[0] <= x0 + cropW && pin[1] >= y0 && pin[1] <= y0 + cropH) {
    drawPinMarker(ctx, ((pin[0] - x0) / cropW) * cw, ((pin[1] - y0) / cropH) * ch, unit * 1.6);
  }
  drawHud(ctx, cw, ch, src.hud(), unit, src.dark(), (kind === 'square' ? 560 : 640) * unit);
  drawMark(ctx, 48 * unit, 66 * unit, unit);
  return out;
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Hands a file to the system share sheet on a touch device, where saving a download is awkward (on an iPhone
 * it opens the image in a tab). Returns false when there is no sheet to use, and the caller downloads it.
 */
async function shareFile(file: File): Promise<boolean> {
  if (!window.matchMedia('(pointer: coarse)').matches || !navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title: 'Rumbleback' });
    return true;
  } catch (e) {
    // Closing the sheet is an answer. Anything else, such as a browser that wants a fresh tap, falls back.
    return (e as Error).name === 'AbortError';
  }
}

const canvasBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('no image'))), 'image/png'));

function clipFormat(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const [mime, ext] of [
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm;codecs=vp8', 'webm'],
    ['video/webm', 'webm'],
    ['video/mp4', 'mp4'],
  ] as const) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return null;
}

export function createShare(src: ShareSources) {
  const dialog = h('dialog', { class: 'sheet share', 'aria-labelledby': 'share-title' });
  const title = h('h2', { id: 'share-title', class: 'sheet-title' });
  const closeBtn = h('button', { class: 'icon-btn', type: 'button', onclick: () => dialog.close() }, icon('close'));
  const preview = h('div', { class: 'share-preview' });
  const pinBox = h('input', { id: 'share-pin', type: 'checkbox' });
  const pinLabel = h('label', { class: 'check', for: 'share-pin' }, pinBox, h('span'));
  const copy = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => void copyLink() }, icon('link'), h('span'));
  const square = h('button', { class: 'btn', type: 'button', onclick: () => void save('square') }, icon('download'), h('span'));
  const story = h('button', { class: 'btn', type: 'button', onclick: () => void save('story') }, icon('download'), h('span'));
  const clip = h('button', { class: 'btn', type: 'button', onclick: () => void record() }, icon('video'), h('span'));
  const note = h('p', { class: 'fine' });
  const status = h('p', { class: 'share-status', role: 'status' });
  dialog.append(
    h('div', { class: 'sheet-head' }, title, closeBtn),
    preview,
    pinLabel,
    h('div', { class: 'share-actions' }, copy, square, story, clip),
    status,
    note,
  );
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());

  const label = (b: HTMLElement) => b.querySelector('span')!;
  let recording = false;

  async function copyLink(): Promise<void> {
    const url = src.link(pinBox.checked && src.hasPin());
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = t('share.copied');
    } catch {
      window.prompt(t('share.link'), url);
    }
  }

  async function save(kind: 'square' | 'story'): Promise<void> {
    const name = `rumbleback-${kind}.png`;
    const blob = await canvasBlob(composeCard(src, kind));
    if (!(await shareFile(new File([blob], name, { type: blob.type })))) download(blob, name);
  }

  function renderPreview(): void {
    const card = composeCard(src, 'square');
    card.className = 'share-card';
    card.setAttribute('role', 'img');
    card.setAttribute('aria-label', t('share.title'));
    preview.replaceChildren(card);
  }

  async function record(): Promise<void> {
    const fmt = clipFormat();
    if (!fmt || recording || !src.hasQuake()) return;
    recording = true;
    // The card and the link read the current frame, which keeps moving while a clip is recorded.
    for (const b of [copy, square, story, clip]) b.disabled = true;
    const { width, height } = src.layers();
    const scale = Math.min(1, 1280 / width);
    const out = document.createElement('canvas');
    out.width = Math.round(width * scale);
    out.height = Math.round(height * scale);
    const ctx = out.getContext('2d')!;
    const stream = out.captureStream(30);
    const chunks: Blob[] = [];
    let rec: MediaRecorder | null = null;
    try {
      rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: 6_000_000 });
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const stopped = new Promise<void>((res) => ((rec as MediaRecorder).onstop = () => res()));
      const total = src.clipSeconds();
      const started = performance.now();
      rec.start(250);
      const completed = await src.playForClip(() => {
        const l = src.layers();
        ctx.drawImage(l.map, 0, 0, out.width, out.height);
        ctx.drawImage(l.overlay, 0, 0, out.width, out.height);
        const pin = src.pinPoint();
        if (pin) drawPinMarker(ctx, pin[0] * scale, pin[1] * scale, scale);
        drawClipHud(ctx, out.height, src.hud(), out.width / 1280);
        status.textContent = t('share.recording', { s: seconds(Math.max(0, total - (performance.now() - started) / 1000)) });
      });
      await new Promise((r) => setTimeout(r, 400));
      rec.stop();
      await stopped;
      if (completed) download(new Blob(chunks, { type: fmt.mime }), `rumbleback.${fmt.ext}`);
    } finally {
      if (rec && rec.state !== 'inactive') rec.stop();
      for (const track of stream.getTracks()) track.stop();
      status.textContent = '';
      recording = false;
      for (const b of [copy, square, story]) b.disabled = false;
      relocalize();
    }
  }

  function relocalize(): void {
    title.textContent = t('share.title');
    closeBtn.setAttribute('aria-label', t('common.close'));
    label(pinLabel).textContent = t('share.includePin');
    pinBox.disabled = !src.hasPin();
    if (!src.hasPin()) pinBox.checked = false;
    label(copy).textContent = t('share.link');
    label(square).textContent = t('share.card');
    label(story).textContent = t('share.story');
    label(clip).textContent = clipFormat() ? t('share.clip') : t('share.unsupported');
    clip.disabled = !clipFormat() || !src.hasQuake() || recording;
    note.textContent = t('share.cardPrivacy');
  }

  return {
    open(): void {
      src.freeze();
      relocalize();
      status.textContent = '';
      renderPreview();
      if (!dialog.open) dialog.showModal();
    },
    relocalize,
    element: dialog,
  };
}
