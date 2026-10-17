import type { Transaction } from "@/features/quote/types";
import { isSameLondonDay } from "@/lib/london-day";
import { formatCurrency, getDestinationName, getEnquiryBudget, type PipelineStage } from "./pipeline-helpers";

function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const month = d.toLocaleDateString("en-GB", { month: "short" }).slice(0, 3);
  return `${d.getDate()} ${month} ${d.getFullYear()}`;
}

function getNights(t: Transaction): number | null {
  const n = t.quotes?.[0]?.num_of_nights ?? t.booking?.num_of_nights ?? t.enquiry?.no_of_nights ?? null;
  const parsed = typeof n === "string" ? parseInt(n, 10) : n;
  return typeof parsed === "number" && parsed > 0 ? parsed : null;
}

/** The muted line under a deal title: "Destination · 12 Mar 2026 · 7 nights",
 *  plus the budget on enquiries. Falls back to "Dates not set". */
export function buildDealMeta(t: Transaction, stage: PipelineStage): string {
  const parts: string[] = [];
  const destination = getDestinationName(t);
  if (destination) parts.push(destination);
  const date = shortDate(t.enquiry?.travel_date || t.quotes?.[0]?.travel_date || t.booking?.travel_date || null);
  if (date) parts.push(date);
  const nights = getNights(t);
  if (nights) parts.push(`${nights} ${nights === 1 ? "night" : "nights"}`);
  if (stage === "Enquiry") {
    const budget = getEnquiryBudget(t);
    if (budget !== null) parts.push(`Budget ${formatCurrency(budget)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Dates not set";
}

/** Whether an ISO due date falls on the same Europe/London calendar day as `now`. */
export function isDueToday(due: string | null | undefined, now: Date = new Date()): boolean {
  if (!due) return false;
  const d = new Date(due);
  return !Number.isNaN(d.getTime()) && isSameLondonDay(d, now);
}
