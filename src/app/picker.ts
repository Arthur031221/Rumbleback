import { HttpError, RECENT_DAYS, RECENT_LIMIT, quakeDetail, recentQuakes, searchQuakes } from '../core/client.ts';
import { eventIdFrom } from '../core/link.ts';
import type { QuakeSummary } from '../core/quake.ts';
import { FEATURED } from '../data/featured.ts';
import { quakeTitle } from './derived.ts';
import { h } from './dom.ts';
import { icon } from './icons.ts';
import { language, number, t } from './i18n.ts';

interface Region {
  id: string;
  /** ISO 3166 country code for a localized name, or a locale key for areas that are not countries. */
  label: { iso: string } | { key: string };
  box: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
}

const REGIONS: Region[] = [
  { id: 'world', label: { key: 'picker.anywhere' }, box: null },
  { id: 'tw', label: { iso: 'TW' }, box: { minLat: 21.5, maxLat: 25.6, minLon: 119.2, maxLon: 122.5 } },
  { id: 'jp', label: { iso: 'JP' }, box: { minLat: 24, maxLat: 46, minLon: 122, maxLon: 147 } },
  { id: 'cn', label: { iso: 'CN' }, box: { minLat: 18, maxLat: 54, minLon: 73, maxLon: 135 } },
  { id: 'tr', label: { iso: 'TR' }, box: { minLat: 35.5, maxLat: 42.5, minLon: 25.5, maxLon: 45 } },
  { id: 'ir', label: { iso: 'IR' }, box: { minLat: 25, maxLat: 40, minLon: 44, maxLon: 63.5 } },
  { id: 'in', label: { iso: 'IN' }, box: { minLat: 6, maxLat: 36, minLon: 68, maxLon: 97.5 } },
  { id: 'id', label: { iso: 'ID' }, box: { minLat: -11, maxLat: 6, minLon: 95, maxLon: 141 } },
  { id: 'ph', label: { iso: 'PH' }, box: { minLat: 4.5, maxLat: 21.5, minLon: 116, maxLon: 127 } },
  { id: 'mx', label: { iso: 'MX' }, box: { minLat: 14, maxLat: 33, minLon: -118, maxLon: -86 } },
  { id: 'cl', label: { iso: 'CL' }, box: { minLat: -56, maxLat: -17, minLon: -76, maxLon: -66 } },
  { id: 'pe', label: { iso: 'PE' }, box: { minLat: -19, maxLat: 0, minLon: -82, maxLon: -68 } },
  { id: 'nz', label: { iso: 'NZ' }, box: { minLat: -48, maxLat: -33, minLon: 165, maxLon: 179 } },
  { id: 'it', label: { iso: 'IT' }, box: { minLat: 36, maxLat: 47.5, minLon: 6, maxLon: 19 } },
  { id: 'gr', label: { iso: 'GR' }, box: { minLat: 34, maxLat: 42, minLon: 19, maxLon: 30 } },
  { id: 'ca', label: { key: 'region.california' }, box: { minLat: 32, maxLat: 42, minLon: -125, maxLon: -114 } },
  { id: 'ak', label: { key: 'region.alaska' }, box: { minLat: 51, maxLat: 72, minLon: -170, maxLon: -130 } },
];

const MAGNITUDES = [5, 5.5, 6, 6.5, 7, 7.5, 8];
/** The minimum magnitudes the recent list offers. Below 4.5 USGS lists too many to be of use. */
const RECENT_MAGNITUDES = [4.5, 5, 6, 7];

