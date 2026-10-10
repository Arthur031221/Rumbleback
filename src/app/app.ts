import 'maplibre-gl/dist/maplibre-gl.css';
import { isUnknownEvent, loadQuake } from '../core/client.ts';
import { decodeQuake } from '../core/codec.ts';
import { shaking } from '../core/intensity.ts';
import { buildLink, parseLink } from '../core/link.ts';
import type { QuakeData } from '../core/quake.ts';
import { defaultSpeed, openingBounds, replayLength, SPEEDS } from '../core/replay.ts';
import { TravelTimes } from '../core/traveltime.ts';
import { gridMmiAt } from '../core/usgs.ts';
import { FEATURED } from '../data/featured.ts';
import { cities, loadCities, nearestCityName, pinLabel, pinTiming, quakeTitle } from './derived.ts';
import { createAudio } from './audio.ts';
import { createDock } from './dock.ts';
import { $, h } from './dom.ts';
import { createInspector } from './inspector.ts';
import { icon } from './icons.ts';
import { LANGS, LOCALES, number, pickLanguage, seconds, setLanguage, t, translateTree, type Lang } from './i18n.ts';
import { createLearn } from './learn.ts';
import { createMap } from './map.ts';
import { Overlay } from './overlay.ts';
import { createLayers } from './layers.ts';
import { createPanel } from './panel.ts';
import { createPicker } from './picker.ts';
import { createShare } from './share.ts';
import { clock, get, seek, set, START, subscribe, type LayerKey, type Pin, type ThemeChoice } from './state.ts';
import type { Theme } from './style.ts';

const store = {
  read(key: string): string | null {
    try {
      return localStorage.getItem(`rumbleback.${key}`);
    } catch {
      return null;
    }
  },
  write(key: string, value: string | null): void {
    try {
      if (value === null) localStorage.removeItem(`rumbleback.${key}`);
      else localStorage.setItem(`rumbleback.${key}`, value);
    } catch {
      /* private mode: the choice just does not persist */
    }
  },
};

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const resolveTheme = (): Theme => (get().theme === 'auto' ? (prefersDark.matches ? 'dark' : 'light') : (get().theme as Theme));

function readPin(): Pin | null {
  try {
    const p = JSON.parse(store.read('pin') ?? 'null') as Pin | null;
    if (p && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180)
      return { lat: p.lat, lon: p.lon, city: typeof p.city === 'number' ? p.city : null };
  } catch {
    /* ignore a corrupt value */
  }
  return null;
}

