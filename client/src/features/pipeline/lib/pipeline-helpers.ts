import type { Transaction } from "@/features/quote/types";
import { formatDueDateTime } from "@/lib/task-due-format";
import type { PipelineColumnStatus } from "@/features/transaction/api/use-transaction-queries";

/** Pipeline board columns. "Enquiry" / "Quoted" / "In Play" / "Booked" are the
 *  main stages driven by transaction/quote status; "Future" and "Lost" are
 *  parked deals surfaced by their own endpoints. */
export type PipelineStage = "Enquiry" | "Quoted" | "In Play" | "Booked" | "Future" | "Lost";

export const ALL_STAGES: PipelineStage[] = ["Enquiry", "Quoted", "In Play", "Booked", "Future", "Lost"];

/** Shape of a single page returned by `GET /pipeline/:status`. */
export interface PipelinePage {
  items: Transaction[];
  total: number;
  page: number;
  hasMore: boolean;
  totalProfit: number;
  totalValue: number;
}

/** Column stages that start collapsed on first visit (before any localStorage override). */
export const DEFAULT_COLLAPSED_STAGES: PipelineStage[] = ["Future", "Lost"];

/** Maps a board column to the `GET /pipeline/:status` status segment. */
export const STAGE_STATUS: Record<PipelineStage, PipelineColumnStatus> = {
  Enquiry: "enquiry",
  Quoted: "quote",
  "In Play": "in_play",
  Booked: "booking",
  Future: "future",
  Lost: "lost",
};

/** Column header labels, per the design mock. */
export const STAGE_LABEL: Record<PipelineStage, string> = {
  Enquiry: "Enquiries",
  Quoted: "Quotes",
  "In Play": "In-Play",
  Booked: "Booked",
  Future: "Future Deals",
  Lost: "Lost Deals",
};

export const PRIORITY_OPTIONS: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];

