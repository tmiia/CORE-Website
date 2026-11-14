export interface NavLink {
  label: string;
  href: string;
}

/** Burger menu links. PLACEHOLDER: /credits doesn't exist yet. */
export const NAV_LINKS: NavLink[] = [
  { label: "ACCUEIL", href: "/" },
  { label: "LE PROJET", href: "/projet" },
  { label: "CRÉDITS", href: "/credits" },
];
