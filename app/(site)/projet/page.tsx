import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import ContextSection, { ArchivePrint, type ContextArchive } from "@/components/genre/ContextSection";
import FrequencyList from "@/components/genre/FrequencyList";
import NotionsSheet from "@/components/genre/NotionsSheet";
import SectionTitle from "@/components/genre/SectionTitle";
import StickyUnder from "@/components/genre/StickyUnder";
import ProjectHero from "@/components/project/ProjectHero";
import SignalMixup from "@/components/project/SignalMixup";
import Statement from "@/components/project/Statement";
import { buildMenu, INSTALLATION_GENRES, type StoryItem } from "@/lib/experience/genres";
import {
  CHAPTERS,
  EXHIBITION,
  exhibitionDates,
  exhibitionSentence,
  exhibitionStatus,
  INSTALLATION,
  MIXUP,
  PROJECT_LEDE,
  type ProjectChapter,
  type ProjectImage,
  REMEMBER,
  STATUS_LABEL,
} from "@/lib/experience/project";
import { client } from "@/sanity/lib/client";
import { allStoriesQuery } from "@/sanity/lib/queries";

export const metadata: Metadata = {
  title: "Le projet",
  description: `CORE.FM, installation sonore interactive. ${PROJECT_LEDE}`,
};

const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-8";
const GRID = "grid grid-cols-4 gap-x-3 lg:grid-cols-12 lg:gap-x-6";
const BODY = "font-anonymous text-[clamp(1.05rem,4.4vw,1.25rem)] normal-case leading-[1.7] tracking-normal";
// Body paragraphs alternate between two column ranges (editorial grid).
const BODY_COLS = [
  "col-span-4 lg:col-start-2 lg:col-span-6",
  "col-start-2 col-span-3 lg:col-start-6 lg:col-span-6",
];
// With an aside on the right (desktop), the paragraphs stack on the left.
const ROW_START = ["lg:row-start-1", "lg:row-start-2", "lg:row-start-3", "lg:row-start-4"];

const pad = (n: number) => String(n).padStart(2, "0");

const toArchive = (img: ProjectImage, i: number, key: string): ContextArchive => ({
  key: `${key}-${i}`,
  image: { src: img.src, width: img.width, height: img.height },
  caption: img.caption,
});

async function getStories() {
  if (!client) return [];
  return client.fetch<StoryItem[]>(allStoriesQuery, {}, { next: { revalidate: 60 } });
}

/** A chapter: title bar, the key line (decoded), body on the grid, an
 * optional aside (desktop: on the right), then its photos if any. */
