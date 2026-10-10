/**
 * A short screen, such as a phone held sideways: the panel stays at the side and the timeline has no strip, so the map
 * keeps its room. The shape matters as well as the height: a keyboard that shrinks a phone held upright to 390 by 330
 * pixels is not a screen held sideways, and the page must not change its layout under the finger that is typing.
 */
export const SHORT = '(max-height: 480px) and (min-aspect-ratio: 17/10)';
/** A phone held upright: the panel is a sheet above the timeline, and the timeline carries the seismogram strip. The complement of SHORT within the narrow screens. */
export const PHONE = '(max-width: 820px) and (max-aspect-ratio: 169/100), (max-width: 820px) and (min-height: 481px)';

export const isPhone = (): boolean => window.matchMedia(PHONE).matches;
export const isShort = (): boolean => window.matchMedia(SHORT).matches;
