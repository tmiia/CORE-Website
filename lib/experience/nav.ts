export interface NavLink {
  label: string;
  href: string;
}

/** Burger menu links. PLACEHOLDERS: /projet and /credits don't exist yet —
 * replace with the real pages. */
export const NAV_LINKS: NavLink[] = [
  { label: "ACCUEIL", href: "/" },
  { label: "LE PROJET", href: "/projet" },
  { label: "CRÉDITS", href: "/credits" },
];
