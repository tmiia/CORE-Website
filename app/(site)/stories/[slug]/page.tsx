import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PortableText,
  toPlainText,
  type PortableTextBlock,
  type PortableTextComponents,
} from "@portabletext/react";
import type { SanityImageSource } from "@sanity/image-url";
import GenreHero from "@/components/genre/GenreHero";
import SectionTitle from "@/components/genre/SectionTitle";
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

type ArchiveImage = {
  _key: string;
  image?: SanityImageSource;
  dimensions?: { width: number; height: number };
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
  content?: PortableTextBlock[];
  keyConcepts?: KeyConcept[];
  archiveImages?: ArchiveImage[];
  resources?: Resource[];
  genre?: Genre;
};

type StorySlug = {
  slug?: { current?: string };
  path?: string;
};

const link: NonNullable<PortableTextComponents["marks"]>["link"] = ({ children, value }) => {
  const href = typeof value?.href === "string" ? value.href : "";
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="underline decoration-1 underline-offset-4 hover:bg-white hover:text-black"
    >
      {children}
    </a>
  );
};

// VCR is a pixel font: its strokes thicken with the size, so past ~19 px it
// reads bold. Capped near the phone size, which keeps it light.
const TRANSMISSION_SIZE = "text-[clamp(1.05rem,4.6vw,1.2rem)] leading-[1.6]";

/** The radio's voice: subtitle lines on black, as in the home intro. The
 * blinking cursor ends the last block, on its last line. */
function transmissionText(lastKey?: string): PortableTextComponents {
  const line = (children: ReactNode, key?: string) => (
    <span className="bg-black box-decoration-clone px-1.5 py-0.5">
      {children}
      {key !== undefined && key === lastKey && (
        <span aria-hidden="true" className="caret ml-[0.35em]">
          █
        </span>
      )}
    </span>
  );
  return {
    block: {
      normal: ({ children, value }) => (
        <p className={`whitespace-pre-line ${TRANSMISSION_SIZE}`}>{line(children, value._key)}</p>
      ),
      blockquote: ({ children, value }) => (
        <blockquote className={`border-l-4 border-white pl-4 ${TRANSMISSION_SIZE}`}>
          {line(children, value._key)}
        </blockquote>
      ),
    },
    marks: { link },
  };
}

/** Reading text: Anonymous Pro, sentence case. */
const bodyText: PortableTextComponents = {
  block: {
    normal: ({ children }) => (
      <p className="whitespace-pre-line font-anonymous text-base normal-case leading-relaxed tracking-normal text-white/90 sm:text-lg">
        {children}
      </p>
    ),
    h2: ({ children }) => <h3 className="text-xl leading-tight sm:text-2xl">{children}</h3>,
    h3: ({ children }) => <h4 className="text-lg leading-tight">{children}</h4>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-white pl-4 font-anonymous text-lg normal-case leading-relaxed tracking-normal">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="flex flex-col gap-2 font-anonymous text-base normal-case leading-relaxed tracking-normal sm:text-lg">
        {children}
      </ul>
    ),
    number: ({ children }) => (
      <ol className="flex list-decimal flex-col gap-2 pl-6 font-anonymous text-base normal-case leading-relaxed tracking-normal sm:text-lg">
        {children}
      </ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li className="before:mr-2 before:content-['▮']">{children}</li>,
    number: ({ children }) => <li>{children}</li>,
  },
  marks: { link },
};

const RESOURCE_LABELS: Record<string, string> = {
  article: "ARTICLE",
  book: "LIVRE",
  video: "VIDÉO",
  audio: "AUDIO",
  archive: "ARCHIVE",
  other: "LIEN",
};

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

