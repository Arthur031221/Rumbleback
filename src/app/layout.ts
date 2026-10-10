/** A phone held upright: the panel is a sheet above the timeline, and the timeline carries the seismogram strip. */
export const PHONE = '(max-width: 820px) and (min-height: 481px)';
/** A short screen, such as a phone held sideways: the panel stays at the side and the timeline has no strip, so the map keeps room. */
export const SHORT = '(max-height: 480px)';

export const isPhone = (): boolean => window.matchMedia(PHONE).matches;
export const isShort = (): boolean => window.matchMedia(SHORT).matches;
