"use client";

import Link from "next/link";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { NavLink } from "@/lib/experience/nav";
import { scrambleText } from "@/lib/experience/scramble";

const TITLE = "MENU";
const MARKER = "▮";
const DECODE = { stagger: 0.02, shuffles: 4, shuffleStep: 0.04 };
// Exit: rows glitch out one after another, in a random order (.glitch-out,
// 0.22 s each), while the bar, frame and backdrop go (globals.css).
const ROW_OUT_STEP = 0.035; // s
/** Exit length: the parent unmounts the menu after this. */
export const NAV_EXIT_MS = 420;

/** A random order of 0..n-1 (each row's rank in the exit cascade). */
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
 * Full-screen menu behind the header (the burger stays on top to close it).
 * Same row language as the genre menu: inverted bar + ▮ on the highlighted
 * link, every label decoding in on open. Escape closes. `closing`: plays the
 * exit (glitch + fade), inert, until the parent unmounts it.
 */
export default function NavOverlay({
  id,
  links,
  onClose,
  closing = false,
}: {
  id: string;
  links: NavLink[];
  onClose: () => void;
  closing?: boolean;
}) {
  const [active, setActive] = useState(0);
  const [exitRank] = useState(() => shuffledRanks(links.length));
  const titleRef = useRef<HTMLSpanElement>(null);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    firstLinkRef.current?.focus({ preventScroll: true });
    const cancels: (() => void)[] = [];
    if (titleRef.current) cancels.push(scrambleText(titleRef.current, TITLE, DECODE));
    const timers = links.map((l, i) =>
      window.setTimeout(() => {
        const el = labelRefs.current[i];
        if (el) cancels.push(scrambleText(el, l.label, DECODE));
      }, 120 + i * 90),
    );
    return () => {
      timers.forEach(clearTimeout);
      cancels.forEach((cancel) => cancel());
    };
  }, [links]);

  const highlight = (i: number) => {
    if (i === active) return;
    setActive(i);
    const el = labelRefs.current[i];
    if (el) scrambleText(el, links[i].label, DECODE);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      id={id}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      inert={closing}
      onKeyDown={onKeyDown}
      className={`fixed inset-0 z-40 flex items-center bg-black/90 px-4 font-vcr uppercase tracking-[0.08em] text-white backdrop-blur-[2px] sm:px-8 ${
        closing ? "fade-out pointer-events-none" : ""
      }`}
    >
      <nav className="w-full sm:w-[30rem]">
        <h2
          className={`mb-2 inline-block bg-white px-2.5 py-1 text-[clamp(0.85rem,3.6vw,1.1rem)] text-black ${
            closing ? "wipe-x-out" : ""
          }`}
        >
          <span className="sr-only">{TITLE}</span>
          <span ref={titleRef} aria-hidden="true" />
        </h2>
        <ul className={`flex flex-col border border-white bg-black py-1.5 ${closing ? "wipe-y-out" : ""}`}>
          {links.map((l, i) => {
            const on = i === active;
            return (
              <li
                key={l.href}
                className={closing ? "glitch-out" : ""}
                style={closing ? { animationDelay: `${(exitRank[i] ?? i) * ROW_OUT_STEP}s` } : undefined}
              >
                <Link
                  ref={i === 0 ? firstLinkRef : undefined}
                  href={l.href}
                  aria-label={l.label}
                  onMouseEnter={() => highlight(i)}
                  onFocus={() => highlight(i)}
                  onClick={onClose}
                  className={`flex min-h-11 items-center gap-3 px-3 py-2.5 text-[clamp(1.6rem,8.5vw,2.8rem)] leading-none outline-none ${
                    on ? "bg-white text-black" : "text-white"
                  }`}
                >
                  <span aria-hidden="true" className={`text-[0.7em] ${on ? "visible" : "invisible"}`}>
                    {MARKER}
                  </span>
                  <span
                    aria-hidden="true"
                    ref={(el) => {
                      labelRefs.current[i] = el;
                    }}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
