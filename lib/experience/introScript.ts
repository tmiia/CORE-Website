/**
 * Intro voice-over, shown as typed subtitles over the wave: the narration
 * script, cut into subtitles at its natural pauses (≤ ~3 lines on a phone).
 * French, "tu" (as everywhere on the site), uppercase on screen.
 *
 * Timing: until the voice is recorded, each line's timing is derived from its
 * length (≈ speech rate). Once the recording exists, `start`/`end` come from it
 * (seconds into the audio file, e.g. from a WebVTT export) and the typing
 * follows the voice.
 */
export interface Cue {
  text: string;
  start: number; // s: line starts typing
  end: number; // s: line leaves the screen
}

export const INTRO_LINES = [
  "BIENVENUE DANS LES ARCHIVES DE CORE.FM,",
  "LA RADIO QUI TE FAIT REDÉCOUVRIR L'HISTOIRE DES MUSIQUES NOIRES POPULAIRES.",
  "LE RAP, LE BAILE FUNK, LA TECHNO, LE BOUYON",
  "SONT DES MUSIQUES TRÈS POPULAIRES AUJOURD'HUI",
  "ET POURTANT, PARFOIS, ON OUBLIE D'OÙ ELLES VIENNENT.",
  "ALORS AVEC CETTE INSTALLATION SONORE INTERACTIVE,",
  "ON A VOULU RAPPELER LES CULTURES QUI SONT DERRIÈRE CES MUSIQUES,",
  "LEUR HISTOIRE ET LE CONTEXTE SOCIAL OÙ ELLES ONT ÉTÉ CRÉÉES.",
];

export const INTRO_TIMING = {
  charsPerSecond: 15, // ≈ French speech rate
  hold: 1.2, // s a finished line stays on screen
  gap: 0.35, // s of empty screen between lines
  lead: 0.8, // s before the first line
};

export function autoTime(lines: string[], t = INTRO_TIMING): Cue[] {
  let at = t.lead;
  return lines.map((text) => {
    const start = at;
    const end = start + text.length / t.charsPerSecond + t.hold;
    at = end + t.gap;
    return { text, start, end };
  });
}

/** Characters of `cue` visible at time `t` (typing ends `hold` before `end`). */
export function typedCount(cue: Cue, t: number, hold = INTRO_TIMING.hold): number {
  const typingEnd = Math.max(cue.start + 0.05, cue.end - hold);
  const k = (t - cue.start) / (typingEnd - cue.start);
  return Math.max(0, Math.min(cue.text.length, Math.floor(k * cue.text.length)));
}
