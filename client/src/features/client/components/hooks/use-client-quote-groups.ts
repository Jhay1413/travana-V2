import { useMemo } from "react";
import type { DealImage } from "@/types/quote";
import type { Transaction } from "@/types/quote";
import type { QuoteWithJoins, BookingWithJoins } from "../client-types";
import type { QuoteRowCardData } from "../tabs/QuoteRowCard";

export type GroupRowItem =
  | { type: "quote"; row: QuoteRowCardData; isChild: boolean }
  | { type: "toggle"; parentId: string; count: number; label: string };

export interface QuoteGroup {
  id: "in-play" | "won" | "lost";
  title: string;
  count: number;
  items: GroupRowItem[];
}

const PAX_LABEL = (a: number, c: number, i: number) =>
  `${a}A${c > 0 ? ` ${c}C` : ""}${i > 0 ? ` ${i}I` : ""}`;

const NET_PRICE = (sales: string | null | undefined, disc: string | null | undefined, svc: string | null | undefined) =>
  parseFloat(sales || "0") - parseFloat(disc || "0") + parseFloat(svc || "0");

const PRIMARY_IMAGE = (images: DealImage[] | undefined | null): string | null =>
  images?.find((img: DealImage) => img.isPrimary)?.image_url || images?.[0]?.image_url || null;

export function quoteToRow(q: QuoteWithJoins, fallbackStatus: string): QuoteRowCardData {
  return {
    id: q.id,
    transactionId: q.transaction_id,
    title: q.title || q.holiday_type_name || "Trip",
    isQuoteCopy: Boolean(q.isQuoteCopy),
    quoteType: (q as any).quote_type ?? null,
    destination: q.holiday_type_name || (q as any).quote_type || "—",
    travelDate: q.travel_date,
    createdAt: q.date_created ? new Date(q.date_created).toLocaleDateString("en-GB") : "—",
    createdAtRaw: q.date_created || "",
    status: q.quote_status || fallbackStatus,
    totalCost: NET_PRICE(q.sales_price, q.discounts, q.service_charge),
    pricePerPerson: parseFloat(q.price_per_person || "0"),
    imageUrl: PRIMARY_IMAGE(q.images),
    pax: PAX_LABEL(q.adult || 0, q.child || 0, q.infant || 0),
    nights: q.num_of_nights || 0,
  };
}

function bookingToRow(b: BookingWithJoins): QuoteRowCardData {
  return {
    id: b.id,
    transactionId: b.transaction_id || "",
    title: b.title || b.holiday_type_name || "Booking",
    isQuoteCopy: false,
    destination: b.holiday_type_name || "—",
    travelDate: b.travel_date,
    createdAt: b.date_created ? new Date(b.date_created).toLocaleDateString("en-GB") : "—",
    createdAtRaw: b.date_created || "",
    status: b.booking_status || "BOOKED",
    totalCost: NET_PRICE(b.sales_price, b.discounts, b.service_charge),
    pricePerPerson: 0,
    imageUrl: PRIMARY_IMAGE(b.images),
    pax: PAX_LABEL(b.adult || 0, b.child || 0, b.infant || 0),
    nights: b.num_of_nights || 0,
    haysRef: b.hays_ref,
    supplierRef: b.supplier_ref,
    isBooking: true,
  };
}

const LOST_STATUSES = ["LOST", "ARCHIVED", "INACTIVE", "EXPIRED"];
const FINAL_STATUSES = ["WON", ...LOST_STATUSES];

/**
 * Computes the In-Play / Won (Bookings) / Lost groups from raw quotes,
 * bookings, and transactions, including the "Show N copies/quotes" toggle
 * children for each main row based on the expandedCopyGroups map.
 */
export function useClientQuoteGroups(
  quotes: QuoteWithJoins[],
  bookings: BookingWithJoins[],
  transactions: Transaction[],
  expandedCopyGroups: Record<string, boolean>,
): QuoteGroup[] {
  return useMemo(() => {
    const transactionStatusMap = new Map<string, string>();
    transactions.forEach((t) => {
      if (t.id && t.status) transactionStatusMap.set(t.id, t.status);
    });

    const inPlayRows = quotes
      .filter((q) => {
        if (q.quote_status && FINAL_STATUSES.includes(q.quote_status)) return false;
        if (transactionStatusMap.get(q.transaction_id) === "on_booking") return false;
        return true;
      })
      .map((q) => quoteToRow(q, "NEW_LEAD"));

    const wonRows = bookings.map(bookingToRow);

    const lostRows = quotes
      .filter((q) => q.quote_status && LOST_STATUSES.includes(q.quote_status))
      .map((q) => quoteToRow(q, "LOST"));

    const groups: Array<{ id: QuoteGroup["id"]; title: string; rows: QuoteRowCardData[] }> = [
      { id: "in-play", title: "In Play", rows: inPlayRows },
      { id: "won", title: "Won (Bookings)", rows: wonRows },
      { id: "lost", title: "Lost", rows: lostRows },
    ];

    return groups.map((group) => {
      const sorted = [...group.rows].sort(
        (a, b) => new Date(b.createdAtRaw || 0).getTime() - new Date(a.createdAtRaw || 0).getTime(),
      );

      // In Play nests by the primary/secondary quote hierarchy (plus copies);
      // Lost keeps the copy-only nesting.
      const isChildRow = (r: QuoteRowCardData) =>
        group.id === "in-play" ? r.isQuoteCopy || r.quoteType === "secondary" : r.isQuoteCopy;

      const mainRows = sorted.filter((r) => !isChildRow(r));
      const childRows = sorted.filter(isChildRow);

      const items: GroupRowItem[] = [];

      for (const main of mainRows) {
        items.push({ type: "quote", row: main, isChild: false });

        if (group.id === "won") {
          // Show sibling quotes from the same transaction as collapsible children,
          // excluding the WON quote that was converted into this booking (it is
          // already represented by the parent booking row).
          const related = quotes
            .filter((q) => q.transaction_id === main.transactionId && q.quote_status !== "WON")
            .map((q) => ({ ...quoteToRow(q, "NEW_LEAD"), isBooking: false }));

          if (related.length > 0) {
            items.push({ type: "toggle", parentId: main.id, count: related.length, label: "quote" });
            if (expandedCopyGroups[main.id]) {
              for (const r of related) items.push({ type: "quote", row: r, isChild: true });
            }
          }
        } else {
          // In Play: nest secondary quotes/copies under their primary parent.
          // Lost: nest copies from the same transaction.
          const children = childRows.filter((c) => c.transactionId === main.transactionId);
          if (children.length > 0) {
            const label = group.id === "in-play" ? "quote" : "copy";
            items.push({ type: "toggle", parentId: main.id, count: children.length, label });
            if (expandedCopyGroups[main.id]) {
              for (const c of children) items.push({ type: "quote", row: c, isChild: true });
            }
          }
        }
      }

      // Append any orphan children (no main row in the same transaction).
      const orphans = childRows.filter(
        (c) => !mainRows.some((m) => m.transactionId === c.transactionId),
      );
      for (const o of orphans) items.push({ type: "quote", row: o, isChild: true });

      return { id: group.id, title: group.title, count: group.rows.length, items };
    });
  }, [quotes, bookings, transactions, expandedCopyGroups]);
}
