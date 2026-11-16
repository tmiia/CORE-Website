/**
 * Intro voice-over and its typed subtitles: one line per phrase of the
 * recording. French, "tu" (as everywhere on the site), uppercase on screen.
 *
 * Cue times are seconds into the recording, read off its loudness envelope:
 * each line types from the first syllable of its phrase to the last (linear
 * typing follows this voice closely), then stays a moment. A new recording
 * means measuring these again. Without sound, the same timing.
 */
export interface Cue {
  text: string;
  start: number; // s: line starts typing
  typed: number; // s: fully typed
  end: number; // s: line leaves the screen
}

// Kept short: why the project exists (forgotten origins, the installation's
// aim) is told on the project page (/projet).
export const INTRO_CUES: Cue[] = [
  // Voice 0.20 → 2.14 s, then a short breath: line 2 takes over.
  { text: "BIENVENUE DANS LES ARCHIVES DE CORE.FM,", start: 0.16, typed: 2.05, end: 2.56 },
  // Voice 2.62 → 5.70 s (the file ends at 5.97 s), then time to read.
  {
    text: "LA RADIO QUI TE FAIT REDÉCOUVRIR L'HISTOIRE DES MUSIQUES NOIRES POPULAIRES.",
    start: 2.58,
    typed: 5.6,
    end: 7.2,
  },
];

export const INTRO_VOICE = {
  url: "/assets/audio/vo/VO.m4a",
  gain: 1.3, // the recording peaks at −8 dBFS
  lead: 0.4, // s of intro (the wave alone) before the recording starts
};

/** Characters of `cue` visible at time `t` (recording time). */
export function typedCount(cue: Cue, t: number): number {
  const k = (t - cue.start) / Math.max(0.05, cue.typed - cue.start);
  return Math.max(0, Math.min(cue.text.length, Math.floor(k * cue.text.length)));
}