function regionLabel(r: Region): string {
  if ('key' in r.label) return t(r.label.key);
  return new Intl.DisplayNames([language()], { type: 'region' }).of(r.label.iso) ?? r.label.iso;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function createPicker(onChoose: (id: string) => void) {
  const dialog = h('dialog', { class: 'sheet picker', 'aria-labelledby': 'picker-title' });
  const title = h('h2', { id: 'picker-title', class: 'sheet-title' });
  const closeBtn = h('button', { class: 'icon-btn', type: 'button', onclick: () => dialog.close() }, icon('close'));
  const tabNames = ['featured', 'recent', 'search', 'lookup'] as const;
  const tabs = tabNames.map((name) =>
    h('button', {
      class: 'tab',
      id: `picker-tab-${name}`,
      type: 'button',
      role: 'tab',
      'aria-controls': 'picker-panel',
      onclick: () => select(name),
      // Arrow keys, Home and End move between the tabs, as in the ARIA tabs pattern.
      onkeydown: (e) => {
        const at = tabNames.indexOf(name);
        const n = tabNames.length;
        const to = ({ ArrowRight: (at + 1) % n, ArrowLeft: (at + n - 1) % n, Home: 0, End: n - 1 } as Record<string, number>)[
          (e as KeyboardEvent).key
        ];
        if (to === undefined) return;
        e.preventDefault();
        tabs[to]!.focus();
        void select(tabNames[to]!);
      },
    }),
  );
  const tabBar = h('div', { class: 'tabs', role: 'tablist' }, ...tabs);
  const list = h('ul', { class: 'quake-list' });
  const message = h('p', { class: 'list-message', role: 'status' });
  const panel = h('div', { class: 'picker-panel', id: 'picker-panel', role: 'tabpanel' });

  const recentMag = h('select', { id: 'recent-mag', class: 'input' });
  const recentLabel = h('label', { class: 'field-label', for: 'recent-mag' });
  const recentNote = h('p', { class: 'recent-note' });
  const recentBar = h('div', { class: 'recent-bar' }, h('div', {}, recentLabel, recentMag), recentNote);

  const lookupInput = h('input', {
    id: 'lookup-id',
    class: 'input',
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'us7000m9g4',
    'aria-describedby': 'lookup-hint',
  });
  const lookupLabel = h('label', { class: 'field-label', for: 'lookup-id' });
  const lookupGo = h('button', { class: 'btn btn-primary', type: 'submit' });
  const lookupHint = h('p', { class: 'recent-note', id: 'lookup-hint' });
  const lookupForm = h(
    'form',
    {
      class: 'lookup-form',
      onsubmit: (e) => {
        e.preventDefault();
        void runLookup();
      },
    },
    lookupLabel,
    h('div', { class: 'lookup-row' }, lookupInput, lookupGo),
    lookupHint,
  );

  const minMag = h('select', { id: 'search-mag', class: 'input' });
  const region = h('select', { id: 'search-region', class: 'input' });
  const from = h('input', { id: 'search-from', class: 'input', type: 'date' });
  const to = h('input', { id: 'search-to', class: 'input', type: 'date' });
  const go = h('button', { class: 'btn btn-primary', type: 'submit' });
  const labels = ['search-mag', 'search-region', 'search-from', 'search-to'].map((id) => h('label', { class: 'field-label', for: id }));
  const form = h(
    'form',
    {
      class: 'search-form',
      onsubmit: (e) => {
        e.preventDefault();
        void runSearch();
      },
    },
    h('div', {}, labels[0]!, minMag),
    h('div', {}, labels[1]!, region),
    h('div', {}, labels[2]!, from),
    h('div', {}, labels[3]!, to),
    go,
  );
  panel.append(recentBar, form, lookupForm, message, list);
  dialog.append(h('div', { class: 'sheet-head' }, title, closeBtn), tabBar, panel);
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());

  const today = new Date();
  to.value = isoDay(today);
  from.value = isoDay(new Date(today.getTime() - 365 * 86400000));
  MAGNITUDES.forEach((m) => minMag.append(h('option', { value: String(m), selected: m === 7 }, `M ${number(m, 1)}+`)));
  RECENT_MAGNITUDES.forEach((m) => recentMag.append(h('option', { value: String(m), selected: m === 5 }, `M ${number(m, 1)}+`)));
  recentMag.addEventListener('change', () => void select('recent'));

  let tab: (typeof tabNames)[number] = 'featured';
  const recent = new Map<number, { at: number; items: QuakeSummary[] }>();
  let results: QuakeSummary[] = [];
  let busy: AbortController | null = null;

  const row = (id: string, heading: string, details: string[], mag: number | null) =>
    h(
      'li',
      {},
      h(
        'button',
        {
          class: 'quake-row',
          type: 'button',
          onclick: () => {
            dialog.close();
            onChoose(id);
          },
        },
        h('span', { class: `mag-chip mono${mag !== null && mag >= 7 ? ' big' : ''}`, text: mag === null ? '' : number(mag, 1) }),
        h(
          'span',
          { class: 'row-text' },
          h('span', { class: 'row-title', text: heading }),
          h('span', { class: 'row-line' }, ...details.filter(Boolean).map((text) => h('span', { text }))),
        ),
      ),
    );

  /** The date and, when there are any, the felt reports. */
  const describe = (q: QuakeSummary): string[] => {
    const date = new Intl.DateTimeFormat(language(), { dateStyle: 'medium', timeZone: 'UTC' }).format(q.time);
    return [date, q.felt ? t('picker.felt', { n: number(q.felt) }) : ''];
  };

  // What the list shows is kept as data, so a change of language can draw it again without a request.
  type Notice = 'loading' | 'empty' | 'error' | 'badRange' | 'badId' | 'noEvent' | 'checking';
  let shown: { items: QuakeSummary[]; featured: boolean } = { items: [], featured: false };
  let notice: Notice | null = null;
  let generation = 0;

  function paint(): void {
    list.replaceChildren(
      ...shown.items.map((q) =>
        shown.featured
          ? row(q.id, t(`featured.${q.id}`), describe(q), q.mag)
          : row(q.id, quakeTitle(q), [q.place === quakeTitle(q) ? '' : q.place, ...describe(q)], q.mag),
      ),
    );
    message.textContent = notice ? t(`picker.${notice}`) : '';
  }

  const show = (items: QuakeSummary[], featured = false) => {
    shown = { items, featured };
    notice = items.length ? null : 'empty';
    paint();
  };

  const wait = (what: Notice) => {
    shown = { items: [], featured: false };
    notice = what;
    paint();
  };

  /** Runs a request for the list. An answer that arrives after the viewer has moved on is dropped. */
  async function load(task: (signal: AbortSignal) => Promise<QuakeSummary[]>): Promise<QuakeSummary[] | null> {
    busy?.abort();
    const mine = (busy = new AbortController());
    const gen = ++generation;
    wait('loading');
    try {
      const items = await task(mine.signal);
      return gen === generation ? items : null;
    } catch (e) {
      if (gen === generation && (e as Error).name !== 'AbortError') wait('error');
      return null;
    }
  }

  async function runSearch(): Promise<void> {
    results = []; // a failed search must not leave the last good one behind
    if (from.value > to.value) {
      busy?.abort();
      generation++;
      return wait('badRange');
    }
    const box = REGIONS.find((r) => r.id === region.value)?.box ?? null;
    const items = await load((signal) =>
      searchQuakes({ minMag: Number(minMag.value), start: from.value, end: to.value, box }, fetch, signal),
    );
    if (items) {
      results = items;
      show(items);
    }
  }

  /** Opens what the viewer pasted, after USGS has confirmed that the earthquake exists. */
  async function runLookup(): Promise<void> {
    const id = eventIdFrom(lookupInput.value);
    busy?.abort();
    const mine = (busy = new AbortController());
    const gen = ++generation;
    if (!id) return wait('badId');
    wait('checking');
    try {
      await quakeDetail(id, fetch, mine.signal);
      if (gen !== generation) return;
      dialog.close();
      onChoose(id);
    } catch (e) {
      if (gen !== generation || (e as Error).name === 'AbortError') return;
      // USGS answers 404 for an id it does not know, and the detail call itself refuses what is not an earthquake.
      const unknown = e instanceof HttpError ? e.status === 404 || e.status === 400 : /^no earthquake/.test((e as Error).message);
      wait(unknown ? 'noEvent' : 'error');
    }
  }

  async function select(next: (typeof tabNames)[number]): Promise<void> {
    tab = next;
    render();
    busy?.abort();
    const gen = ++generation;
    if (next === 'featured') {
      wait('loading');
      try {
        const items = await featuredIndex();
        if (gen === generation) show(items, true);
      } catch {
        if (gen === generation) wait('error');
      }
    } else if (next === 'recent') {
      const mag = Number(recentMag.value);
      const kept = recent.get(mag);
      if (!kept || Date.now() - kept.at > 300000) {
        const items = await load((signal) => recentQuakes(fetch, signal, Date.now(), mag));
        if (!items) return;
        recent.set(mag, { at: Date.now(), items });
      }
      show(recent.get(mag)!.items);
      describeRecent();
    } else if (next === 'lookup') {
      shown = { items: [], featured: false };
      notice = null;
      paint();
      lookupInput.focus();
    } else if (results.length) {
      show(results);
    } else {
      void runSearch();
    }
  }

  let index: QuakeSummary[] | null = null;
  /** The featured quakes, in shelf order, from a small file shipped with the app. */
  async function featuredIndex(): Promise<QuakeSummary[]> {
    if (!index) {
      const res = await fetch(new URL('events/index.json', document.baseURI));
      if (!res.ok) throw new Error(`events/index.json ${res.status}`);
      const all = (await res.json()) as QuakeSummary[];
      index = FEATURED.map((f) => all.find((q) => q.id === f.id)).filter((q): q is QuakeSummary => !!q);
    }
    return index;
  }

  /** Says how far back the recent list reaches, and that it stops at a limit when it does. */
  function describeRecent(): void {
    const kept = recent.get(Number(recentMag.value));
    recentNote.textContent = !kept
      ? ''
      : kept.items.length >= RECENT_LIMIT
        ? t('picker.recentCapped', { n: number(RECENT_LIMIT), days: number(RECENT_DAYS) })
        : t('picker.recentAll', { days: number(RECENT_DAYS) });
  }

  function render(): void {
    title.textContent = t('picker.title');
    closeBtn.setAttribute('aria-label', t('common.close'));
    tabs.forEach((b, i) => {
      b.textContent = t(`picker.${tabNames[i]}`);
      b.setAttribute('aria-selected', String(tabNames[i] === tab));
      b.tabIndex = tabNames[i] === tab ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', `picker-tab-${tab}`);
    form.hidden = tab !== 'search';
    recentBar.hidden = tab !== 'recent';
    lookupForm.hidden = tab !== 'lookup';
    recentLabel.textContent = t('picker.minMag');
    describeRecent();
    lookupLabel.textContent = t('picker.lookupLabel');
    lookupGo.textContent = t('picker.lookupGo');
    lookupHint.textContent = t('picker.lookupHint');
    labels[0]!.textContent = t('picker.minMag');
    labels[1]!.textContent = t('picker.region');
    labels[2]!.textContent = t('picker.from');
    labels[3]!.textContent = t('picker.to');
    go.textContent = t('picker.go');
    const chosen = region.value || 'world';
    region.replaceChildren(...REGIONS.map((r) => h('option', { value: r.id, selected: r.id === chosen }, regionLabel(r))));
    const mag = recentMag.value;
    recentMag.replaceChildren(
      ...RECENT_MAGNITUDES.map((m) => h('option', { value: String(m), selected: String(m) === (mag || '5') }, `M ${number(m, 1)}+`)),
    );
  }

  return {
    open(): void {
      void select(tab);
      if (!dialog.open) dialog.showModal();
    },
    relocalize(): void {
      render();
      paint();
    },
    element: dialog,
  };
}
