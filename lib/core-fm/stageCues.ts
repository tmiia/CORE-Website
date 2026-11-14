/**
 * Cues from the page (React) to the WebGL stage and the header. A plain module
 * object read every frame: everything lives in the same client bundle, and the
 * stage may be created after the page sets a cue. Listeners let React
 * (useSyncExternalStore) and a non-animating stage (reduced motion) react.
 */
export type LogoCue =
  | "hidden" // dissolves into the ASCII if it was there
  | "forge" // ASCII silhouette driven by the hold (stageCues.forge)
  | "forged" // hold complete: the chrome materialises
  | "shown"; // end of the intro: scale/fade in, glow, light sweep

// First load on the home: the opening starts dark and not live (no REC, no
// menu) — set at module load so nothing flashes before the page's effects run.
const openingAhead = typeof window !== "undefined" && window.location.pathname === "/";

/** A genre page: its model replaces the wave (see GenreModelLayer). */
export interface StageGenre {
  model: string | null; // glb URL (null: a story with no installation model)
  /** The box the model is fitted into, tracked every frame (scrolls with the page). */
  anchor: HTMLElement | null;
  /** Per-band deformation 0..1 and its mean (GhostEq, ticked by the page). */
  eq: { readonly deform: Readonly<Record<"high" | "mid" | "low", number>>; readonly energy: number };
}

export const stageCues = {
  dark: openingAhead, // true = no wave, no ASCII field (loading + forge)
  live: !openingAhead, // false = REC idle, burger menu unavailable
  logo: "hidden" as LogoCue,
  forge: 0, // hold progress, 0..1
  genre: null as StageGenre | null, // null = no genre page (the wave shows)
  // Models to load (and warm up on the GPU) ahead of time: the home's genres,
  // during its loader, so opening a genre page never hitches.
  preload: [] as string[],
};

const listeners = new Set<() => void>();

export function onStageCue(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const notify = () => listeners.forEach((cb) => cb());

export function setStageDark(dark: boolean): void {
  if (stageCues.dark === dark) return;
  stageCues.dark = dark;
  notify();
}

export function setLive(live: boolean): void {
  if (stageCues.live === live) return;
  stageCues.live = live;
  notify();
}

export function setLogoCue(cue: LogoCue): void {
  if (stageCues.logo === cue) return;
  stageCues.logo = cue;
  notify();
}

export function setStagePreload(urls: string[]): void {
  const next = urls.filter((u) => !stageCues.preload.includes(u));
  if (!next.length) return;
  stageCues.preload = [...stageCues.preload, ...next];
  notify();
}

export function setStageGenre(genre: StageGenre | null): void {
  if (stageCues.genre === genre) return;
  stageCues.genre = genre;
  notify();
}

export function setForgeProgress(p: number): void {
  if (stageCues.forge === p) return;
  stageCues.forge = p;
  notify();
}
