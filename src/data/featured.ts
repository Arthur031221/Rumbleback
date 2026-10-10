/** Earthquakes shipped with the app, so the page works offline-first and the first replay starts at once. */
export interface Featured {
  id: string;
  /** Short label key in the locale files, "featured.<id>". */
  region: 'taiwan' | 'japan' | 'world';
}

export const FEATURED: readonly Featured[] = [
  { id: 'us7000m9g4', region: 'taiwan' },
  { id: 'us7000i90q', region: 'taiwan' },
  { id: 'usp0009eq0', region: 'taiwan' },
  { id: 'official20110311054624120_30', region: 'japan' },
  { id: 'us6000m0xl', region: 'japan' },
  { id: 'us6000rtdt', region: 'japan' },
  { id: 'us6000jllz', region: 'world' },
  { id: 'us7000pn9s', region: 'world' },
  { id: 'us6000qw60', region: 'world' },
  { id: 'ci38457511', region: 'world' },
  { id: 'us2000ar20', region: 'world' },
  { id: 'official20100227063411530_30', region: 'world' },
  { id: 'us20002926', region: 'world' },
  { id: 'us7000kufc', region: 'world' },
];
