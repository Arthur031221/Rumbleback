import { cityName, citiesNear, searchCities, type City } from '../core/cities.ts';
import { mmiColor, mmiRoman, shaking } from '../core/intensity.ts';
import { gridMmiAt } from '../core/usgs.ts';
import { blindRadiusKm } from '../core/warning.ts';
import { checkStats, cities, loadCities, nearestCityName, pinLabel, pinTiming, quakeTitle } from './derived.ts';
import { $, h } from './dom.ts';
import { icon } from './icons.ts';
import { km, language, localDate, number, seconds, t, utcDate } from './i18n.ts';
import { drawResiduals } from './residual-chart.ts';
import { isPhone, isShort } from './layout.ts';
import { clock, get } from './state.ts';

/** The intensities the colour key spans (1 is white, 10 dark red), and the ones it names. */
const KEY_LOW = 1;
const KEY_HIGH = 10;
const KEY_TICKS = [2, 4, 6, 8, 10];

export interface PanelCallbacks {
  retry(): void;
  pickCity(index: number): void;
  locate(): void;
  removePin(): void;
  setAlert(sec: number): void;
  /** Rewinds to a few seconds before the P wave reaches the pin and plays. */
  watchPin(): void;
}

export function createPanel(host: HTMLElement, cb: PanelCallbacks) {
  const handle = h(
    'button',
    { class: 'sheet-handle', type: 'button', 'aria-expanded': 'true', 'aria-label': '', onclick: () => toggle() },
    h('span'),
  );
  const mag = h('div', { class: 'mag' }, h('span', { class: 'mag-num mono' }), h('span', { class: 'mag-type' }));
  const title = h('h2', { class: 'quake-title' });
  const place = h('p', { class: 'quake-place' });
  const facts = h('p', { class: 'quake-facts' });
  const loadingLine = h('p', { class: 'quake-loading', role: 'status' }, h('span', { class: 'bar' }), h('span', { class: 'bar-text' }));
  const errorText = h('span');
  const retryBtn = h('button', { class: 'btn', type: 'button', onclick: () => cb.retry() });
  const errorLine = h('p', { class: 'quake-error', role: 'alert' }, errorText, retryBtn);
  // The key to the colours of the ShakeMap, the instrument dots and the felt reports, which share one scale.
  const keyTitle = h('span', { class: 'mmi-key-title' });
  const keyBar = h('span', { class: 'mmi-key-bar', 'aria-hidden': 'true' });
  keyBar.style.setProperty(
    '--ramp',
    `linear-gradient(90deg, ${Array.from({ length: KEY_HIGH - KEY_LOW + 1 }, (_, i) => mmiColor(KEY_LOW + i)).join(', ')})`,
  );
  const keyTicks = h(
    'span',
    { class: 'mmi-key-ticks mono', 'aria-hidden': 'true' },
    ...KEY_TICKS.map((v) => h('span', { text: mmiRoman(v), style: `--at:${((v - KEY_LOW) / (KEY_HIGH - KEY_LOW)) * 100}%` })),
  );
  const mmiKey = h('div', { class: 'mmi-key', hidden: true }, keyTitle, keyBar, keyTicks);
  const quakeCard = h(
    'section',
    { class: 'card quake-card' },
    h('div', { class: 'quake-head' }, mag, h('div', { class: 'quake-meta' }, title, place)),
    facts,
    mmiKey,
    loadingLine,
    errorLine,
  );

  // Pin card
  const pinTitle = h('h3', { class: 'card-title' });
  const removeBtn = h('button', { class: 'icon-btn', type: 'button', onclick: () => cb.removePin() }, icon('close'));
  const pinHead = h('div', { class: 'card-head' }, pinTitle, removeBtn);
  const prompt = h('p', { class: 'pin-prompt' });
  const searchLabel = h('label', { class: 'field-label', for: 'city-search' });
  const search = h('input', {
    id: 'city-search',
    class: 'input',
    type: 'search',
    autocomplete: 'off',
    spellcheck: 'false',
    role: 'combobox',
    'aria-expanded': 'false',
    'aria-controls': 'city-results',
    'aria-autocomplete': 'list',
  });
  const results = h('ul', { id: 'city-results', class: 'results', role: 'listbox', hidden: true });
  // Read out when the list appears, since a screen reader user does not see it.
  const resultsHint = h('p', { class: 'sr-only', role: 'status' });
  const locateBtn = h('button', { class: 'btn', type: 'button', onclick: () => cb.locate() }, icon('locate'), h('span'));
  const chips = h('div', { class: 'chips' });
  const setup = h(
    'div',
    { class: 'pin-setup' },
    prompt,
    searchLabel,
    h('div', { class: 'search-wrap' }, icon('search'), search, results),
    resultsHint,
    locateBtn,
    chips,
  );

  const stat = (cls: string) =>
    h('div', { class: `stat ${cls}` }, h('span', { class: 'stat-label' }), h('span', { class: 'stat-value mono' }));
  const [statP, statS, statGap] = [stat('p'), stat('s'), stat('gap')];
  const stats = h('div', { class: 'stats' }, statP, statS, statGap);
  const distance = h('p', { class: 'pin-distance' });
  const offscreen = h('p', { class: 'fine pin-offscreen', hidden: true });
  const status = h('p', { class: 'pin-status' });
  const watchBtn = h(
    'button',
    { class: 'btn btn-quiet pin-watch', type: 'button', onclick: () => cb.watchPin() },
    icon('replay'),
    h('span'),
  );
  const shakeChip = h('span', { class: 'mmi-chip mono' });
  const shakeText = h('span', { class: 'shake-text' });
  const shakeLabel = h('span', { class: 'shake-label' });
  const shakeRow = h('div', { class: 'shake-row' }, shakeLabel, shakeChip, shakeText);

  const alertTitle = h('h4', { class: 'sub-title' });
  const alertLabel = h('label', { class: 'field-label', for: 'alert-range' });
  const range = h('input', { id: 'alert-range', class: 'range', type: 'range', min: '0', max: '60', step: '1', value: '10' });
  const alertResult = h('p', { class: 'alert-result' });
  const alertRadius = h('p', { class: 'alert-radius' });
  const alertNote = h('p', { class: 'fine' });
  const alertBox = h('div', { class: 'alert' }, alertTitle, alertLabel, range, alertResult, alertRadius, alertNote);
  const stays = h('p', { class: 'fine' });
  const pinned = h('div', { class: 'pin-live' }, distance, offscreen, stats, status, watchBtn, shakeRow, alertBox, stays);
  const pinCard = h('section', { class: 'card pin-card' }, pinHead, setup, pinned);

  // Model check
  const checkTitle = h('summary', {});
  const histogram = h('canvas', { class: 'histogram', 'aria-hidden': 'true' });
  const checkSummary = h('p', { class: 'check-summary' });
  const checkNote = h('p', { class: 'fine check-s' });
  const checkCaveat = h('p', { class: 'fine' });
  const checkAxis = h('p', { class: 'fine axis' });
  const check = h(
    'details',
    { class: 'card check-card' },
    checkTitle,
    h('div', { class: 'check-body' }, checkSummary, histogram, checkAxis, checkNote, checkCaveat),
  );

  host.append(handle, quakeCard, pinCard, check);

  const toggle = () => {
    const collapsed = host.dataset.collapsed !== 'true';
    host.dataset.collapsed = String(collapsed);
    handle.setAttribute('aria-expanded', String(!collapsed));
  };

  // Search
  let current: City[] = [];
  let active = -1;
  const setActive = (index: number) => {
    active = index;
    const options = [...results.querySelectorAll<HTMLElement>('[role="option"]')];
    options.forEach((o, i) => {
      o.classList.toggle('active', i === index);
      o.setAttribute('aria-selected', String(i === index));
    });
    if (options[index]) {
      search.setAttribute('aria-activedescendant', options[index]!.id);
      options[index]!.scrollIntoView({ block: 'nearest' });
    } else search.removeAttribute('aria-activedescendant');
  };
  const renderResults = () => {
    results.replaceChildren();
    resultsHint.textContent = '';
    active = -1;
    search.removeAttribute('aria-activedescendant');
    const list = cities();
    if (!list) return;
    const asked = search.value.trim() !== '';
    results.hidden = current.length === 0 && !asked;
    search.setAttribute('aria-expanded', String(!results.hidden));
    if (current.length === 0 && asked) {
      // A listbox holds options only, so the "no match" row is a disabled one.
      results.append(h('li', { role: 'option', 'aria-disabled': 'true', class: 'result none', text: t('pin.noResults') }));
      resultsHint.textContent = t('pin.noResults');
      return;
    }
    current.forEach((c, i) =>
      results.append(
        h('li', {
          role: 'option',
          id: `city-option-${i}`,
          class: 'result',
          'aria-selected': 'false',
          text: cityName(c, list.order, language()),
          // A press, not a click, so the field keeps its focus and the list does not close first.
          onmousedown: (e) => e.preventDefault(),
          onclick: () => choose(c),
        }),
      ),
    );
    if (current.length) resultsHint.textContent = t('pin.resultsHint');
  };
  const choose = (c: City) => {
    const list = cities();
    if (!list) return;
    search.value = '';
    current = [];
    renderResults();
    cb.pickCity(list.list.indexOf(c));
  };
  search.addEventListener('input', () => {
    void loadCities()
      .then((list) => {
        current = searchCities(list.list, search.value);
        renderResults();
      })
      .catch(() => {});
  });
  // The list closes when the field loses the focus, as on a phone when the keyboard is put away. The rows keep
  // the focus on the field themselves (see onmousedown above), so a tap on one still lands.
  search.addEventListener('focusout', (e) => {
    if (results.contains((e as FocusEvent).relatedTarget as Node | null)) return;
    current = [];
    active = -1;
    results.replaceChildren();
    results.hidden = true;
    resultsHint.textContent = '';
    search.setAttribute('aria-expanded', 'false');
    search.removeAttribute('aria-activedescendant');
  });
  // Coming back to a field that still holds a search shows its list again.
  search.addEventListener('focus', () => search.value && search.dispatchEvent(new Event('input')));
  search.addEventListener('keydown', (e) => {
    const key = (e as KeyboardEvent).key;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      if (!current.length) return;
      e.preventDefault();
      setActive(
        key === 'ArrowDown'
          ? (active + 1) % current.length
          : active < 0
            ? current.length - 1
            : active - 1 < 0
              ? current.length - 1
              : active - 1,
      );
    } else if (key === 'Enter' && current.length) {
      e.preventDefault();
      choose(current[Math.max(active, 0)]!);
    } else if (key === 'Escape') {
      search.value = '';
      current = [];
      renderResults();
    }
  });
  range.addEventListener('input', () => cb.setAlert(Number(range.value)));

  function update(): void {
    const s = get();
    const q = s.quake?.quake;
    handle.setAttribute('aria-label', t('panel.toggle'));
    $('.mag-num', mag).textContent = q ? number(q.mag, 1) : '';
    $('.mag-type', mag).textContent = q?.magType ? `M${q.magType.toLowerCase().replace(/^m/, '')}` : '';
    title.textContent = q ? quakeTitle(q) : s.status === 'error' ? '' : t('quake.loading');
    const heading = q ? quakeTitle(q) : '';
    place.textContent = q && q.place && q.place !== heading ? q.place : '';
    const local = q ? localDate(q.time) : null;
    const factParts = q
      ? [
          t('quake.when', { date: utcDate(q.time) }),
          ...(local ? [t('quake.local', { date: local })] : []),
          t('quake.depth', { km: km(q.depthKm) }),
        ]
      : [];
    if (q?.felt) factParts.push(t('quake.felt', { n: number(q.felt) }));
    facts.replaceChildren(...factParts.map((p) => h('span', { text: p })));
    // The key shows while something on the map is coloured by shaking.
    const d = s.quake;
    const coloured =
      !!d && ((s.layers.shaking && !!d.grid) || (s.layers.instruments && d.instruments.length > 0) || (s.layers.felt && d.felt.length > 0));
    mmiKey.hidden = !coloured;
    keyTitle.textContent = t('legend.title');
    quakeCard.classList.toggle('is-loading', s.status === 'loading');
    quakeCard.classList.toggle('is-failed', s.status === 'error');
    loadingLine.hidden = !(s.status === 'ready' && s.layersLoading);
    $('.bar-text', loadingLine).textContent = t('quake.loading');
    errorLine.hidden = s.status !== 'error';
    errorText.textContent = t(s.errorKind === 'missing' ? 'picker.noEvent' : 'quake.error');
    retryBtn.hidden = s.errorKind === 'missing';
    retryBtn.textContent = t('quake.retry');

    // Pin
    pinTitle.textContent = t('pin.title');
    if (isOffscreen) offscreen.textContent = t('pin.offscreen');
    removeBtn.hidden = !s.pin;
    removeBtn.setAttribute('aria-label', t('pin.remove'));
    removeBtn.setAttribute('title', t('pin.remove'));
    setup.hidden = !!s.pin;
    // A pin placed another way, on the map or with the location button, ends the search it leaves behind.
    if (s.pin && search.value) {
      search.value = '';
      current = [];
      renderResults();
    }
    prompt.textContent = t('pin.prompt');
    searchLabel.textContent = t('pin.search');
    search.setAttribute('placeholder', t('pin.searchHint'));
    $('span', locateBtn).textContent = t('pin.locate');
    const list = cities();
    chips.replaceChildren();
    if (list && q && !s.pin) {
      for (const c of citiesNear(list.list, q.lat, q.lon, 450, 5)) {
        chips.append(h('button', { class: 'chip', type: 'button', onclick: () => choose(c) }, cityName(c, list.order, language())));
      }
    } else if (!list)
      void loadCities()
        .then(update)
        .catch(() => {});

    const timing = pinTiming(s);
    pinned.hidden = !(s.pin && timing);
    const hasPin = !!s.pin;
    if (hasPin !== hadPin) {
      if (hadPin !== null) followPin(hasPin);
      hadPin = hasPin;
    }
    if (s.pin && timing && s.quake) {
      const name =
        s.pin.city !== null ? pinLabel(s.pin, s.lang) : (nearestCityName(s.pin.lat, s.pin.lon, s.lang) ?? pinLabel(s.pin, s.lang));
      pinTitle.textContent = name;
      distance.textContent = t('pin.distance', { km: km(timing.distanceKm) });
      for (const [el, label, value] of [
        [statP, t('pin.p'), seconds(timing.pSec)],
        [statS, t('pin.s'), seconds(timing.sSec)],
        [statGap, t('pin.gap'), seconds(timing.gapSec)],
      ] as const) {
        $('.stat-label', el).textContent = label;
        $('.stat-value', el).textContent = value;
      }
      const mmi = s.quake.grid ? gridMmiAt(s.quake.grid, s.pin.lat, s.pin.lon) : null;
      shakeLabel.textContent = t('pin.shaking');
      if (mmi === null) {
        shakeChip.hidden = true;
        // The quake has a ShakeMap but it does not reach this place, or has no estimate there.
        shakeText.textContent = t(s.quake.grid ? 'pin.noShakeHere' : 'pin.noShake');
      } else {
        shakeChip.hidden = false;
        shakeChip.textContent = mmiRoman(mmi);
        shakeChip.style.setProperty('--mmi', mmiColor(mmi));
        shakeText.textContent = `${t('shaking.' + shaking(mmi))} (MMI ${number(mmi, 1)})`;
      }
      $('span', watchBtn).textContent = t('pin.watch');
      alertTitle.textContent = t('alert.title');
      alertLabel.textContent = t('alert.label', { s: seconds(s.alertSec) });
      range.value = String(s.alertSec);
      range.style.setProperty('--fill', `${(s.alertSec / 60) * 100}%`);
      alertResult.classList.toggle('is-blind', timing.blind);
      alertResult.textContent = timing.blind ? t('alert.blind') : t('alert.result', { s: seconds(timing.warningSec) });
      const radius = s.tt ? blindRadiusKm(s.tt, s.alertSec) : 0;
      alertRadius.hidden = radius <= 0;
      alertRadius.textContent = t('alert.radius', { km: km(radius) });
      alertNote.textContent = t('alert.note');
      stays.textContent = t('pin.stays');
      tick(clock.t);
    }

    // Model check
    checkTitle.textContent = t('check.title');
    for (const el of [checkSummary, checkAxis, checkNote, checkCaveat]) el.textContent = s.quake ? el.textContent : '';
    histogram.hidden = !s.quake;
    if (s.quake) {
      const c = checkStats(s.quake);
      if (c.P) {
        checkSummary.textContent = t('check.summary', { n: number(c.P.n), m: seconds(c.P.medianAbs), p: seconds(c.P.p90Abs) });
        histogram.hidden = false;
        checkAxis.textContent = t('check.axis');
        checkNote.textContent = t('check.sNote', { n: number(c.S?.n ?? 0) });
        checkCaveat.textContent = t('check.caveat');
        if (check.open) drawChart();
      } else {
        checkSummary.textContent = t('check.none');
        histogram.hidden = true;
        checkAxis.textContent = '';
        checkCaveat.textContent = '';
        checkNote.textContent = t('check.sNote', { n: number(c.S?.n ?? 0) });
      }
    }
  }

  /** Null until the first update, so a pin kept from an earlier visit does not move the sheet. */
  let hadPin: boolean | null = null;
  /** On a phone the sheet shows the quake card first, which would hide the numbers of a pin just placed. */
  function followPin(placed: boolean): void {
    if (!isPhone() && !isShort()) return;
    if (placed && host.dataset.collapsed === 'true') toggle();
    // The pin card has just been shown, so wait for the layout before measuring where it starts.
    requestAnimationFrame(() => {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      host.scrollTo({ top: placed ? Math.max(0, pinCard.offsetTop - 8) : 0, behavior });
    });
  }

  const drawChart = () => {
    const s = get();
    if (!s.quake) return;
    const c = checkStats(s.quake);
    const dark = document.documentElement.dataset.theme !== 'light';
    drawResiduals(histogram, c.residuals, c.P?.median ?? null, dark ? '76,195,255' : '10,116,196', dark ? '#c9d6e3' : '#25323f');
  };
  check.addEventListener('toggle', () => {
    if (!check.open) return;
    requestAnimationFrame(drawChart);
    check.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  /** Called every frame while the clock moves: the live countdown under the pin numbers. */
  function tick(time: number): void {
    const timing = pinTiming(get());
    if (!timing) return;
    let text: string;
    let phase: 'before' | 'between' | 'after';
    if (time < timing.pSec) [text, phase] = [t('pin.before', { s: seconds(timing.pSec - time) }), 'before'];
    else if (time < timing.sSec) [text, phase] = [t('pin.between', { s: seconds(timing.sSec - time) }), 'between'];
    else [text, phase] = [t('pin.after'), 'after'];
    if (status.textContent !== text) status.textContent = text;
    status.dataset.phase = phase;
  }

  let isOffscreen = false;
  function setOffscreen(off: boolean): void {
    isOffscreen = off;
    offscreen.hidden = !off;
    offscreen.textContent = off ? t('pin.offscreen') : '';
  }

  return { update, tick, setOffscreen, redrawChart: () => check.open && drawChart(), search };
}
