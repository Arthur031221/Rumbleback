/**
 * The point nearest to (x, y) among those `counts` accepts, as an index into `xy` (the x and y of each point, one
 * after the other), or -1 when none lies within `radius`. Of two equally near points the lower index wins.
 */
export function nearestPoint(xy: ArrayLike<number>, x: number, y: number, radius: number, counts: (index: number) => boolean): number {
  const limit = radius * radius;
  let best = -1;
  let bestSq = limit;
  for (let i = 0; i < xy.length / 2; i++) {
    const [dx, dy] = [xy[i * 2]! - x, xy[i * 2 + 1]! - y];
    const sq = dx * dx + dy * dy;
    if (best === -1 ? sq > limit : sq >= bestSq) continue;
    if (!counts(i)) continue;
    best = i;
    bestSq = sq;
  }
  return best;
}
