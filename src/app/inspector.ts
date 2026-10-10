import { distanceDeg, KM_PER_DEGREE } from '../core/geo.ts';
import { mmiColor, mmiRoman, shaking } from '../core/intensity.ts';
import type { QuakeData } from '../core/quake.ts';
import type { TravelTimes } from '../core/traveltime.ts';
import { h } from './dom.ts';
import { km, language, number, t } from './i18n.ts';
import type { Hit } from './overlay.ts';

/** The words for one dot: a title, what kind of dot it is, and the facts. `mmi` also draws the intensity chip. */
interface Description {
  title: string;
  lines: string[];
  mmi?: number;
}

/** A pick is compared with the model to a tenth of a second, where the panel rounds the same seconds. */
const tenths = (n: number) => t('unit.s', { n: number(n, 1) });

function describe(hit: Hit, data: QuakeData, tt: TravelTimes): Description {
  const epi = [data.quake.lat, data.quake.lon] as const;
  const away = (lat: number, lon: number) => t('pin.distance', { km: km(distanceDeg(epi, [lat, lon]) * KM_PER_DEGREE) });
  const level = (mmi: number) => `${t('shaking.' + shaking(mmi))} (MMI ${number(mmi, 1)})`;
  if (hit.kind === 'pick') {
    const p = data.picks[hit.index]!;
    return {
      title: p.sta,
      lines: [
        t('pin.distance', { km: km(p.dist * KM_PER_DEGREE) }),
        t('inspect.pick', { wave: p.wave, t: tenths(p.t), m: tenths(tt.time(p.wave, p.dist)) }),
      ],
    };
  }
  if (hit.kind === 'instrument') {
    const i = data.instruments[hit.index]!;
    const peaks = [
      i.pga === undefined ? '' : t('inspect.pga', { v: number(i.pga, i.pga < 10 ? 1 : 0) }),
      i.pgv === undefined ? '' : t('inspect.pgv', { v: number(i.pgv, i.pgv < 10 ? 1 : 0) }),
    ];
    return {
      title: i.name || i.id,
      mmi: i.mmi,
      lines: [t('inspect.instrument', { network: i.network }), level(i.mmi), ...peaks.filter(Boolean), away(i.lat, i.lon)],
    };
  }
  const f = data.felt[hit.index]!;
  return { title: t('inspect.felt', { n: number(f.n) }), mmi: f.mmi, lines: [level(f.mmi), away(f.lat, f.lon)] };
}

/**
 * A small card that follows the mouse over a lit dot and says what it is: the station and its pick against the
 * model, a strong motion instrument and what it recorded, or a group of felt reports. It is a pointer aid for a
 * mouse, so it stays out of the accessibility tree and a finger never opens it (a tap drops the pin).
 */
export function createInspector() {
  const box = h('div', { class: 'inspector', 'aria-hidden': 'true', hidden: true });
  document.body.append(box);
  let shown = '';

  function hide(): void {
    shown = '';
    box.hidden = true;
  }

  /** `at` is the pointer in screen pixels; the card sits beside it and flips where it would leave the screen. */
  function show(hit: Hit, data: QuakeData, tt: TravelTimes, at: { x: number; y: number }): void {
    const key = `${language()}:${hit.kind}:${hit.index}`;
    if (key !== shown) {
      shown = key;
      const d = describe(hit, data, tt);
      box.replaceChildren(
        h(
          'p',
          { class: 'inspector-title' },
          d.title,
          d.mmi === undefined ? null : h('span', { class: 'mmi-chip mono', text: mmiRoman(d.mmi), style: `--mmi:${mmiColor(d.mmi)}` }),
        ),
        ...d.lines.map((line) => h('p', { class: 'inspector-line', text: line })),
      );
    }
    box.hidden = false;
    const { offsetWidth: w, offsetHeight: ht } = box;
    const x = at.x + 16 + w > window.innerWidth - 8 ? at.x - 16 - w : at.x + 16;
    const y = at.y + 16 + ht > window.innerHeight - 8 ? at.y - 16 - ht : at.y + 16;
    box.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  }

  return { show, hide };
}
