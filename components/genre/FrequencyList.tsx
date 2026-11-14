import Link from "next/link";
import type { MenuGenre } from "@/lib/experience/genres";

/**
 * The genres as a list of frequencies (the home menu's language): ▮ on hover,
 * frequency on the right, "BIENTÔT" for a genre without a page. End of the
 * genre pages (CHANGER DE FRÉQUENCE) and of the project page.
 */
export default function FrequencyList({ label, genres }: { label: string; genres: MenuGenre[] }) {
  if (genres.length === 0) return null;
  return (
    <nav
      aria-label={label}
      className="section-rule flex flex-col py-12 md:grid md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10 md:py-16"
    >
      <h2 className="mb-2 w-fit bg-white px-2.5 py-1 text-[clamp(0.95rem,4vw,1.2rem)] text-black md:mb-0 md:self-start">
        {label}
      </h2>
      <ul className="flex flex-col border border-white bg-black py-1.5">
        {genres.map((g) => {
          const row =
            "group flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-[clamp(1.4rem,7vw,2.4rem)] leading-none outline-none";
          const content = (
            <>
              <span
                aria-hidden="true"
                className="invisible text-[0.7em] group-hover:visible group-focus-visible:visible"
              >
                ▮
              </span>
              <span className={g.href ? "" : "opacity-45"}>{g.label}</span>
              <span aria-hidden="true" className="ml-auto text-[0.42em] tracking-[0.12em] opacity-70">
                {g.href ? (g.freq !== undefined ? `${g.freq.toFixed(1)} FM` : "") : "BIENTÔT"}
              </span>
            </>
          );
          return (
            <li key={g.label}>
              {g.href ? (
                <Link
                  href={g.href}
                  aria-label={g.meta ? `${g.label}, ${g.meta}` : g.label}
                  className={`${row} hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black`}
                >
                  {content}
                </Link>
              ) : (
                <span aria-label={`${g.label}, bientôt`} className={row}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
