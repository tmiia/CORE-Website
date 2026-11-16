/**
 * The team, for the credits page (/credits). Names and links: the CORE.FM page
 * of Nehémia's portfolio; roles: as the team described them. Project lead
 * first, then the portfolio's order.
 */
export interface CreditLink {
  label: string;
  url: string;
}

export interface Credit {
  first: string;
  last: string;
  roles: string[];
  links: CreditLink[];
}

export const CREDITS: Credit[] = [
  {
    first: "Nehémia",
    last: "Telusma",
    roles: [
      "Project lead",
      "Direction artistique",
      "Concept",
      "Narration",
      "Électronique",
      "Développement (gameplay et site)",
      "Sound design",
    ],
    links: [{ label: "Portfolio", url: "https://www.nehemiatelusma.com/" }],
  },
  {
    first: "Lyes",
    last: "Bedouda",
    roles: ["Direction artistique", "Concept", "Scénographie", "Sound design"],
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/lyes-bedouda-6b2060232/" }],
  },
  {
    first: "Dana",
    last: "Vong",
    roles: ["Design des interfaces", "Logistique"],
    links: [],
  },
  {
    first: "Martin",
    last: "Cantonny",
    roles: ["Développement web", "Interfaces du gameplay (premières versions)"],
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/martin-cantonny-089506228/" }],
  },
];

export const CREDITS_NOTE = "CORE.FM · Conçue aux Gobelins, l'école de l'image · 2026";
