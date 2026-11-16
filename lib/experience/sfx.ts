/**
 * Typing and glitch sounds, on the shared output (silent when the visitor
 * chose no sound). The files are the installation's own (something.fm
 * `musics/sfx/ui/typing.mp3`, `musics/gltich/glitch.mp3`), re-encoded mono:
 * - typing: a loop of key clicks. Each click is found in the file and cut
 *   out on first use, so one can be played per typed character (`typeKey`),
 *   or a run of them at the loop's own pace while a text decodes
 *   (`typingRun`, like the installation, where every decode types);
 * - glitches (`glitch`): stuttering bursts, held and dropped like the stepped
 *   CSS flicker. The audible part is synthesised (see CRACKLE): the
 *   installation's no-signal static is a low rumble, nearly nothing above
 *   1 kHz, so on a phone or a laptop it can't be heard. It stays under the
 *   normal glitches as a low layer (headphones, speakers);
 * - archive prints put down on the context text (`printDown`): a short,
 *   muffled paper touch, synthesised.
 * Nothing loads while the sound is off, nothing plays before the visitor's
 * first gesture (no queueing: a missed sound is just skipped).
 */

import { audioOutput, loadSample, runningContext, sample } from "./audio";
import { onSoundChange, soundEnabled } from "./sound";

export const SFX_FILES = {
  typing: "/assets/audio/sfx/typing.m4a",
  static: "/assets/audio/sfx/static.m4a",
};

/** Levels (linear gain) and timings. Live-tunable: ?debug pane, "Son".
 * Measured at the site's output (dBFS, loudest 128-sample block) in brackets.
 * Lowered on 2026-11-16: everything was far too loud, the glitches most. */
export const SFX = {
  // All the sound design at once (HOLD hum, typing, glitches, prints): one
  // knob on top of the levels below. The voice is apart (INTRO_VOICE.gain).
  master: 0.6,
  key: 0.13, // a character typed by the scroll (context text)
  keyUnderVoice: 0.065, // the intro subtitles, under the voice
  decode: 0.09, // a text decoding (scramble): its run of clicks
  decodeRate: 15.5, // clicks/s while decoding (the typing loop's pace)
  decodeMax: 2.5, // s, longest run (a long line decodes for longer)
  keyGap: 0.045, // s, min between two typed clicks (≤ ~22/s)
  detune: 0.05, // ± playback rate per click, so they don't all match
  // Glitches: the crackle is normalised (−12 dBFS RMS) before these gains.
  glitch: 0.065, // the main glitches (genre menu arriving)
  glitchBody: 0.05, // + the installation's static under it (lows)
  glitchSoft: 0.04, // light, thin, no low layer: the smaller moments
  glitchStep: [0.022, 0.05] as [number, number], // s per stutter step
  appear: 0.08, // a genre model tearing in: decaying burst…
  appearFor: 1.1, // …this long (its ASCII tear fades over GENRE_FX.fadeIn)
  print: 0.15, // an archive print put down: a short, muffled paper touch
  // s from the print starting to come down to its contact: .archive-photo
  // lands in 0.5 s, ease-out, 80 % of the way at 0.14 s.
  printFall: 0.15,
};

const CLICK = { pre: 0.002, length: 0.05 }; // s: lead-in before an onset, slice length
const LOOKAHEAD = 0.12; // s of decode clicks scheduled ahead
const noop = () => {};
const jitter = (spread: number) => 1 + (Math.random() * 2 - 1) * spread;

let fxBus: GainNode | null = null;

/** Where all the sound design connects (not the voice): the shared output,
 * through one gain, `SFX.master` (read at every sound, so the pane's slider
 * applies at once). */
export function effectsOutput(): AudioNode | null {
  const out = audioOutput();
  if (!out) return null;
  if (!fxBus || fxBus.context !== out.context) {
    fxBus = out.context.createGain();
    fxBus.connect(out);
  }
  fxBus.gain.value = SFX.master;
  return fxBus;
}

/** Starts loading the files once the sound is on (now or later). */
export function watchSfx(): () => void {
  const warm = () => {
    if (!soundEnabled()) return;
    void loadSample(SFX_FILES.typing);
    void loadSample(SFX_FILES.static);
  };
  warm();
  return onSoundChange(warm);
}

/** Context and file, when a sound can play right now. */
function ready(url: string): { c: AudioContext; buf: AudioBuffer; out: AudioNode } | null {
  if (!soundEnabled()) return null;
  const c = runningContext();
  if (!c) return null;
  const buf = sample(url);
  if (!buf) {
    void loadSample(url);
    return null;
  }
  const out = effectsOutput();
  return out ? { c, buf, out } : null;
}

// --- typing -------------------------------------------------------------------

const clips = new WeakMap<AudioBuffer, AudioBuffer[]>();

/** Where each click starts in the typing loop (s): an envelope follower with
 * hysteresis. Found on the decoded file, so it survives a re-encode. */
