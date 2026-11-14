import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toPlainText, type PortableTextBlock } from "@portabletext/react";
import type { SanityImageSource } from "@sanity/image-url";
import ContextSection, {
  type ContextArchive,
  type ContextParagraph,
  type ContextRun,
} from "@/components/genre/ContextSection";
import FrequencyList from "@/components/genre/FrequencyList";
import GenreHero from "@/components/genre/GenreHero";
import NotionsSheet, { type SheetRow } from "@/components/genre/NotionsSheet";
import SectionTitle from "@/components/genre/SectionTitle";
import StickyUnder from "@/components/genre/StickyUnder";
import { buildMenu, findInstallationGenre, type StoryItem } from "@/lib/experience/genres";
import { client } from "@/sanity/lib/client";
import { allStoriesQuery, allStorySlugsQuery, storyBySlugQuery } from "@/sanity/lib/queries";
import { urlForImage } from "@/sanity/lib/image";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type KeyConcept = {
  _key: string;
  title?: string;
  description?: string;
};

/** An archive: an image, a short video, or both (the image is the poster). */
type Archive = {
  _key: string;
  image?: SanityImageSource;
  dimensions?: { width: number; height: number };
  videoUrl?: string;
  caption?: string;
  source?: string;
};

type Resource = {
  _key: string;
  title?: string;
  url?: string;
  description?: string;
  type?: string;
};

type Genre = {
  _id: string;
  name?: string;
  origin?: string;
  birth?: string;
  description?: string;
  history?: PortableTextBlock[];
  images?: SanityImageSource[];
};

type Story = {
  _id: string;
  title: string;
  origin?: string;
  birthYear?: number;
  description?: string;
  slug?: { current: string };
  path?: string;
  thumbnail?: SanityImageSource;
  keyConcepts?: KeyConcept[];
  archiveImages?: Archive[];
  resources?: Resource[];
  genre?: Genre;
};

type StorySlug = {
  slug?: { current?: string };
  path?: string;
};

/** Portable Text internals read for the context: spans and their marks. */
type Span = { _type: string; text?: string; marks?: string[] };
type MarkDef = { _key: string; _type: string; url?: string; title?: string };

const RESOURCE_GROUPS: { type: string; label: string }[] = [
  { type: "video", label: "VIDÉOS" },
  { type: "article", label: "ARTICLES" },
  { type: "book", label: "LIVRES" },
  { type: "audio", label: "AUDIO" },
  { type: "archive", label: "ARCHIVES" },
  { type: "other", label: "LIENS" },
];
const groupOf = (type?: string) =>
  RESOURCE_GROUPS.some((g) => g.type === type) ? (type as string) : "other";

function formatBirth(date?: string) {
  if (!date) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(date))
    .toUpperCase();
}

