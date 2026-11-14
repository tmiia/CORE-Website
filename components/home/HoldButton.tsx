"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { setForgeProgress } from "@/lib/core-fm/stageCues";
import { EXPERIENCE } from "@/lib/experience/config";
import { hapticSuccess, hapticTick } from "@/lib/experience/haptics";
import { Hum, unlockAudio } from "@/lib/experience/hum";
import { scrambleText } from "@/lib/experience/scramble";
import { onSoundChange, setSoundEnabled, soundEnabled } from "@/lib/experience/sound";

const LABEL = "HOLD";
const HINT = "MAINTIENS POUR CALER LE SIGNAL";
const SOUND_CHOICES: [boolean, string][] = [
  [true, "AVEC SON"],
  [false, "SANS SON"],
];
const DECODE = { stagger: 0.02, shuffles: 4, shuffleStep: 0.04 };
// Haptic ticks speed up with the hold: ms between ticks [start, full].
const TICK_MS: [number, number] = [220, 60];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Press-and-hold to forge the logo. Holding fills the button (TV1 modal clip),
 * drives the stage (setForgeProgress), raises the hum and ticks the haptics,
 * faster and faster; the button trembles more as it charges. Releasing early
 * drains it back. Pointer (touch/mouse) and keyboard (Space/Enter held).
 */
export default function HoldButton({ onComplete }: { onComplete: () => void }) {
  const [p, setP] = useState(0);
  const sound = useSyncExternalStore(onSoundChange, soundEnabled, () => true);
  const holding = useRef(false);
  const hum = useRef<Hum | null>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    if (hintRef.current) return scrambleText(hintRef.current, HINT, DECODE);
  }, []);

  useEffect(() => {
    const h = new Hum();
    hum.current = h;
    let raf = 0;
    let last = performance.now();
    let progress = 0;
    let nextTick = 0;
    let done = false;

    const frame = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      progress = clamp01(
        progress + (holding.current ? dt / EXPERIENCE.holdMs : -dt / EXPERIENCE.releaseMs),
      );
      setP(progress);
      setForgeProgress(progress);
      h.update(progress, holding.current);
      if (holding.current && now >= nextTick) {
        hapticTick();
        nextTick = now + TICK_MS[0] + (TICK_MS[1] - TICK_MS[0]) * progress;
      }
      if (progress >= 1) {
        done = true;
        holding.current = false;
        hapticSuccess();
        h.complete();
        onCompleteRef.current();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      if (!done) h.stop();
    };
  }, []);

  const press = () => {
    if (holding.current) return;
    holding.current = true;
    hum.current?.start(); // inside the gesture: unlocks audio
    hapticTick();
  };
  const release = () => {
    holding.current = false;
  };

  // Tremble while charging (re-rendered every frame anyway).
  const amp = holding.current ? 2.5 * p : 0;
  const shake = `translate(${(Math.random() * 2 - 1) * amp}px, ${(Math.random() * 2 - 1) * amp}px)`;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[68%] z-30 flex flex-col items-center gap-3 px-4 font-vcr uppercase tracking-[0.08em] text-white">
      <button
        type="button"
        aria-label="Maintiens pour caler le signal"
        onPointerDown={(e) => {
          // No preventDefault: a cancelled mouse press no longer counts as the
          // user activation that lets the hum start. Selection and scrolling
          // are blocked by CSS (select-none, touch-none) instead.
          e.currentTarget.setPointerCapture(e.pointerId);
          press();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            press();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") release();
        }}
        onBlur={release}
        onContextMenu={(e) => e.preventDefault()}
        style={{ transform: shake, WebkitTouchCallout: "none" }}
        className="pointer-events-auto relative touch-none select-none border border-white bg-black px-10 py-3 pl-[calc(2.5rem+0.3em)] text-[clamp(1.5rem,7vw,2.25rem)] leading-none tracking-[0.3em] outline-offset-4"
      >
        <span>{LABEL}</span>
        {/* The fill: same label inverted, revealed left → right. */}
        <span
          aria-hidden="true"
          style={{ clipPath: `inset(0 ${100 - p * 100}% 0 0)` }}
          className="absolute inset-0 flex items-center justify-center bg-white pl-[0.3em] text-black"
        >
          {LABEL}
        </span>
      </button>
      {/* The hint and the sound choice read as one block, close together. */}
      <div className="flex flex-col items-center">
        <p ref={hintRef} aria-hidden="true" className="text-[clamp(0.75rem,3.2vw,0.95rem)] opacity-80" />
        {/* Sound choice: discreet, remembered on this device. Choosing "on" is
            also a gesture, so the first touch-hold already has its hum. */}
        <div role="group" aria-label="Son" className="pointer-events-auto flex gap-6 text-[clamp(0.68rem,2.8vw,0.78rem)]">
          {SOUND_CHOICES.map(([on, label]) => {
            const chosen = sound === on;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={chosen}
                onClick={() => {
                  setSoundEnabled(on);
                  if (on) unlockAudio();
                }}
                className={`py-1.5 underline-offset-4 outline-none transition-colors hover:underline focus-visible:underline ${
                  chosen ? "text-white/85" : "text-white/40 hover:text-white/70"
                }`}
              >
                <span aria-hidden="true" className={chosen ? "" : "invisible"}>
                  ▮{" "}
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