function clickOffsets(buf: AudioBuffer): number[] {
  const data = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const win = Math.max(1, Math.round(sr * 0.001));
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const on = peak * 0.2;
  const off = peak * 0.03;
  const at: number[] = [];
  let armed = true;
  let last = -1;
  for (let i = 0; i < data.length; i += win) {
    let m = 0;
    for (let j = i; j < Math.min(i + win, data.length); j++) m = Math.max(m, Math.abs(data[j]));
    const t = i / sr;
    if (armed && m > on && t - last > 0.03) {
      if (t - CLICK.pre + CLICK.length <= buf.duration) at.push(Math.max(0, t - CLICK.pre));
      last = t;
      armed = false;
    } else if (!armed && m < off) armed = true;
  }
  return at;
}

/**
 * Each click copied into its own short buffer (5 ms fade-out baked in),
 * played whole. Playing a slice of the loop instead (start with an offset and
 * a duration) ends it at a fixed context time: when the audio thread is a few
 * ms ahead of `currentTime`, the click started late and was cut short, or
 * skipped entirely.
 */
function clickClips(c: AudioContext, buf: AudioBuffer): AudioBuffer[] {
  const cached = clips.get(buf);
  if (cached) return cached;
  const data = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const len = Math.round(CLICK.length * sr);
  const fade = Math.round(0.005 * sr);
  const list = clickOffsets(buf).map((t) => {
    const clip = c.createBuffer(1, len, sr);
    const d = clip.getChannelData(0);
    d.set(data.subarray(Math.round(t * sr), Math.round(t * sr) + len));
    for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;
    return clip;
  });
  clips.set(buf, list);
  return list;
}

/** One key click at `when` (context time), one of the loop's at random. */
function click(c: AudioContext, buf: AudioBuffer, out: AudioNode, when: number, level: number): void {
  const list = clickClips(c, buf);
  if (!list.length) return;
  const src = c.createBufferSource();
  src.buffer = list[Math.floor(Math.random() * list.length)];
  src.playbackRate.value = jitter(SFX.detune);
  const g = c.createGain();
  g.gain.value = level * jitter(0.2);
  src.connect(g).connect(out);
  src.onended = () => g.disconnect();
  src.start(when);
}

// Decode runs share one stream of clicks: overlapping decodes (a menu's title
// and rows at once) type as one, for as long as the longest of them.
const runs = new Map<number, number>(); // run id → end (context time)
let runId = 0;
let pumpTimer = 0;
let nextClick = 0;
let lastKey = -1;

/** A character was typed: one click (dropped if the last one was too close,
 * or while a decode run already types). */
export function typeKey(level = SFX.key): void {
  if (runs.size) return;
  const r = ready(SFX_FILES.typing);
  if (!r) return;
  const now = r.c.currentTime;
  if (now - lastKey < SFX.keyGap) return;
  lastKey = now;
  click(r.c, r.buf, r.out, now, level);
}

/** A text decodes for `seconds`: clicks at the typing loop's pace until it
 * ends or the returned function is called (decode cancelled). */
export function typingRun(seconds: number): () => void {
  if (seconds <= 0 || !ready(SFX_FILES.typing)) return noop;
  const c = runningContext()!;
  const id = ++runId;
  runs.set(id, c.currentTime + Math.min(seconds, SFX.decodeMax));
  if (!pumpTimer) pump();
  return () => void runs.delete(id);
}

function pump(): void {
  pumpTimer = 0;
  const r = ready(SFX_FILES.typing);
  if (!r) {
    runs.clear();
    return;
  }
  const now = r.c.currentTime;
  for (const [id, end] of runs) if (end <= now) runs.delete(id);
  if (!runs.size) return;
  const until = Math.min(Math.max(...runs.values()), now + LOOKAHEAD);
  nextClick = Math.max(nextClick, now);
  while (nextClick < until) {
    click(r.c, r.buf, r.out, nextClick, SFX.decode);
    nextClick += jitter(0.08) / SFX.decodeRate;
  }
  pumpTimer = window.setTimeout(pump, 50);
}

/** Context and output, when a synthesised sound can play right now. */
function live(): { c: AudioContext; out: AudioNode } | null {
  if (!soundEnabled()) return null;
  const c = runningContext();
  const out = c && effectsOutput();
  return c && out ? { c, out } : null;
}

// --- glitch ---------------------------------------------------------------------

// Sample-and-hold noise (random values held 2–9 samples, like a bitcrusher),
// lows and hard highs cut, normalised to a fixed RMS: crunchy, digital,
// mostly 0.6–3.5 kHz, where small speakers play. Made once, on the live
// context.
const CRACKLE = {
  seconds: 2,
  hold: [2, 10] as [number, number],
  highpass: 600,
  lowpass: 3500, // the hard highs off: crackle, not hiss
  rms: 0.25,
};
let crackle: AudioBuffer | null = null;

