export const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export const currencyFull = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMonthLabel(yyyyDashMm: string): string {
  const [y, m] = yyyyDashMm.split("-").map((n) => parseInt(n, 10));
  if (!y || !m) return yyyyDashMm;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}
