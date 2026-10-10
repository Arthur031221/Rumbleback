/**
 * `AbortSignal.timeout` and `AbortSignal.any` are missing from Safari before 16.4 and 17.4 and from Chrome before
 * 103 and 116. Without them a request to USGS or EarthScope threw before it was sent, so a quake that is not on
 * the featured shelf, the Recent, Search and Link tabs and the seismogram failed on an iPhone that has not been
 * updated. These use the built-in where there is one and do the same by hand where there is not.
 */
export function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(new DOMException('The operation timed out.', 'TimeoutError')), ms);
  return ctl.signal;
}

export function anySignal(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals);
  const ctl = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      ctl.abort(s.reason);
      break;
    }
    // Once one has fired the controller's own signal removes the listeners on the others.
    s.addEventListener('abort', () => ctl.abort(s.reason), { once: true, signal: ctl.signal });
  }
  return ctl.signal;
}

/** A signal that fires when `ms` have passed or when any of the given ones fires. */
export function within(ms: number, ...signals: (AbortSignal | undefined)[]): AbortSignal {
  return anySignal([timeoutSignal(ms), ...signals.filter((s): s is AbortSignal => s !== undefined)]);
}
