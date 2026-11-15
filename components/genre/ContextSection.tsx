"use client";

import Image from "next/image";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import SectionTitle from "./SectionTitle";

export interface ContextArchive {
  key: string;
  image?: { src: string; width: number; height: number };
  videoUrl?: string;
  caption?: string;
  source?: string; // a URL or a plain-text credit
  sourceHost?: string | null; // set when `source` is a URL
}

/** A paragraph is a list of runs: text, or a note pointing to a numbered
 * source of the "Pour aller plus loin" list. */
export type ContextRun = { text: string } | { note: string; href: string; title: string };
export type ContextParagraph = ContextRun[];

/**
 * Scroll budget, in svh of scroll while the section is pinned: a lead-in, the
 * typing (∝ text length), one step per archive, then a hold on the final
 * composition.
 */
const BUDGET = { lead: 8, perChar: 0.25, typeMin: 60, typeMax: 200, perArchive: 45, hold: 35 };

/** The archives make a pile on the text: each print is centred on the text
 * block, then shifted by dx/dy (% of its own size) and tilted (r, deg), so it
 * covers most of the previous one and part of the text. Cycled past 6. */
const POSES = [
  { dx: 10, dy: -30, r: -3 },
  { dx: -12, dy: 22, r: 2.2 },
  { dx: 5, dy: -6, r: -1.2 },
  { dx: -8, dy: -26, r: 3 },
  { dx: 13, dy: 16, r: -2.2 },
  { dx: -3, dy: 4, r: 1.2 },
];

const pad = (n: number) => String(n).padStart(2, "0");
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const isText = (run: ContextRun): run is { text: string } => "text" in run;

/**
 * 01 LE CONTEXTE. The section pins (sticky frame in a tall wrapper); the text,
 * centred in the height, types itself as you scroll (scrolling back erases
 * it), source notes appearing as it passes them; then the archives are laid on
 * top of it one by one, like photos put down on a table. Screen readers get
 * the full text (and the notes as links); `reduced-motion`: no pin,
 * everything shown.
 */
