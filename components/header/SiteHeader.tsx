"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { onStageCue, stageCues } from "@/lib/core-fm/stageCues";
import { NAV_LINKS } from "@/lib/experience/nav";
import NavOverlay, { NAV_EXIT_MS } from "./NavOverlay";
import RecIndicator from "./RecIndicator";

const MENU_ID = "site-menu";

type MenuState = "closed" | "open" | "closing";

/** Open → closing (exit animation), or straight to closed in reduced motion. */
const exitFrom = (m: MenuState): MenuState =>
  m !== "open"
    ? m
    : window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "closed"
      : "closing";

/**
 * Site header, in the layout: camcorder REC timecode top-left, burger top-right
 * opening the full-screen menu. During the home's opening (loading, HOLD,
 * forge) it isn't live yet: REC greyed at zero, burger hidden and inert.
 * Sits above the menu overlay so the burger (turned into ✕) closes it.
 */
export default function SiteHeader() {
  const [menu, setMenu] = useState<MenuState>("closed");
  const open = menu === "open";
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Server/hydration: the home starts with its opening, other pages are live.
  const live = useSyncExternalStore(
    onStageCue,
    () => stageCues.live,
    () => pathname !== "/",
  );

  // Navigating (back/forward with the menu open) plays the exit too. A menu
  // link already started it, so it carries on.
  useEffect(() => {
    setMenu(exitFrom);
  }, [pathname]);

  // The exit plays, then the menu unmounts.
  useEffect(() => {
    if (menu !== "closing") return;
    const id = window.setTimeout(() => setMenu("closed"), NAV_EXIT_MS);
    return () => clearTimeout(id);
  }, [menu]);

  // Scrolled pages: a black fade behind the header, so REC and the burger
  // don't sit on top of the text scrolling under them.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  const close = () => {
    setMenu(exitFrom);
    buttonRef.current?.focus({ preventScroll: true });
  };

  const toggle = () => {
    if (menu === "open") close();
    else if (menu === "closed") setMenu("open"); // ignored mid-exit
  };

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] font-vcr text-[clamp(0.85rem,3.6vw,1.05rem)] uppercase tracking-[0.08em] text-white sm:p-8">
        <div
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 -z-10 h-[calc(100%+1.5rem)] bg-linear-to-b from-black from-55% to-transparent transition-opacity duration-300 ${
            scrolled && !open ? "opacity-100" : "opacity-0"
          }`}
        />
        <RecIndicator live={live} />
        <button
          ref={buttonRef}
          type="button"
          inert={!live}
          aria-expanded={open}
          aria-controls={MENU_ID}
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={toggle}
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
      {menu !== "closed" && live && (
        <NavOverlay id={MENU_ID} links={NAV_LINKS} onClose={close} closing={menu === "closing"} />
      )}
    </>
  );
}
