import type { Transaction } from "@/features/quote/types";
import { mainQuoteOf } from "./main-quote";

export type DealTargetType = "enquiry" | "quote" | "booking";

/** The single entity a deal card represents (and pins / opens). */
export interface DealTarget {
  type: DealTargetType;
  id: string;
  title: string | null;
}

/**
 * Which entity a transaction's card represents when the caller doesn't say.
 * Derived from the transaction status — the same rule the server uses to match
 * `favorites` rows when ordering pipeline columns (transaction.repository.ts
 * buildPinnedAtExpr), so client pin state and server ordering always agree.
 */
export function dealFocusOf(t: Pick<Transaction, "status">): DealTargetType {
  if (t.status === "on_enquiry") return "enquiry";
  if (t.status === "on_booking") return "booking";
  return "quote";
}

/**
 * Resolves a transaction card to its pin/open target. `focus` is the entity the
 * surface is showing (e.g. a tab); omitted, it is derived from the status. Falls
 * back to the main quote when the focused entity is missing.
 */
export function resolveDealTarget(t: Transaction, focus: DealTargetType = dealFocusOf(t)): DealTarget | null {
  if (focus === "enquiry" && t.enquiry) return { type: "enquiry", id: t.enquiry.id, title: t.enquiry.title ?? null };
  if (focus === "booking" && t.booking) return { type: "booking", id: t.booking.id, title: t.booking.title ?? null };
  const q = mainQuoteOf(t);
  if (q) return { type: "quote", id: q.id, title: q.title ?? null };
  return null;
}

/**
 * Whether the viewing user has pinned this deal. Once the favourites list has
 * loaded it is authoritative (it updates optimistically on toggle); before that
 * the server's per-deal `pinned` flag stands in.
 */
export function isDealPinned(t: Transaction, pinnedKeys: ReadonlySet<string>, favoritesLoaded: boolean, target: DealTarget | null = resolveDealTarget(t)): boolean {
  if (favoritesLoaded) return target !== null && pinnedKeys.has(`${target.type}:${target.id}`);
  return t.pinned === true;
}
