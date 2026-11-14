"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { onStageCue, stageCues } from "@/lib/core-fm/stageCues";
import { NAV_LINKS } from "@/lib/experience/nav";
import NavOverlay from "./NavOverlay";
import RecIndicator from "./RecIndicator";

const MENU_ID = "site-menu";

/**
 * Site header, in the layout: camcorder REC timecode top-left, burger top-right
 * opening the full-screen menu. During the home's opening (loading, HOLD,
 * forge) it isn't live yet: REC greyed at zero, burger hidden and inert.
 * Sits above the menu overlay so the burger (turned into ✕) closes it.
 */
export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Server/hydration: the home starts with its opening, other pages are live.
  const live = useSyncExternalStore(
    onStageCue,
    () => stageCues.live,
    () => pathname !== "/",
  );

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] font-vcr text-[clamp(0.85rem,3.6vw,1.05rem)] uppercase tracking-[0.08em] text-white sm:p-8">
        <RecIndicator live={live} />
        <button
          ref={buttonRef}
          type="button"
          inert={!live}
          aria-expanded={open}
          aria-controls={MENU_ID}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => (open ? close() : setOpen(true))}
          className={`relative -m-2 flex size-11 items-center justify-center transition-opacity duration-700 ${
            live ? "pointer-events-auto opacity-100" : "opacity-0"
          }`}
        >
          {/* Three bars → ✕ */}
          {[-7, 0, 7].map((y, i) => (
            <span
              key={y}
              aria-hidden="true"
              style={{
                transform: open
                  ? i === 1
                    ? "scaleX(0)"
                    : `rotate(${i === 0 ? 45 : -45}deg)`
                  : `translateY(${y}px)`,
              }}
              className="absolute h-[2px] w-6 bg-white transition-transform duration-200 motion-reduce:transition-none"
            />
          ))}
        </button>
      </header>
      {open && live && <NavOverlay id={MENU_ID} links={NAV_LINKS} onClose={close} />}
    </>
  );
}
