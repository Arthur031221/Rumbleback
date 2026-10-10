import { SPEEDS } from '../core/replay.ts';
import { pinTiming } from './derived.ts';
import { h } from './dom.ts';
import { icon } from './icons.ts';
import { seconds, t } from './i18n.ts';
import { clock, get, START } from './state.ts';
import { createStrip, STRIP_HEIGHT } from './strip.ts';

export interface DockCallbacks {
  toggle(): void;
  seek(t: number): void;
  setSpeed(speed: number): void;
  toggleSound(): void;
  /** The dock's height changed, so the map's padding has to follow. */
  layoutChanged(): void;
}

export function createDock(host: HTMLElement, cb: DockCallbacks) {
  const play = h('button', { class: 'play-btn', type: 'button', onclick: () => cb.toggle() });
  const now = h('span', { class: 'time-now mono' });
  const scrub = h('input', { class: 'scrub range', type: 'range', step: '0.1', min: String(START), max: '60', value: String(START) });
  const markP = h('span', { class: 'mark mark-p' });
  const markS = h('span', { class: 'mark mark-s' });
  const markA = h('span', { class: 'mark mark-alert' });
  const marks = h('div', { class: 'marks', 'aria-hidden': 'true' }, markP, markS, markA);
  const soundBtn = h('button', { class: 'icon-btn sound-btn', type: 'button', onclick: () => cb.toggleSound() });
  const speedGroup = h('div', { class: 'speeds', role: 'group' });
  const speedButtons = SPEEDS.map((s) => h('button', { class: 'speed', type: 'button', onclick: () => cb.setSpeed(s) }, `${s}×`));
  speedGroup.append(...speedButtons);
  const stripCanvas = h('canvas', { class: 'strip', hidden: true });
  const strip = createStrip(stripCanvas);
  host.append(stripCanvas, play, h('div', { class: 'time' }, now), h('div', { class: 'scrub-wrap' }, scrub, marks), soundBtn, speedGroup);

  scrub.addEventListener('pointerdown', () => get().playing && cb.toggle());
  scrub.addEventListener('input', () => cb.seek(Number(scrub.value)));

  const place = (el: HTMLElement, value: number | null) => {
    const { length } = get();
    el.hidden = value === null || value < START || value > length;
    if (value === null) return;
    const pct = (value - START) / (length - START);
    el.style.left = `calc(${pct * 100}% + ${(0.5 - pct) * 18}px)`;
  };

  function update(): void {
    const s = get();
    scrub.max = String(s.length);
    scrub.disabled = !s.quake;
    const finished = clock.t >= s.length - 0.05;
    play.replaceChildren(icon(s.playing ? 'pause' : finished ? 'replay' : 'play'));
    const label = s.playing ? t('dock.pause') : finished ? t('dock.replay') : t('dock.play');
    play.setAttribute('aria-label', label);
    play.title = label;
    scrub.setAttribute('aria-label', t('dock.scrub'));
    speedGroup.setAttribute('aria-label', t('dock.speed'));
    soundBtn.replaceChildren(icon(s.sound ? 'speakerHigh' : 'speakerSlash'));
    soundBtn.setAttribute('aria-pressed', String(s.sound));
    soundBtn.setAttribute('aria-label', t('dock.sound'));
    soundBtn.title = t('dock.sound');
    speedButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(SPEEDS[i] === s.speed)));
    const timing = pinTiming(s);
    place(markP, timing?.pSec ?? null);
    place(markS, timing?.sSec ?? null);
    place(markA, timing ? s.alertSec : null);
    markP.title = t('dock.markP');
    markS.title = t('dock.markS');
    markA.title = t('dock.markAlert');
    strip.update();
    // The seismogram strip sits above the controls, so the dock grows by its height when there is one.
    const withStrip = !!s.quake?.seismogram && !window.matchMedia('(max-width: 820px)').matches;
    const tall = withStrip ? STRIP_HEIGHT + 8 : 0;
    host.classList.toggle('has-strip', withStrip);
    document.documentElement.style.setProperty('--dock-extra', `${tall}px`);
    tick(clock.t);
  }

  let lastFinished = false;

  function tick(time: number): void {
    const s = get();
    const label = `T${time < 0 ? '' : '+'}${seconds(time)}`;
    now.textContent = label;
    scrub.setAttribute('aria-valuetext', label);
    scrub.value = String(time);
    strip.tick(time);
    const pct = ((time - START) / (s.length - START)) * 100;
    scrub.style.setProperty('--fill', `${Math.min(100, Math.max(0, pct))}%`);
    const finished = time >= s.length - 0.05;
    if (finished !== lastFinished) {
      lastFinished = finished;
      update();
    }
  }

  // Crossing the phone breakpoint shows or hides the strip, which changes how tall the dock is.
  window.matchMedia('(max-width: 820px)').addEventListener('change', () => {
    update();
    cb.layoutChanged();
  });

  return { update, tick };
}
