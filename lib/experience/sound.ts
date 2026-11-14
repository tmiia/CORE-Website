/**
 * Sound on/off, chosen on the HOLD screen and remembered on this device. All
 * the site's audio (the hum, later the voice-over) goes through one output
 * that follows it (audioOutput() in hum.ts). Default: off. The browser won't
 * play anything before a click anyway, so turning it on is the visitor's
 * click ("AVEC SON"), which also unlocks the audio.
 */
const KEY = "corefm-sound";
export const SOUND_DEFAULT = false;

let enabled: boolean | null = null; // read lazily: localStorage is client-only
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    const saved = window.localStorage.getItem(KEY);
    return saved === null ? SOUND_DEFAULT : saved === "on";
  } catch {
    return SOUND_DEFAULT; // storage blocked (private mode…)
  }
}

export function soundEnabled(): boolean {
  if (enabled === null) enabled = typeof window === "undefined" ? SOUND_DEFAULT : read();
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
