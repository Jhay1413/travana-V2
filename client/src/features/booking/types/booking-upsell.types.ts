import { z } from "zod";
import { Hotel, ArrowLeftRight, Coffee, ParkingSquare, Receipt, PackagePlus } from "lucide-react";
import type { UpsellItemValue } from "./booking-form.types";

// ─── Upsell types ─────────────────────────────────────────────────────────────
// An upsell is an extra line item added to a booking AFTER it was created.
// Its commission is recognised in the month it was added (`addedAt`), not the
// booking's creation/travel month. Kept deliberately generic so one mechanism
// covers many upsell kinds. The form schema/shape lives in booking-form.types.ts
// (the `upsells` array) so it travels with the rest of the booking form.

export const UPSELL_TYPES = [
  "EXTRA_NIGHTS",
  "TRANSFER",
  "LOUNGE",
  "PARKING",
  "FEE",
  "OTHER",
] as const;

export type UpsellType = (typeof UPSELL_TYPES)[number];

export const UPSELL_TYPE_OPTIONS: {
  value: UpsellType;
  label: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { value: "EXTRA_NIGHTS", label: "Extra Nights", icon: Hotel, color: "text-blue-600" },
  { value: "TRANSFER", label: "Transfer", icon: ArrowLeftRight, color: "text-sky-600" },
  { value: "LOUNGE", label: "Lounge Pass", icon: Coffee, color: "text-rose-600" },
  { value: "PARKING", label: "Airport Parking", icon: ParkingSquare, color: "text-emerald-600" },
  { value: "FEE", label: "Fee / Amendment", icon: Receipt, color: "text-amber-600" },
  { value: "OTHER", label: "Other", icon: PackagePlus, color: "text-purple-600" },
];

export function upsellTypeMeta(type: UpsellType) {
  return UPSELL_TYPE_OPTIONS.find((o) => o.value === type) ?? UPSELL_TYPE_OPTIONS[UPSELL_TYPE_OPTIONS.length - 1];
}

/** Default values for a freshly-appended upsell row in the booking form. */
export function emptyUpsellItem(): UpsellItemValue {
  return {
    upsellType: "EXTRA_NIGHTS",
    description: "",
    quantity: 1,
    cost: 0,
    commission: 0,
    tourOperatorId: "",
  };
}

// ─── API contract (single source of truth, shared client ⇄ server) ────────────
// The wire shape is snake_case (`booking_upsell`-style). Numerics travel as
// strings to match Drizzle's `numeric` columns and the existing booking line
// items. This schema validates create/update bodies; the Phase 3 backend
// validator mirrors it.

export const upsellPayloadSchema = z.object({
  upsell_type: z.enum(UPSELL_TYPES),
  description: z.string().nullable().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  cost: z.union([z.string(), z.number()]),
  commission: z.union([z.string(), z.number()]),
  tour_operator_id: z.string().uuid().nullable().optional(),
});

/** Request body for create/update upsell endpoints. */
export type UpsellPayload = z.infer<typeof upsellPayloadSchema>;

/** A persisted upsell row as returned by the upsell endpoints. */
export interface UpsellRecord {
  id: string;
  booking_id: string;
  upsell_type: UpsellType;
  description: string | null;
  quantity: number;
  cost: string;
  commission: string;
  sales_price?: string | null;
  added_at: string;
  added_by?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// ─── Mapping helpers (form ⇄ API) ─────────────────────────────────────────────
// Shared so the in-form Upsells section and the dedicated Upsells dialog hydrate
// and persist upsells identically. The API shape is snake_case
// (`booking_upsell`-style); the form shape is the camelCase `UpsellItemValue`.

function isUpsellType(v: unknown): v is UpsellType {
  return typeof v === "string" && (UPSELL_TYPES as readonly string[]).includes(v);
}

/** Map a single raw upsell record (API row) into a form row. */
export function upsellToFormValue(raw: any): UpsellItemValue {
  const rawType = raw?.upsell_type ?? raw?.upsellType;
  return {
    id: raw?.id ?? undefined,
    upsellType: isUpsellType(rawType) ? rawType : "OTHER",
    description: raw?.description ?? "",
    quantity: Number(raw?.quantity ?? 1) || 1,
    cost: parseFloat(String(raw?.cost ?? 0)) || 0,
    commission: parseFloat(String(raw?.commission ?? 0)) || 0,
    tourOperatorId: raw?.tour_operator_id ?? raw?.tourOperatorId ?? "",
  };
}

/** Map a booking's raw upsells array into form rows (defensive: missing → []). */
export function upsellsToFormValues(raw: unknown): UpsellItemValue[] {
  return Array.isArray(raw) ? raw.map(upsellToFormValue) : [];
}

// ─── Aggregation ──────────────────────────────────────────────────────────────
// Totals folded into the booking's costings/total price. The sale amount prefers
// the explicit `sales_price` and falls back to `cost`; commission is summed flat
// to match the server's SUM(commission) recognition.

const toNum = (v: unknown) => parseFloat(String(v ?? 0)) || 0;

/** Sum active upsells into a customer-facing price and a commission total. */
export function sumUpsells(upsells: UpsellRecord[] | undefined): {
  price: number;
  commission: number;
} {
  const rows = Array.isArray(upsells) ? upsells : [];
  return rows.reduce(
    (acc, u) => {
      const sale = toNum(u.sales_price);
      acc.price += sale > 0 ? sale : toNum(u.cost);
      acc.commission += toNum(u.commission);
      return acc;
    },
    { price: 0, commission: 0 },
  );
}

/** Map a single form upsell row into the API payload shape. */
export function upsellToPayload(u: UpsellItemValue): UpsellPayload {
  return {
    upsell_type: u.upsellType,
    description: u.description || null,
    quantity: u.quantity,
    cost: String(u.cost || 0),
    commission: String(u.commission || 0),
    tour_operator_id: u.tourOperatorId || null,
  };
}

/** Map form upsell rows into the API payload shape. */
export function upsellsToPayload(items: UpsellItemValue[] | undefined): UpsellPayload[] {
  return (items ?? []).map(upsellToPayload);
}
