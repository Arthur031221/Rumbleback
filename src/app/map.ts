import { AttributionControl, Map, Marker, setWorkerUrl, type LngLatBoundsLike } from 'maplibre-gl';
import type { Lang } from '../core/cities.ts';
import type { Bounds } from '../core/replay.ts';
import { h } from './dom.ts';
import { icon } from './icons.ts';
import { buildStyle, type Theme } from './style.ts';

const base = (path: string) => new URL(path, document.baseURI).href;

setWorkerUrl(base('assets/maplibre-gl-worker.mjs'));

/** How long a click on the map waits before it drops the pin, to tell it from a double click. */
const TAP_MS = 260;

export interface MapView {
  map: Map;
  setLook(theme: Theme, lang: Lang): void;
  fit(bounds: Bounds, animate: boolean): void;
  setPin(lat: number, lon: number): void;
  clearPin(): void;
  /** Space the floating panels cover, so the epicenter is centred in what is left. */
  setPadding(p: { left: number; right: number; top: number; bottom: number }): void;
  onTilesFailed(cb: () => void): void;
}

export interface MapOptions {
  theme: Theme;
  lang: Lang;
  onPick(lat: number, lon: number): void;
  onPinMoved(lat: number, lon: number): void;
}

export function createMap(container: HTMLElement, o: MapOptions): MapView {
  const landUrl = base('data/land-50m.json');
  const map = new Map({
    container,
    style: buildStyle(o.theme, o.lang, landUrl),
    center: [121.6, 23.8],
    zoom: 6,
    minZoom: 1,
    maxZoom: 13,
    attributionControl: false,
    dragRotate: false,
    // The arrow keys step the replay clock (see app.ts), so the map must not pan on them too.
    keyboard: false,
    pitchWithRotate: false,
    maxPitch: 0,
    fadeDuration: 0,
    // The share card and the clip are drawn from the map canvas, which needs its pixels kept.
    canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
  // MapLibre opens the compact credit at the start. On a phone it would cover the map, so it starts as
  // the small (i) button and opens when tapped. The credit arrives with the tile source, so wait for it.
  if (window.matchMedia('(max-width: 820px)').matches) {
    const collapse = () => {
      const credit = container.querySelector('.maplibregl-ctrl-attrib');
      if (!credit?.classList.contains('maplibregl-compact-show')) return;
      credit.classList.remove('maplibregl-compact-show');
      map.off('sourcedata', collapse);
    };
    map.on('sourcedata', collapse);
  }

  // A tile source that cannot be reached at all fails once, without a tile. Single tile errors are
  // normal (empty tiles, a flaky connection), so those only count when they pile up.
  let tileErrors = 0;
  let failedCb: () => void = () => {};
  let told = false;
  map.on('error', (e) => {
    const { sourceId, tile } = e as unknown as { sourceId?: string; tile?: unknown };
    if (sourceId !== 'tiles' || told) return;
    if (tile !== undefined && ++tileErrors < 8) return;
    told = true;
    failedCb();
  });

  // A double click or double tap zooms, and the clicks that make it up must not move the pin. A click
  // therefore waits a moment, and a second click, a double click or a zoom in that time cancels it.
  let tap: number | undefined;
  const cancelTap = () => {
    clearTimeout(tap);
    tap = undefined;
  };
  map.on('click', (e) => {
    if (tap !== undefined) return cancelTap();
    if (map.isMoving()) return;
    const { lat, lng } = e.lngLat;
    tap = window.setTimeout(() => {
      tap = undefined;
      o.onPick(lat, ((lng + 540) % 360) - 180);
    }, TAP_MS);
  });
  map.on('dblclick', cancelTap);
  map.on('zoomstart', cancelTap);

  let marker: Marker | null = null;
  const pinElement = () =>
    h(
      'div',
      { class: 'pin' },
      h('span', { class: 'pin-pulse' }),
      (() => {
        const i = icon('pin');
        i.classList.add('pin-icon');
        return i;
      })(),
    );

  return {
    map,
    setLook(theme, lang) {
      map.setStyle(buildStyle(theme, lang, landUrl), { diff: false });
    },
    fit(b, animate) {
      const bounds: LngLatBoundsLike = [
        [b.west, b.south],
        [b.east, b.north],
      ];
      map.fitBounds(bounds, { duration: animate ? 1100 : 0, maxZoom: 10 });
    },
    setPin(lat, lon) {
      if (!marker) {
        marker = new Marker({ element: pinElement(), draggable: true, anchor: 'bottom' }).setLngLat([lon, lat]).addTo(map);
        marker.on('dragend', () => {
          const p = marker!.getLngLat();
          o.onPinMoved(p.lat, ((p.lng + 540) % 360) - 180);
        });
      } else {
        marker.setLngLat([lon, lat]);
      }
    },
    clearPin() {
      marker?.remove();
      marker = null;
    },
    setPadding(p) {
      map.setPadding(p);
    },
    onTilesFailed(cb) {
      failedCb = cb;
    },
  };
}
