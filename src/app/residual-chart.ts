/** A small histogram of observed minus modelled arrival times. Values beyond the range pile into the end bins. */
export function drawResiduals(canvas: HTMLCanvasElement, residuals: number[], median: number | null, rgb: string, ink: string): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const range = 4;
  const step = 0.25;
  const bins = new Array<number>((2 * range) / step).fill(0);
  for (const r of residuals) bins[Math.min(bins.length - 1, Math.max(0, Math.floor((r + range) / step)))]!++;
  const peak = Math.max(1, ...bins);
  const axis = 16;
  const top = 4;
  const bw = w / bins.length;
  ctx.fillStyle = `rgba(${rgb},0.85)`;
  bins.forEach((n, i) => {
    const bh = ((h - axis - top) * n) / peak;
    ctx.fillRect(i * bw + 0.5, h - axis - bh, Math.max(1, bw - 1), bh);
  });
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h - axis + 0.5);
  ctx.lineTo(w, h - axis + 0.5);
  ctx.moveTo(w / 2, top);
  ctx.lineTo(w / 2, h - axis);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (median !== null) {
    const x = w / 2 + (Math.max(-range, Math.min(range, median)) / (2 * range)) * w;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, h - axis);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = ink;
  ctx.font = '11px "JetBrains Mono Variable", ui-monospace, monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(`-${range}`, 0, h - 3);
  ctx.textAlign = 'center';
  ctx.fillText('0', w / 2, h - 3);
  ctx.textAlign = 'right';
  ctx.fillText(`+${range}`, w, h - 3);
}
