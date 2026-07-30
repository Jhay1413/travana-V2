import { and, ilike, or, sql, type SQL } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";

// Name matcher shared by the global header search and the client list/search
// endpoint, so the two can never disagree about what "John Smith" finds.
//
// Multi-word queries AND each word against the CONCATENATED full name. Two
// properties matter:
//   • order-independent — "smith john" finds "John Smith";
//   • middle names survive — "john smith" finds "John Paul" + "Smith".
// A single ILIKE on the whole query ("%john smith%") fails both of those.
//
// It also keeps results TIGHT, which is the real bug it fixes: OR-ing each word
// across firstName and surename separately returns every John plus every Smith,
// so on a paged endpoint the one client actually named John Smith can fall off
// the first page entirely and look missing.
//
// Single-word queries stay a loose OR across both columns — searching "smith"
// should find them whether it's their first or last name.
export function clientNameCondition(
  firstNameColumn: AnyColumn,
  surnameColumn: AnyColumn,
  query: string | null | undefined,
): SQL | undefined {
  const term = (query ?? "").trim();
  if (!term) return undefined;

  const words = term.split(/\s+/).filter(Boolean);
  const fullName = sql`concat_ws(' ', ${firstNameColumn}, ${surnameColumn})`;

  if (words.length > 1) {
    return and(...words.map((w) => sql`${fullName} ILIKE ${`%${w}%`}`));
  }
  return or(ilike(firstNameColumn, `%${term}%`), ilike(surnameColumn, `%${term}%`));
}
