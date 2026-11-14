"use client";

import { useEffect, useRef, useState } from "react";
import { loadProgress, reportLoad } from "@/lib/core-fm/loadProgress";
import { EXPERIENCE } from "@/lib/experience/config";

const SQUARES = 10; // TV1's loading row
const LABEL = "RÉCEPTION DU SIGNAL";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Real loader, retro-computer style: TV1's row of squares + a big 000–100 %
 * counter bottom-left. One continuous curve: an ease-out clock over
 * minLoadingMs (fast, then slower and slower), capped by the real loading for
 * the part above `realFrom` (80 %), and the display follows it smoothly — no
 * speed jumps, never done before minLoadingMs.
 * Plain DOM, so it's on screen before the 3D bundle arrives.
 */
export default function Loader({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    void document.fonts?.ready.then(() => reportLoad("fonts", 1));
    const { minLoadingMs, maxLoadingMs, loaderCurve, loaderFollow, realFrom } = EXPERIENCE;
    const t0 = performance.now();
    let last = t0;
    let raf = 0;
    let doneTimer = 0;
    let shown = 0;

    const frame = (now: number) => {
      const elapsed = now - t0;
      const dt = Math.max(0, now - last) / 1000;
      last = now;
      const real = elapsed >= maxLoadingMs ? 1 : loadProgress();
      const clock = 1 - Math.pow(1 - clamp01(elapsed / minLoadingMs), loaderCurve);
      const target = Math.min(clock, realFrom + (1 - realFrom) * real);
      // Frame-rate independent follow: smooth even if a frame is late.
      shown = Math.max(shown, shown + (target - shown) * (1 - Math.exp(-loaderFollow * dt)));
      if (target >= 1 && shown > 0.995) shown = 1;
      const next = Math.floor(shown * 100);
      setPct((p) => (p === next ? p : next));
      if (shown >= 1) {
        doneTimer = window.setTimeout(() => onDoneRef.current(), EXPERIENCE.loadedBeatMs);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(doneTimer);
    };
  }, []);

  const filled = Math.floor(pct / 10);

  return (
    <div
      role="progressbar"
      aria-label="Chargement"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="fixed inset-0 z-40 bg-black font-vcr uppercase tracking-[0.08em] text-white"
    >
      <div className="absolute bottom-0 left-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-8">
        <p className="mb-3 inline-block bg-white px-2.5 py-1 text-[clamp(0.85rem,3.6vw,1.1rem)] text-black">
          {LABEL}
        </p>
        <div aria-hidden="true" className="flex gap-[0.35em] text-[clamp(0.9rem,3.6vw,1.2rem)]">
          {Array.from({ length: SQUARES }, (_, i) => (
            <span key={i} className={`size-[1em] bg-white ${i < filled ? "" : "opacity-25"}`} />
          ))}
        </div>
        <p aria-hidden="true" className="mt-2 text-[clamp(5rem,30vw,14rem)] leading-[0.85]">
          {String(pct).padStart(3, "0")}
          <span className="text-[0.35em]">%</span>
        </p>
      </div>
    </div>
  );
}
