import type { Metadata } from "next";
import Link from "next/link";
import { ArchivePrint, type ContextArchive } from "@/components/genre/ContextSection";
import FrequencyList from "@/components/genre/FrequencyList";
import NotionsSheet from "@/components/genre/NotionsSheet";
import SectionTitle from "@/components/genre/SectionTitle";
import StickyUnder from "@/components/genre/StickyUnder";
import { alternate, BODY, CONTAINER, GRID, MAIN, paragraphCols, RAIL } from "@/components/grid";
import ProjectHero from "@/components/project/ProjectHero";
import Statement from "@/components/project/Statement";
import { buildMenu, type StoryItem } from "@/lib/experience/genres";
import {
  exhibitionDates,
  exhibitionStatus,
  type ProjectChapter,
  type ProjectImage,
  STATUS_LABEL,
} from "@/lib/experience/project";
import { client } from "@/sanity/lib/client";
import { getProjectPage } from "@/sanity/lib/projectPage";
import { allStoriesQuery } from "@/sanity/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { title, kicker, lede } = await getProjectPage();
  return { title: "Le projet", description: `${title}, ${kicker.toLowerCase()}. ${lede}` };
}

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

/** A section's key line, decoded: column 1, ten columns wide on desktop. */
function KeyLine({ text }: { text: string }) {
  return (
    <div className={`${GRID} mt-8 lg:mt-12`}>
      <Statement text={text} className="col-span-4 lg:col-span-10" />
    </div>
  );
}

/** A chapter: title bar, key line, paragraphs (column 4 on desktop), then its
 * photos if any, as prints. */
function Chapter({ index, chapter }: { index: string; chapter: ProjectChapter }) {
  return (
    <section className={`${CONTAINER} py-16 sm:py-24`}>
      <SectionTitle index={index} label={chapter.label} />
      <KeyLine text={chapter.heading} />
      <div className={`${GRID} mt-10 gap-y-6 lg:mt-14`}>
        {chapter.body.map((text, i) => (
          <p key={i} className={`${paragraphCols(i)} ${BODY}`}>
            <span className="context-line">{text}</span>
          </p>
        ))}
      </div>
      {chapter.images.length > 0 && (
        <div className={`${GRID} mt-12`}>
          {/* Desktop: two prints side by side in the text's column. */}
          <div className={`col-span-4 grid grid-cols-4 gap-x-3 gap-y-8 ${MAIN} lg:grid-cols-2 lg:gap-x-6`}>
            {chapter.images.map((img, i) => (
              <ArchivePrint
                key={`${index}-${i}`}
                archive={toArchive(img, i, index)}
                index={i}
                alt={chapter.label}
                className={`${i % 2 ? "col-start-2" : ""} col-span-3 lg:col-span-1 lg:col-start-auto`}
                style={{ transform: `rotate(${i % 2 ? 1.4 : -1.2}deg)` }}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default async function ProjectPage() {
  const [project, stories] = await Promise.all([getProjectPage(), getStories()]);
  const { chapters, installation, exhibition: ex } = project;
  const genres = buildMenu(stories);
  const status = exhibitionStatus(ex);
  const [days, monthYear] = exhibitionDates(ex);

  // Section numbers, in reading order: the chapters, the installation (its card
  // slides over the last chapter), the exhibition.
  const lead = chapters.slice(0, -1);
  const last = chapters.at(-1);
  const exhibitionIndex = pad(chapters.length + 2);
  const details = [
    { label: "LIEU", value: [ex.venue, ex.city].filter(Boolean).join(", ") },
    { label: "FESTIVAL", value: ex.festival },
    { label: "HORAIRES", value: ex.hours },
    { label: "ENTRÉE", value: ex.entry },
  ].filter((row) => row.value);

  return (
    <main className="flex flex-1 flex-col font-vcr uppercase tracking-[0.08em] text-white">
      <ProjectHero
        kicker={project.kicker}
        title={project.title}
        lede={project.lede}
        status={status}
        statusLabel={STATUS_LABEL[status]}
        when={`${days} ${monthYear}${ex.city ? ` · ${ex.city.toUpperCase()}` : ""}`}
      />

      {lead.map((chapter, i) => (
        <Chapter key={i} index={pad(i + 1)} chapter={chapter} />
      ))}

      <div className="relative">
        {last && (
          <StickyUnder>
            <Chapter index={pad(chapters.length)} chapter={last} />
          </StickyUnder>
        )}
        <NotionsSheet
          index={pad(chapters.length + 1)}
          label={installation.label}
          heading={<KeyLine text={installation.heading} />}
          intro={installation.body}
          rows={installation.rows}
          align="column"
        />
      </div>

      <section className={`${CONTAINER} py-16 sm:py-24`}>
        <SectionTitle index={exhibitionIndex} label={STATUS_LABEL[status]} />
        <div className={`${GRID} mt-10 gap-y-8 lg:mt-14`}>
          <p className="col-span-4 flex flex-col text-[clamp(2.6rem,13vw,7rem)] leading-[0.95] lg:col-span-12">
            <span>{days}</span>
            <span>{monthYear}</span>
          </p>
          {/* Labels in columns 1–3, values from column 4, as on the card. */}
          <dl className="col-span-4 grid grid-cols-subgrid border-b-2 border-dotted border-white/50 lg:col-span-12">
            {details.map((row) => (
              <div
                key={row.label}
                className="col-span-4 grid grid-cols-subgrid border-t-2 border-dotted border-white/50 bg-black py-4 lg:col-span-12"
              >
                <dt className={`text-[0.78rem] text-white/60 ${RAIL} lg:pt-1`}>{row.label}</dt>
                <dd className={`col-span-3 text-[clamp(1.1rem,5vw,1.6rem)] leading-tight ${MAIN}`}>
                  {row.value.toUpperCase()}
                </dd>
              </div>
            ))}
          </dl>
          {ex.announcement[status] && (
            <p className={`${alternate(0)} ${MAIN} lg:max-w-[62ch] ${BODY}`}>
              <span className="context-line">{ex.announcement[status]}</span>
            </p>
          )}
          {ex.festivalUrl && (
            <a
              href={ex.festivalUrl}
              target="_blank"
              rel="noreferrer"
              className="col-span-4 flex min-h-11 w-fit items-center border border-white bg-black px-3 py-2 text-[clamp(0.9rem,3.8vw,1.05rem)] outline-none hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black lg:col-start-4"
            >
              {ex.festival.toUpperCase()} ↗<span className="sr-only"> (site du festival, nouvel onglet)</span>
            </a>
          )}
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
