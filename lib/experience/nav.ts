export interface NavLink {
  label: string;
  href: string;
}

/** Burger menu links. No home link: every page has its own way back (◂ HOME). */
export const NAV_LINKS: NavLink[] = [
  { label: "LE PROJET", href: "/projet" },
  { label: "CRÉDITS", href: "/credits" },
];
