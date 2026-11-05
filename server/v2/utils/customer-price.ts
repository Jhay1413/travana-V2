/**
 * Customer-facing price rules, shared by every customer page (public quote,
 * portal, v1 legacy routes).
 *
 *   holiday total = sales price − discounts + service charge
 *   total         = holiday total + extras the customer pays on top of the package
 *   per person    = holiday total ÷ travellers (extras are NEVER part of it)
 */

const n = (raw: unknown): number => parseFloat(String(raw ?? 0)) || 0;

export interface CustomerPriceInput {
  salesPrice: unknown;
  discounts?: unknown;
  serviceCharge?: unknown;
  /** Cost of the extras explicitly not included in the package (see quoteExtrasTotalExpr). */
  extrasTotal?: unknown;
  adults?: number | null;
  children?: number | null;
}

export interface CustomerPrice {
  holidayTotal: number;
  total: number;
  pricePerPerson: number;
}

export function customerPrice(input: CustomerPriceInput): CustomerPrice {
  const holidayTotal = n(input.salesPrice) - n(input.discounts) + n(input.serviceCharge);
  const pax = (input.adults || 0) + (input.children || 0);
  return {
    holidayTotal,
    total: holidayTotal + n(input.extrasTotal),
    pricePerPerson: pax > 0 ? holidayTotal / pax : 0,
  };
}
