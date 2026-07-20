import { sql, type SQL } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";

// Digits-normalized phone matcher for search clauses: strips every non-digit
// from BOTH the stored number and the query, so "07968215588" finds a client
// stored as "07968 215588" (and vice versa). Plain ILIKE on the raw column
// misses any formatting difference — which also makes the UI disagree with
// the webhook onboarding matcher (identity.service/findMatches), which
// already compares digits-only.
//
// Returns null when the query contains fewer than 5 digits — a short digit
// run ("1", "07") would otherwise match practically every phone number and
// swamp name/email results.
export function phoneDigitsCondition(column: AnyColumn, query: string | null | undefined): SQL | null {
  const digits = (query ?? "").replace(/\D/g, "");
  if (digits.length < 5) return null;
  return sql`regexp_replace(COALESCE(${column}, ''), '[^0-9]', '', 'g') LIKE ${`%${digits}%`}`;
}
