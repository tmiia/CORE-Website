"use client";

import { useSyncExternalStore } from "react";
import { audioRunning, justUnlocked, onAudioState, unlockAudio } from "@/lib/experience/audio";
import { onSoundChange, setSoundEnabled, SOUND_DEFAULT, soundEnabled } from "@/lib/experience/sound";

// A tiny level meter: each bar jumps in steps (.eq-bar) at its own pace while
// sound plays; flat when off. `rest`: its height without the animation
// (reduced motion, or waiting for a tap).
const BARS = [
  { rest: 0.55, ms: 820, delay: 0 },
  { rest: 1, ms: 640, delay: -210 },
  { rest: 0.4, ms: 940, delay: -470 },
  { rest: 0.75, ms: 720, delay: -330 },
];
const FLAT = 0.15;

/**
 * Header sound on/off, the same choice as the HOLD screen's (remembered on
 * this device). Three states:
 * - on, and the browser lets audio play: the bars jump;
 * - on, but the browser is still waiting for a click or a tap on this page
 *   (opened or reloaded, then only scrolled): the bars stand still and blink;
 *   pressing starts the sound (any click or tap anywhere does too);
 * - off: flat bars.
 */
export default function SoundToggle({ live }: { live: boolean }) {
  const on = useSyncExternalStore(onSoundChange, soundEnabled, () => SOUND_DEFAULT);
  const running = useSyncExternalStore(onAudioState, audioRunning, () => false);
  const waiting = on && !running;

  return (
    <button
      type="button"
      inert={!live}
      aria-pressed={on}
      aria-label="Son"
      title={waiting ? "Touche pour lancer le son" : on ? "Couper le son" : "Activer le son"}
      onClick={() => {
        // On, but this very press is what let the audio start (the page-wide
        // unlock in audio.ts runs first): it meant "start", not "turn off".
        if (on && justUnlocked()) return;
        setSoundEnabled(!on);
        if (!on) unlockAudio();
      }}
      className={`relative -m-2 flex size-11 items-center justify-center transition-opacity duration-700 ${
        live ? "pointer-events-auto opacity-100" : "opacity-0"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-3.5 items-end gap-[3px] ${on ? "" : "opacity-60"} ${waiting ? "hint-blink" : ""}`}
      >
        {BARS.map((b, i) => (
          <span
            key={i}
            className={`h-full w-[3px] origin-bottom bg-white ${on && running ? "eq-bar" : ""}`}
            style={{
              transform: `scaleY(${on ? b.rest : FLAT})`,
              animationDuration: `${b.ms}ms`,
              animationDelay: `${b.delay}ms`,
            }}
          />
        ))}
      </span>
    </button>
  );
}
