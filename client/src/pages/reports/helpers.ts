export const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export function formatMonthLabel(yyyyDashMm: string): string {
  const [y, m] = yyyyDashMm.split("-").map((n) => parseInt(n, 10));
  if (!y || !m) return yyyyDashMm;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

export function formatMonthLong(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function delta(current: number, prior: number): {
  abs: number;
  pct: number | null;
  direction: "up" | "down" | "flat";
} {
  const abs = current - prior;
  if (prior === 0 && current === 0) return { abs: 0, pct: 0, direction: "flat" };
  if (prior === 0) return { abs, pct: null, direction: abs > 0 ? "up" : "down" };
  const p = Math.round((abs / Math.abs(prior)) * 100);
  return {
    abs,
    pct: p,
    direction: abs > 0 ? "up" : abs < 0 ? "down" : "flat",
  };
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function firstOfMonthIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
