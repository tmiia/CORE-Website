"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import type { MenuGenre } from "@/lib/experience/genres";
import { scrambleText } from "@/lib/experience/scramble";

const TITLE = "CHOISIS UN GENRE";
const MARKER = "▮";
// Installation genre menu settings (GenreSelect).
const DECODE = { stagger: 0.02, shuffles: 4, shuffleStep: 0.04 };
// Entrance: everything lands in ~0.3 s.
const ENTRANCE_DECODE = { stagger: 0.012, shuffles: 3, shuffleStep: 0.03, fade: 0.08 };
const TITLE_AT = 0.08; // s, once the white bar has wiped in
const ROW_AT = 0.06; // s, first row…
const ROW_STEP = 0.045; // …then one more every 45 ms, in a shuffled order
const LEAVE_DELAY = 450; // ms: let the selection decode before navigating

/** A random order of 0..n-1: the rows cascade in out of order. */
function shuffledRanks(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const rank = new Array<number>(n);
  order.forEach((row, k) => (rank[row] = k));
  return rank;
}

/**
 * The site's main interaction — a take on the installation's genre menu (TV1
 * GenreSelect): inverted title bar, ▮ marker + inverted row on the highlighted
 * genre, year · place below. Full width at the bottom on phones, a large block
 * bottom-left on desktop. Appears after `delay` ms (the logo leads); every
 * label decodes in; hover/focus re-decodes; a click decodes then navigates.
 */
export default function GenreMenu({
  genres,
  delay = 0,
}: {
  genres: MenuGenre[];
  delay?: number;
}) {
  const router = useRouter();
  const [shown, setShown] = useState(delay === 0);
  const [active, setActive] = useState(0);
  const leaving = useRef(false);
  const titleRef = useRef<HTMLSpanElement>(null);
  const metaRef = useRef<HTMLSpanElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (delay === 0) return;
    const id = window.setTimeout(() => setShown(true), delay);
    return () => clearTimeout(id);
  }, [delay]);

  // Rows cascade in out of order (fixed for this mount).
  const rank = useMemo(() => shuffledRanks(genres.length), [genres.length]);
  const rowAt = (i: number) => ROW_AT + (rank[i] ?? i) * ROW_STEP;

  // Entrance decode, in step with the CSS glitch (wipe-x / wipe-y / glitch-in).
  useEffect(() => {
    if (!shown) return;
    const cancels: (() => void)[] = [];
    const at = (s: number, fn: () => void) => window.setTimeout(fn, s * 1000);
    const timers = [
      at(TITLE_AT, () => {
        if (titleRef.current)
          cancels.push(scrambleText(titleRef.current, TITLE, ENTRANCE_DECODE));
      }),
      ...genres.map((g, i) =>
        at(rowAt(i), () => {
          const el = labelRefs.current[i];
          if (el) cancels.push(scrambleText(el, g.label, ENTRANCE_DECODE));
        }),
      ),
    ];
    return () => {
      timers.forEach(clearTimeout);
      cancels.forEach((cancel) => cancel());
    };
  }, [genres, shown]);

  // The meta line follows the highlighted genre.
  useEffect(() => {
    const el = metaRef.current;
    if (!el || !shown) return;
    const meta = genres[active]?.meta;
    if (!meta) {
      el.textContent = "";
      return;
    }
    return scrambleText(el, meta, DECODE);
  }, [active, genres, shown]);

  const highlight = (i: number) => {
    if (leaving.current || i === active) return;
    setActive(i);
    const el = labelRefs.current[i];
    if (el) scrambleText(el, genres[i].label, DECODE);
  };

  const select = (e: MouseEvent<HTMLAnchorElement>, i: number) => {
    const href = genres[i].href;
    // New tab / window: let the browser do it.
    if (!href || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (leaving.current) return;
    leaving.current = true;
    setActive(i);
    const el = labelRefs.current[i];
    if (el) scrambleText(el, genres[i].label, DECODE);
    window.setTimeout(() => router.push(href), LEAVE_DELAY);
  };

  // No page yet: highlightable (shows its year · place) but not a link.
  const soon = (i: number) => {
    const el = labelRefs.current[i];
    if (el) scrambleText(el, genres[i].label, DECODE);
  };

  return (
    <nav
      aria-label="Genres"
      className={`fixed inset-x-0 bottom-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] font-vcr uppercase tracking-[0.08em] text-white sm:right-auto sm:w-[30rem] sm:p-8 ${
        shown ? "" : "invisible"
      }`}
    >
      <h2
        className={`mb-2 inline-block bg-white px-2.5 py-1 text-[clamp(0.85rem,3.6vw,1.1rem)] text-black ${
          shown ? "wipe-x" : ""
        }`}
      >
        <span className="sr-only">{TITLE}</span>
        <span
          ref={titleRef}
          aria-hidden="true"
          className={`inline-block ${shown ? "glitch-in" : ""}`}
          style={{ animationDelay: `${TITLE_AT}s` }}
        />
      </h2>
      <ul className={`flex flex-col border border-white bg-black py-1.5 ${shown ? "wipe-y" : ""}`}>
        {genres.map((g, i) => {
          const on = i === active;
          const row = `flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-[clamp(1.6rem,8.5vw,2.8rem)] leading-none outline-none ${
            on ? "bg-white text-black" : "text-white"
          }`;
          const content = (
            <>
              <span aria-hidden="true" className={`text-[0.7em] ${on ? "visible" : "invisible"}`}>
                {MARKER}
              </span>
              <span
                aria-hidden="true"
                className={g.href ? "" : "opacity-45"}
                ref={(el) => {
                  labelRefs.current[i] = el;
                }}
              />
              {!g.href && (
                <span aria-hidden="true" className="ml-auto text-[0.32em] tracking-[0.12em] opacity-70">
                  BIENTÔT
                </span>
              )}
            </>
          );
          return (
            <li
              key={g.label}
              className={shown ? "glitch-in" : ""}
              style={{ animationDelay: `${rowAt(i)}s` }}
            >
              {g.href ? (
                <Link
                  href={g.href}
                  aria-label={g.meta ? `${g.label}, ${g.meta}` : g.label}
                  onMouseEnter={() => highlight(i)}
                  onFocus={() => highlight(i)}
                  onClick={(e) => select(e, i)}
                  className={row}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  aria-disabled="true"
                  aria-label={`${g.label}, bientôt`}
                  onMouseEnter={() => highlight(i)}
                  onFocus={() => highlight(i)}
                  onClick={() => soon(i)}
                  className={`${row} cursor-default text-left`}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p
        className={`mt-2 min-h-[1.4em] text-[clamp(0.8rem,3.4vw,1rem)] ${shown ? "glitch-in" : ""}`}
        style={{ animationDelay: `${ROW_AT + genres.length * ROW_STEP}s` }}
      >
        <span ref={metaRef} aria-hidden="true" className="bg-black px-2.5 py-0.5 empty:hidden" />
      </p>
    </nav>
  );
}
