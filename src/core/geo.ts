export type LatLon = readonly [lat: number, lon: number];

export const EARTH_RADIUS_KM = 6371.0088;
export const KM_PER_DEGREE = (EARTH_RADIUS_KM * Math.PI) / 180;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Wrap a longitude into [-180, 180). */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Great-circle distance between two points, in degrees of arc. */
export function distanceDeg(a: LatLon, b: LatLon): number {
  const [la1, lo1] = [rad(a[0]), rad(a[1])];
  const [la2, lo2] = [rad(b[0]), rad(b[1])];
  const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2;
  return deg(2 * Math.asin(Math.min(1, Math.sqrt(h))));
}

export function distanceKm(a: LatLon, b: LatLon): number {
  return distanceDeg(a, b) * KM_PER_DEGREE;
}

/** Initial bearing from a to b in degrees clockwise from north, 0 to 360. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const [la1, la2] = [rad(a[0]), rad(b[0])];
  const dLon = rad(b[1] - a[1]);
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** The point reached from `from` after `arcDeg` degrees of arc on a bearing. Longitude is wrapped. */
export function destination(from: LatLon, bearing: number, arcDeg: number): LatLon {
  const [lat1, lon1] = [rad(from[0]), rad(from[1])];
  const [brg, d] = [rad(bearing), rad(arcDeg)];
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg));
  const lon2 = lon1 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [deg(lat2), wrapLon(deg(lon2))];
}

/**
 * A small circle of constant arc distance around a point, as [lon, lat] pairs.
 * Longitudes are unwrapped so the ring is continuous across the antimeridian,
 * which is what a map projection that repeats the world needs.
 */
export function ring(center: LatLon, arcDeg: number, steps = 192): [number, number][] {
  const out: [number, number][] = [];
  let prev = center[1];
  for (let i = 0; i <= steps; i++) {
    const [lat, lon] = destination(center, (360 * i) / steps, arcDeg);
    let unwrapped = lon;
    while (unwrapped - prev > 180) unwrapped -= 360;
    while (unwrapped - prev < -180) unwrapped += 360;
    out.push([unwrapped, lat]);
    prev = unwrapped;
  }
  return out;
}