export default function ContextSection({
  index,
  label = "LE CONTEXTE",
  meta,
  paragraphs,
  archives,
  alt,
}: {
  index: string;
  label?: string;
  meta?: string;
  paragraphs: ContextParagraph[];
  archives: ContextArchive[];
  alt: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  // Flattened over all paragraphs, in reading order.
  const typedRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const cursorRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const restRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const noteRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const caretRef = useRef<HTMLSpanElement>(null);
  const photoRefs = useRef<(HTMLElement | null)[]>([]);
  const [still, setStill] = useState(false);

  const runs = paragraphs.flat();
  const total = runs.reduce((sum, r) => sum + (isText(r) ? r.text.length : 0), 0);
  const typeVh = total
    ? Math.min(BUDGET.typeMax, Math.max(BUDGET.typeMin, total * BUDGET.perChar))
    : 0;
  const spanVh = BUDGET.lead + typeVh + archives.length * BUDGET.perArchive + BUDGET.hold;
  // Long texts get a smaller size so they still fit on a phone screen.
  const textSize =
    total > 560
      ? "font-anonymous normal-case tracking-normal text-[clamp(0.95rem,3.9vw,1.15rem)] leading-[1.65]"
      : "font-anonymous normal-case tracking-normal text-[clamp(1.05rem,4.4vw,1.3rem)] leading-[1.7]";

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (still) return;
    const wrap = wrapRef.current;
    const frame = frameRef.current;
    if (!wrap || !frame) return;

    const all = paragraphs.flat();
    const texts = all.filter(isText);
    const typeFrom = BUDGET.lead / spanVh;
    const typeTo = (BUDGET.lead + typeVh) / spanVh;
    const landAt = (i: number) =>
      (BUDGET.lead + typeVh + i * BUDGET.perArchive + 6) / spanVh;
    // Where each text run starts, and where each note appears (right after
    // the cited passage), in typed characters.
    const textStarts: number[] = [];
    const noteAt: number[] = [];
    let count = 0;
    for (const run of all) {
      if (isText(run)) {
        textStarts.push(count);
        count += run.text.length;
      } else noteAt.push(count);
    }

    let p = 0;
    let raf = 0;
    let shown = -1;
    let dim = false;
    let visible = true;
    const on = archives.map(() => false);
    const video = (i: number) => photoRefs.current[i]?.querySelector("video") ?? null;
    const play = (v: HTMLVideoElement | null) => void v?.play().catch(() => {});

    const apply = () => {
      raf = 0;
      // Typing: one global character count, spread over the text runs.
      const n = Math.round(clamp01((p - typeFrom) / Math.max(1e-6, typeTo - typeFrom)) * total);
      if (n !== shown) {
        shown = n;
        texts.forEach(({ text }, k) => {
          const typed = typedRefs.current[k];
          const cursor = cursorRefs.current[k];
          const rest = restRefs.current[k];
          if (!typed || !cursor || !rest) return;
          const t = Math.min(text.length, Math.max(0, n - textStarts[k]));
          const current = n >= textStarts[k] && t < text.length;
          typed.textContent = text.slice(0, t);
          // The cursor is the next character itself (same width: no reflow).
          cursor.textContent = current ? text[t] : "";
          rest.textContent = text.slice(current ? t + 1 : t);
        });
        // Notes: hidden (not focusable) until the typing passes them.
        noteAt.forEach((at, j) => noteRefs.current[j]?.classList.toggle("invisible", n < at));
        caretRef.current?.classList.toggle("hidden", n < total);
      }
      // Archives: laid one by one, lifted again when scrolling back.
      archives.forEach((_, i) => {
        const want = p >= landAt(i);
        if (want === on[i]) return;
        on[i] = want;
        photoRefs.current[i]?.toggleAttribute("data-on", want);
        if (want && visible) play(video(i));
        else video(i)?.pause();
      });
      const wantDim = archives.length > 0 && p >= landAt(0);
      if (wantDim !== dim) {
        dim = wantDim;
        textRef.current?.toggleAttribute("data-dim", dim);
      }
    };

    // Read in the scroll event (layout is clean there), write in the frame.
    const read = () => {
      const r = wrap.getBoundingClientRect();
      const dist = r.height - frame.clientHeight;
      p = dist > 0 ? -r.top / dist : 0;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    // Videos only play while the section is on screen.
    const io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      archives.forEach((_, i) => (visible && on[i] ? play(video(i)) : video(i)?.pause()));
    });
    io.observe(wrap);

    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [still, paragraphs, archives, total, typeVh, spanVh]);

  const header = (
    <div className="flex flex-col gap-3">
      <SectionTitle index={index} label={label} />
      {meta && <p className="text-[clamp(0.8rem,3.4vw,0.95rem)] text-white/70">▮ {meta}</p>}
    </div>
  );

  // Screen readers: the text in one piece (the visual one is split while it
  // types). The notes are read in the visual layer, as links.
  const srText = (
    <div className="sr-only">
      {paragraphs.map((para, k) => (
        <p key={k}>{para.map((run) => (isText(run) ? run.text : "")).join("")}</p>
      ))}
    </div>
  );

  // Visual text. Before hydration (and in `still` mode) it is fully typed.
  let textIndex = 0;
  let noteIndex = 0;
  const visualText = (live: boolean) =>
    paragraphs.map((para, k) => (
      <p key={k} className="whitespace-pre-line">
        {para.map((run, r) => {
          if (isText(run)) {
            const i = textIndex++;
            return (
              <span key={r} aria-hidden="true">
                <span
                  ref={
                    live
                      ? (el) => {
                          typedRefs.current[i] = el;
                        }
                      : undefined
                  }
                  className="context-line"
                >
                  {run.text}
                </span>
                {live && (
                  <>
                    <span
                      ref={(el) => {
                        cursorRefs.current[i] = el;
                      }}
                      className="bg-white text-black"
                    />
                    <span
                      ref={(el) => {
                        restRefs.current[i] = el;
                      }}
                      className="text-transparent"
                    />
                  </>
                )}
              </span>
            );
          }
          const j = noteIndex++;
          return (
            <a
              key={r}
              ref={
                live
                  ? (el) => {
                      noteRefs.current[j] = el;
                    }
                  : undefined
              }
              href={run.href}
              aria-label={`Source ${run.note} : ${run.title}`}
              className="source-note"
            >
              {run.note}
            </a>
          );
        })}
        {live && k === paragraphs.length - 1 && (
          <span ref={caretRef} aria-hidden="true" className="caret ml-[0.3em] bg-white">
            {" "}
          </span>
        )}
      </p>
    ));

  if (still) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-8 sm:py-20">
        {header}
        {srText}
        <div className={`mt-6 flex max-w-[38em] flex-col gap-5 ${textSize}`}>
          {visualText(false)}
        </div>
        {archives.length > 0 && (
          <div className="mt-10 grid grid-cols-4 gap-x-3 gap-y-8 lg:grid-cols-12 lg:gap-x-6">
            {archives.map((a, i) => (
              <ArchivePrint
                key={a.key}
                archive={a}
                index={i}
                alt={alt}
                className={`${i % 2 ? "col-start-2" : ""} col-span-3 lg:col-span-5 ${i % 2 ? "lg:col-start-7" : "lg:col-start-2"}`}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section ref={wrapRef} className="relative" style={{ height: `calc(100svh + ${spanVh}svh)` }}>
      <div
        ref={frameRef}
        className="sticky top-0 flex h-svh flex-col overflow-hidden pb-6 pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] sm:pt-24"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-8">
          {header}
          {srText}
          {/* The text sits in the middle of the height (the bottom padding
              about matches the title block, so it reads as centred on the
              screen, not just under the title). */}
          <div className="relative mt-6 flex flex-1 flex-col justify-center-safe pb-[clamp(2rem,9svh,5rem)]">
            {/* Text block + the pile laid on it (siblings: dimming the text
                must not dim the prints). */}
            <div className="relative lg:w-[52%]">
              <div ref={textRef} className={`context-text flex flex-col gap-5 select-none ${textSize}`}>
                {visualText(true)}
              </div>

              {archives.map((a, i) => {
                const pose = POSES[i % POSES.length];
                // Later cycles: mirrored, so they don't land exactly on top.
                const flip = Math.floor(i / POSES.length) % 2 ? -1 : 1;
                return (
                  <ArchivePrint
                    key={a.key}
                    archive={a}
                    index={i}
                    alt={alt}
                    refCb={(el) => {
                      photoRefs.current[i] = el;
                    }}
                    className="archive-photo absolute w-[74%] lg:w-[64%]"
                    style={
                      {
                        zIndex: i + 1,
                        "--dx": `${pose.dx * flip}%`,
                        "--dy": `${pose.dy}%`,
                        "--r": `${pose.r * flip}deg`,
                      } as CSSProperties
                    }
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** One archive as a print: white border, the image (or muted video loop) in
 * greyscale with scanlines, and a caption strip in the bottom margin. */
export function ArchivePrint({
  archive: a,
  index,
  alt,
  className = "",
  style,
  refCb,
}: {
  archive: ContextArchive;
  index: number;
  alt: string;
  className?: string;
  style?: CSSProperties;
  refCb?: (el: HTMLElement | null) => void;
}) {
  // Very tall images are cropped a little, so a print always fits the screen.
  const ratio = a.image ? Math.max(a.image.width / a.image.height, 0.9) : 16 / 9;
  const label = `▶ ARCH. ${pad(index + 1)}`;
  return (
    <figure ref={refCb} className={`archive-print ${className}`} style={style}>
      <div className="archive-frame relative overflow-hidden bg-black" style={{ aspectRatio: ratio }}>
        {a.videoUrl ? (
          <video
            src={a.videoUrl}
            poster={a.image?.src}
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={a.caption || alt}
            className="absolute inset-0 h-full w-full object-cover contrast-125 grayscale"
          />
        ) : a.image ? (
          <Image
            src={a.image.src}
            alt={a.caption || alt}
            fill
            sizes="(max-width: 1023px) 75vw, 400px"
            className="object-cover contrast-125 grayscale"
          />
        ) : null}
      </div>
      <figcaption className="flex items-start justify-between gap-3 px-0.5 pt-1.5 text-[0.68rem] leading-snug text-black">
        <span className="line-clamp-2">
          {label}
          {a.caption ? ` · ${a.caption.toUpperCase()}` : ""}
        </span>
        {a.source && a.sourceHost && (
          <a
            href={a.source}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 underline decoration-1 underline-offset-2"
          >
            SOURCE ↗<span className="sr-only"> {a.sourceHost} (nouvel onglet)</span>
          </a>
        )}
      </figcaption>
    </figure>
  );
}
