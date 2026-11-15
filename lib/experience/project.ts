/**
 * The project page (/projet). Its content is edited in Sanity (the
 * "projectPage" singleton, see sanity/lib/projectPage.ts); DEFAULT_PROJECT is
 * the same content, used when Sanity isn't configured or the document doesn't
 * exist yet, and to seed it. "Tu" for the visitor, "on" for the team, as on the
 * rest of the site.
 *
 * No imports: this file is also read by the seed script, outside Next.
 */
export interface ProjectImage {
  src: string;
  width: number;
  height: number;
  caption?: string;
}

export interface ProjectChapter {
  /** Title bar: "D'OÙ L'ON VIENT". */
  label: string;
  /** The big line, decoded when it scrolls into view. */
  heading: string;
  /** Paragraphs. */
  body: string[];
  /** Photos (after the exhibition), laid as prints. */
  images: ProjectImage[];
}

export interface ProjectRow {
  label: string;
  /** " · " separated values are shown one per line. */
  value: string;
}

/** The installation: a chapter on an index card, with its label (cartel). */
export interface ProjectInstallation extends Omit<ProjectChapter, "images"> {
  rows: ProjectRow[];
}

export type ExhibitionStatus = "upcoming" | "live" | "past";

export interface Exhibition {
  /** YYYY-MM-DD, days in Paris. */
  start: string;
  end: string;
  venue: string;
  city: string;
  festival: string;
  festivalUrl?: string;
  hours: string;
  entry: string;
  /** The sentence under the dates, in each tense: the page picks it by date. */
  announcement: Record<ExhibitionStatus, string>;
}

export interface ProjectContent {
  kicker: string;
  title: string;
  lede: string;
  chapters: ProjectChapter[];
  installation: ProjectInstallation;
  exhibition: Exhibition;
}

const AT_FESTIVAL = "au Quarante, à Laval, dans le cadre de Recto VRso, le festival d'art numérique de Laval Virtual.";

export const DEFAULT_PROJECT: ProjectContent = {
  kicker: "INSTALLATION SONORE INTERACTIVE",
  title: "CORE.FM",
  lede: "La radio qui te fait [re]découvrir l'histoire des musiques noires populaires.",
  chapters: [
    {
      label: "D'OÙ L'ON VIENT",
      heading: "DES QUARTIERS POPULAIRES AUX SCÈNES INTERNATIONALES.",
      body: [
        "Le rap, la techno, le bouyon, le baile funk. Des musiques nées au sein de communautés noires et populaires, dans des contextes sociaux, culturels et politiques bien particuliers.",
        "Certaines ont longtemps été marginalisées, comme les communautés dont elles sont issues. Et pourtant, aujourd'hui, elles traversent les frontières, remplissent les clubs et influencent la culture populaire.",
        "Ce qui était autrefois stigmatisé devient tendance. Les rythmes voyagent, les codes sont repris, les genres évoluent.",
        "Mais au milieu de tout ça, on oublie parfois d'où viennent ces musiques, qui les a créées et pourquoi elles sont nées.",
      ],
      images: [],
    },
    {
      label: "POUR NE PAS OUBLIER",
      heading: "PARCE QUE DERRIÈRE LA MUSIQUE, IL Y A DES HISTOIRES.",
      body: [
        "On a voulu créer un projet qui nous ressemble, qui parle de nos cultures et de ce qu'elles nous ont transmis.",
        "Un projet qui prend le temps de revenir là où tout a commencé. De raconter les personnes, les lieux, les rencontres qui ont donné naissance à ces musiques.",
        "Parce qu'une musique ne naît jamais de nulle part. Elle est le reflet d'une époque, d'une société et de ceux qui la font vivre.",
        "Et connaître son histoire, c'est aussi apprendre à l'écouter autrement.",
      ],
      images: [],
    },
  ],
  installation: {
    label: "RETROUVER LE SIGNAL",
    heading: "UNE RADIO POUR REMONTER LE TEMPS.",
    body: [
      "CORE.FM est une installation sonore interactive inspirée de l'univers des radios pirates.",
      "Face à un émetteur, tu choisis un genre musical, tu recherches sa fréquence et tu ajustes l'égaliseur pour rétablir le signal.",
      "Une émission démarre. À travers une voix, des archives sonores et des extraits musicaux, tu découvres comment cette musique est née, ce qui l'a influencée et comment elle a évolué jusqu'à aujourd'hui.",
      "À la fin de l'expérience, un ticket imprimé te permet de retrouver des ressources pour poursuivre la découverte.",
    ],
    rows: [
      // Not "ŒUVRE": the VCR font has no Œ (a fallback glyph shows).
      { label: "TITRE", value: "CORE.FM" },
      { label: "TYPE", value: "Installation sonore interactive" },
      { label: "ÉTAPES", value: "Fréquence · Égaliseur · Émission · Photobooth · Ticket" },
      { label: "GENRES", value: "Rap · Techno · Bouyon · Baile funk" },
      { label: "CONÇUE AUX", value: "Gobelins, l'école de l'image" },
      { label: "ANNÉE", value: "2026" },
    ],
  },
  exhibition: {
    start: "2026-11-19",
    end: "2026-11-22",
    venue: "Le Quarante",
    city: "Laval",
    festival: "Recto VRso",
    festivalUrl: "https://rectovrso.laval-virtual.com/",
    hours: "10 h – 17 h",
    entry: "Libre",
    announcement: {
      upcoming: `L'installation sera présentée ${AT_FESTIVAL}`,
      live: `L'installation est présentée en ce moment ${AT_FESTIVAL}`,
      past: `L'installation a été présentée ${AT_FESTIVAL}`,
    },
  },
};

/** Before, during or after the exhibition (Paris time). */
export function exhibitionStatus(ex: Pick<Exhibition, "start" | "end">, now = new Date()): ExhibitionStatus {
  // en-CA formats as YYYY-MM-DD, comparable as strings.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
  if (today < ex.start) return "upcoming";
  if (today > ex.end) return "past";
  return "live";
}

/** Radio words for the exhibition: next broadcast, on air, broadcast. */
export const STATUS_LABEL: Record<ExhibitionStatus, string> = {
  upcoming: "PROCHAINE DIFFUSION",
  live: "EN DIRECT",
  past: "DIFFUSÉ",
};

/** The dates on two lines: ["19 → 22", "NOVEMBRE 2026"] (or ["28 OCTOBRE →",
 * "2 NOVEMBRE 2026"] across two months). */
export function exhibitionDates(ex: Pick<Exhibition, "start" | "end">): [string, string] {
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...opts }).format(new Date(iso)).toUpperCase();
  if (ex.start.slice(0, 7) === ex.end.slice(0, 7)) {
    return [
      `${fmt(ex.start, { day: "numeric" })} → ${fmt(ex.end, { day: "numeric" })}`,
      fmt(ex.end, { month: "long", year: "numeric" }),
    ];
  }
  return [`${fmt(ex.start, { day: "numeric", month: "long" })} →`, fmt(ex.end, { day: "numeric", month: "long", year: "numeric" })];
}
