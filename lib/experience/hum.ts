/**
 * HOLD feedback hum, synthesised with Web Audio (no file): a low saw drone
 * through a resonant low-pass, plus band-passed radio static. Pitch, brightness
 * and level rise with the hold. `start()` must run inside a user gesture
 * (pointerdown): that gesture also unlocks audio for the rest of the visit.
 */

let shared: AudioContext | null = null;

/** The site's AudioContext, once a gesture created it (for the voice-over). */
export function audioContext(): AudioContext | null {
  return shared;
}

function ensureContext(): AudioContext | null {
  if (shared || typeof window === "undefined") return shared;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  shared = Ctor ? new Ctor() : null;
  return shared;
}

let unlockInstalled = false;

/**
 * Browsers only let audio start after a "user activation": a mouse or key
 * *press*, but for touch the *release* (pointerup / touchend) — a finger going
 * down could still become a scroll. So a first touch-and-hold can't make sound
 * until the finger lifts. This resumes the context on whichever gesture comes
 * first, anywhere on the page, so the rest of the visit (voice-over) has sound.
 */
export function installAudioUnlock(): void {
  if (unlockInstalled || typeof window === "undefined") return;
  unlockInstalled = true;
  const events = ["pointerdown", "pointerup", "touchend", "keydown", "click"];
  const unlock = () => {
    const c = ensureContext();
    if (!c) return;
    void c.resume().then(() => {
      if (c.state === "running") {
        events.forEach((type) => window.removeEventListener(type, unlock, true));
      }
    });
  };
  events.forEach((type) => window.addEventListener(type, unlock, true));
}

export const HUM = {
  level: [0.05, 0.17] as [number, number], // master gain [hold start, full]
  pitch: [55, 110] as [number, number], // Hz, the drone climbs an octave
  cutoff: [220, 2400] as [number, number], // Hz, low-pass opening
  static: [0.15, 0.6] as [number, number], // static level (relative)
};

export class Hum {
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private saw: OscillatorNode | null = null;
  private sub: OscillatorNode | null = null;
  private noise: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;

  start(): void {
    const c = ensureContext();
    if (!c) return;
    void c.resume(); // works if this press counts as an activation (mouse, key)
    if (this.master) return;

    this.master = c.createGain();
    this.master.gain.value = 0;
    this.master.connect(c.destination);

    this.filter = c.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = HUM.cutoff[0];
    this.filter.Q.value = 6;
    this.filter.connect(this.master);

    this.saw = c.createOscillator();
    this.saw.type = "sawtooth";
    this.saw.frequency.value = HUM.pitch[0];
    this.saw.connect(this.filter);

    this.sub = c.createOscillator();
    this.sub.type = "sine";
    this.sub.frequency.value = HUM.pitch[0] / 2;
    this.sub.connect(this.filter);

    // 2 s of white noise, looped, band-passed like a radio between stations.
    const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = c.createBufferSource();
    this.noise.buffer = buffer;
    this.noise.loop = true;
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1800;
    band.Q.value = 0.7;
    this.noiseGain = c.createGain();
    this.noiseGain.gain.value = 0;
    this.noise.connect(band).connect(this.noiseGain).connect(this.master);

    this.saw.start();
    this.sub.start();
    this.noise.start();
  }

  /** Every frame: p = hold progress 0..1. */
  update(p: number, holding: boolean): void {
    const c = shared;
    if (!c || !this.master || !this.filter || !this.saw || !this.sub || !this.noiseGain) return;
    const t = c.currentTime;
    const lerp = ([a, b]: [number, number], k: number) => a + (b - a) * k;
    this.master.gain.setTargetAtTime(holding ? lerp(HUM.level, p) : 0, t, holding ? 0.05 : 0.12);
    this.saw.frequency.setTargetAtTime(lerp(HUM.pitch, p), t, 0.05);
    this.sub.frequency.setTargetAtTime(lerp(HUM.pitch, p) / 2, t, 0.05);
    this.filter.frequency.setTargetAtTime(lerp(HUM.cutoff, p * p), t, 0.05);
    this.noiseGain.gain.setTargetAtTime(lerp(HUM.static, p), t, 0.05);
  }

  /** Hold complete: a swell, then a 1.2 s decay, then stop. */
  complete(): void {
    const c = shared;
    if (!c || !this.master || !this.filter) return;
    const t = c.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(HUM.level[1] * 1.6, t + 0.06);
    this.master.gain.setTargetAtTime(0, t + 0.08, 0.3);
    this.filter.frequency.setTargetAtTime(HUM.cutoff[1] * 1.5, t, 0.05);
    this.stopAt(t + 1.6);
  }

  /** Released / unmounted: quick fade, then stop. */
  stop(): void {
    const c = shared;
    if (!c || !this.master) return;
    const t = c.currentTime;
    this.master.gain.setTargetAtTime(0, t, 0.08);
    this.stopAt(t + 0.5);
  }

  private stopAt(when: number): void {
    for (const src of [this.saw, this.sub, this.noise]) src?.stop(when);
    const master = this.master;
    this.master = this.filter = this.saw = this.sub = this.noise = this.noiseGain = null;
    window.setTimeout(() => master?.disconnect(), 1800);
  }
}
