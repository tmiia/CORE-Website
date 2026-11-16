"use client";

import { useEffect, useRef } from "react";
import { scrambleText } from "@/lib/experience/scramble";

const DECODE = { stagger: 0.018, shuffles: 3, shuffleStep: 0.04 };

/**
 * A chapter's key line, large, decoded the first time it scrolls into view.
 * VCR is monospaced: the scrambled glyphs take the final text's room, so
 * nothing reflows while it decodes.
 */
export default function Statement({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;
    let cancel: (() => void) | undefined;
    el.style.visibility = "hidden";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        el.style.visibility = "";
        cancel = scrambleText(el, text, DECODE);
      },
      { rootMargin: "0px 0px -18% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancel?.();
      el.style.visibility = "";
      el.textContent = text;
    };
  }, [text]);

  return (
    <p className={`text-[clamp(1.6rem,7.4vw,3.6rem)] leading-[1.15] ${className}`}>
      <span className="sr-only">{text}</span>
      <span ref={ref} aria-hidden="true" className="context-line">
        {text}
      </span>
    </p>
  );
}
