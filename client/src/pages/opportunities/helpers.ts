export const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

export function formatStatus(s: string): string {
  if (s === "all") return "All Statuses";
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bIn\b/, "in");
}

export function statusBadgeClass(s: string): string {
  switch (s) {
    case "QUOTE_IN_PROGRESS": return "bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20";
    case "NEW_LEAD":          return "bg-violet-500/10 text-violet-600 border-violet-500/20";
    case "QUOTE_CALL":        return "bg-sky-500/10 text-sky-600 border-sky-500/20";
    case "QUOTE_READY":       return "bg-teal-500/10 text-teal-600 border-teal-500/20";
    case "AWAITING_DECISION": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "REQUOTE":           return "bg-orange-500/10 text-orange-600 border-orange-500/20";
    case "WON":
    case "BOOKED":            return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "LOST":              return "bg-red-500/10 text-red-600 border-red-500/20";
    case "ARCHIVED":
    case "INACTIVE":
    case "EXPIRED":           return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    case "ACTIVE":            return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    default:                  return "";
  }
}
