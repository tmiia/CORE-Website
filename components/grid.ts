/**
 * The editorial grid (project page, index card). Phone: 4 columns, paragraphs
 * alternate full width / indented by one. Desktop: 12 columns and only two
 * alignments: column 1 (title bars, key lines, dates) and column 4 (text,
 * values, links), labels in columns 1–3, as the genre page's lists.
 */
export const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-8";
export const GRID = "grid grid-cols-4 gap-x-3 lg:grid-cols-12 lg:gap-x-6";

/** Reading text (Anonymous Pro). */
export const BODY = "font-anonymous text-[clamp(1.05rem,4.4vw,1.25rem)] normal-case leading-[1.7] tracking-normal";

/** Labels: columns 1–3 on desktop. */
export const RAIL = "lg:col-span-3";
/** Everything else: columns 4–12 on desktop. */
export const MAIN = "lg:col-start-4 lg:col-span-9";

/** Phone: full width, then indented, alternately. Desktop: column 4, with a
 * reading measure for paragraphs. */
export const alternate = (i: number) => (i % 2 ? "col-start-2 col-span-3" : "col-span-4");
export const paragraphCols = (i: number) => `${alternate(i)} ${MAIN} lg:max-w-[62ch]`;