function crackleBuffer(c: AudioContext): AudioBuffer {
  if (crackle) return crackle;
  const sr = c.sampleRate;
  const buf = c.createBuffer(1, Math.round(sr * CRACKLE.seconds), sr);
  const d = buf.getChannelData(0);
  const k = Math.exp((-2 * Math.PI * CRACKLE.highpass) / sr); // one-pole highpass
  const l = 1 - Math.exp((-2 * Math.PI * CRACKLE.lowpass) / sr); // one-pole lowpass
  const [h0, h1] = CRACKLE.hold;
  let v = 0;
  let hold = 0;
  let prev = 0;
  let y = 0;
  let z = 0;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    if (--hold <= 0) {
      v = Math.random() * 2 - 1;
      hold = h0 + Math.floor(Math.random() * (h1 - h0));
    }
    y = k * (y + v - prev);
    prev = v;
    z += l * (y - z);
    d[i] = z;
    sum += z * z;
  }
  const scale = CRACKLE.rms / Math.sqrt(sum / d.length);
  for (let i = 0; i < d.length; i++) d[i] *= scale;
  crackle = buf;
  return buf;
}

let lastGlitch = -1;

/**
 * A burst for a visual glitch: the crackle (random stretch and speed, no two
 * alike) and, under it, the installation's static (`body`, 0 = none), both
 * through one gate held in steps, loud / dropped. `decay`: fades out over the
 * burst (a signal settling, e.g. the ASCII tear of a genre model appearing).
 * `rate`: speed range of the crackle (faster = thinner).
 */
export function glitch({
  duration = 0.3,
  level = SFX.glitch,
  body = SFX.glitchBody,
  decay = false,
  rate: [r0, r1] = [0.75, 1.25],
}: {
  duration?: number;
  level?: number;
  body?: number;
  decay?: boolean;
  rate?: [number, number];
} = {}): void {
  const r = live();
  if (!r) return;
  const { c, out } = r;
  const now = c.currentTime;
  if (now - lastGlitch < 0.06) return; // one burst per event (cascades)
  lastGlitch = now;

  const end = now + duration;
  const gate = c.createGain();
  gate.gain.setValueAtTime(0, now);
  const [s0, s1] = SFX.glitchStep;
  let t = now;
  let loud = true;
  while (t < end) {
    const fade = decay ? (1 - (t - now) / duration) ** 2 : 1;
    gate.gain.setValueAtTime(fade * (loud ? 0.5 + Math.random() * 0.35 : Math.random() * 0.15), t);
    t += s0 + Math.random() * (s1 - s0);
    loud = !loud || Math.random() < 0.25;
  }
  gate.gain.setTargetAtTime(0, end, 0.008);
  gate.connect(out);

  const layer = (buf: AudioBuffer, gain: number, speed: number) => {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = speed;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(g).connect(gate);
    src.onended = () => g.disconnect();
    src.start(now, Math.random() * buf.duration);
    src.stop(end + 0.06);
  };
  layer(crackleBuffer(c), level, r0 + Math.random() * (r1 - r0));
  if (body > 0) {
    const rumble = sample(SFX_FILES.static);
    if (rumble) layer(rumble, body, 0.8 + Math.random() * 0.4);
    else void loadSample(SFX_FILES.static);
  }
  window.setTimeout(() => gate.disconnect(), (duration + 0.3) * 1000);
}

/** A light crackle for the smaller glitch moments (a menu closing, a skip):
 * quiet, thin (sped up), no low layer, so it marks the moment without
 * covering it. */
export function softGlitch(duration = 0.25, decay = false): void {
  glitch({ duration, level: SFX.glitchSoft, body: 0, decay, rate: [1.1, 1.5] });
}

/** A genre model appearing: its ASCII tear, a burst that settles with it. */
export function appearGlitch(): void {
  glitch({ duration: SFX.appearFor, level: SFX.appear, decay: true });
}

// --- archive prints -----------------------------------------------------------

// White noise at a known level (uniform ±0.433 ≈ −12 dBFS RMS), made once.
let white: AudioBuffer | null = null;

function noise(c: AudioContext): AudioBufferSourceNode {
  if (!white) {
    white = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = white.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.433;
  }
  const src = c.createBufferSource();
  src.buffer = white;
  src.loop = true;
  return src;
}

/**
 * An archive print put down on the text: one short, muffled touch of paper at
 * the contact (`SFX.printFall` after the call, when the CSS landing has mostly
 * arrived), barely there. No swoosh before, no thump: those made it a cartoon.
 * Lifting a print again (scrolling back) is silent.
 */
export function printDown(): void {
  const r = live();
  if (!r) return;
  const { c, out } = r;
  const hit = c.currentTime + SFX.printFall;
  const src = noise(c);
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 350;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1800 + Math.random() * 900;
  lp.Q.value = 0.4;
  const g = c.createGain();
  g.gain.value = 0; // a GainNode starts at 1: silent until its envelope
  g.gain.setValueAtTime(0, hit);
  g.gain.linearRampToValueAtTime(SFX.print * jitter(0.15), hit + 0.002);
  g.gain.setTargetAtTime(0, hit + 0.002, 0.012);
  src.connect(hp).connect(lp).connect(g).connect(out);
  src.onended = () => g.disconnect();
  src.start(hit, Math.random() * 0.5);
  src.stop(hit + 0.1);
}
