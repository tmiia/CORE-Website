"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { type Band, BANDS, type EqPhase, GhostEq } from "@/lib/core-fm/genre/GhostEq";
import { setStageGenre } from "@/lib/core-fm/stageCues";
import type { EqSetting } from "@/lib/experience/genres";
import { scrambleText } from "@/lib/experience/scramble";

// Installation HUD labels (something.fm client/shared/texts.ts).
const LABELS: Record<Band, string> = { high: "AIGUS", mid: "MÉDIUMS", low: "GRAVES" };
const STATUS: Record<EqPhase, string> = {
  tune: "RÉGLAGE ÉGALISEUR",
  pause: "RÉGLAGE ÉGALISEUR",
  lock: "ÉGALISEUR RÉGLÉ",
  detune: "ÉGALISEUR DÉRÉGLÉ",
};
const STATUS_CLASS: Record<EqPhase, string> = {
  tune: "hint-blink",
  pause: "hint-blink",
  lock: "bg-white text-black",
  detune: "text-rec",
};
const DECODE = { stagger: 0.03, shuffles: 4, shuffleStep: 0.04 };

/**
 * Top of a genre page. The genre's 3D model (the installation's equalizer
 * step) turns in the box marked by `anchorRef`, drawn by the fixed WebGL stage
 * in ASCII; a ghost hand keeps tuning its equalizer, which deforms it. The EQ
 * panel below mirrors the pots live, as on TV1.
 */
export default function GenreHero({
  title,
  meta,
  freq,
  description,
  model,
  eq,
  tolerance = 1,
}: {
  title: string;
  meta?: string;
  freq?: number;
  description?: string;
  model: string | null;
  eq: EqSetting | null;
  tolerance?: number;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const valueRefs = useRef<Partial<Record<Band, HTMLSpanElement | null>>>({});
  const fillRefs = useRef<Partial<Record<Band, HTMLSpanElement | null>>>({});
  const statusRef = useRef<HTMLSpanElement>(null);

  // Stage cue + the ghost equalizer, ticked here so the panel works even
  // without WebGL (the stage only reads its deformation).
  const eqKey = eq ? `${eq.high}/${eq.mid}/${eq.low}` : "";
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ghost = new GhostEq(
      eq ?? { high: 5, mid: 5, low: 5 },
      tolerance,
      reduced || !eq ? "locked" : "far",
    );
    setStageGenre({ model, anchor: anchorRef.current, eq: ghost });

    const shown: Partial<Record<Band, string>> = {};
    let phase: EqPhase | null = null;
    const draw = () => {
      for (const b of BANDS) {
        const v = ghost.values[b];
        const text = v.toFixed(1);
        if (shown[b] !== text) {
          shown[b] = text;
          const value = valueRefs.current[b];
          if (value) value.textContent = text;
          const fill = fillRefs.current[b];
          if (fill) fill.style.width = `${v * 10}%`;
        }
      }
      const status = statusRef.current;
      if (status && ghost.phase !== phase) {
        phase = ghost.phase;
        status.textContent = STATUS[phase];
        status.className = `px-1.5 py-0.5 ${STATUS_CLASS[phase]}`;
      }
    };
    draw();
    if (reduced || !eq) return () => setStageGenre(null);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      ghost.update(Math.min((now - last) / 1000, 0.1));
      last = now;
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      setStageGenre(null);
    };
    // eqKey stands for `eq` (a new object every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, eqKey, tolerance]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return scrambleText(el, title, DECODE);
  }, [title]);

  return (
    <section className="relative flex min-h-svh flex-col px-4 pb-6 pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] sm:px-8 sm:pb-8 sm:pt-24 lg:grid lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-x-8">
      <Link
        href="/"
        className="w-fit py-2 text-[clamp(0.85rem,3.6vw,1rem)] outline-none hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black lg:col-start-1 lg:row-start-1"
      >
        ◂ HOME
      </Link>

      {/* The WebGL stage fits the model into this box. */}
      <div
        ref={anchorRef}
        aria-hidden="true"
        className="relative min-h-[38svh] flex-1 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-0"
      />

      <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-2 lg:self-end">
        {freq !== undefined && (
          <p className="flex w-fit gap-6 bg-white px-2.5 py-1 text-[clamp(0.85rem,3.6vw,1.05rem)] text-black">
            <span>FRÉQUENCE</span>
            <span>{freq.toFixed(1)}</span>
          </p>
        )}
        <h1 className="text-[clamp(2.6rem,12vw,6.5rem)] leading-[0.9] wrap-anywhere">
          <span className="sr-only">{title}</span>
          <span ref={titleRef} aria-hidden="true">
            {title}
          </span>
        </h1>
        {meta && <p className="text-[clamp(0.9rem,3.8vw,1.15rem)]">▮ {meta}</p>}
        {description && (
          <p className="max-w-[38ch] font-anonymous text-[0.95rem] normal-case leading-relaxed tracking-normal text-white/80 sm:text-base">
            {description}
          </p>
        )}

        {eq && (
          <div className="mt-2 w-full max-w-[30rem]" aria-label="Égaliseur">
            <h2 className="inline-block bg-white px-2.5 py-1 text-[clamp(0.8rem,3.4vw,0.95rem)] text-black">
              ÉGALISEUR
            </h2>
            <div className="flex flex-col gap-2 border border-white bg-black px-3 py-2.5 text-[clamp(0.8rem,3.4vw,0.95rem)]">
              {BANDS.map((b) => {
                const t = eq[b];
                return (
                  <div key={b} className="flex items-center gap-3">
                    <span className="w-[5.5em] shrink-0">{LABELS[b]}</span>
                    <span className="relative h-2.5 flex-1 border border-white">
                      <span
                        ref={(el) => {
                          fillRefs.current[b] = el;
                        }}
                        className="absolute inset-y-0 left-0 bg-white"
                        style={{ width: `${t * 10}%` }}
                      />
                      {/* Target window (± tolerance), visible over the fill too. */}
                      <span
                        className="absolute -inset-y-1 border border-white mix-blend-difference"
                        style={{
                          left: `${Math.max(0, t - tolerance) * 10}%`,
                          width: `${(Math.min(10, t + tolerance) - Math.max(0, t - tolerance)) * 10}%`,
                        }}
                      />
                    </span>
                    <span
                      ref={(el) => {
                        valueRefs.current[b] = el;
                      }}
                      className="w-[2.5em] shrink-0 text-right tabular-nums"
                    >
                      {t.toFixed(1)}
                    </span>
                  </div>
                );
              })}
              <p className="mt-1 border-t-2 border-dotted border-white/60 pt-2" aria-live="off">
                <span ref={statusRef} className="px-1.5 py-0.5">
                  {STATUS.lock}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
