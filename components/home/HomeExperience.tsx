"use client";

import { useEffect, useMemo, useState } from "react";
import {
  setForgeProgress,
  setLive,
  setLogoCue,
  setStageDark,
  setStagePreload,
} from "@/lib/core-fm/stageCues";
import { EXPERIENCE } from "@/lib/experience/config";
import { type MenuGenre, menuModels } from "@/lib/experience/genres";
import { installAudioUnlock } from "@/lib/experience/hum";
import { autoTime, INTRO_LINES } from "@/lib/experience/introScript";
import GenreMenu from "./GenreMenu";
import HoldButton from "./HoldButton";
import IntroSubtitles from "./IntroSubtitles";
import Loader from "./Loader";

/**
 * loading → hold (forge the logo) → forged (chrome alone) → dissolve (the logo
 * sinks into the ASCII as the field and the wave form; REC goes live) → intro
 * (subtitles) → menu (the logo comes back, genre menu).
 */
type Phase = "loading" | "hold" | "forged" | "dissolve" | "intro" | "menu";

// The opening plays once per visit (back to the home → straight to the menu).
let played = false;

const STAGE: Record<Phase, { dark: boolean; live: boolean; logo: Parameters<typeof setLogoCue>[0] }> = {
  loading: { dark: true, live: false, logo: "hidden" },
  hold: { dark: true, live: false, logo: "forge" },
  forged: { dark: true, live: false, logo: "forged" },
  dissolve: { dark: false, live: true, logo: "hidden" },
  intro: { dark: false, live: true, logo: "hidden" },
  menu: { dark: false, live: true, logo: "shown" },
};

/** Timed phases: how long they last before the next one. */
const NEXT: Partial<Record<Phase, [Phase, number]>> = {
  forged: ["dissolve", EXPERIENCE.forgedShowMs],
  dissolve: ["intro", EXPERIENCE.dissolveMs],
};

/**
 * Single-viewport home. Phases drive the WebGL stage and the header through
 * stageCues. `?nointro` jumps straight to the menu (dev).
 */
export default function HomeExperience({ genres }: { genres: MenuGenre[] }) {
  const [phase, setPhase] = useState<Phase>(() => (played ? "menu" : "loading"));
  const cues = useMemo(() => autoTime(INTRO_LINES), []);

  useEffect(() => {
    installAudioUnlock();
    if (new URLSearchParams(window.location.search).has("nointro")) setPhase("menu");
  }, []);

  // The genre pages' models load (and warm up) behind the loader.
  useEffect(() => {
    setStagePreload(menuModels(genres));
  }, [genres]);

  // A single fixed screen: no page scroll, no rubber-band bounce on phones.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      overscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
    };
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.overscroll;
      body.style.overflow = prev.bodyOverflow;
    };
  }, []);

  useEffect(() => {
    const s = STAGE[phase];
    setStageDark(s.dark);
    setLive(s.live);
    setLogoCue(s.logo);
    if (phase !== "hold") setForgeProgress(phase === "forged" ? 1 : 0);
    if (phase === "menu") played = true;
    const next = NEXT[phase];
    if (!next) return;
    const id = window.setTimeout(() => setPhase(next[0]), next[1]);
    return () => clearTimeout(id);
  }, [phase]);

  useEffect(
    () => () => {
      setStageDark(false);
      setLive(true);
      setLogoCue("hidden");
      setForgeProgress(0);
    },
    [],
  );

  return (
    <main className="fixed inset-0 overflow-hidden">
      {phase === "loading" && <Loader onDone={() => setPhase("hold")} />}
      {phase === "hold" && <HoldButton onComplete={() => setPhase("forged")} />}
      {phase === "intro" && (
        <>
          <IntroSubtitles cues={cues} onDone={() => setPhase("menu")} />
          <button
            type="button"
            onClick={() => setPhase("menu")}
            className="fixed bottom-0 right-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] font-vcr text-[0.75rem] uppercase tracking-[0.08em] text-white/70 transition-colors hover:text-white focus-visible:text-white"
          >
            PASSER ▸
          </button>
        </>
      )}
      {phase === "menu" && <GenreMenu genres={genres} delay={EXPERIENCE.menuDelayMs} />}
    </main>
  );
}
