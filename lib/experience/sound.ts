/**
 * Sound on/off, chosen on the HOLD screen and remembered on this device. All
 * the site's audio (the hum, later the voice-over) goes through one output
 * that follows it (audioOutput() in hum.ts). Default: on.
 */
const KEY = "corefm-sound";

let enabled: boolean | null = null; // read lazily: localStorage is client-only
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true; // storage blocked (private mode…): default
  }
}

export function soundEnabled(): boolean {
  if (enabled === null) enabled = typeof window === "undefined" ? true : read();
  return enabled;
}

export function setSoundEnabled(on: boolean): void {
  if (soundEnabled() === on) return;
  enabled = on;
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Not remembered, still applies for this visit.
  }
  listeners.forEach((cb) => cb());
}

export function onSoundChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
