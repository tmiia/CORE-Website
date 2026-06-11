import type { Metadata } from "next";
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
import { client } from "@/sanity/lib/client";
import { allStorySlugsQuery, storyBySlugQuery } from "@/sanity/lib/queries";
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

const portableTextComponents: PortableTextComponents = {
  block: {
    normal: ({ children }) => (
      <p className="font-anonymous text-[#171717] text-base leading-relaxed sm:text-lg">
        {children}
      </p>
    ),
    h2: ({ children }) => (
      <h2 className="font-monigue text-[#171717] text-4xl uppercase leading-none sm:text-5xl">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-anonymous text-[#171717] text-xl font-bold uppercase leading-tight">
        {children}
      </h3>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-[#171717]/70 pl-4 font-anonymous text-[#171717] text-lg uppercase leading-relaxed">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="list-disc space-y-2 pl-5 font-anonymous text-[#171717] text-base leading-relaxed sm:text-lg">
        {children}
      </ul>
    ),
    number: ({ children }) => (
      <ol className="list-decimal space-y-2 pl-5 font-anonymous text-[#171717] text-base leading-relaxed sm:text-lg">
        {children}
      </ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li>{children}</li>,
    number: ({ children }) => <li>{children}</li>,
  },
  marks: {
    link: ({ children, value }) => {
      const href = typeof value?.href === "string" ? value.href : "";
      const isExternal = href.startsWith("http");

      return (
        <a
          href={href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noreferrer" : undefined}
          className="underline underline-offset-4 transition-opacity hover:opacity-60"
        >
          {children}
        </a>
      );
    },
  },
};

function formatGenreBirth(date?: string) {
  if (!date) return null;

  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

function getResourceLabel(type?: string) {
  const labels: Record<string, string> = {
    article: "Article",
    book: "Livre",
    video: "Vidéo",
    audio: "Audio",
    archive: "Archive",
    other: "Ressource",
  };

  return type ? labels[type] ?? "Ressource" : "Ressource";
}

async function getStory(slug: string) {
  return client.fetch<Story | null>(
    storyBySlugQuery,
    { slug },
    { next: { revalidate: 60 } },
  );
}

export async function generateStaticParams() {
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
  const story = await getStory(slug);

  if (!story) {
    notFound();
  }

  const heroImageUrl = story.thumbnail
    ? urlForImage(story.thumbnail).width(1600).height(900).url()
    : null;
  const hasStoryContent = Boolean(story.content?.length);
  const hasGenreHistory = Boolean(story.genre?.history?.length);
  const hasGenreImages = Boolean(story.genre?.images?.length);
  const hasArchiveImages = Boolean(story.archiveImages?.length);
  const hasKeyConcepts = Boolean(story.keyConcepts?.length);
  const hasResources = Boolean(story.resources?.length);
  const genreBirth = formatGenreBirth(story.genre?.birth);

  return (
    <main className="flex min-h-screen flex-1 flex-col bg-white px-4 pb-24 pt-20 text-[#171717] sm:px-6 sm:pt-24 md:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 sm:gap-16">
        <Link
          href="/"
          className="w-fit font-anonymous text-sm uppercase tracking-wide transition-opacity hover:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#171717]"
        >
          [&lt;- Retour]
        </Link>

        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div className="relative aspect-4/3 w-full overflow-hidden sm:aspect-video">
            {heroImageUrl ? (
              <Image
                src={heroImageUrl}
                alt={story.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 58vw"
                className="object-cover"
              />
            ) : (
              <div className="h-full w-full bg-black/20" />
            )}
          </div>

          <div className="flex flex-col gap-5">
            <p className="font-anonymous text-sm uppercase tracking-[0.2em]">
              {story.genre?.name ? `Genre musical: ${story.genre.name}` : "Histoire"}
            </p>
            <h1 className="font-monigue text-6xl uppercase leading-none sm:text-7xl md:text-8xl">
              {story.title}
            </h1>
            {story.description && (
              <p className="font-anonymous text-base uppercase leading-relaxed sm:text-lg">
                {story.description}
              </p>
            )}
            {(story.origin || story.birthYear) && (
              <dl className="grid grid-cols-2 gap-4 border-y border-[#171717]/50 py-4 font-anonymous uppercase">
                {story.origin && (
                  <div>
                    <dt className="text-xs tracking-wide opacity-70">Origine</dt>
                    <dd className="mt-1 text-xl font-bold leading-tight">{story.origin}</dd>
                  </div>
                )}
                {story.birthYear && (
                  <div>
                    <dt className="text-xs tracking-wide opacity-70">Année</dt>
                    <dd className="mt-1 text-xl leading-tight">{story.birthYear}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </section>

        {hasStoryContent && (
          <section className="grid gap-5 md:grid-cols-[0.35fr_0.65fr] md:gap-10">
            <h2 className="font-monigue text-5xl uppercase leading-none sm:text-6xl">
              L&apos;histoire
            </h2>
            <div className="flex flex-col gap-5">
              <PortableText value={story.content ?? []} components={portableTextComponents} />
            </div>
          </section>
        )}

        {(story.genre?.name || story.genre?.description || hasGenreHistory) && (
          <section className="grid gap-6 border-t border-[#171717]/50 pt-10 md:grid-cols-[0.35fr_0.65fr] md:gap-10">
            <div className="flex flex-col gap-3">
              <p className="font-anonymous text-sm uppercase tracking-[0.2em]">Genre musical</p>
              <h2 className="font-monigue text-5xl uppercase leading-none sm:text-6xl">
                {story.genre?.name}
              </h2>
              {(story.genre?.origin || genreBirth) && (
                <div className="font-anonymous text-sm uppercase leading-relaxed opacity-90">
                  {story.genre?.origin && <p>{story.genre.origin}</p>}
                  {genreBirth && <p>{genreBirth}</p>}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-5">
              {story.genre?.description && (
                <p className="font-anonymous text-base uppercase leading-relaxed sm:text-lg">
                  {story.genre.description}
                </p>
              )}
              {hasGenreHistory && (
                <PortableText value={story.genre?.history ?? []} components={portableTextComponents} />
              )}
            </div>
          </section>
        )}

        {hasKeyConcepts && (
          <section className="border-t border-[#171717]/50 pt-10">
            <h2 className="font-monigue text-5xl uppercase leading-none sm:text-6xl">
              Notions cles
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {story.keyConcepts?.map((concept) => (
                <article key={concept._key} className="border border-[#171717]/50 p-4">
                  <h3 className="font-anonymous text-xl font-bold uppercase leading-tight">
                    {concept.title}
                  </h3>
                  {concept.description && (
                    <p className="mt-3 font-anonymous text-sm uppercase leading-relaxed">
                      {concept.description}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {(hasArchiveImages || hasGenreImages) && (
          <section className="border-t border-[#171717]/50 pt-10">
            <h2 className="font-monigue text-5xl uppercase leading-none sm:text-6xl">
              Images d&apos;archives
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {story.archiveImages?.map((archive) => {
                const archiveImageUrl = archive.image
                  ? urlForImage(archive.image).width(900).height(650).url()
                  : null;

                if (!archiveImageUrl) return null;

                return (
                  <figure key={archive._key} className="flex flex-col gap-3">
                    <div className="relative aspect-4/3 overflow-hidden">
                      <Image
                        src={archiveImageUrl}
                        alt={archive.caption || story.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 50vw"
                        className="object-cover"
                      />
                    </div>
                    {(archive.caption || archive.source) && (
                      <figcaption className="font-anonymous text-xs uppercase leading-relaxed opacity-90">
                        {archive.caption}
                        {archive.caption && archive.source ? " - " : ""}
                        {archive.source}
                      </figcaption>
                    )}
                  </figure>
                );
              })}

              {!hasArchiveImages &&
                story.genre?.images?.map((image, index) => {
                  const genreImageUrl = urlForImage(image).width(900).height(650).url();

                  return (
                    <figure key={`${story.genre?._id}-${index}`} className="flex flex-col gap-3">
                      <div className="relative aspect-4/3 overflow-hidden">
                        <Image
                          src={genreImageUrl}
                          alt={story.genre?.name || story.title}
                          fill
                          sizes="(max-width: 640px) 100vw, 50vw"
                          className="object-cover"
                        />
                      </div>
                    </figure>
                  );
                })}
            </div>
          </section>
        )}

        {hasResources && (
          <section className="border-t border-[#171717]/50 pt-10">
            <h2 className="font-monigue text-5xl uppercase leading-none sm:text-6xl">
              Pour aller plus loin
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {story.resources?.map((resource) => {
                if (!resource.url) return null;

                return (
                  <a
                    key={resource._key}
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-[#171717]/50 p-4 transition-colors hover:bg-[#171717] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#171717]"
                  >
                    <p className="font-anonymous text-xs uppercase tracking-[0.2em] opacity-80">
                      {getResourceLabel(resource.type)}
                    </p>
                    <h3 className="mt-2 font-anonymous text-xl font-bold uppercase leading-tight">
                      {resource.title}
                    </h3>
                    {resource.description && (
                      <p className="mt-3 font-anonymous text-sm uppercase leading-relaxed">
                        {resource.description}
                      </p>
                    )}
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
