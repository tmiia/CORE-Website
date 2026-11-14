"use client";

import { useEffect, useRef } from "react";
import { scrambleText } from "@/lib/experience/scramble";

const DECODE = { stagger: 0.025, shuffles: 4, shuffleStep: 0.04 };

/**
 * Inverted title bar (installation HUD), "01 ▮ TRANSMISSION". The label
 * decodes the first time it scrolls into view.
 */
export default function SectionTitle({ index, label }: { index: string; label: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;
    let cancel: (() => void) | undefined;
    // Blank until it decodes (it is below the fold when this runs).
    el.textContent = "";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        cancel = scrambleText(el, label, DECODE);
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancel?.();
      el.textContent = label;
    };
  }, [label]);

  return (
    // self-start: in the desktop two-column grid, don't stretch to the row height.
    <h2 className="flex w-fit items-baseline gap-3 self-start bg-white px-2.5 py-1 text-[clamp(0.95rem,4vw,1.2rem)] text-black">
      <span aria-hidden="true" className="opacity-60">
        {index}
      </span>
      <span className="sr-only">{label}</span>
      <span ref={ref} aria-hidden="true" className="min-w-[1ch]">
        {label}
      </span>
    </h2>
  );
}
