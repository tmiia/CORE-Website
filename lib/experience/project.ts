import { INSTALLATION_GENRES } from "./genres";

/**
 * The project page (/projet): why CORE.FM, what the installation is, where it
 * is shown. FIRST DRAFT, to be reread by the team; once validated it can move
 * to Sanity. "Tu" for the visitor, "on" for the team, as on the rest of the
 * site.
 *
 * Images: each chapter, and the manifesto, can take photos, laid as prints.
 * None yet: they come after the exhibition. `src` is a /public path or a full
 * URL (cdn.sanity.io is allowed by next.config).
 */
export interface ProjectImage {
  src: string;
  width: number;
  height: number;
  caption?: string;
}

export interface ProjectChapter {
  key: string;
  label: string;
  /** The big line, decoded when it scrolls into view. */
  statement: string;
  body: string[];
  images?: ProjectImage[];
}

export const PROJECT_LEDE =
  "Une radio qu'on vient écouter, pour redécouvrir l'histoire des musiques noires populaires.";

export const CHAPTERS: ProjectChapter[] = [
  {
    key: "pourquoi",
    label: "POURQUOI",
    statement: "On a toujours voulu faire un projet qui a du sens.",
    body: [
      "Un projet qui raconte quelque chose d'important pour nous. Et mettre en avant l'histoire des musiques noires, ce n'est pas anodin.",
    ],
    images: [],
  },
  {
    key: "constat",
    label: "LE CONSTAT",
    statement: "Beaucoup l'écoutent. Peu savent la nommer.",
    body: [
      "Prends le bouyon : une musique jeune, que beaucoup de gens écoutent aujourd'hui. Très peu savent nommer ce style, et beaucoup le confondent avec d'autres musiques populaires du moment, comme le shatta.",
      "Quand ces musiques deviennent populaires, elles sont réappropriées. C'est normal : elles plaisent, et d'autres ont envie de faire partie du mouvement. Mais pendant que les morceaux circulent, leur histoire s'efface derrière leur succès.",
    ],
    images: [],
  },
];

/** Chapter "LE CONSTAT": the genre people hear, and the one they name. */
export const MIXUP = { heard: "SHATTA", genre: "bouyon" };

/** The manifesto: pinned, typed on scroll. Photos of the installation can be
 * laid on it after the exhibition. */
export const REMEMBER = {
  label: "SE RAPPELER",
  paragraphs: [
    "Se rappeler d'où viennent ces musiques, comment elles ont été créées, et dans quel contexte.",
    "Quand on les écoute, on ne consomme pas que le côté festif : on porte avec nous toute leur histoire.",
  ],
  images: [] as ProjectImage[],
};

/** The work's label (cartel), as an index card sliding over the manifesto.
 * " - " separated values are shown one per line. */
export const INSTALLATION = {
  label: "L'INSTALLATION",
  intro: [
    "CORE.FM est une installation sonore interactive : une radio, qu'on vient écouter. Tu choisis un genre, tu cales la fréquence, tu règles l'égaliseur, et l'émission commence : l'histoire du genre, racontée à l'antenne.",
    "Elle s'appuie sur l'imaginaire des radios pirates et du brouillage : certaines histoires ne s'entendent que si on prend le temps de chercher le signal. À la fin, un ticket imprimé, avec un QR code, t'amène ici pour aller plus loin.",
  ],
  rows: [
    // Not "ŒUVRE": the VCR font has no Œ (a fallback glyph shows).
    { label: "TITRE", value: "CORE.FM" },
    { label: "TYPE", value: "Installation sonore interactive" },
    { label: "ÉTAPES", value: "Fréquence - Égaliseur - Émission - Photobooth - Ticket" },
    { label: "GENRES", value: INSTALLATION_GENRES.map((g) => g.label).join(" - ") },
    { label: "CONÇUE AUX", value: "Gobelins, l'école de l'image" },
    { label: "ANNÉE", value: "2026" },
  ],
};

/** Where it is shown. Dates are days in Paris. Hours and entry: Laval
 * Tourisme listing, to check against the festival's programme. */
export const EXHIBITION = {
  festival: "Recto VRso",
  about: "le festival d'art numérique de Laval Virtual",
  venue: "Le Quarante",
  venueAt: "au Quarante", // "à + le" → "au"
  city: "Laval",
  start: "2026-11-19",
  end: "2026-11-22",
  hours: "10 h – 17 h",
  entry: "Libre",
  url: "https://rectovrso.laval-virtual.com/",
};

export type ExhibitionStatus = "upcoming" | "live" | "past";

/** Before, during or after the exhibition (Paris time). */
export function exhibitionStatus(now = new Date()): ExhibitionStatus {
  // en-CA formats as YYYY-MM-DD, comparable as strings.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
  if (today < EXHIBITION.start) return "upcoming";
  if (today > EXHIBITION.end) return "past";
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
export function exhibitionDates(): [string, string] {
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...opts }).format(new Date(iso)).toUpperCase();
  if (EXHIBITION.start.slice(0, 7) === EXHIBITION.end.slice(0, 7)) {
    return [
      `${fmt(EXHIBITION.start, { day: "numeric" })} → ${fmt(EXHIBITION.end, { day: "numeric" })}`,
      fmt(EXHIBITION.end, { month: "long", year: "numeric" }),
    ];
  }
  return [
    `${fmt(EXHIBITION.start, { day: "numeric", month: "long" })} →`,
    fmt(EXHIBITION.end, { day: "numeric", month: "long", year: "numeric" }),
  ];
}

/** The exhibition sentence, in the right tense. */
export function exhibitionSentence(status: ExhibitionStatus): string {
  const verb = {
    upcoming: "sera exposée",
    live: "est exposée en ce moment",
    past: "a été exposée",
  }[status];
  return `L'installation ${verb} ${EXHIBITION.venueAt}, à ${EXHIBITION.city}, pendant ${EXHIBITION.festival}, ${EXHIBITION.about}.`;
}
