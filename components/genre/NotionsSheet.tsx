import type { ReactNode } from "react";
import { alternate, BODY, GRID, MAIN, paragraphCols, RAIL } from "@/components/grid";
import SectionTitle from "./SectionTitle";

export interface SheetRow {
  label: string;
  value: string;
}

/** "Juan Atkins - Kevin Saunderson - Derrick May" → one name per line. Commas
 * are left alone (they are often inside a sentence). */
const splitList = (value: string) =>
  value
    .split(/\s+[-–·]\s+|\n/)
    .map((s) => s.trim())
    .filter(Boolean);

// Desktop, "stagger" (genre page): values alternate between two column starts.
// "column" (project page): they all start on column 4, as the page's text.
// Phone: they alternate either way.
const STAGGER = ["col-span-4 lg:col-start-4 lg:col-span-8", "col-start-2 col-span-3 lg:col-start-5 lg:col-span-8"];

/**
 * An index card: an opaque black sheet that slides over the previous section
 * (wrapped in StickyUnder), at least one screen tall so it covers it entirely.
 * Optional key line and intro paragraphs, then labels on the left, values
 * large, dotted rules between rows (the installation's separator). Genre page:
 * NOTIONS CLÉS; project page: the installation and its label (cartel).
 */
export default function NotionsSheet({
  index,
  label = "NOTIONS CLÉS",
  heading,
  intro = [],
  rows,
  align = "stagger",
}: {
  index: string;
  label?: string;
  heading?: ReactNode;
  intro?: string[];
  rows: SheetRow[];
  align?: "stagger" | "column";
}) {
  const valueCols = (i: number) => (align === "column" ? `${alternate(i)} ${MAIN}` : STAGGER[i % 2]);
  return (
    <section className="relative z-10 flex min-h-svh flex-col border-t border-white bg-black shadow-[0_-28px_56px_rgba(0,0,0,0.85)]">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10 pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] sm:px-8 sm:pt-24">
        <SectionTitle index={index} label={label} />
        {heading}
        {intro.length > 0 && (
          <div className={`${GRID} mt-10 gap-y-6 lg:mt-14`}>
            {intro.map((text, i) => (
              <p key={i} className={`${paragraphCols(i)} ${BODY}`}>
                {text}
              </p>
            ))}
          </div>
        )}
        <dl className={`${GRID} ${intro.length > 0 ? "mt-10 lg:mt-14" : "mt-8"} border-b-2 border-dotted border-white/50`}>
          {rows.map((row, i) => {
            const items = splitList(row.value);
            // Names and short values large; sentences a size down.
            const size =
              items.length > 1 || row.value.length <= 28
                ? "text-[clamp(1.25rem,6vw,2.4rem)] leading-[1.1]"
                : "text-[clamp(1.05rem,4.6vw,1.6rem)] leading-[1.25]";
            return (
              <div
                key={`${row.label}-${i}`}
                className="col-span-4 grid grid-cols-subgrid gap-y-2 border-t-2 border-dotted border-white/50 py-5 lg:col-span-12 lg:py-7"
              >
                <dt className={`col-span-4 text-[0.78rem] text-white/60 ${RAIL} lg:pt-1.5`}>{row.label.toUpperCase()}</dt>
                <dd className={`${valueCols(i)} flex flex-col ${size}`}>
                  {items.length > 1
                    ? items.map((item) => <span key={item}>{item.toUpperCase()}</span>)
                    : row.value.toUpperCase()}
                </dd>
              </div>
            );
          })}
        </dl>
        {/* The sheet is a screen tall (it must cover the context): its blank
            end is ruled, like an index card. */}
        <div aria-hidden="true" className="sheet-lines min-h-14 flex-1" />
      </div>
    </section>
  );
}
