"use client";

import { useEffect, useRef, useState } from "react";
import { type Cue, typedCount } from "@/lib/experience/introScript";

/**
 * Typed subtitles over the wave: one line at a time, typewriter-style, with a
 * blinking block caret. Driven by a clock (performance.now for now; the voice
 * recording's currentTime later), so the typing can follow the voice.
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
    const t0 = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      if (!last || t >= last.end) {
        onDoneRef.current();
        return;
      }
      const index = cues.findIndex((c) => t >= c.start && t < c.end);
      const count =
        index < 0 ? 0 : reduced ? cues[index].text.length : typedCount(cues[index], t);
      setView((v) => (v.index === index && v.count === count ? v : { index, count }));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
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
