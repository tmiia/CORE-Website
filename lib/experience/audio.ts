/**
 * The site's audio core: one AudioContext, one output that follows the sound
 * choice (sound.ts), the gesture unlock, and decoded sound files. Everything
 * that makes sound (the HOLD hum, the intro voice, the typing and glitch
 * effects) connects to `audioOutput()`, never straight to the speakers.
 */

import { onSoundChange, soundEnabled } from "./sound";

let shared: AudioContext | null = null;
let bus: GainNode | null = null;
const stateListeners = new Set<() => void>();
const notifyState = () => stateListeners.forEach((cb) => cb());

/** The site's AudioContext, once a gesture created it (null before). */
export function audioContext(): AudioContext | null {
  return shared;
}

/** Creates the context if needed: call it inside a user gesture. */
export function ensureAudioContext(): AudioContext | null {
  if (shared || typeof window === "undefined") return shared;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  shared = Ctor ? new Ctor() : null;
  shared?.addEventListener("statechange", notifyState);
  notifyState();
  return shared;
}

/** The context, only if it is already allowed to play (no gesture → null). */
export function runningContext(): AudioContext | null {
  return shared?.state === "running" ? shared : null;
}

/** Whether audio can play right now (for the header's sound toggle). */
export function audioRunning(): boolean {
  return shared?.state === "running";
}

/** Called when audio becomes able to play, or stops being able to. */
export function onAudioState(cb: () => void): () => void {
  stateListeners.add(cb);
  return () => void stateListeners.delete(cb);
}

/**
 * Where the site's sounds connect: silent when the visitor chose no sound,
 * with a short fade when it changes.
 */
export function audioOutput(): AudioNode | null {
  const c = ensureAudioContext();
  if (!c) return null;
  if (!bus) {
    const out = c.createGain();
    out.gain.value = soundEnabled() ? 1 : 0;
    out.connect(c.destination);
    onSoundChange(() => out.gain.setTargetAtTime(soundEnabled() ? 1 : 0, c.currentTime, 0.05));
    bus = out;
  }
  return bus;
}

/** Call inside a user gesture (e.g. "sound on"): audio can play from now on. */
export function unlockAudio(): void {
  void ensureAudioContext()?.resume();
}

let unlockInstalled = false;
let unlockedAt = -Infinity;

/** True right after a press started the audio (that same press: ~1 s). */
export function justUnlocked(): boolean {
  return performance.now() - unlockedAt < 1000;
}

/**
 * Browsers only let audio start after a "user activation": a mouse or key
 * *press*, but for touch the *release* (pointerup / touchend) — a finger going
 * down could still become a scroll. Scrolling (wheel, trackpad, finger) never
 * counts: a page opened or reloaded and only scrolled stays silent until a
 * click or a tap. This resumes the context on any such gesture, anywhere on
 * any page, for the whole visit: Safari can suspend a running context again
 * (output device changed, tab in the background), so the listeners stay.
 */
export function installAudioUnlock(): void {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const unlock = () => {
    const had = shared;
    const c = ensureAudioContext();
    if (!c || (had && c.state === "running")) return;
    unlockedAt = performance.now();
    void c.resume().catch(() => {});
  };
  for (const type of ["pointerdown", "pointerup", "touchend", "keydown", "click"]) {
    window.addEventListener(type, unlock, true);
  }
  // Back to the tab: a context suspended meanwhile may resume without a
  // gesture (otherwise the next gesture does it).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && shared && shared.state !== "running") {
      void shared.resume().catch(() => {});
    }
  });
}

// --- sound files ------------------------------------------------------------

// Decoded off the live context (an OfflineAudioContext needs no gesture), so
// files load during the loader, before the visitor's first click. A buffer
// plays on any context.
let decoder: BaseAudioContext | null = null;
const pending = new Map<string, Promise<AudioBuffer | null>>();
const ready = new Map<string, AudioBuffer>();

function getDecoder(): BaseAudioContext | null {
  if (decoder || typeof window === "undefined") return decoder;
  const Ctor =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  decoder = Ctor ? new Ctor(1, 1, 48000) : null;
  return decoder;
}

/** Fetches and decodes a sound file once. A missing or broken file → null
 * (that sound stays silent, one warning). */
export function loadSample(url: string): Promise<AudioBuffer | null> {
  let p = pending.get(url);
  if (!p) {
    const d = getDecoder();
    p = !d
      ? Promise.resolve(null)
      : fetch(url)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
          .then((bytes) => d.decodeAudioData(bytes))
          .then((buffer) => {
            ready.set(url, buffer);
            return buffer;
          })
          .catch((e) => {
            console.warn(`[audio] ${url} unavailable`, e);
            return null;
          });
    pending.set(url, p);
  }
  return p;
}

/** The decoded file, if it has loaded (null otherwise: nothing waits). */
export function sample(url: string): AudioBuffer | null {
  return ready.get(url) ?? null;
}
