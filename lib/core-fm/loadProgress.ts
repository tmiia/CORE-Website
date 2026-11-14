/**
 * What the home loader waits for, weighted. Reported by whoever loads it
 * (fonts: the loader, code: AsciiBackground, logo + genres + scene: BackgroundStage).
 * No three.js import here: the loader must not pull the 3D bundle.
 */
const WEIGHTS = {
  fonts: 0.1, // VCR + Anonymous Pro
  code: 0.25, // three + postprocessing chunk
  logo: 0.25, // core-logo.glb, by downloaded bytes
  genres: 0.25, // the genre pages' models (stageCues.preload), by bytes
  scene: 0.15, // studio env, glyph atlas, shader compile + GPU upload, first frame
};

export type LoadTask = keyof typeof WEIGHTS;

const progress: Record<LoadTask, number> = { fonts: 0, code: 0, logo: 0, genres: 0, scene: 0 };

/** 0..1, monotonic. */
export function loadProgress(): number {
  return (Object.keys(WEIGHTS) as LoadTask[]).reduce(
    (sum, task) => sum + WEIGHTS[task] * progress[task],
    0,
  );
}

export function reportLoad(task: LoadTask, p: number): void {
  progress[task] = Math.max(progress[task], Math.min(1, Math.max(0, p)));
}

/** Something failed (no WebGL…): don't keep the loader waiting. */
export function completeAllLoads(): void {
  (Object.keys(WEIGHTS) as LoadTask[]).forEach((task) => reportLoad(task, 1));
}
