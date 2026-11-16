"use client";

import { useEffect, useRef, useState } from "react";
import { audioOutput, runningContext, sample } from "@/lib/experience/audio";
import { type Cue, INTRO_VOICE, typedCount } from "@/lib/experience/introScript";
import { SFX, typeKey } from "@/lib/experience/sfx";
import { soundEnabled } from "@/lib/experience/sound";

interface Voice {
  c: AudioContext;
  src: AudioBufferSourceNode;
  gain: GainNode;
  zero: number; // context time of the recording's t = 0
}

/**
 * Typed subtitles over the wave, one line at a time, typewriter-style, with a
 * blinking block caret and a key click per character. Driven by the voice-over:
 * while it plays, its clock (what is heard now) types the lines. Without it
 * (sound off, audio still locked, file not loaded), a plain clock with the
 * same timing; if it becomes possible mid-intro (sound turned on), the voice
 * joins at the current line, like tuning into a broadcast already on.
 */
export default function IntroSubtitles({
  cues,
  onDone,
}: {
  cues: Cue[];
  onDone: () => void;
}) {
  const [view, setView] = useState({ index: -1, count: 0 });
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const last = cues[cues.length - 1];
    const t0 = performance.now() + INTRO_VOICE.lead * 1000;
    let raf = 0;
    let voice: Voice | null = null;
    let t = -Infinity; // recording time; never goes back
    let shown = { index: -1, count: 0 };

    const tryVoice = (at: number) => {
      if (voice || at < 0 || !soundEnabled()) return;
      const c = runningContext();
      const buf = sample(INTRO_VOICE.url);
      const out = audioOutput();
      if (!c || !buf || !out || at >= buf.duration - 0.2) return;
      const src = c.createBufferSource();
      src.buffer = buf;
      const gain = c.createGain();
      gain.gain.value = INTRO_VOICE.gain;
      src.connect(gain).connect(out);
      src.onended = () => gain.disconnect();
      src.start(c.currentTime, at);
      voice = { c, src, gain, zero: c.currentTime - at };
    };

    const clock = (now: number) => {
      if (!voice) return (now - t0) / 1000;
      // What is heard now: the context's clock minus the output latency.
      const lag = voice.c.outputLatency || voice.c.baseLatency || 0;
      return voice.c.currentTime - voice.zero - lag;
    };

    const frame = (now: number) => {
      t = Math.max(t, clock(now));
      tryVoice(t);
      if (!last || t >= last.end) {
        onDoneRef.current();
        return;
      }
      const index = cues.findIndex((c) => t >= c.start && t < c.end);
      const count =
        index < 0 ? 0 : reduced ? cues[index].text.length : typedCount(cues[index], t);
      // A click when new characters appeared (spaces don't type).
      const before = index === shown.index ? shown.count : 0;
      if (!reduced && index >= 0 && count > before && /\S/.test(cues[index].text.slice(before, count))) {
        typeKey(voice ? SFX.keyUnderVoice : SFX.key);
      }
      const next = { index, count };
      shown = next;
      setView((v) => (v.index === index && v.count === count ? v : next));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      // Skipped (PASSER) or done: the voice fades out quickly.
      if (!voice) return;
      const { c, src, gain } = voice;
      gain.gain.setTargetAtTime(0, c.currentTime, 0.05);
      try {
        src.stop(c.currentTime + 0.3);
      } catch {
        // already stopped
      }
    };
  }, [cues]);

  const cue = view.index >= 0 ? cues[view.index] : null;

  return (
    // Below the centred logo.
    <div className="pointer-events-none fixed inset-x-0 top-[66%] flex justify-center px-5">
      {/* Screen readers get whole lines, not every typed character. */}
      <p className="sr-only" aria-live="polite">
        {cue?.text}
      </p>
      {cue && (
        <p
          aria-hidden="true"
          className="max-w-[30ch] text-center font-vcr text-[clamp(1.05rem,4.8vw,1.9rem)] uppercase leading-[1.55] tracking-[0.06em] text-white"
        >
          <span className="box-decoration-clone bg-black px-[0.35em] py-[0.12em]">
            {cue.text.slice(0, view.count)}
            <span className="caret">█</span>
          </span>
        </p>
      )}
    </div>
  );
}
