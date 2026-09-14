import type { Transaction } from "@/features/quote/types";
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

// "In Play" is derived from the primary quote's quote_status, not from
// transaction.status — see getStageForTransaction. Only Enquiry and Booked
// stages map onto a transaction status directly; drops onto Future/Lost use
// their dedicated endpoints instead of this map.
export const STAGE_TO_STATUS: Partial<Record<PipelineStage, string>> = {
  Enquiry: "on_enquiry",
  Quoted: "on_quote",
  "In Play": "on_quote",
  Booked: "on_booking",
};

export const PRIORITY_OPTIONS: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];

export const PRIORITY_META: Record<"low" | "medium" | "high", { label: string; color: string }> = {
  high: { label: "High", color: "#f59e0b" },
  medium: { label: "Medium", color: "#eab308" },
  low: { label: "Low", color: "#4caf50" },
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

/** Total customer value: sales price − discounts + service charge, summed across quotes/booking. */
export function getTransactionValue(t: Transaction): number {
  if (t.quotes?.length) {
    return t.quotes.reduce((s, q) => {
      return s + (parseFloat(q.sales_price || "0") || 0) - (parseFloat(q.discounts || "0") || 0) + (parseFloat(q.service_charge || "0") || 0);
    }, 0);
  }
  if (t.booking) {
    return (parseFloat(t.booking.sales_price || "0") || 0) - (parseFloat(t.booking.discounts || "0") || 0) + (parseFloat(t.booking.service_charge || "0") || 0);
  }
  return 0;
}

export function getTransactionProfit(t: Transaction): number {
  if (t.quotes?.length) {
    return t.quotes.reduce((s, q) => {
      const pkg = parseFloat((q as unknown as { package_commission?: string }).package_commission || "0") || 0;
      const svc = parseFloat((q as unknown as { service_commission?: string }).service_commission || "0") || 0;
      return s + pkg + svc;
    }, 0);
  }
  if (t.booking) {
    return parseFloat(t.booking.package_commission || "0") || 0;
  }
  return 0;
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

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Formats a task due date as "Today 15:15" / "Tomorrow 15:15" / "Mon 14 Sep 09:30", or "No date". */
export function formatDueDateTime(due: string | null | undefined, now: Date = new Date()): string {
  if (!due) return "No date";
  const d = new Date(due);
  if (isNaN(d.getTime())) return "No date";

  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  if (isSameCalendarDay(d, now)) return `Today ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameCalendarDay(d, tomorrow)) return `Tomorrow ${time}`;

  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.getDate();
  // Slice to 3 letters — some ICU versions render "short" September as "Sept".
  const month = d.toLocaleDateString("en-GB", { month: "short" }).slice(0, 3);
  return `${weekday} ${day} ${month} ${time}`;
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