/** Priority label plus its dot colour (design tokens, so dark mode follows). */
export const PRIORITY_META: Record<"low" | "medium" | "high", { label: string; color: string; dotClass: string }> = {
  high: { label: "High", color: "hsl(var(--priority-high))", dotClass: "bg-priority-high" },
  medium: { label: "Medium", color: "hsl(var(--priority-medium))", dotClass: "bg-priority-medium" },
  low: { label: "Low", color: "hsl(var(--priority-low))", dotClass: "bg-priority-low" },
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "No date";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const num = (raw: string | number | null | undefined): number => {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  return parseFloat(raw || "0") || 0;
};

type WithServiceCommission = { package_commission?: string | number | null; service_commission?: string | number | null };

/** Customer total of one quote/booking row: sales price − discounts + service charge. */
function rowValue(r: { sales_price?: string | null; discounts?: string | null; service_charge?: string | null }): number {
  return num(r.sales_price) - num(r.discounts) + num(r.service_charge);
}

/** Commission of one quote/booking row: package commission + line-item service commission. */
function rowProfit(r: object): number {
  const c = r as WithServiceCommission;
  return num(c.package_commission) + num(c.service_commission);
}

/** Total customer value: sales price − discounts + service charge. Stage-aware to
 *  match the server's column totals: bookings read the booking row, quoted deals
 *  sum their quotes, enquiries have no value. */
export function getTransactionValue(t: Transaction): number {
  if (t.status === "on_booking") return t.booking ? rowValue(t.booking) : 0;
  if (t.status === "on_quote") return (t.quotes ?? []).reduce((s, q) => s + rowValue(q), 0);
  return 0;
}

/** Package commission + line-item service commission, stage-aware like the value. */
export function getTransactionProfit(t: Transaction): number {
  if (t.status === "on_booking") return t.booking ? rowProfit(t.booking) : 0;
  if (t.status === "on_quote") return (t.quotes ?? []).reduce((s, q) => s + rowProfit(q), 0);
  return 0;
}

/** Whether the deal has a quote or booking to show money for. */
export function hasQuoteOrBooking(t: Transaction): boolean {
  return t.status === "on_booking" ? !!t.booking : !!t.quotes?.length;
}

/** Joined client phone (pipeline endpoints only). */
export function getClientPhone(t: Transaction): string | null {
  const phone = (t as Transaction & { client_phone?: string | null }).client_phone;
  return phone && phone !== "NULL" ? phone : null;
}

/** Enquiry-stage cards show the enquiry's budget rather than a computed value. */
export function getEnquiryBudget(t: Transaction): number | null {
  const raw = t.enquiry?.budget;
  if (!raw) return null;
  const val = parseFloat(raw);
  return isNaN(val) ? null : val;
}

export function getTransactionTitle(t: Transaction): string {
  return t.enquiry?.title || t.quotes?.[0]?.title || t.booking?.title || `#${t.id.slice(0, 8)}`;
}

export function getTransactionDate(t: Transaction): string | null {
  return t.enquiry?.travel_date || t.quotes?.[0]?.travel_date || t.booking?.travel_date || t.created_at;
}

export function getDestinationName(t: Transaction): string | null {
  return t.quotes?.[0]?.destination_name || t.booking?.destination_name || t.enquiry?.destination_name || null;
}

export function getTourOperator(t: Transaction): { name: string | null; logoUrl: string | null } {
  const q = t.quotes?.[0];
  return {
    name: q?.main_tour_operator_name || t.booking?.main_tour_operator_name || null,
    logoUrl: q?.main_tour_operator_logo_url || t.booking?.main_tour_operator_logo_url || null,
  };
}

export function getAssigneeName(t: Transaction): string {
  const u = t.assignedUser;
  if (!u) return "Unassigned";
  return u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unassigned";
}

export function getTimeAgo(d: string | null | undefined): string {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Whether dropping a card dragged from `from` onto the `to` column is a
 *  transition the server actually supports. Bookings can't be marked lost,
 *  and a lost deal can only be restored into Enquiry/Quoted/In Play/Future —
 *  restoring straight into Booked (or any other combination) isn't
 *  supported, so those drops shouldn't even highlight as valid targets. */
export function isValidDrop(from: PipelineStage, to: PipelineStage): boolean {
  if (from === to) return false;
  if (from === "Booked" && to === "Lost") return false;
  if (from === "Lost" && to !== "Enquiry" && to !== "Quoted" && to !== "In Play" && to !== "Future") return false;
  // Deals only move forward: no way back to Enquiry, and a booking stays booked.
  if (to === "Enquiry" && (from === "Quoted" || from === "In Play" || from === "Booked")) return false;
  if (from === "Booked" && (to === "Quoted" || to === "In Play")) return false;
  // A booking needs a quote first.
  if (from === "Enquiry" && to === "Booked") return false;
  return true;
}

/** Derives the board stage for a transaction returned by a column endpoint
 *  other than "future"/"lost" (those columns carry their own explicit stage). */
export function getStageForTransaction(t: Transaction): PipelineStage {
  if (t.status === "on_enquiry") return "Enquiry";
  if (t.status === "on_quote") {
    const primary =
      t.quote_variants?.find((v) => v.isQuoteCopy === false) ??
      (t.quote_variants?.[0] ?? null);
    if (primary?.quote_status === "in_play") return "In Play";
    return "Quoted";
  }
  if (t.status === "on_booking") return "Booked";
  return "Enquiry";
}

/** Deep link into the client page's holiday detail view for a given card/stage. */
export function getTransactionNavUrl(t: Transaction, stage: PipelineStage): string {
  if (!t.client_id) return "/pipeline";
  if (stage === "Enquiry" && t.enquiry) return `/clients/${t.client_id}?holiday=enquiry:${t.enquiry.id}`;
  if ((stage === "Quoted" || stage === "In Play") && t.quotes?.length) {
    const main = t.quotes.find((q) => !q.isQuoteCopy) || t.quotes[0];
    return `/clients/${t.client_id}?holiday=quote:${main.id}`;
  }
  if (stage === "Booked" && t.booking) return `/clients/${t.client_id}?holiday=booking:${t.booking.id}`;
  // Future / Lost cards keep whichever underlying entity the deal has.
  if (t.booking) return `/clients/${t.client_id}?holiday=booking:${t.booking.id}`;
  if (t.quotes?.length) {
    const main = t.quotes.find((q) => !q.isQuoteCopy) || t.quotes[0];
    return `/clients/${t.client_id}?holiday=quote:${main.id}`;
  }
  if (t.enquiry) return `/clients/${t.client_id}?holiday=enquiry:${t.enquiry.id}`;
  return `/clients/${t.client_id}`;
}

/** Formats the "no activity" line for a deal with no next task, from last_activity_at. */
export function formatNoActivityLabel(lastActivityAt: string | null | undefined, now: Date = new Date()): string {
  if (!lastActivityAt) return "No activity";
  const d = new Date(lastActivityAt);
  if (isNaN(d.getTime())) return "No activity";
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return "No activity today";
  if (days === 1) return "No activity for 1 day";
  return `No activity for ${days} days`;
}

export { formatDueDateTime };
