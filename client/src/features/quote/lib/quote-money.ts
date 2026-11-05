/**
 * Money maths for a quote / booking detail page. Pure, so it can be unit
 * tested and reused by the page cards.
 *
 * The figures deliberately match the pipeline card (`getTransactionValue` /
 * `getTransactionProfit` in features/pipeline/lib/pipeline-helpers.ts):
 *   total  = sales price − discounts + service charge + extras NOT included in the package
 *   profit = package commission + line-item (service) commission
 * Upsells are NOT counted in either, exactly as the pipeline does not.
 */

type Amount = string | number | null | undefined;

export interface QuoteMoneyInput {
  sales_price?: Amount;
  discounts?: Amount;
  service_charge?: Amount;
  package_commission?: Amount;
  /** Sum of the line-item commissions, returned by the quote/booking detail GET. */
  service_commission?: Amount;
  /** Cost of the extras not marked "Included in package", returned by the quote/booking GET and pipeline rows. */
  extras_total?: Amount;
}

export interface QuoteMoney {
  /** What the customer pays: sales − discounts + service charge + extras not included in the package. */
  total: number;
  /** Raw package price (the stored sales price). */
  packagePrice: number;
  discount: number;
  serviceCharge: number;
  /** Extras the customer pays for on top of the package. */
  extras: number;
  /** Package commission + line-item commission. */
  profit: number;
  /** profit ÷ total × 100, or null when the total is not positive. */
  marginPercent: number | null;
}

export interface MoneyBarSegment {
  key: "package" | "commission" | "service" | "extras";
  /** Amount the segment represents, in pounds. */
  amount: number;
  /** Share of the bar, 0-100. */
  widthPercent: number;
}

function num(raw: Amount): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  return parseFloat(raw ?? "0") || 0;
}

export function quoteTotal(input: QuoteMoneyInput): number {
  return num(input.sales_price) - num(input.discounts) + num(input.service_charge) + num(input.extras_total);
}

/**
 * Price per person from the full customer total (extras not in the package included),
 * shared by adults + children. Infants don't count. 0 when there are no travellers.
 */
export function quotePerPerson(total: number, adults: unknown, children: unknown): number {
  const travellers = (Number(adults) || 0) + (Number(children) || 0);
  if (travellers <= 0) return 0;
  return Math.round((total / travellers) * 100) / 100;
}

export function quoteProfit(input: QuoteMoneyInput): number {
  return num(input.package_commission) + num(input.service_commission);
}

/** Margin as a percentage of the total price; null when it cannot be meaningful. */
export function quoteMarginPercent(profit: number, total: number): number | null {
  if (!(total > 0)) return null;
  return (profit / total) * 100;
}

export function computeQuoteMoney(input: QuoteMoneyInput): QuoteMoney {
  const total = quoteTotal(input);
  const profit = quoteProfit(input);
  return {
    total,
    packagePrice: num(input.sales_price),
    discount: num(input.discounts),
    serviceCharge: num(input.service_charge),
    extras: num(input.extras_total),
    profit,
    marginPercent: quoteMarginPercent(profit, total),
  };
}

/**
 * Segments of the "Price and profit" bar. package − commission is the cost to
 * us, commission − discount is the profit kept after discounting, and the
 * service charge sits on top; together they add up to the total price.
 * Returns an empty list when there is nothing to draw.
 */
export function moneyBarSegments(money: QuoteMoney): MoneyBarSegment[] {
  if (!(money.total > 0)) return [];
  const raw: Array<Pick<MoneyBarSegment, "key" | "amount">> = [
    { key: "package", amount: Math.max(money.packagePrice - money.profit, 0) },
    { key: "commission", amount: Math.max(money.profit - money.discount, 0) },
    { key: "service", amount: Math.max(money.serviceCharge, 0) },
    { key: "extras", amount: Math.max(money.extras, 0) },
  ];
  return raw
    .filter((s) => s.amount > 0)
    .map((s) => ({ ...s, widthPercent: Math.min((s.amount / money.total) * 100, 100) }));
}

export interface ExtrasCommissionInput {
  transfers?: ReadonlyArray<{ commission?: Amount }> | null;
  carHires?: ReadonlyArray<{ commission?: Amount }> | null;
  attractionTickets?: ReadonlyArray<{ commission?: Amount }> | null;
  loungePasses?: ReadonlyArray<{ commission?: Amount }> | null;
  airportParkings?: ReadonlyArray<{ commission?: Amount }> | null;
  extraAccommodations?: ReadonlyArray<{ commission?: Amount }> | null;
}

/**
 * Sum of the line-item (extras) commission entered on a quote/booking form.
 * Mirrors the server's `totalQuoteCommissionExpr`, which adds every line-item
 * table's commission to the package commission. Rows marked "Included in
 * package" already have their commission zeroed by the form, so the stored
 * value is summed as-is.
 */
export function extrasCommission(input: ExtrasCommissionInput): number {
  const groups = [
    input.transfers,
    input.carHires,
    input.attractionTickets,
    input.loungePasses,
    input.airportParkings,
    input.extraAccommodations,
  ];
  return groups.reduce(
    (sum, rows) => sum + (rows ?? []).reduce((s, r) => s + num(r?.commission), 0),
    0,
  );
}

export interface ExtrasCostRow {
  cost?: Amount;
  /** True = the cost is already inside the package price, so it adds nothing to the total. */
  isIncludedInPackage?: boolean | null;
}

export interface ExtrasCostInput {
  transfers?: ReadonlyArray<ExtrasCostRow> | null;
  carHires?: ReadonlyArray<ExtrasCostRow> | null;
  attractionTickets?: ReadonlyArray<ExtrasCostRow> | null;
  loungePasses?: ReadonlyArray<ExtrasCostRow> | null;
  airportParkings?: ReadonlyArray<ExtrasCostRow> | null;
  extraAccommodations?: ReadonlyArray<ExtrasCostRow> | null;
}

/**
 * What the customer pays for extras on top of the package: the `cost` of every
 * extra row explicitly marked NOT included (null/undefined counts as included,
 * matching the server's `= FALSE` and the edit dialogs' `?? true`). Mirrors the server's
 * `quoteExtrasTotalExpr` / `bookingExtrasTotalExpr`.
 */
export function extrasCustomerTotal(input: ExtrasCostInput): number {
  const groups = [
    input.transfers,
    input.carHires,
    input.attractionTickets,
    input.loungePasses,
    input.airportParkings,
    input.extraAccommodations,
  ];
  return groups.reduce(
    (sum, rows) => sum + (rows ?? []).reduce((s, r) => (r?.isIncludedInPackage === false ? s + num(r?.cost) : s), 0),
    0,
  );
}

/** Form-level Final total: price − discount + service charge + extras not included in the package. */
export function formFinalTotal(
  price: Amount,
  discount: Amount,
  serviceCharge: Amount,
  extras: ExtrasCostInput,
): number {
  return num(price) - num(discount) + num(serviceCharge) + extrasCustomerTotal(extras);
}

/** Form-level Total Profit: package (net) commission + extras commission. */
export function formTotalProfit(
  packageCommission: Amount,
  extras: ExtrasCommissionInput,
): number {
  return quoteProfit({
    package_commission: packageCommission,
    service_commission: extrasCommission(extras),
  });
}
