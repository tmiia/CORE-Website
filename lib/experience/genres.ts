export interface MenuGenre {
  label: string;
  meta?: string; // "1973 · BRONX, NEW YORK"
  href?: string; // no page yet → shown as "BIENTÔT", not clickable
}

/** The installation's genres (something.fm content/genres.json), in its order.
 * `key` matches a Sanity story by slug, title or genre name. */
export const INSTALLATION_GENRES = [
  { key: "rap", label: "RAP", year: 1973, place: "BRONX, NEW YORK" },
  { key: "techno", label: "TECHNO", year: 1988, place: "DETROIT, MICHIGAN" },
  { key: "bouyon", label: "BOUYON", year: 1988, place: "DOMINIQUE" },
  { key: "baile-funk", label: "BAILE FUNK", year: 1989, place: "RIO DE JANEIRO" },
];

export interface StoryItem {
  title: string;
  path: string;
  origin?: string;
  birthYear?: number | string;
  genreName?: string;
}

/** "Baile Funk", "baile-funk", "BAILE_FUNK" → "bailefunk". */
const norm = (s?: string) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** "1973 · BRONX, NEW YORK" — Sanity values first, installation ones as fallback. */
const metaOf = (year?: number | string, place?: string) =>
  [year, place?.toUpperCase()].filter(Boolean).join(" · ") || undefined;

/**
 * Menu = the installation's genres, each linked to its Sanity story page when
 * one matches (slug, title or genre name); unmatched ones stay listed without a
 * link. Sanity stories that aren't installation genres are appended.
 */
export function buildMenu(stories: StoryItem[]): MenuGenre[] {
  const used = new Set<StoryItem>();
  const menu: MenuGenre[] = INSTALLATION_GENRES.map(({ key, label, year, place }) => {
    const story = stories.find(
      (s) => !used.has(s) && [s.path, s.title, s.genreName].some((v) => norm(v) === norm(key)),
    );
    if (!story) return { label, meta: metaOf(year, place) };
    used.add(story);
    return {
      label,
      meta: metaOf(story.birthYear ?? year, story.origin ?? place),
      href: `/stories/${story.path}`,
    };
  });
  for (const s of stories) {
    if (used.has(s)) continue;
    menu.push({ label: s.title.toUpperCase(), meta: metaOf(s.birthYear, s.origin), href: `/stories/${s.path}` });
  }
  return menu;
}
