/** Modified Mercalli Intensity helpers. Colours follow the USGS ShakeMap scale so the map reads like the one USGS publishes. */

const STOPS: [number, [number, number, number]][] = [
  [1, [255, 255, 255]],
  [2, [191, 204, 255]],
  [3, [160, 230, 255]],
  [4, [128, 255, 255]],
  [5, [122, 255, 147]],
  [6, [255, 255, 0]],
  [7, [255, 200, 0]],
  [8, [255, 145, 0]],
  [9, [255, 0, 0]],
  [10, [200, 0, 0]],
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function mmiRgb(mmi: number): [number, number, number] {
  const m = Math.min(Math.max(mmi, 1), 10);
  const hi = STOPS.findIndex(([v]) => v >= m);
  if (hi <= 0) return STOPS[0]![1];
  const [v0, c0] = STOPS[hi - 1]!;
  const [v1, c1] = STOPS[hi]!;
  const f = (m - v0) / (v1 - v0);
  return [0, 1, 2].map((i) => Math.round(c0[i]! + (c1[i]! - c0[i]!) * f)) as [number, number, number];
}

export function mmiColor(mmi: number, alpha = 1): string {
  const [r, g, b] = mmiRgb(mmi);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** The Roman numeral of the nearest whole intensity, "VII" for 6.6 to 7.4. */
export function mmiRoman(mmi: number): string {
  return ROMAN[Math.min(Math.max(Math.round(mmi), 1), 12) - 1]!;
}

export type Shaking = 'notFelt' | 'weak' | 'light' | 'moderate' | 'strong' | 'veryStrong' | 'severe' | 'violent' | 'extreme';

/** The USGS word for the perceived shaking at a whole intensity. */
export function shaking(mmi: number): Shaking {
  const n = Math.round(mmi);
  if (n <= 1) return 'notFelt';
  if (n <= 3) return 'weak';
  if (n >= 10) return 'extreme';
  return (['light', 'moderate', 'strong', 'veryStrong', 'severe', 'violent'] as const)[n - 4]!;
}
