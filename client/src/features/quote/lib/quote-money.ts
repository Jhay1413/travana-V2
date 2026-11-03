/**
 * Money maths for a quote / booking detail page. Pure, so it can be unit
 * tested and reused by the page cards.
 *
 * The figures deliberately match the pipeline card (`getTransactionValue` /
 * `getTransactionProfit` in features/pipeline/lib/pipeline-helpers.ts):
 *   total  = sales price − discounts + service charge
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
}

export interface QuoteMoney {
  /** What the customer pays: sales − discounts + service charge. */
  total: number;
  /** Raw package price (the stored sales price). */
  packagePrice: number;
  discount: number;
  serviceCharge: number;
  /** Package commission + line-item commission. */
  profit: number;
  /** profit ÷ total × 100, or null when the total is not positive. */
  marginPercent: number | null;
}

export interface MoneyBarSegment {
  key: "package" | "commission" | "service";
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
  return num(input.sales_price) - num(input.discounts) + num(input.service_charge);
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
  ];
  return raw
    .filter((s) => s.amount > 0)
    .map((s) => ({ ...s, widthPercent: Math.min((s.amount / money.total) * 100, 100) }));
}
