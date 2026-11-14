"use client";

import { useEffect, useRef } from "react";

const FPS = 25; // PAL, as the installation's TV2 timecode

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

/** HH:MM:SS:FF (from something.fm client/tv2/VHSFeed.ts formatSmpte). */
function smpte(ms: number): string {
  const frames = Math.floor((ms / 1000) * FPS);
  const s = Math.floor(frames / FPS);
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}:${pad2(frames % FPS)}`;
}

// When recording started — module-level, so it keeps counting across pages.
let recStart: number | null = null;

/**
 * Camcorder "● REC 00:00:12:07". Idle (greyed, 00:00:00:00, dot off) until
 * `live` — on the home, when the wave appears — then the red dot blinks and
 * the timecode runs. The text is written straight to the DOM (no React render
 * per frame).
 */
export default function RecIndicator({ live }: { live: boolean }) {
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!live) return;
    const start = (recStart ??= performance.now());
    let raf = 0;
    let last = "";
    const frame = (now: number) => {
      const text = smpte(now - start);
      if (text !== last && timeRef.current) {
        timeRef.current.textContent = text;
        last = text;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [live]);

  return (
    <div
      aria-hidden="true"
      className={`flex items-center gap-2 tabular-nums transition-opacity duration-700 ${
        live ? "opacity-100" : "opacity-40"
      }`}
    >
      <span
        className={`inline-block size-[0.62em] rounded-full transition-colors duration-700 ${
          live ? "rec-blink bg-[#ff2b2b] shadow-[0_0_8px_#ff2b2b]" : "bg-white/50"
        }`}
      />
      <span>REC</span>
      <span ref={timeRef} className="opacity-85">
        {smpte(0)}
      </span>
    </div>
  );
}
