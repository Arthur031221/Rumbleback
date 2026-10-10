/**
 * A short screen, such as a phone held sideways: the panel stays at the side and the timeline has no strip, so the map
 * keeps its room. The shape matters as well as the height: a keyboard that shrinks a phone held upright to 390 by 330
 * pixels is not a screen held sideways, and the page must not change its layout under the finger that is typing.
 */
export const SHORT = '(max-height: 480px) and (min-aspect-ratio: 17/10)';
/**
 * A phone held upright: the panel is a sheet above the timeline, and the timeline carries the seismogram strip. It
 * meets SHORT at an aspect ratio of exactly 17 to 10 and overlaps it there, which is better than a gap that leaves a
 * window with neither layout. Where both match, SHORT is the one the stylesheet and `layoutKind` prefer.
 */
export const PHONE = '(max-width: 820px) and (max-aspect-ratio: 17/10), (max-width: 820px) and (min-height: 481px)';

export const isPhone = (): boolean => window.matchMedia(PHONE).matches;
export const isShort = (): boolean => window.matchMedia(SHORT).matches;

export type LayoutKind = 'phone' | 'short' | 'desktop';

export const layoutKind = (): LayoutKind => (isShort() ? 'short' : isPhone() ? 'phone' : 'desktop');

/** Where the panels are, in pixels from the top left of the screen. */
export interface Metrics {
  width: number;
  height: number;
  /** Right edge of the left panel, which a sheet on a phone does not use. */
  panelRight: number;
  /** Bottom edge of the layer chips. */
  chipsBottom: number;
  /** Top edge of the timeline. */
  dockTop: number;
}

export interface Padding {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The space the panels cover, so the map centres the epicenter in what is left. The top follows the chips where they
 * run across the screen, and the bottom follows the timeline wherever it sits, so a notch or a home indicator, which
 * move both, are counted without being asked for.
 */
export function mapPadding(kind: LayoutKind, m: Metrics): Padding {
  const fromBottom = m.height - m.dockTop;
  if (kind === 'phone') {
    return { left: 12, right: 12, top: Math.max(64, m.chipsBottom + 8), bottom: fromBottom + 8 + Math.min(m.height * 0.42, 330) };
  }
  if (kind === 'short') return { left: m.panelRight + 16, right: 16, top: Math.max(56, m.chipsBottom + 8), bottom: fromBottom + 16 };
  return { left: m.panelRight + 24, right: 24, top: 76, bottom: fromBottom + 22 };
}

/**
 * How far from the top and from the bottom of the map a wavefront's letter may sit and still be seen: below the bar
 * and the chips, above the sheet or the timeline.
 */
export function letterBand(kind: LayoutKind, padding: Padding): { top: number; bottom: number } {
  return kind === 'desktop' ? { top: 62, bottom: Math.max(130, padding.bottom + 6) } : { top: padding.top, bottom: padding.bottom + 6 };
}
