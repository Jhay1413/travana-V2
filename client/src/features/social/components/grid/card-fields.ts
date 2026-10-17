import { format } from "date-fns";
import type { EnrichedQuote } from "@/features/quote/types";
import {
  formatDate,
  formatPrice,
  getBoardBasis,
  getCruise,
  getDepartingAirport,
  isCruiseQuote,
  isLodgeQuote,
  pricePerPersonLabel,
} from "@/features/social/lib/quote-card-fields";
import { time12 } from "@/features/social/lib/schedule-time";
import type { SocialPostStatus } from "@/features/social/lib/post-status";

export interface CardField {
  label: string;
  value: string;
}

const text = (value: string | number | null | undefined): string =>
  value === null || value === undefined || value === "" ? "—" : String(value);

/** The four key-value cells on a card, depending on the kind of quote. */
export function getCardFields(q: EnrichedQuote): CardField[] {
  if (isCruiseQuote(q)) {
    const cruise = getCruise(q);
    return [
      { label: "Cruise line", value: text(cruise?.cruise_line) },
      { label: "Ship", value: text(cruise?.ship) },
      { label: "Nights", value: text(q.num_of_nights) },
      { label: "Departure date", value: formatDate(cruise?.cruise_date) },
    ];
  }
  if (isLodgeQuote(q)) {
    return [
      { label: "Park", value: text(q.park_name) },
      { label: "Lodge", value: text(q.lodge_name || q.lodge_type) },
      { label: "Nights", value: text(q.num_of_nights) },
      { label: "Check-in", value: formatDate(q.travel_date) },
    ];
  }
  return [
    { label: "Departing", value: getDepartingAirport(q) },
    { label: "Nights", value: text(q.num_of_nights) },
    { label: "Board", value: getBoardBasis(q) },
    { label: "Travel date", value: formatDate(q.travel_date) },
  ];
}

/** Price pill text: per-person price, else the formatted sales price. */
export function cardPriceLabel(q: EnrichedQuote): string {
  const perPerson = pricePerPersonLabel(q);
  return perPerson !== "—" ? perPerson : formatPrice(q.sales_price);
}

/** "Tue 21 Oct · 9:00 AM" in the browser's timezone, or "" for a missing/invalid value. */
export function whenLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${format(d, "EEE d MMM")} · ${time12(hm)}`;
}

/** Body copy of the delete confirmation, by post status. */
export function deleteCopy(status: SocialPostStatus, postSchedule: string | null | undefined): string {
  if (status === "posted") return "This only removes it from Travana. The live post stays up.";
  if (status === "scheduled") {
    const iso = postSchedule ? new Date(postSchedule) : null;
    if (iso && !Number.isNaN(iso.getTime())) {
      const hm = `${String(iso.getHours()).padStart(2, "0")}:${String(iso.getMinutes()).padStart(2, "0")}`;
      return `It is set for ${format(iso, "EEE d MMM")} at ${time12(hm)} and will not go out.`;
    }
    return "It is scheduled and will not go out.";
  }
  if (status === "not_generated") return "This removes the social quote for good.";
  return "The draft is removed for good.";
}
