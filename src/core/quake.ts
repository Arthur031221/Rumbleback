import type { Wave } from './traveltime.ts';

/** What the USGS event feed says about an earthquake. */
export interface QuakeSummary {
  id: string;
  /** The USGS place string, for example "15 km S of Hualien City, Taiwan". */
  place: string;
  mag: number;
  magType: string;
  /** Origin time, milliseconds since the epoch. */
  time: number;
  lat: number;
  lon: number;
  depthKm: number;
  felt?: number;
  mmi?: number;
  alert?: string;
  tsunami?: boolean;
}

/** One station arrival picked by an analyst, placed from the distance and azimuth USGS reports. */
export interface Pick {
  /** Network and station code, for example "IU.TATO". */
  sta: string;
  phase: string;
  wave: Wave;
  lat: number;
  lon: number;
  /** Epicentral distance in degrees. */
  dist: number;
  /** Seconds after the origin time. */
  t: number;
  /** Channel and location codes of the waveform the pick was made on, for fetching that waveform. */
  cha: string;
  loc: string;
}

/** A seismic instrument from the ShakeMap station list, with its measured intensity. */
export interface Instrument {
  id: string;
  name: string;
  network: string;
  lat: number;
  lon: number;
  mmi: number;
  /** Peak ground acceleration in percent g. */
  pga?: number;
  /** Peak ground velocity in cm/s. */
  pgv?: number;
}

/** A group of Did You Feel It? responses, one intensity for one place. */
export interface FeltReport {
  lat: number;
  lon: number;
  mmi: number;
  n: number;
}

/** The ShakeMap intensity grid. Values are MMI times ten, rounded, 0 where there is no estimate. */
export interface IntensityGrid {
  west: number;
  south: number;
  /** Cell size in degrees. */
  dx: number;
  dy: number;
  cols: number;
  rows: number;
  /** Row-major from the south row up, `rows * cols` bytes, base64 in saved files. */
  mmi: Uint8Array;
}

/**
 * A real seismogram from one station, condensed to a min and max per time bin so a strip of it can be drawn.
 * Amplitudes are relative to the largest value, -1000 to 1000, and are not corrected for the instrument.
 */
export interface Seismogram {
  /** Network and station code, for example "IU.TATO". */
  sta: string;
  cha: string;
  /** Epicentral distance in degrees. */
  dist: number;
  lat: number;
  lon: number;
  /** Seconds after the origin of the first bin. */
  t0: number;
  /** Seconds per bin. */
  bin: number;
  min: number[];
  max: number[];
}

export interface QuakeData {
  quake: QuakeSummary;
  picks: Pick[];
  instruments: Instrument[];
  felt: FeltReport[];
  grid: IntensityGrid | null;
  /** The nearest station that has data in the EarthScope archive, or null. */
  seismogram: Seismogram | null;
}

/** Where the extra layers of one event can be fetched from, taken from the USGS event detail. */
export interface ProductUrls {
  phases?: string;
  grid?: string;
  stations?: string;
}