function hostOf(url?: string) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Same source, written differently: no protocol, no www, no trailing slash. */
const sameUrl = (url?: string) =>
  (url ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")
    .toLowerCase();

const pad = (n: number) => String(n).padStart(2, "0");
const sourceId = (num: string) => `source-${num}`;

/** The source notes of the history (annotation `sourceRef`). */
function citedSources(history: PortableTextBlock[]): MarkDef[] {
  return history.flatMap((block) =>
    ((block.markDefs ?? []) as MarkDef[]).filter((d) => d._type === "sourceRef" && d.url),
  );
}

/** A history block → text runs, with a note right after each cited passage
 * (`num` gives the source's number in the list). */
function contextRuns(
  block: PortableTextBlock,
  num: (url: string) => { note: string; title: string } | undefined,
): ContextParagraph {
  const defs = new Map(
    ((block.markDefs ?? []) as MarkDef[])
      .filter((d) => d._type === "sourceRef" && d.url)
      .map((d) => [d._key, d]),
  );
  const spans = (Array.isArray(block.children) ? block.children : []) as Span[];
  const runs: ContextRun[] = [];
  const pushText = (text: string) => {
    const last = runs.at(-1);
    if (last && "text" in last) last.text += text;
    else runs.push({ text });
  };
  spans.forEach((span, i) => {
    if (span._type !== "span" || !span.text) return;
    pushText(span.text);
    for (const key of span.marks ?? []) {
      const def = defs.get(key);
      // The note goes after the last span of the cited passage.
      if (!def?.url || spans[i + 1]?.marks?.includes(key)) continue;
      const source = num(def.url);
      if (source) runs.push({ note: source.note, href: `#${sourceId(source.note)}`, title: source.title });
    }
  });
  return runs;
}

const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-8";
const GRID = "grid grid-cols-4 gap-x-3 lg:grid-cols-12 lg:gap-x-6";
const ROW_LINK =
  "grid min-h-11 grid-cols-4 gap-x-3 py-3 outline-none hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black lg:grid-cols-9 lg:gap-x-6";

async function getStory(slug: string) {
  if (!client) return null;
  return client.fetch<Story | null>(storyBySlugQuery, { slug }, { next: { revalidate: 60 } });
}

async function getStories() {
  if (!client) return [];
  return client.fetch<StoryItem[]>(allStoriesQuery, {}, { next: { revalidate: 60 } });
}

export async function generateStaticParams() {
  if (!client) return [];

  const stories = await client.fetch<StorySlug[]>(
    allStorySlugsQuery,
    {},
    { next: { revalidate: 60 } },
  );

  return stories
    .map((story) => story.slug?.current ?? story.path)
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStory(slug);

  if (!story) {
    return {
      title: "Histoire introuvable",
    };
  }

  const history = story.genre?.history;
  const description =
    story.description ||
    story.genre?.description ||
    (history?.length ? toPlainText(history).slice(0, 155) : undefined);
  const imageUrl = story.thumbnail
    ? urlForImage(story.thumbnail).width(1200).height(630).url()
    : undefined;

  return {
    title: story.title,
    description,
    openGraph: {
      title: story.title,
      description,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
  };
}

export default async function StoryDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const [story, stories] = await Promise.all([getStory(slug), getStories()]);

  if (!story) {
    notFound();
  }

  const path = story.path ?? story.slug?.current ?? story._id;
  const genre = story.genre;
  const installation = findInstallationGenre({
    path,
    title: story.title,
    genreName: genre?.name,
  });
  const year = story.birthYear ?? installation?.year;
  const place = story.origin ?? installation?.place;
  const meta = [year, place?.toUpperCase()].filter(Boolean).join(" · ") || undefined;
  const birth = formatBirth(genre?.birth);
  const others = buildMenu(stories).filter((g) => g.href !== `/stories/${path}`);
  const historyBlocks = (genre?.history ?? []).filter((block) => block._type === "block");

  // Sources: the story's resources, plus the ones the context cites that
  // aren't in them (added as links). Numbered in display order (by type), so
  // a note shows the same number as its row.
  const resources = (story.resources ?? []).filter((r) => r.url);
  for (const def of citedSources(historyBlocks)) {
    if (resources.some((r) => sameUrl(r.url) === sameUrl(def.url))) continue;
    resources.push({
      _key: `cited-${def._key}`,
      url: def.url,
      title: def.title || hostOf(def.url) || def.url,
      type: "other",
    });
  }
  let count = 0;
  const groups = RESOURCE_GROUPS.map((g) => ({
    ...g,
    items: resources
      .filter((r) => groupOf(r.type) === g.type)
      .map((r) => ({ ...r, num: pad(++count) })),
  })).filter((g) => g.items.length > 0);
  const numbered = groups.flatMap((g) => g.items);
  const sourceNum = (url: string) => {
    const r = numbered.find((s) => sameUrl(s.url) === sameUrl(url));
    return r ? { note: r.num, title: r.title ?? hostOf(r.url) ?? "" } : undefined;
  };

  // Context: the genre's description, then its history (typed on scroll).
  const contextParagraphs: ContextParagraph[] = [
    ...(genre?.description?.trim() ? [[{ text: genre.description.trim() }]] : []),
    ...historyBlocks.map((block) => contextRuns(block, sourceNum)),
  ].filter((para) => para.some((run) => !("text" in run) || run.text.trim()));

  // Archives laid over the context: the story's (images or videos), else the
  // genre's images.
  const storyArchives = (story.archiveImages ?? []).filter((a) => a.image || a.videoUrl);
  const archives: ContextArchive[] = storyArchives.length
    ? storyArchives.map((a) => ({
        key: a._key,
        image: a.image
          ? {
              src: urlForImage(a.image).width(1000).fit("max").url(),
              width: a.dimensions?.width ?? 1200,
              height: a.dimensions?.height ?? 900,
            }
          : undefined,
        videoUrl: a.videoUrl,
        caption: a.caption,
        source: a.source,
        sourceHost: a.source?.startsWith("http") ? hostOf(a.source) : null,
      }))
    : (genre?.images ?? []).map((image, i) => ({
        key: `${genre?._id}-${i}`,
        image: { src: urlForImage(image).width(1000).fit("max").url(), width: 1200, height: 900 },
      }));
  const archiveCredits = archives
    .map((a, i) => ({ ...a, label: `ARCH. ${pad(i + 1)}` }))
    .filter((a) => a.caption || a.source);

  // Notions clés: when and where, then Sanity's key notions. The installation's
  // frequency and EQ settings are in the hero already.
  const sheet: SheetRow[] = [
    ...(place ? [{ label: "ORIGINE", value: place }] : []),
    ...(birth || year ? [{ label: "NAISSANCE", value: birth ?? String(year) }] : []),
    ...(story.keyConcepts ?? [])
      .filter((c) => c.title && c.description)
      .map((c) => ({ label: c.title as string, value: c.description as string })),
  ];

  let n = 0;
  const next = () => pad(++n);

  const context =
    contextParagraphs.length > 0 || archives.length > 0 ? (
      <ContextSection
        index={next()}
        meta={meta}
        paragraphs={contextParagraphs}
        archives={archives}
        alt={story.title}
      />
    ) : null;
  const notions = sheet.length > 0 ? <NotionsSheet index={next()} rows={sheet} /> : null;

  return (
    <main className="flex flex-1 flex-col font-vcr uppercase tracking-[0.08em] text-white">
      <GenreHero
        title={story.title.toUpperCase()}
        meta={meta}
        freq={installation?.freq}
        description={story.description}
        model={installation?.model ?? null}
        eq={installation?.eq ?? null}
        tolerance={installation?.eqTolerance}
      />

      {/* The notions sheet slides over the context's final composition. */}
      {context && notions ? (
        <div className="relative">
          <StickyUnder>{context}</StickyUnder>
          {notions}
        </div>
      ) : (
        <>
          {context}
          {notions}
        </>
      )}

      {(groups.length > 0 || archiveCredits.length > 0) && (
        <section className={`${CONTAINER} py-16 sm:py-24`}>
          <SectionTitle index={next()} label="POUR ALLER PLUS LOIN" />
          <div className={`${GRID} mt-10 gap-y-10`}>
            {groups.map((g) => (
              <div key={g.type} className="col-span-4 grid grid-cols-subgrid gap-y-3 lg:col-span-12">
                <h3 className="col-span-4 text-[0.78rem] text-white/60 lg:col-span-3 lg:pt-3">
                  {g.label} · {pad(g.items.length)}
                </h3>
                <ul className="col-span-4 border-t border-white bg-black lg:col-span-9">
                  {g.items.map((r) => {
                    const host = hostOf(r.url);
                    return (
                      <li
                        key={r._key}
                        id={sourceId(r.num)}
                        className="source-row scroll-mt-24 border-b-2 border-dotted border-white/40"
                      >
                        <a href={r.url} target="_blank" rel="noreferrer" className={ROW_LINK}>
                          <span className="pl-2 text-[0.8rem] tabular-nums opacity-60">[{r.num}]</span>
                          <span className="col-span-3 flex min-w-0 flex-col gap-1 pr-2 lg:col-span-8">
                            {host && <span className="text-[0.72rem] opacity-60">{host} ↗</span>}
                            <span className="text-[clamp(0.95rem,4vw,1.15rem)] leading-snug wrap-anywhere">
                              {r.title}
                            </span>
                            {r.description && (
                              <span className="font-anonymous text-sm normal-case leading-relaxed tracking-normal opacity-80">
                                {r.description}
                              </span>
                            )}
                          </span>
                          <span className="sr-only">(nouvel onglet)</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {archiveCredits.length > 0 && (
              <div className="col-span-4 grid grid-cols-subgrid gap-y-3 lg:col-span-12">
                <h3 className="col-span-4 text-[0.78rem] text-white/60 lg:col-span-3 lg:pt-3">
                  CRÉDITS DES ARCHIVES
                </h3>
                <ul className="col-span-4 border-t border-white bg-black lg:col-span-9">
                  {archiveCredits.map((a) => {
                    const content = (
                      <>
                        <span className="pl-2 text-[0.8rem] opacity-60">{a.label}</span>
                        <span className="col-span-3 flex min-w-0 flex-col gap-1 pr-2 lg:col-span-8">
                          {a.caption && (
                            <span className="text-[clamp(0.9rem,3.8vw,1.05rem)] leading-snug">{a.caption}</span>
                          )}
                          {a.source && (
                            <span className="text-[0.72rem] opacity-60 wrap-anywhere">
                              {a.sourceHost ? `${a.sourceHost} ↗` : `SOURCE : ${a.source}`}
                            </span>
                          )}
                        </span>
                      </>
                    );
                    return (
                      <li key={a.key} className="border-b-2 border-dotted border-white/40">
                        {a.sourceHost ? (
                          <a href={a.source} target="_blank" rel="noreferrer" className={ROW_LINK}>
                            {content}
                            <span className="sr-only">(nouvel onglet)</span>
                          </a>
                        ) : (
                          <div className="grid grid-cols-4 gap-x-3 py-3 lg:grid-cols-9 lg:gap-x-6">{content}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      <div className={`${CONTAINER} flex flex-col pb-16`}>
        <FrequencyList label="CHANGER DE FRÉQUENCE" genres={others} />

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
