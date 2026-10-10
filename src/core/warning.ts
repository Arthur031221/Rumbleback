import { KM_PER_DEGREE } from './geo.ts';
import type { TravelTimes } from './traveltime.ts';

export interface PinTiming {
  distanceKm: number;
  pSec: number;
  sSec: number;
  /** S minus P, the gap an early warning system works inside. */
  gapSec: number;
  /** Seconds between an alert issued `alertSec` after the origin and the S wave, never below zero. */
  warningSec: number;
  /** True when the S wave got there before the alert did. */
  blind: boolean;
}

export function timingAt(tt: TravelTimes, distanceDeg: number, alertSec: number): PinTiming {
  const pSec = tt.time('P', distanceDeg);
  const sSec = tt.time('S', distanceDeg);
  return {
    distanceKm: distanceDeg * KM_PER_DEGREE,
    pSec,
    sSec,
    gapSec: sSec - pSec,
    warningSec: Math.max(0, sSec - alertSec),
    blind: sSec <= alertSec,
  };
}

/**
 * Radius in km of the blind zone for an alert issued `alertSec` after the origin: inside it the
 * S wave has already arrived. Zero while the S wave has not yet reached the surface above the source.
 */
export function blindRadiusKm(tt: TravelTimes, alertSec: number): number {
  const deg = tt.distanceAt('S', alertSec);
  return deg === null ? 0 : deg * KM_PER_DEGREE;
}
