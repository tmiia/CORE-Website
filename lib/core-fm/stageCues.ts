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

export const stageCues = {
  dark: openingAhead, // true = no wave, no ASCII field (loading + forge)
  live: !openingAhead, // false = REC idle, burger menu unavailable
  logo: "hidden" as LogoCue,
  forge: 0, // hold progress, 0..1
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

export function setForgeProgress(p: number): void {
  if (stageCues.forge === p) return;
  stageCues.forge = p;
  notify();
}