function Chapter({ index, chapter, aside }: { index: string; chapter: ProjectChapter; aside?: ReactNode }) {
  const images = chapter.images ?? [];
  return (
    <section className={`${CONTAINER} py-16 sm:py-24`}>
      <SectionTitle index={index} label={chapter.label} />
      <Statement text={chapter.statement} className="mt-8 lg:mt-12 lg:max-w-[85%]" />
      <div className={`${GRID} mt-10 gap-y-6 lg:mt-14`}>
        {chapter.body.map((text, i) => (
          <Fragment key={i}>
            <p className={`${aside ? `col-span-4 lg:col-span-6 ${ROW_START[i] ?? ""}` : BODY_COLS[i % 2]} ${BODY}`}>
              <span className="context-line">{text}</span>
            </p>
            {aside && i === 0 && (
              <div className="col-span-4 my-6 lg:col-start-8 lg:col-span-5 lg:row-span-3 lg:row-start-1 lg:my-0 lg:self-center">
                {aside}
              </div>
            )}
          </Fragment>
        ))}
      </div>
      {images.length > 0 && (
        <div className={`${GRID} mt-12 gap-y-8`}>
          {images.map((img, i) => (
            <ArchivePrint
              key={`${chapter.key}-${i}`}
              archive={toArchive(img, i, chapter.key)}
              index={i}
              alt={chapter.label}
              className={i % 2 ? "col-start-2 col-span-3 lg:col-start-7 lg:col-span-5" : "col-span-3 lg:col-start-2 lg:col-span-5"}
              style={{ transform: `rotate(${i % 2 ? 1.4 : -1.2}deg)` }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function ProjectPage() {
  const stories = await getStories();
  const genres = buildMenu(stories);
  const status = exhibitionStatus();
  const [days, monthYear] = exhibitionDates();
  const bouyon = INSTALLATION_GENRES.find((g) => g.key === MIXUP.genre);

  let n = 0;
  const next = () => pad(++n);

  const chapters = CHAPTERS.map((chapter) => (
    <Chapter
      key={chapter.key}
      index={next()}
      chapter={chapter}
      aside={
        chapter.key === "constat" && bouyon ? (
          <SignalMixup
            heard={MIXUP.heard}
            genre={bouyon.label}
            meta={`${bouyon.freq.toFixed(1)} FM · ${bouyon.place} · ${bouyon.year}`}
          />
        ) : undefined
      }
    />
  ));

  return (
    <main className="flex flex-1 flex-col font-vcr uppercase tracking-[0.08em] text-white">
      <ProjectHero
        kicker="INSTALLATION SONORE INTERACTIVE"
        title="CORE.FM"
        lede={PROJECT_LEDE}
        status={status}
        statusLabel={STATUS_LABEL[status]}
        when={`${days} ${monthYear} · ${EXHIBITION.city.toUpperCase()}`}
      />

      {chapters}

      {/* The work's label slides over the manifesto. */}
      <div className="relative">
        <StickyUnder>
          <ContextSection
            index={next()}
            label={REMEMBER.label}
            paragraphs={REMEMBER.paragraphs.map((text) => [{ text }])}
            archives={REMEMBER.images.map((img, i) => toArchive(img, i, "remember"))}
            alt="CORE.FM"
            variant="statement"
          />
        </StickyUnder>
        <NotionsSheet index={next()} label={INSTALLATION.label} intro={INSTALLATION.intro} rows={INSTALLATION.rows} />
      </div>

      <section className={`${CONTAINER} py-16 sm:py-24`}>
        <SectionTitle index={next()} label={STATUS_LABEL[status]} />
        <div className={`${GRID} mt-10 gap-y-8`}>
          <p className="col-span-4 flex flex-col text-[clamp(2.6rem,13vw,7rem)] leading-[0.95] lg:col-span-12">
            <span>{days}</span>
            <span>{monthYear}</span>
          </p>
          <dl className="col-span-4 border-b-2 border-dotted border-white/50 lg:col-start-4 lg:col-span-9">
            {[
              { label: "LIEU", value: `${EXHIBITION.venue}, ${EXHIBITION.city}` },
              { label: "FESTIVAL", value: EXHIBITION.festival },
              { label: "HORAIRES", value: EXHIBITION.hours },
              { label: "ENTRÉE", value: EXHIBITION.entry },
            ].map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-4 gap-x-3 border-t-2 border-dotted border-white/50 bg-black py-4 lg:grid-cols-9 lg:gap-x-6"
              >
                <dt className="text-[0.78rem] text-white/60 lg:col-span-3 lg:pt-1">{row.label}</dt>
                <dd className="col-span-3 text-[clamp(1.1rem,5vw,1.6rem)] leading-tight lg:col-span-6">
                  {row.value.toUpperCase()}
                </dd>
              </div>
            ))}
          </dl>
          <p className={`col-span-4 lg:col-start-4 lg:col-span-6 ${BODY}`}>
            <span className="context-line">{exhibitionSentence(status)}</span>
          </p>
          <a
            href={EXHIBITION.url}
            target="_blank"
            rel="noreferrer"
            className="col-span-4 flex min-h-11 w-fit items-center border border-white bg-black px-3 py-2 text-[clamp(0.9rem,3.8vw,1.05rem)] outline-none hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black lg:col-start-4"
          >
            {EXHIBITION.festival.toUpperCase()} ↗<span className="sr-only"> (site du festival, nouvel onglet)</span>
          </a>
        </div>
      </section>

      <div className={`${CONTAINER} flex flex-col pb-16`}>
        <FrequencyList label="CHOISIS UN GENRE" genres={genres} />

        <footer className="section-rule flex flex-wrap items-center justify-between gap-4 pt-8 text-[0.85rem] text-white/70">
          <span>▮ FIN DE TRANSMISSION</span>
          <Link href="/" className="py-2 hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black">
            ◂ HOME
          </Link>
        </footer>
      </div>
    </main>
  );
}
