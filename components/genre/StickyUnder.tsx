"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * Keeps its content in place once its bottom reaches the bottom of the
 * screen, so the next section (a "sheet", opaque) slides over it. Works for any
 * height: `top` = min(0, screen − height), kept in sync with its size. Must be
 * followed by the sheet inside the same parent (sticky stops at the parent's
 * end), and the sheet must be at least one screen tall to cover it.
 */
export default function StickyUnder({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      el.style.top = `min(0px, calc(100svh - ${el.offsetHeight}px))`;
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="sticky top-0">
      {children}
    </div>
  );
}
