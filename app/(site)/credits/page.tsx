import type { Metadata } from "next";
import Link from "next/link";
import { CREDITS, CREDITS_NOTE } from "@/lib/experience/credits";

export const metadata: Metadata = {
  title: "Crédits",
  description: "L'équipe de CORE.FM, installation sonore interactive conçue aux Gobelins.",
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The credits, as a broadcast's end credits: exactly one screen (h-dvh, no
 * scroll). Sizes follow the screen's height as well as its width, so the four
 * names fit from a small phone to a desktop. Phone: one row per person, roles
 * inline. Landscape (desktop, phone on its side): four columns, one role per
 * line.
 */
export default function CreditsPage() {
  return (
    <main className="flex h-dvh flex-col overflow-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] font-vcr uppercase tracking-[0.08em] text-white sm:px-8 sm:pb-8 sm:pt-24 landscape:max-lg:pt-16">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="w-fit bg-white px-2.5 py-1 text-[clamp(0.95rem,4vw,1.2rem)] text-black">CRÉDITS</h1>
          <Link
            href="/"
            className="bg-black px-1 py-1 text-[clamp(0.8rem,3.4vw,1rem)] outline-none hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black"
          >
            ◂ HOME
          </Link>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-center-safe py-[clamp(0.5rem,2svh,2rem)]">
          <ol className="grid border-b-2 border-dotted border-white/50 bg-black landscape:grid-cols-4 landscape:border-b-0 landscape:border-t-2">
            {CREDITS.map((person, i) => (
              <li
                key={person.last}
                className="flex flex-col gap-[clamp(0.25rem,1svh,0.75rem)] border-t-2 border-dotted border-white/50 py-[clamp(0.45rem,1.7svh,1.25rem)] landscape:border-t-0 landscape:px-[clamp(0.5rem,1.2vw,1.25rem)] landscape:first:pl-0 landscape:[&+li]:border-l-2"
              >
                <h2 className="text-[clamp(1.2rem,min(7vw,4.2svh),3.2rem)] leading-[1.05]">
                  <span aria-hidden="true" className="mr-2 align-top text-[0.4em] text-white/50 landscape:block">
                    {pad(i + 1)}
                  </span>
                  <span className="landscape:block">{person.first.toUpperCase()}</span>{" "}
                  <span className="landscape:block">{person.last.toUpperCase()}</span>
                </h2>
                <ul className="flex flex-wrap text-[clamp(0.66rem,min(3vw,1.75svh),0.9rem)] leading-[1.45] text-white/75 landscape:flex-col">
                  {person.roles.map((role) => (
                    <li
                      key={role}
                      className="after:mx-[0.5em] after:text-white/40 after:content-['·'] last:after:content-none landscape:after:content-none"
                    >
                      {role.toUpperCase()}
                    </li>
                  ))}
                </ul>
                {person.links.length > 0 && (
                  <p className="flex flex-wrap gap-3 text-[clamp(0.66rem,min(3vw,1.75svh),0.85rem)]">
                    {person.links.map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="relative w-fit border border-white px-1.5 py-0.5 outline-none after:absolute after:-inset-2 hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black"
                      >
                        {l.label.toUpperCase()} ↗
                        <span className="sr-only">
                          {" "}
                          de {person.first} {person.last} (nouvel onglet)
                        </span>
                      </a>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>

        <p className="text-[clamp(0.66rem,min(2.9vw,1.7svh),0.85rem)] text-white/60">
          <span className="context-line">▮ {CREDITS_NOTE.toUpperCase()}</span>
        </p>
      </div>
    </main>
  );
}
