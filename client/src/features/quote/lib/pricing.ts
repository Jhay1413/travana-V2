/**
 * Pricing arithmetic shared by the quote and booking forms.
 *
 * Commission = price × operator % − discount + service charge. The discount is
 * taken off the commission (not the price) and the service charge is added to
 * it. Price per person = (price − discount + service charge) / (adults +
 * children).
 */

export type PricingField = "price" | "discount" | "serviceCharge";

export interface PricingSnapshot {
  /** Values as they were BEFORE the edit being applied. */
  price: number;
  discount: number;
  serviceCharge: number;
  commission: number;
  adults: number;
  children: number;
  /** Operator commission %, or null when the operator has none set. */
  operatorCommissionPct: number | null;
}

export interface PricingResult {
  /** New commission, or null when the edit leaves it unchanged. */
  commission: number | null;
  pricePerPerson: number;
}

const round2 = (n: number) => parseFloat(n.toFixed(2));

const num = (v: unknown) => Number(v) || 0;

/** Operator commission percentage from a tour-operator lookup row, or null. */
export function operatorCommissionPct(
  op: { commission_percentage?: string | number | null } | undefined,
): number | null {
  if (op?.commission_percentage == null) return null;
  const pct = parseFloat(String(op.commission_percentage));
  return Number.isNaN(pct) ? null : pct;
}

/** Commission for a freshly chosen operator, given the current price fields. */
export function commissionForOperator(
  pct: number,
  price: unknown,
  discount: unknown,
  serviceCharge: unknown,
): number {
  return round2((num(price) * pct) / 100 - num(discount) + num(serviceCharge));
}

/**
 * Recompute commission and price-per-person after one of the price fields
 * changes. `prev` must be captured before the form value is updated so the
 * no-operator delta path can compare old and new discount / service charge.
 */
export function recomputePricing(
  field: PricingField,
  nextValue: number,
  prev: PricingSnapshot,
): PricingResult {
  const nextPrice = field === "price" ? nextValue : prev.price;
  const nextDiscount = field === "discount" ? nextValue : prev.discount;
  const nextServiceCharge = field === "serviceCharge" ? nextValue : prev.serviceCharge;

  let commission: number | null = null;
  if (prev.operatorCommissionPct != null && nextPrice > 0) {
    commission = round2((nextPrice * prev.operatorCommissionPct) / 100 - nextDiscount + nextServiceCharge);
  } else if (field === "discount" || field === "serviceCharge") {
    // No operator base to recompute from — adjust the existing commission by
    // the change: discount is deducted, service charge is added.
    const delta = field === "discount" ? prev.discount - nextDiscount : nextServiceCharge - prev.serviceCharge;
    commission = round2(prev.commission + delta);
  }

  const total = prev.adults + prev.children;
  const netPrice = nextPrice - nextDiscount + nextServiceCharge;
  const pricePerPerson = total > 0 ? round2(netPrice / total) : 0;

  return { commission, pricePerPerson };
}
