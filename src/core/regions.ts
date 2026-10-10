/** A place to search for earthquakes in: a name and a rectangle, since the USGS catalog takes a bounding box. */
export interface Region {
  id: string;
  /** ISO 3166 country code for a localized name, or a locale key for areas that are not countries. */
  label: { iso: string } | { key: string };
  box: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
}

const country = (id: string, minLat: number, maxLat: number, minLon: number, maxLon: number): Region => ({
  id,
  label: { iso: id.toUpperCase() },
  box: { minLat, maxLat, minLon, maxLon },
});

/** The first entry is "anywhere". The picker sorts the rest by their name in the viewer's language. */
export const REGIONS: Region[] = [
  { id: 'world', label: { key: 'picker.anywhere' }, box: null },
  country('tw', 21.5, 25.6, 119.2, 122.5),
  country('jp', 24, 46, 122, 147),
  country('cn', 18, 54, 73, 135),
  country('tr', 35.5, 42.5, 25.5, 45),
  country('ir', 25, 40, 44, 63.5),
  country('in', 6, 36, 68, 97.5),
  country('id', -11, 6, 95, 141),
  country('ph', 4.5, 21.5, 116, 127),
  country('mx', 14, 33, -118, -86),
  country('cl', -56, -17, -76, -66),
  country('pe', -19, 0, -82, -68),
  country('nz', -48, -33, 165, 179),
  country('it', 36, 47.5, 6, 19),
  country('gr', 34, 42, 19, 30),
  country('pk', 23.5, 37.2, 60.8, 77.9),
  country('af', 29.3, 38.6, 60.4, 75),
  country('np', 26.3, 30.5, 80, 88.3),
  country('mm', 9.5, 28.6, 92.1, 101.2),
  country('pg', -11.8, -0.7, 140.8, 157),
  country('co', -4.3, 13.5, -79.1, -66.8),
  country('ec', -5.1, 1.5, -81.1, -75.1),
  country('ma', 27.6, 36, -13.3, -0.9),
  country('ht', 17.9, 20.2, -74.6, -71.6),
  country('gt', 13.7, 17.9, -92.3, -88.2),
  country('vu', -20.5, -13, 166.4, 170.5),
  country('is', 63, 67, -25, -12.5),
  country('to', -24, -14.5, -179, -172),
  country('sb', -12.5, -5, 154.5, 170),
  country('cr', 7.8, 11.5, -86.2, -82.4),
  country('sv', 12.9, 14.6, -90.3, -87.5),
  country('ni', 10.6, 15.2, -88, -82.5),
  country('pa', 6.9, 9.8, -83.2, -77),
  country('pr', 17.5, 19, -68, -64.5),
  country('do', 17.3, 20.1, -72.2, -68.2),
  country('kr', 33, 38.7, 124.5, 130),
  country('dz', 18.9, 37.1, -8.7, 12),
  country('al', 39.6, 42.7, 19.2, 21.1),
  country('ro', 43.6, 48.3, 20.2, 30),
  country('tj', 36.6, 41.1, 67.3, 75.2),
  country('kg', 39.1, 43.3, 69.2, 80.3),
  country('ar', -55, -21.7, -73.6, -53.6),
  { id: 'ca', label: { key: 'region.california' }, box: { minLat: 32, maxLat: 42, minLon: -125, maxLon: -114 } },
  { id: 'ak', label: { key: 'region.alaska' }, box: { minLat: 51, maxLat: 72, minLon: -170, maxLon: -130 } },
  { id: 'hi', label: { key: 'region.hawaii' }, box: { minLat: 18.5, maxLat: 22.5, minLon: -160.5, maxLon: -154.5 } },
  { id: 'kam', label: { key: 'region.kamchatka' }, box: { minLat: 43, maxLat: 62.5, minLon: 146, maxLon: 173 } },
];
