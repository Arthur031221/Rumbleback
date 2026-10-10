import { h } from './dom.ts';
import { t } from './i18n.ts';
import { get, type LayerKey } from './state.ts';

const KEYS: LayerKey[] = ['waves', 'picks', 'shaking', 'instruments', 'felt', 'blind'];

/** The row of layer toggles floating over the map. A layer with no data for this quake is shown disabled. */
export function createLayers(host: HTMLElement, toggle: (key: LayerKey, on: boolean) => void) {
  const buttons = new Map<LayerKey, HTMLButtonElement>();
  for (const key of KEYS) {
    const b = h('button', {
      class: `chip layer-${key}`,
      type: 'button',
      'aria-pressed': 'true',
      onclick: () => toggle(key, b.getAttribute('aria-pressed') !== 'true'),
    });
    buttons.set(key, b);
    host.append(b);
  }

  function update(): void {
    const s = get();
    const has: Record<LayerKey, boolean> = {
      waves: true,
      picks: (s.quake?.picks.length ?? 0) > 0,
      shaking: !!s.quake?.grid,
      instruments: (s.quake?.instruments.length ?? 0) > 0,
      felt: (s.quake?.felt.length ?? 0) > 0,
      blind: !!s.pin,
    };
    for (const [key, b] of buttons) {
      b.textContent = t(`layer.${key}`);
      b.setAttribute('aria-pressed', String(s.layers[key] && has[key]));
      b.disabled = !has[key];
      b.title = has[key] || key === 'blind' || s.layersLoading ? '' : t('quake.noLayers');
    }
    host.setAttribute('aria-label', t('nav.layers'));
  }

  return { update };
}
