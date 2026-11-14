"use client";

import { useEffect, useRef } from "react";
import { scrambleText } from "@/lib/experience/scramble";

const DECODE = { stagger: 0.05, shuffles: 4, shuffleStep: 0.045 };

/**
 * "LE CONSTAT": the genre people think they hear, struck out, then the one it
 * is, decoded, in a HUD box like the installation's equalizer panel. Plays
 * once when it scrolls into view (data-step 0 → 3, see globals.css); without
 * JS or with reduced motion, the final state.
 */
export default function SignalMixup({
  heard,
  genre,
  meta,
}: {
  heard: string;
  genre: string;
  meta: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const heardRef = useRef<HTMLSpanElement>(null);
  const genreRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;
    const timers: number[] = [];
    const cancels: (() => void)[] = [];
    const step = (n: number) => box.setAttribute("data-step", String(n));
    step(0);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        step(1);
        if (heardRef.current) cancels.push(scrambleText(heardRef.current, heard, DECODE));
        timers.push(window.setTimeout(() => step(2), 1100));
        timers.push(
          window.setTimeout(() => {
            step(3);
            if (genreRef.current) cancels.push(scrambleText(genreRef.current, genre, DECODE));
          }, 1700),
        );
      },
      { threshold: 0.6 },
    );
    io.observe(box);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
      cancels.forEach((c) => c());
      box.removeAttribute("data-step");
    };
  }, [heard, genre]);

  return (
    <div className="w-full max-w-[30rem]">
      <p className="sr-only">
        On l&apos;entend souvent appeler {heard.toLowerCase()} : c&apos;est du {genre.toLowerCase()}.
      </p>
      <div ref={boxRef} aria-hidden="true" className="mixup">
        <p className="inline-block bg-white px-2.5 py-1 text-[clamp(0.8rem,3.4vw,0.95rem)] text-black">
          IDENTIFICATION DU GENRE
        </p>
        <div className="flex flex-col border border-white bg-black px-3 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span ref={heardRef} className="mixup-heard mixup-strike text-[clamp(1.8rem,9vw,3rem)] leading-none">
              {heard}
            </span>
            <span className="mixup-no shrink-0 text-[clamp(0.8rem,3.4vw,0.95rem)] text-rec">✕ NON</span>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-3">
            <span ref={genreRef} className="mixup-genre text-[clamp(2.4rem,13vw,4.5rem)] leading-none">
              {genre}
            </span>
            <span className="mixup-yes shrink-0 bg-white px-1.5 py-0.5 text-[clamp(0.8rem,3.4vw,0.95rem)] text-black">
              ▮ OUI
            </span>
          </div>
          <p className="mt-4 border-t-2 border-dotted border-white/60 pt-2 text-[clamp(0.8rem,3.4vw,0.95rem)]">
            {meta}
          </p>
        </div>
      </div>
    </div>
  );
}
