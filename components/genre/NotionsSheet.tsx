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

// Values alternate between two column starts, so the card isn't one flush column.
const VALUE_COLS = [
  "col-span-4 lg:col-start-4 lg:col-span-8",
  "col-start-2 col-span-3 lg:col-start-5 lg:col-span-8",
];

/**
 * An index card: an opaque black sheet that slides over the previous section
 * (wrapped in StickyUnder), at least one screen tall so it covers it entirely.
 * Optional intro paragraphs, then labels on the left, values large, dotted
 * rules between rows (the installation's separator). Genre page: NOTIONS CLÉS;
 * project page: the work's label (cartel).
 */
export default function NotionsSheet({
  index,
  label = "NOTIONS CLÉS",
  intro = [],
  rows,
}: {
  index: string;
  label?: string;
  intro?: string[];
  rows: SheetRow[];
}) {
  return (
    <section className="relative z-10 flex min-h-svh flex-col border-t border-white bg-black shadow-[0_-28px_56px_rgba(0,0,0,0.85)]">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10 pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] sm:px-8 sm:pt-24">
        <SectionTitle index={index} label={label} />
        {intro.length > 0 && (
          <div className="mt-8 grid grid-cols-4 gap-x-3 gap-y-5 font-anonymous text-[clamp(1rem,4.2vw,1.15rem)] normal-case leading-[1.7] tracking-normal text-white/90 lg:grid-cols-12 lg:gap-x-6">
            {intro.map((text, i) => (
              <p key={i} className={`${i % 2 ? "col-start-2 col-span-3 lg:col-start-6" : "col-span-4 lg:col-start-4"} lg:col-span-6`}>
                {text}
              </p>
            ))}
          </div>
        )}
        <dl className="mt-8 grid grid-cols-4 gap-x-3 border-b-2 border-dotted border-white/50 lg:grid-cols-12 lg:gap-x-6">
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
                <dt className="col-span-4 text-[0.78rem] text-white/60 lg:col-span-3 lg:pt-1.5">
                  {row.label.toUpperCase()}
                </dt>
                <dd className={`${VALUE_COLS[i % 2]} flex flex-col ${size}`}>
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
