// Helpers from something.fm@7129c50 client/tv1/visuals/tuningFx.ts

/** 0 within tolerance, 1 at `reach` beyond it (and past), curved. */
export function distanceNorm(
  current: number,
  target: number,
  tolerance: number,
  reach: number,
  curve: number,
): number {
  const over = Math.max(0, Math.abs(current - target) - tolerance);
  if (reach <= 0) return 0;
  return Math.pow(Math.min(1, over / reach), curve);
}

/** Frame-rate independent ease of `from` toward `to`. */
export function ease(from: number, to: number, rate: number, dt: number): number {
  return from + (to - from) * (1 - Math.exp(-rate * dt));
}
