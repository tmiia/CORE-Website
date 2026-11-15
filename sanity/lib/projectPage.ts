import { cache } from "react";
import {
  DEFAULT_PROJECT,
  type Exhibition,
  type ExhibitionStatus,
  type ProjectContent,
  type ProjectImage,
} from "@/lib/experience/project";
import { client } from "./client";
import { PROJECT_PAGE_ID } from "./projectPageId";
import { projectPageQuery } from "./queries";

interface Block {
  _type?: string;
  children?: { text?: string }[];
}

type Maybe<T> = T | null | undefined;

interface ProjectPageDoc {
  kicker?: Maybe<string>;
  title?: Maybe<string>;
  lede?: Maybe<string>;
  chapters?: Maybe<
    {
      label?: Maybe<string>;
      heading?: Maybe<string>;
      body?: Maybe<Block[]>;
      images?: Maybe<{ caption?: Maybe<string>; src?: Maybe<string>; width?: Maybe<number>; height?: Maybe<number> }[]>;
    }[]
  >;
  installation?: Maybe<{
    label?: Maybe<string>;
    heading?: Maybe<string>;
    body?: Maybe<Block[]>;
    rows?: Maybe<{ label?: Maybe<string>; value?: Maybe<string> }[]>;
  }>;
  exhibition?: Maybe<{ [K in keyof Omit<Exhibition, "announcement">]?: Maybe<string> } & {
    announcement?: Maybe<{ [K in ExhibitionStatus]?: Maybe<string> }>;
  }>;
}

/** Plain paragraphs from the Studio's blocks (no marks allowed there). */
const paragraphs = (blocks: Maybe<Block[]>) =>
  (blocks ?? [])
    .filter((b) => b._type === "block")
    .map((b) => (b.children ?? []).map((c) => c.text ?? "").join("").trim())
    .filter(Boolean);

const images = (list: NonNullable<NonNullable<ProjectPageDoc["chapters"]>[number]["images"]>): ProjectImage[] =>
  list.flatMap((img) =>
    img.src && img.width && img.height
      ? [{ src: img.src, width: img.width, height: img.height, caption: img.caption ?? undefined }]
      : [],
  );

/** The Studio's document, or the local content for what it doesn't have. */
function toContent(doc: ProjectPageDoc): ProjectContent {
  const d = DEFAULT_PROJECT;
  const inst = doc.installation;
  const ex = doc.exhibition;
  const say = ex?.announcement;
  return {
    kicker: doc.kicker || d.kicker,
    title: doc.title || d.title,
    lede: doc.lede || d.lede,
    chapters: doc.chapters?.length
      ? doc.chapters.map((c) => ({
          label: c.label ?? "",
          heading: c.heading ?? "",
          body: paragraphs(c.body),
          images: images(c.images ?? []),
        }))
      : d.chapters,
    installation: inst
      ? {
          label: inst.label ?? "",
          heading: inst.heading ?? "",
          body: paragraphs(inst.body),
          rows: (inst.rows ?? []).flatMap((r) => (r.label && r.value ? [{ label: r.label, value: r.value }] : [])),
        }
      : d.installation,
    exhibition:
      ex?.start && ex.end
        ? {
            start: ex.start,
            end: ex.end,
            venue: ex.venue ?? "",
            city: ex.city ?? "",
            festival: ex.festival ?? "",
            festivalUrl: ex.festivalUrl ?? undefined,
            hours: ex.hours ?? "",
            entry: ex.entry ?? "",
            announcement: {
              upcoming: say?.upcoming ?? "",
              live: say?.live ?? "",
              past: say?.past ?? "",
            },
          }
        : d.exhibition,
  };
}

/** The project page's content: Sanity's published document, else the local
 * content (no Sanity config, no document yet, Sanity unreachable). Cached per
 * request: the page and its metadata share one fetch. */
export const getProjectPage = cache(async (): Promise<ProjectContent> => {
  if (!client) return DEFAULT_PROJECT;
  try {
    const doc = await client.fetch<ProjectPageDoc | null>(
      projectPageQuery,
      { id: PROJECT_PAGE_ID },
      { next: { revalidate: 60 } },
    );
    return doc ? toContent(doc) : DEFAULT_PROJECT;
  } catch (e) {
    console.warn("[projet] Sanity unreachable, local content shown", e);
    return DEFAULT_PROJECT;
  }
});