const pad = (n: number) => String(n).padStart(2, "0");

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

  const description =
    story.description ||
    (story.content?.length ? toPlainText(story.content).slice(0, 155) : undefined);
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

  const archives = (story.archiveImages ?? []).filter((a) => a.image);
  const genreImages = archives.length ? [] : (genre?.images ?? []);
  const resources = (story.resources ?? []).filter((r) => r.url);
  const concepts = (story.keyConcepts ?? []).filter((c) => c.title);
  const hasContext = Boolean(genre?.description || genre?.history?.length);

  // Fiche signal: what the installation knows, then Sanity's key notions.
  const sheet: { label: string; value: string; body?: boolean }[] = [
    ...(place ? [{ label: "ORIGINE", value: place.toUpperCase() }] : []),
    ...(birth || year ? [{ label: "NAISSANCE", value: birth ?? String(year) }] : []),
    ...(installation ? [{ label: "FRÉQUENCE", value: `${installation.freq.toFixed(1)} FM` }] : []),
    ...(installation
      ? [
          {
            label: "ÉGALISEUR",
            // Non-breaking spaces: wraps between bands, never inside one.
            value: `AIGUS ${installation.eq.high.toFixed(1)} · MÉDIUMS ${installation.eq.mid.toFixed(1)} · GRAVES ${installation.eq.low.toFixed(1)}`,
          },
        ]
      : []),
    ...concepts.map((c) => ({
      label: (c.title ?? "").toUpperCase(),
      value: c.description ?? "",
      body: true,
    })),
  ];

  let n = 0;
  const next = () => pad(++n);

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

      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-16 sm:px-8">
        {Boolean(story.content?.length) && (
          <section className="section-rule grid gap-6 py-12 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10 md:py-16">
            <SectionTitle index={next()} label="TRANSMISSION" />
            <div className="flex max-w-[38em] flex-col gap-5 normal-case tracking-[0.02em]">
              <PortableText
                value={story.content ?? []}
                components={transmissionText(story.content?.at(-1)?._key)}
              />
            </div>
          </section>
        )}

        {hasContext && (
          <section className="section-rule grid gap-6 py-12 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10 md:py-16">
            <SectionTitle index={next()} label="LE CONTEXTE" />
            <div className="flex max-w-[65ch] flex-col gap-5 bg-black/85 p-4 sm:p-6">
              {genre?.description && (
                <p className="font-anonymous text-lg normal-case leading-relaxed tracking-normal">
                  {genre.description}
                </p>
              )}
              <PortableText value={genre?.history ?? []} components={bodyText} />
            </div>
          </section>
        )}

        {sheet.length > 0 && (
          <section className="section-rule grid gap-6 py-12 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10 md:py-16">
            <SectionTitle index={next()} label="FICHE SIGNAL" />
            <dl className="flex max-w-176 flex-col divide-y-2 divide-dotted divide-white/50 border border-white bg-black">
              {sheet.map((row, i) => (
                <div
                  key={`${row.label}-${i}`}
                  className="flex flex-col gap-1.5 px-3 py-3 sm:flex-row sm:items-baseline sm:gap-6 sm:px-4"
                >
                  <dt className="shrink-0 text-[0.8rem] text-white/60 sm:w-52">{row.label}</dt>
                  <dd
                    className={
                      row.body
                        ? "font-anonymous text-base normal-case leading-relaxed tracking-normal"
                        : "text-[clamp(0.95rem,4vw,1.15rem)]"
                    }
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {(archives.length > 0 || genreImages.length > 0) && (
          <section className="section-rule grid gap-6 py-12 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10 md:py-16">
            <SectionTitle index={next()} label="ARCHIVES" />
            <div className="grid gap-8 sm:grid-cols-2 sm:gap-6">
              {archives.map((archive, i) => {
                const dims = archive.dimensions;
                const src = urlForImage(archive.image!).width(1200).fit("max").url();
                const host = archive.source?.startsWith("http") ? hostOf(archive.source) : null;
                return (
                  <figure key={archive._key} className="flex flex-col gap-2">
                    <div className="archive-frame relative overflow-hidden border border-white bg-black">
                      <Image
                        src={src}
                        alt={archive.caption || story.title}
                        width={dims?.width ?? 1200}
                        height={dims?.height ?? 900}
                        sizes="(max-width: 640px) 100vw, (max-width: 1152px) 40vw, 460px"
                        className="block h-auto w-full contrast-125 grayscale"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-0 bg-black px-2 py-1 text-[0.75rem]"
                      >
                        ▶ ARCH. {pad(i + 1)}
                      </span>
                    </div>
                    {(archive.caption || archive.source) && (
                      <figcaption className="flex flex-col gap-1 text-[0.8rem] leading-snug">
                        {archive.caption && <span>{archive.caption}</span>}
                        {archive.source &&
                          (host ? (
                            <a
                              href={archive.source}
                              target="_blank"
                              rel="noreferrer"
                              className="w-fit text-white/60 hover:bg-white hover:text-black"
                            >
                              SOURCE ↗ {host}
                            </a>
                          ) : (
                            <span className="text-white/60">SOURCE : {archive.source}</span>
                          ))}
                      </figcaption>
                    )}
                  </figure>
                );
              })}
              {genreImages.map((image, i) => (
                <div
                  key={`${genre?._id}-${i}`}
                  className="archive-frame relative overflow-hidden border border-white bg-black"
                >
                  <Image
                    src={urlForImage(image).width(1200).fit("max").url()}
                    alt={genre?.name || story.title}
                    width={1200}
                    height={900}
                    sizes="(max-width: 640px) 100vw, 460px"
                    className="block h-auto w-full contrast-125 grayscale"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {resources.length > 0 && (
          <section className="section-rule grid gap-6 py-12 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10 md:py-16">
            <SectionTitle index={next()} label="POUR ALLER PLUS LOIN" />
            <ul className="flex flex-col border border-white bg-black py-1.5">
              {resources.map((r) => {
                const host = hostOf(r.url);
                return (
                  <li key={r._key}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-11 items-start gap-3 px-3 py-3 outline-none hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black sm:px-4"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-[0.75rem] opacity-60">
                          [{RESOURCE_LABELS[r.type ?? ""] ?? "LIEN"}]{host ? ` ${host}` : ""}
                        </span>
                        <span className="text-[clamp(0.95rem,4vw,1.15rem)] leading-snug wrap-anywhere">
                          {r.title}
                        </span>
                        {r.description && (
                          <span className="font-anonymous text-sm normal-case leading-relaxed tracking-normal opacity-80">
                            {r.description}
                          </span>
                        )}
                      </span>
                      <span aria-hidden="true" className="pt-0.5">
                        ↗
                      </span>
                      <span className="sr-only">(nouvel onglet)</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {others.length > 0 && (
          <nav
            aria-label="Autres genres"
            className="section-rule flex flex-col py-12 md:grid md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10 md:py-16"
          >
            <h2 className="mb-2 w-fit bg-white px-2.5 py-1 text-[clamp(0.95rem,4vw,1.2rem)] text-black md:mb-0 md:self-start">
              CHANGER DE FRÉQUENCE
            </h2>
            <ul className="flex flex-col border border-white bg-black py-1.5">
              {others.map((g) => {
                const row =
                  "group flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-[clamp(1.4rem,7vw,2.4rem)] leading-none outline-none";
                const content = (
                  <>
                    <span
                      aria-hidden="true"
                      className="invisible text-[0.7em] group-hover:visible group-focus-visible:visible"
                    >
                      ▮
                    </span>
                    <span className={g.href ? "" : "opacity-45"}>{g.label}</span>
                    <span aria-hidden="true" className="ml-auto text-[0.42em] tracking-[0.12em] opacity-70">
                      {g.href ? (g.freq !== undefined ? `${g.freq.toFixed(1)} FM` : "") : "BIENTÔT"}
                    </span>
                  </>
                );
                return (
                  <li key={g.label}>
                    {g.href ? (
                      <Link
                        href={g.href}
                        aria-label={g.meta ? `${g.label}, ${g.meta}` : g.label}
                        className={`${row} hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black`}
                      >
                        {content}
                      </Link>
                    ) : (
                      <span aria-label={`${g.label}, bientôt`} className={row}>
                        {content}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

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
