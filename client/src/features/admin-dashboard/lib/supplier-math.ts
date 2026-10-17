import type { TourOperatorBreakdownRow } from "@/features/organization/api/organization-overview.api";

export type SupplierMeasure = "commission" | "bookings";

export const SUPPLIER_LIMIT = 10;

/** Top suppliers by the chosen measure; bookings ties are broken by commission. */
export function rankSuppliers(rows: TourOperatorBreakdownRow[], by: SupplierMeasure, limit = SUPPLIER_LIMIT): TourOperatorBreakdownRow[] {
  const sorted =
    by === "commission"
      ? [...rows].sort((a, b) => b.commission - a.commission || b.bookings - a.bookings)
      : [...rows].sort((a, b) => b.bookings - a.bookings || b.commission - a.commission);
  return sorted.slice(0, limit);
}

/** "Jet2holidays" -> "JE", "EasyJet Holidays" -> "EH". */
export function supplierInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function supplierBarWidth(value: number, top: number): number {
  return top > 0 ? Math.min(100, Math.max(0, (value / top) * 100)) : 0;
}
