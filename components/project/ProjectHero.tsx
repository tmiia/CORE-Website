"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { setStageGenre, type StageGenre } from "@/lib/core-fm/stageCues";
import type { ExhibitionStatus } from "@/lib/experience/project";
import { scrambleText } from "@/lib/experience/scramble";

const DECODE = { stagger: 0.07, shuffles: 5, shuffleStep: 0.05 };

/** Past the hero, the stage goes quiet as on a genre page's body: the wave
 * fades out, no model (one object, so the cue only changes on a real change). */
const QUIET: StageGenre = {
  model: null,
  anchor: null,
  eq: { deform: { high: 0, mid: 0, low: 0 }, energy: 0 },
};

/**
 * Top of the project page: the radio's wave (the layout's WebGL stage) above,
 * then what CORE.FM is, decoded, and its next broadcast (the exhibition). The
 * wave belongs to the hero: it fades out once most of the hero has scrolled
 * away, and comes back with it.
 */
export default function ProjectHero({
  kicker,
  title,
  lede,
  status,
  statusLabel,
  when,
}: {
  kicker: string;
  title: string;
  lede: string;
  status: ExhibitionStatus;
  statusLabel: string;
  when: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setStageGenre(entry && entry.intersectionRatio >= 0.4 ? null : QUIET),
      { threshold: [0, 0.4] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      setStageGenre(null);
    };
  }, []);

  useEffect(() => {
    const el = titleRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return scrambleText(el, title, DECODE);
  }, [title]);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-svh flex-col px-4 pb-8 pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] sm:px-8 sm:pb-12 sm:pt-24">
      <Link
        href="/"
        className="w-fit py-2 text-[clamp(0.85rem,3.6vw,1rem)] outline-none hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black"
      >
        ◂ HOME
      </Link>

      {/* The wave shows through here. */}
      <div aria-hidden="true" className="min-h-[24svh] flex-1" />

      <div className="flex flex-col gap-4 lg:max-w-[56rem]">
        <p className="w-fit bg-white px-2.5 py-1 text-[clamp(0.85rem,3.6vw,1.05rem)] text-black">{kicker}</p>
        <h1 className="text-[clamp(3.4rem,17vw,12rem)] leading-[0.85]">
          <span className="sr-only">{title}</span>
          <span ref={titleRef} aria-hidden="true">
            {title}
          </span>
        </h1>
        <p className="max-w-[34ch] font-anonymous text-[clamp(1.05rem,4.4vw,1.35rem)] normal-case leading-[1.6] tracking-normal">
          <span className="context-line">{lede}</span>
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[clamp(0.85rem,3.6vw,1.05rem)]">
          <span
            className={
              status === "live"
                ? "flex items-center gap-2 bg-white px-2 py-0.5 text-black"
                : "border border-white bg-black px-2 py-0.5"
            }
          >
            {status === "live" && (
              <span aria-hidden="true" className="hint-blink text-rec">
                ●
              </span>
            )}
            {statusLabel}
          </span>
          <span className="bg-black px-1">▮ {when}</span>
        </p>
      </div>
    </section>
  );
}
