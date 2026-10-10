import type { Lang } from '../core/cities.ts';
import type { QuakeData } from '../core/quake.ts';
import type { Bounds } from '../core/replay.ts';
import type { TravelTimes } from '../core/traveltime.ts';

export type LayerKey = 'waves' | 'picks' | 'shaking' | 'instruments' | 'felt' | 'blind';
export type ThemeChoice = 'auto' | 'dark' | 'light';

export interface Pin {
  lat: number;
  lon: number;
  /** Index into the city list when the pin was set by choosing a city, so its name follows the language. */
  city: number | null;
}

export interface AppState {
  lang: Lang;
  theme: ThemeChoice;
  quake: QuakeData | null;
  /** 'loading' until the summary arrives; the station layers may still be coming in after 'ready'. */
  status: 'loading' | 'ready' | 'error';
  layersLoading: boolean;
  tt: TravelTimes | null;
  view: Bounds | null;
  length: number;
  playing: boolean;
  speed: number;
  pin: Pin | null;
  alertSec: number;
  layers: Record<LayerKey, boolean>;
  /** Cues for the moments a wave reaches the pin. Off at every start, because browsers want a click first. */
  sound: boolean;
}

type Listener = (s: AppState, prev: AppState) => void;

let state: AppState = {
  lang: 'en',
  theme: 'auto',
  quake: null,
  status: 'loading',
  layersLoading: false,
  tt: null,
  view: null,
  length: 60,
  playing: false,
  speed: 5,
  pin: null,
  alertSec: 10,
  layers: { waves: true, picks: true, shaking: true, instruments: true, felt: true, blind: true },
  sound: false,
};
const listeners = new Set<Listener>();

export const get = (): AppState => state;

export function set(patch: Partial<AppState>): void {
  const prev = state;
  state = { ...state, ...patch };
  for (const l of [...listeners]) l(state, prev);
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Where the replay clock starts, in seconds after the origin: a moment of quiet before the first wave. */
export const START = -2;

/** The replay clock lives apart from the state so a frame does not wake every subscriber. */
export const clock = { t: START, listeners: new Set<(t: number) => void>() };

export function seek(t: number): void {
  clock.t = t;
  for (const l of clock.listeners) l(t);
}
