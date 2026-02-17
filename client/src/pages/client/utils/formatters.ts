import type { ClientTier, Stage, QuotePassenger } from "./types";

export const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export function tierPill(tier: ClientTier): string {
  switch (tier) {
    case "Platinum":
      return "border-violet-500/25 bg-violet-500/10 text-violet-700";
    case "Gold":
      return "border-amber-500/25 bg-amber-500/10 text-amber-800";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

export function stagePill(stage: Stage): string {
  switch (stage) {
    case "Booked":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-800";
    case "Quote":
      return "border-sky-500/25 bg-sky-500/10 text-sky-800";
    default:
      return "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-800";
  }
}

export function ticketStatusPill(status: string): string {
  switch (status) {
    case "Open":
      return "border-red-500/25 bg-red-500/10 text-red-700";
    case "In Progress":
      return "border-amber-500/25 bg-amber-500/10 text-amber-700";
    case "Resolved":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
    case "Closed":
      return "border-black/10 bg-black/[0.03] text-black/70";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

export function ticketTypePill(type: string): string {
  switch (type) {
    case "Query":
      return "border-blue-500/25 bg-blue-500/10 text-blue-700";
    case "Issue":
      return "border-red-500/25 bg-red-500/10 text-red-700";
    case "Complaint":
      return "border-red-600/25 bg-red-600/10 text-red-800";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

export function formatTicketDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatPax(p: QuotePassenger): string {
  const parts = [];
  if (p.adults) parts.push(`${p.adults}A`);
  if (p.children) parts.push(`${p.children}C`);
  if (p.infants) parts.push(`${p.infants}I`);
  return parts.join(" + ");
}

export function computePaxTotal(p: QuotePassenger): number {
  return (p.adults || 0) + (p.children || 0) + (p.infants || 0);
}

export function formatUKDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function safeJsonParse(value: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    const data = JSON.parse(value);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
