// Decode effect from something.fm@7129c50 client/tv1/hud/scramble.ts,
// rewritten without gsap (one rAF loop). Same defaults and behaviour: each
// character fades in (staggered), flickers through `shuffles` random ASCII
// glyphs, then lands. Whitespace is not scrambled.

const RANDOM = Array.from({ length: 126 - 33 + 1 }, (_, i) =>
  String.fromCharCode(33 + i),
).join("");
const randomChar = () => RANDOM[Math.floor(Math.random() * RANDOM.length)];

export interface ScrambleOptions {
  stagger?: number; // s between each character's start
  shuffles?: number; // random frames before settling
  shuffleStep?: number; // s per shuffle frame
  fade?: number; // s opacity fade-in
}

// One live run per element: a re-trigger cancels the previous one.
const running = new WeakMap<HTMLElement, () => void>();

/** Decodes `text` into `el` (its children are replaced). Returns a cancel
 * function that leaves the final text in place. */
export function scrambleText(
  el: HTMLElement,
  text: string,
  opts: ScrambleOptions = {},
): () => void {
  const stagger = opts.stagger ?? 0.03;
  const shuffles = opts.shuffles ?? 4;
  const step = opts.shuffleStep ?? 0.05;
  const fade = opts.fade ?? 0.2;

  running.get(el)?.();

  const chars = Array.from(text);
  const spans = chars.map((ch) => {
    const span = document.createElement("span");
    span.textContent = /\s/.test(ch) ? ch : randomChar();
    span.style.opacity = "0";
    return span;
  });
  el.replaceChildren(...spans);

  const total = (chars.length - 1) * stagger + fade + shuffles * step;
  const t0 = performance.now();
  let raf = 0;

  const finish = () => {
    cancelAnimationFrame(raf);
    running.delete(el);
    el.textContent = text;
  };

  const frame = (now: number) => {
    const t = (now - t0) / 1000;
    chars.forEach((ch, i) => {
      const span = spans[i];
      const start = i * stagger;
      span.style.opacity = String(Math.min(1, Math.max(0, (t - start) / fade)));
      if (/\s/.test(ch)) return;
      const k = Math.floor((t - start - fade) / step); // shuffle frame index
      if (k >= shuffles) span.textContent = ch;
      else if (k >= 0 && span.dataset.k !== String(k)) {
        span.dataset.k = String(k);
        span.textContent = randomChar();
      }
    });
    if (t >= total) finish();
    else raf = requestAnimationFrame(frame);
  };

  if (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finish();
    return () => {};
  }

  raf = requestAnimationFrame(frame);
  running.set(el, finish);
  return finish;
}
