export interface MenuGenre {
  label: string;
  meta?: string; // "1973 · BRONX, NEW YORK"
  href?: string; // no page yet → shown as "BIENTÔT", not clickable
  key?: string; // installation genre id, when it is one
  freq?: number; // its frequency on the installation's dial
}

export interface EqSetting {
  high: number;
  mid: number;
  low: number;
}

export interface InstallationGenre {
  key: string;
  label: string;
  year: number;
  place: string;
  /** Frequency step target (dial 0–300). */
  freq: number;
  /** Equalizer step targets (pots 0–10) and their tolerance. */
  eq: EqSetting;
  eqTolerance: number;
  /** The 3D model shown at the equalizer step. */
  model: string;
}

/** The installation's genres (something.fm content/genres.json), in its order.
 * `key` matches a Sanity story by slug, title or genre name. */
export const INSTALLATION_GENRES: InstallationGenre[] = [
  {
    key: "rap",
    label: "RAP",
    year: 1973,
    place: "BRONX, NEW YORK",
    freq: 197.3,
    eq: { high: 4.5, mid: 8.2, low: 1.7 },
    eqTolerance: 0.5,
    model: "/assets/models/genres/rap.glb", // radio.glb
  },
  {
    key: "techno",
    label: "TECHNO",
    year: 1988,
    place: "DETROIT, MICHIGAN",
    freq: 92.4,
    eq: { high: 3, mid: 8, low: 5 },
    eqTolerance: 1,
    model: "/assets/models/genres/techno.glb", // ford.glb
  },
  {
    key: "bouyon",
    label: "BOUYON",
    year: 1988,
    place: "DOMINIQUE",
    freq: 68.5,
    eq: { high: 6, mid: 3, low: 8 },
    eqTolerance: 1,
    model: "/assets/models/genres/bouyon.glb", // sound_system.glb
  },
  {
    key: "baile-funk",
    label: "BAILE FUNK",
    year: 1989,
    place: "RIO DE JANEIRO",
    freq: 245.5,
    eq: { high: 2, mid: 7, low: 4 },
    eqTolerance: 1,
    model: "/assets/models/genres/baile-funk.glb", // paredao.glb
  },
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
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const matches = (story: Partial<StoryItem>, key: string) =>
  [story.path, story.title, story.genreName].some((v) => norm(v) === norm(key));

/** The installation genre a story is about (slug, title or genre name). */
export function findInstallationGenre(story: Partial<StoryItem>): InstallationGenre | undefined {
  return INSTALLATION_GENRES.find((g) => matches(story, g.key));
}

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
  const menu: MenuGenre[] = INSTALLATION_GENRES.map(({ key, label, year, place, freq }) => {
    const story = stories.find((s) => !used.has(s) && matches(s, key));
    if (!story) return { key, freq, label, meta: metaOf(year, place) };
    used.add(story);
    return {
      key,
      freq,
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