function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export async function start(): Promise<void> {
  const link = parseLink(location.search, location.hash);
  const lang = pickLanguage(link.lang ?? store.read('lang'), navigator.languages);
  const savedTheme = store.read('theme');
  setLanguage(lang);
  set({
    lang,
    theme: savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'auto',
    pin: link.pin ? { lat: link.pin[0], lon: link.pin[1], city: null } : readPin(),
    alertSec: link.alert ?? 10,
  });
  document.documentElement.dataset.theme = resolveTheme();

  // index.html shows a placeholder while this script downloads. It goes once the page has its own.
  const retireBoot = () => {
    const boot = document.getElementById('boot');
    if (!boot) return;
    boot.dataset.done = '';
    setTimeout(() => boot.remove(), 600);
  };

  if (!hasWebGL2()) {
    retireBoot();
    document.title = 'Rumbleback';
    document.body.append(h('main', { class: 'fatal' }, h('h1', { text: 'Rumbleback' }), h('p', { text: t('error.webgl') })));
    return;
  }

  // Shell
  const mapEl = h('div', { id: 'map', class: 'map' });
  const panelEl = h('aside', { class: 'panel', 'data-collapsed': 'false' });
  const dockEl = h('footer', { class: 'dock' });
  const layersEl = h('div', { class: 'layers-strip', role: 'group' });
  const toast = h('div', { class: 'toast', role: 'status', hidden: true });
  // Read out by a screen reader as the waves reach the pin; a sighted viewer sees the rings and the countdown instead.
  const announcer = h('p', { id: 'announcer', class: 'sr-only', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const chooseBtn = h('button', { class: 'btn btn-primary', type: 'button', onclick: () => picker.open() }, icon('list'), h('span'));
  const learnBtn = h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => learn.open() }, icon('info'), h('span'));
  const shareBtn = h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => share.open() }, icon('share'), h('span'));
  const langSelect = h('select', { class: 'select', id: 'lang' });
  for (const l of LANGS) langSelect.append(h('option', { value: l, selected: l === lang }, LOCALES[l]['meta.name']));
  langSelect.addEventListener('change', () => {
    changeLanguage(langSelect.value as Lang);
    langSelect.blur(); // so the arrow keys step the replay again instead of changing the language
  });
  const langBox = h('label', { class: 'lang', for: 'lang' }, icon('globe'), langSelect);
  const themeBtn = h('button', { class: 'icon-btn', type: 'button', onclick: () => cycleTheme() });
  const gh = h(
    'a',
    { class: 'icon-btn', href: 'https://github.com/Arthur031221/Rumbleback', target: '_blank', rel: 'noopener' },
    icon('github'),
  );
  const brand = h(
    'a',
    { class: 'brand', href: './', 'aria-label': 'Rumbleback' },
    h('span', { class: 'brand-mark', 'aria-hidden': 'true' }),
    h('span', { class: 'brand-name', text: 'Rumbleback' }),
  );
  const topbar = h(
    'header',
    { class: 'topbar' },
    brand,
    h('div', { class: 'topbar-actions' }, chooseBtn, learnBtn, shareBtn, langBox, themeBtn, gh),
  );
  const overlayCanvas = h('canvas', { class: 'overlay', 'aria-hidden': 'true' });
  // The map and its layer chips are the main landmark, so no content sits outside a landmark.
  document.body.append(h('main', { class: 'stage' }, mapEl, layersEl), topbar, panelEl, dockEl, toast, announcer);

  let toastTimer: number | undefined;
  const showToast = (text: string) => {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast.hidden = true), 5000);
  };

  let announceTimer: number | undefined;
  let queued: string[] = [];
  const announce = (text: string) => {
    // Emptying the region first makes a screen reader read the same sentence again on the next replay. Messages that
    // come within the pause are read together, since a second one would otherwise cut off the first.
    queued.push(text);
    announcer.textContent = '';
    clearTimeout(announceTimer);
    announceTimer = window.setTimeout(() => {
      announcer.textContent = queued.join(' ');
      queued = [];
    }, 60);
  };

  // Map and overlay
  let dirty = true;
  let userMoved = false;
  const view = createMap(mapEl, {
    theme: resolveTheme(),
    lang,
    onPick: (lat, lon) => setPin({ lat, lon, city: null }),
    onPinMoved: (lat, lon) => setPin({ lat, lon, city: null }),
  });
  view.map.getCanvasContainer().appendChild(overlayCanvas);
  const overlay = new Overlay(view.map, overlayCanvas);

  // A mouse over a lit dot says what the dot is. The dots are drawn on a canvas, so the overlay finds the one under the pointer.
  const inspector = createInspector();
  let pointer: { x: number; y: number; clientX: number; clientY: number } | null = null;
  function inspect(): void {
    const s = get();
    const hit = pointer && s.quake && s.tt ? overlay.hit(pointer.x, pointer.y) : null;
    if (hit && pointer && s.quake && s.tt) inspector.show(hit, s.quake, s.tt, { x: pointer.clientX, y: pointer.clientY });
    else inspector.hide();
  }
  mapEl.addEventListener('pointermove', (e) => {
    // A finger taps to drop a pin, and a drag moves the map: neither asks what a dot is.
    if (e.pointerType !== 'mouse' || e.buttons) pointer = null;
    else {
      const box = mapEl.getBoundingClientRect();
      pointer = { x: e.clientX - box.left, y: e.clientY - box.top, clientX: e.clientX, clientY: e.clientY };
    }
    inspect();
  });
  mapEl.addEventListener('pointerleave', () => {
    pointer = null;
    inspect();
  });
  view.map.on('move', () => (dirty = true));
  view.map.on('dragstart', () => (userMoved = true));
  view.map.on('moveend', () => updateOffscreen());
  view.map.on('zoomstart', (e) => e.originalEvent && (userMoved = true));
  view.onTilesFailed(() => showToast(t('map.noTiles')));

  const audio = createAudio();

  // Panels
  const dock = createDock(dockEl, {
    toggle: () => togglePlay(),
    seek: (v) => {
      seek(v);
      dirty = true;
    },
    setSpeed: (s) => {
      userSpeed = true;
      set({ speed: s });
    },
    layoutChanged: () => layoutPadding(),
    toggleSound: () => {
      if (get().sound) return set({ sound: false });
      void audio.enable().then(() => set({ sound: true }));
    },
  });
  const panel = createPanel(panelEl, {
    retry: () => currentId && void openQuake(currentId, true, 'keep'),
    pickCity: (index) => {
      const c = cities()?.list[index];
      if (c) setPin({ lat: c.lat, lon: c.lon, city: index });
    },
    locate: () => {
      if (!navigator.geolocation) return showToast(t('pin.locateFailed'));
      navigator.geolocation.getCurrentPosition(
        (p) => setPin({ lat: p.coords.latitude, lon: p.coords.longitude, city: null }),
        () => showToast(t('pin.locateFailed')),
        { maximumAge: 600000, timeout: 15000 },
      );
    },
    removePin: () => setPin(null),
    setAlert: (sec) => set({ alertSec: sec }),
  });
  const layers = createLayers(layersEl, (key: LayerKey, on) => set({ layers: { ...get().layers, [key]: on } }));
  const picker = createPicker((id) => void openQuake(id, true, 'push'));
  const learn = createLearn();
  const share = createShare({
    layers: () => ({ map: view.map.getCanvas(), overlay: overlayCanvas, width: mapEl.clientWidth, height: mapEl.clientHeight }),
    hud: () => {
      const s = get();
      const timing = pinTiming(s);
      return {
        title: s.quake ? quakeTitle(s.quake.quake) : '',
        magnitude: s.quake ? s.quake.quake.mag.toFixed(1) : '',
        time: clock.t,
        pin:
          s.pin && timing
            ? {
                name: s.pin.city !== null ? pinLabel(s.pin, s.lang) : (nearestCityName(s.pin.lat, s.pin.lon, s.lang) ?? t('pin.myPlace')),
                pSec: timing.pSec,
                sSec: timing.sSec,
                alertSec: s.alertSec,
                warningSec: timing.warningSec,
                blind: timing.blind,
              }
            : undefined,
      };
    },
    focus: () => {
      const s = get();
      const pts: [number, number][] = [];
      for (const at of [s.quake && { lat: s.quake.quake.lat, lon: s.quake.quake.lon }, s.pin]) {
        if (!at) continue;
        const p = view.map.project([at.lon + 360 * Math.round((view.map.getCenter().lng - at.lon) / 360), at.lat]);
        pts.push([p.x, p.y]);
      }
      return pts;
    },
    link: (includePin) => {
      const s = get();
      return buildLink(location.origin + location.pathname, {
        event: s.quake?.quake.id,
        pin: includePin && s.pin ? [s.pin.lat, s.pin.lon] : undefined,
        t: clock.t > START + 0.05 ? clock.t : undefined,
        alert: s.pin ? s.alertSec : undefined,
        lang: s.lang,
      });
    },
    hasPin: () => !!get().pin,
    dark: () => resolveTheme() === 'dark',
    freeze: () => set({ playing: false }),
    hasQuake: () => !!get().quake,
    pinPoint: () => {
      const { pin } = get();
      if (!pin) return null;
      const p = view.map.project([pin.lon + 360 * Math.round((view.map.getCenter().lng - pin.lon) / 360), pin.lat]);
      return [p.x, p.y];
    },
    playForClip: (onFrame) => playForClip(onFrame),
    clipSeconds: () => (get().length - START) / clipSpeed(),
  });
  document.body.append(picker.element, learn.element, share.element);

  // Playback
  let userSpeed = false; // false while the speed is the one picked for the replay's length
  const clipSpeed = () => SPEEDS.find((s) => (get().length - START) / s <= 40) ?? SPEEDS[SPEEDS.length - 1]!;
  let clipHook: {
    onFrame: () => void;
    done: (completed: boolean) => void;
    generation: number;
    speed: number;
    t: number;
    reachedEnd: boolean;
  } | null = null;
  /** Counts the quakes opened, so something started for one quake can tell it is stale. */
  let generation = 0;

  function togglePlay(): void {
    const s = get();
    if (!s.quake) return;
    if (s.playing) return set({ playing: false });
    if (clock.t >= s.length - 0.05) seek(START);
    set({ playing: true });
  }

  /** Plays the replay from the start for a recording. Resolves true if it ran to the end, false if it was cut short. */
  function playForClip(onFrame: () => void): Promise<boolean> {
    if (!get().quake) return Promise.resolve(false);
    return new Promise((done) => {
      clipHook = { onFrame, done, generation, speed: get().speed, t: clock.t, reachedEnd: false };
      seek(START);
      set({ playing: true, speed: clipSpeed() });
    });
  }

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const s = get();
    if (s.playing && s.quake) {
      const next = clock.t + dt * s.speed;
      if (next >= s.length) {
        seek(s.length);
        set({ playing: false });
        if (clipHook) clipHook.reachedEnd = true;
      } else {
        seek(next);
      }
    }
    if (dirty || clipHook) {
      drawNow();
      dirty = false;
      if (clipHook) {
        const hook = clipHook;
        const sameQuake = hook.generation === generation;
        if (sameQuake) hook.onFrame();
        // Pausing, or opening another quake, cuts the recording short. Only the quake it started on gets its state back.
        if (!get().playing || !sameQuake || hook.reachedEnd) {
          clipHook = null;
          if (sameQuake) {
            set({ speed: hook.speed, playing: false });
            seek(hook.t);
          }
          hook.done(sameQuake && hook.reachedEnd);
        }
      }
    }
    requestAnimationFrame(frame);
  }

  function drawNow(): void {
    const s = get();
    if (!s.quake || !s.tt) {
      overlay.draw(null);
      return inspect();
    }
    const timing = pinTiming(s);
    overlay.draw({
      t: clock.t,
      quake: s.quake,
      tt: s.tt,
      theme: resolveTheme(),
      layers: s.layers,
      pin: s.pin && timing ? { lat: s.pin.lat, lon: s.pin.lon, pSec: timing.pSec, sSec: timing.sSec } : null,
      alertSec: s.alertSec,
      speed: s.speed,
    });
    inspect();
  }

  // State changes
  let lastT = START;
  /** Sound cues and screen reader announcements for the pin, only while the replay is running forward, not when the viewer jumps around. */
  function cues(from: number, to: number): void {
    const s = get();
    if (!s.playing || to <= from || to - from > 1.5 * s.speed) return;
    const timing = pinTiming(s);
    if (!timing) return;
    const crossed = (x: number) => from < x && to >= x;
    const play = (cue: 'P' | 'S' | 'alert', intensity?: number) => s.sound && audio.play(cue, intensity);
    // Moments that fall in the same frame are read out together, since a second message would cut off the first.
    const said: string[] = [];
    if (crossed(timing.pSec)) {
      play('P');
      said.push(t('announce.p', { s: seconds(timing.gapSec) }));
    }
    if (crossed(timing.sSec)) {
      const mmi = s.quake?.grid && s.pin ? gridMmiAt(s.quake.grid, s.pin.lat, s.pin.lon) : null;
      play('S', mmi === null ? 0.5 : Math.min(1, Math.max(0, (mmi - 3) / 6)));
      said.push(mmi === null ? t('announce.s') : t('announce.sShaking', { level: t(`shaking.${shaking(mmi)}`), mmi: number(mmi, 1) }));
    }
    if (crossed(s.alertSec)) {
      play('alert');
      said.push(t('announce.alert', { result: timing.blind ? t('alert.blind') : t('alert.result', { s: seconds(timing.warningSec) }) }));
    }
    if (said.length) announce(said.join(' '));
  }

  clock.listeners.add((time) => {
    cues(lastT, time);
    lastT = time;
    dock.tick(time);
    panel.tick(time);
    dirty = true;
  });

  /** The tab, the history menu and a bookmark name the quake that is open. */
  function syncTitle(): void {
    const q = get().quake?.quake;
    document.title = q ? `${quakeTitle(q)} | Rumbleback` : `Rumbleback: ${t('app.tagline')}`;
  }

  subscribe((s, prev) => {
    if (s.quake !== prev.quake) syncTitle();
    if (
      s.quake !== prev.quake ||
      s.status !== prev.status ||
      s.layersLoading !== prev.layersLoading ||
      s.layers !== prev.layers ||
      s.pin !== prev.pin ||
      s.alertSec !== prev.alertSec ||
      s.lang !== prev.lang
    )
      panel.update();
    layers.update();
    dock.update();
    if (s.quake !== prev.quake && s.quake && s.tt) overlay.setQuake(s.quake, s.tt);
    if (s.pin !== prev.pin) syncPin();
    if (s.quake?.seismogram !== prev.quake?.seismogram) layoutPadding();
    if (s.theme !== prev.theme || s.lang !== prev.lang) applyLook();
    dirty = true;
  });

  function applyLook(): void {
    const theme = resolveTheme();
    document.documentElement.dataset.theme = theme;
    // The browser's own bar follows the page, whichever way the theme was chosen. A choice made in the page has to
    // beat the system setting that the two tags in index.html name, so both lose their media query.
    for (const bar of document.querySelectorAll('meta[name="theme-color"]')) {
      bar.setAttribute('content', theme === 'dark' ? '#090d12' : '#e9eef3');
      bar.removeAttribute('media');
    }
    $('.brand-mark', topbar).dataset.theme = theme;
    themeBtn.replaceChildren(icon(theme === 'dark' ? 'sun' : 'moon'));
    const next = theme === 'dark' ? t('theme.light') : t('theme.dark');
    themeBtn.setAttribute('aria-label', `${t('nav.theme')}: ${next}`);
    themeBtn.title = `${t('nav.theme')}: ${next}`;
  }
  prefersDark.addEventListener('change', () => {
    if (get().theme === 'auto') {
      applyLook();
      view.setLook(resolveTheme(), get().lang);
      dirty = true;
    }
  });

  function cycleTheme(): void {
    const next: ThemeChoice = resolveTheme() === 'dark' ? 'light' : 'dark';
    store.write('theme', next);
    set({ theme: next });
    view.setLook(resolveTheme(), get().lang);
    requestAnimationFrame(() => panel.redrawChart());
  }

  function changeLanguage(next: Lang): void {
    store.write('lang', next);
    setLanguage(next);
    set({ lang: next });
    view.setLook(resolveTheme(), next);
    relocalize();
  }

  function relocalize(): void {
    translateTree(document);
    // Below 1100px the labels are hidden and the buttons are icons, so each one carries its name too.
    for (const [btn, key] of [
      [chooseBtn, 'nav.choose'],
      [learnBtn, 'nav.learn'],
      [shareBtn, 'share.title'],
    ] as const) {
      $('span', btn).textContent = t(key);
      btn.setAttribute('aria-label', t(key));
      btn.title = t(key);
    }
    langSelect.setAttribute('aria-label', t('nav.language'));
    gh.setAttribute('aria-label', t('nav.github'));
    gh.title = t('nav.github');
    syncTitle();
    $('meta[name="description"]', document.head).setAttribute('content', t('app.description'));
    picker.relocalize();
    learn.relocalize();
    share.relocalize();
    panel.update();
    layers.update();
    dock.update();
    applyLook();
  }

  function setPin(pin: Pin | null): void {
    store.write('pin', pin ? JSON.stringify(pin) : null);
    set({ pin });
    refreshLength();
  }

  /** The replay has to reach the pin, and a pin that is taken away lets it end sooner again. */
  function refreshLength(): void {
    const s = get();
    if (!s.quake || !s.tt || !s.view) return;
    const length = replayLength(s.tt, s.quake, s.view, s.pin ?? undefined);
    if (length === s.length) return;
    // A speed the viewer picked stays, one that was chosen for the old length follows the new one.
    set({ length, ...(userSpeed ? {} : { speed: defaultSpeed(length) }) });
    if (clock.t > length) seek(length);
  }

  function syncPin(): void {
    const { pin } = get();
    if (pin) view.setPin(pin.lat, pin.lon);
    else view.clearPin();
    panel.update();
    updateOffscreen();
  }

  /**
   * A pin far from the quake is not on screen, and the map does not move to it: loading map tiles
   * around the pin would tell the tile server where it is.
   */
  function updateOffscreen(): void {
    const { pin } = get();
    if (!pin) return panel.setOffscreen(false);
    const lng = pin.lon + 360 * Math.round((view.map.getCenter().lng - pin.lon) / 360);
    const p = view.map.project([lng, pin.lat]);
    panel.setOffscreen(p.x < 0 || p.y < 0 || p.x > mapEl.clientWidth || p.y > mapEl.clientHeight);
  }

  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    // A button or a summary takes Space as a click, and arrows are free. Fields keep every key, except
    // the timeline: it keeps the focus after a drag, and its own arrow keys step a tenth of a second.
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.altKey ||
      (/^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName) && !target.classList.contains('scrub')) ||
      (e.key === ' ' && /^(BUTTON|SUMMARY|A)$/.test(target.tagName)) ||
      document.querySelector('dialog[open]')
    )
      return;
    const s = get();
    if (e.key === '+' || e.key === '=') view.map.zoomIn();
    else if (e.key === '-' || e.key === '_') view.map.zoomOut();
    if (!s.quake) return;
    if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      set({ playing: false });
      seek(Math.min(s.length, Math.max(START, clock.t + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1))));
    }
  });

  // Layout: the map centres the epicenter in the space the panels leave free.
  function layoutPadding(): void {
    const narrow = window.matchMedia('(max-width: 820px)').matches;
    const dockH = dockEl.getBoundingClientRect().height;
    view.setPadding(
      narrow
        ? { left: 12, right: 12, top: 64, bottom: Math.min(window.innerHeight * 0.42, 330) + dockH }
        : { left: panelEl.getBoundingClientRect().right + 24, right: 24, top: 76, bottom: dockH + 36 },
    );
  }
  window.addEventListener('resize', () => {
    overlay.resize();
    layoutPadding();
    dirty = true;
  });

  // Loading a quake
  let loading: AbortController | null = null;
  let currentId = '';
  let initialLoad = true;

  /**
   * `entry` says what the address bar does: a quake the viewer chose becomes a history entry, so Back
   * returns to the one before it; the first quake and a retry rewrite the current entry; going back or
   * forward has already changed it.
   */
  async function openQuake(id: string, animate: boolean, entry: 'push' | 'replace' | 'keep' = 'replace', at?: number): Promise<void> {
    loading?.abort();
    const again = id === currentId;
    currentId = id;
    const ctl = (loading = new AbortController());
    userMoved = false;
    userSpeed = false;
    generation++;
    set({ status: 'loading', playing: false, layersLoading: false, quake: null, tt: null });
    // The first quake keeps what the link said, so a reload of a shared link shows the same thing.
    const kept = initialLoad ? { t: link.t, alert: link.alert, lang: link.lang, pin: link.pin } : {};
    initialLoad = false;
    const address = buildLink(location.pathname, { event: id, ...kept });
    if (entry === 'push' && !again) history.pushState(null, '', address);
    else if (entry !== 'keep') history.replaceState(null, '', address);

    // A link's moment applies to the quake the link names, and holds the replay there.
    const wanted = at ?? (id === (link.event ?? FEATURED[0]!.id) ? link.t : undefined);
    link.t = undefined;
    let landed = START;
    let first = true;
    // Shows what is known so far. The depth gives the travel times, the ShakeMap (when it arrives) the view.
    // The replay starts with the first thing shown, and later layers join it without moving the clock.
    const show = (data: QuakeData, complete: boolean, refit: boolean) => {
      const tt = get().tt ?? new TravelTimes(data.quake.depthKm);
      const bounds = openingBounds(data);
      const length = replayLength(tt, data, bounds, get().pin ?? undefined);
      set({
        quake: data,
        tt,
        view: bounds,
        length,
        status: 'ready',
        layersLoading: !complete,
        ...(userSpeed ? {} : { speed: defaultSpeed(length) }),
      });
      if (clock.t > length) seek(length);
      if (refit) view.fit(bounds, animate);
      if (first) {
        first = false;
        seek(wanted === undefined ? START : Math.min(Math.max(wanted, START), length));
        set({ playing: !reducedMotion.matches && wanted === undefined });
        landed = clock.t;
      } else if (wanted !== undefined && clock.t === landed) {
        // The length can grow as layers arrive. A link's moment that did not fit at first fits now.
        seek(Math.min(Math.max(wanted, START), length));
      }
    };

    try {
      if (FEATURED.some((f) => f.id === id)) {
        const res = await fetch(new URL(`events/${id}.json`, document.baseURI), { signal: ctl.signal });
        if (!res.ok) throw new Error(`events/${id}.json ${res.status}`);
        show(decodeQuake(await res.text()), true, true);
      } else {
        const final = await loadQuake(
          id,
          (partial) => {
            if (ctl.signal.aborted) return;
            const gridArrived = partial.grid !== null && get().quake?.grid === null;
            show({ ...partial }, false, first || (gridArrived && !userMoved));
          },
          fetch,
          ctl.signal,
        );
        if (ctl.signal.aborted) return;
        show({ ...final }, true, false);
      }
    } catch (err) {
      if (ctl.signal.aborted) return;
      console.error(err);
      set({ status: 'error', errorKind: isUnknownEvent(err) ? 'missing' : 'failed' });
    }
  }

  // Back and forward move between the quakes the viewer has opened.
  window.addEventListener('popstate', () => {
    const back = parseLink(location.search, location.hash);
    const id = back.event ?? FEATURED[0]!.id;
    // An entry that carries a moment (a shared link's first entry does) opens paused there.
    if (id !== currentId) void openQuake(id, true, 'keep', back.t);
  });

  // Start
  relocalize();
  layoutPadding();
  void loadCities()
    .then(() => panel.update()) // a pin chosen by city name in an earlier visit needs the list to be named
    .catch(() => {});
  requestAnimationFrame(frame);
  retireBoot();
  await openQuake(link.event ?? FEATURED[0]!.id, false);
  layoutPadding();
  if (get().pin) syncPin();
}
