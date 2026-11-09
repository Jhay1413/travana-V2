// Side-menu sections of the booking form per holiday type. Reuses the quote form rules and adds the
// booking-only sections (references, upsells, wallet credit). Pure so it can be unit tested.
import {
  quoteSectionsFor,
  sectionsDone,
  type QuoteHolidayKind,
  type QuoteSectionInputs,
  type QuoteSectionKey,
} from "@/features/quote/lib/quote-form-sections";

export { holidayKindFromName } from "@/features/quote/lib/quote-form-sections";
export type { QuoteHolidayKind as BookingHolidayKind } from "@/features/quote/lib/quote-form-sections";

export type BookingSectionKey = QuoteSectionKey | "references" | "upsells" | "wallet";

export interface BookingSectionDef {
  key: BookingSectionKey;
  label: string;
  /** Optional sections are not counted in "N of M" and tick when they have content. */
  optional?: boolean;
}

export interface BookingSectionInputs extends QuoteSectionInputs {
  haysRef?: string | null;
  supplierRef?: string | null;
  upsellCount: number;
  walletCreditAmount?: number | string | null;
}

const REFERENCES: BookingSectionDef = { key: "references", label: "References" };
const UPSELLS: BookingSectionDef = { key: "upsells", label: "Upsells", optional: true };
const WALLET: BookingSectionDef = { key: "wallet", label: "Wallet credit", optional: true };

/**
 * Sections shown for a holiday type, in page order. Cruise-only bookings have no flights; the
 * wallet credit section only exists when the booking belongs to a client.
 */
export function bookingSectionsFor(
  kind: QuoteHolidayKind,
  opts: { cruiseOnly?: boolean; hasClient?: boolean } = {},
): BookingSectionDef[] {
  const out: BookingSectionDef[] = [REFERENCES];
  for (const s of quoteSectionsFor(kind, { cruiseOnly: opts.cruiseOnly })) {
    out.push(s);
    if (s.key === "extras") out.push(UPSELLS);
    if (s.key === "costings" && opts.hasClient) out.push(WALLET);
  }
  return out;
}

const filled = (v: string | null | undefined): boolean => typeof v === "string" && v.trim() !== "";

/** Whether each section has what it needs. */
export function bookingSectionsDone(i: BookingSectionInputs): Record<BookingSectionKey, boolean> {
  return {
    ...sectionsDone(i),
    references: filled(i.haysRef) && filled(i.supplierRef),
    upsells: i.upsellCount > 0,
    wallet: Number(i.walletCreditAmount) > 0,
  };
}

/** The visible sections with their done flag, ready for the side menu and countDone. */
export function bookingSectionState(
  kind: QuoteHolidayKind,
  opts: { cruiseOnly?: boolean; hasClient?: boolean },
  inputs: BookingSectionInputs,
): Array<BookingSectionDef & { done: boolean }> {
  const done = bookingSectionsDone(inputs);
  return bookingSectionsFor(kind, opts).map((s) => ({ ...s, done: done[s.key] }));
}
