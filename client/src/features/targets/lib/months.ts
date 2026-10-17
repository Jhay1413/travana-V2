import { parseMoney } from "./money";

export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const FULL_MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0);

/** Twelve amounts, padding short or missing lists with 0. */
export const twelve = (xs: readonly number[] | undefined | null): number[] =>
  Array.from({ length: 12 }, (_, i) => xs?.[i] ?? 0);

/**
 * Split `total` across months in proportion to `weights`, in steps of £`step`. Every month is 0 or more and
 * the months add up to exactly `total`: the few pounds left by rounding go on the biggest month, and a
 * shortfall is taken from the biggest months first. With no weights at all the split is even.
 */
export function spread(total: number, weights: readonly number[], step = 25): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const tw = sum(weights);
  if (tw <= 0) return evenParts(total, n);
  const out: number[] = [];
  let prev = 0;
  let cum = 0;
  for (const w of weights) {
    cum += w;
    const cur = Math.round((total * cum) / tw / step) * step;
    out.push(cur - prev); // cumulative rounding never decreases, so each month is 0 or more
    prev = cur;
  }
  let rest = total - prev;
  const biggestFirst = out.map((_, i) => i).sort((x, y) => out[y] - out[x] || x - y);
  if (rest > 0) out[biggestFirst[0]] += rest;
  for (const i of biggestFirst) {
    if (rest >= 0) break;
    const take = Math.min(out[i], -rest);
    out[i] -= take;
    rest += take;
  }
  return out;
}

/** `total` shared into `n` equal whole-pound parts. The few pounds left over go on the first parts. */
export function evenParts(total: number, n: number): number[] {
  if (n <= 0) return [];
  const each = Math.floor(total / n);
  const extra = total - each * n;
  return Array.from({ length: n }, (_, i) => each + (i < extra ? 1 : 0));
}

/** Twelve equal months. The few pounds left over go on the first months. */
export const evenMonths = (total: number): number[] => evenParts(total, 12);

/** Same seasonality as `base`, scaled to a new yearly total (£25 steps, £5 steps under £5,000). Even when `base` is empty. */
export function scaleMonths(base: readonly number[], total: number): number[] {
  const weights = twelve(base);
  if (sum(weights) <= 0) return evenMonths(total);
  return spread(total, weights, total >= 5000 ? 25 : 5);
}

/** Twelve month inputs -> numbers, with one message per bad month. */
export function parseMonths(raw: readonly string[]): { ok: true; months: number[] } | { ok: false; errors: Record<number, string> } {
  const months: number[] = [];
  const errors: Record<number, string> = {};
  for (let i = 0; i < 12; i++) {
    const r = parseMoney(raw[i] ?? "");
    if (r.ok) months.push(r.value);
    else errors[i] = r.error;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, months };
}

/**
 * Share `total` across people in proportion to their current amounts, in whole pounds. Everyone gets the
 * rounded-down share and the leftover pounds go one each to the biggest remainders, so nothing is negative
 * and the shares add up to exactly `total`. With nothing to go on the split is even.
 */
export function shareProportionally(total: number, weights: readonly number[]): number[] {
  const n = weights.length;
  const tw = sum(weights);
  if (n === 0) return [];
  if (tw <= 0) return evenParts(total, n);
  const exact = weights.map((w) => (w / tw) * total);
  const out = exact.map(Math.floor);
  let left = total - sum(out);
  const order = exact.map((_, i) => i).sort((a, b) => exact[b] - Math.floor(exact[b]) - (exact[a] - Math.floor(exact[a])) || a - b);
  for (let k = 0; left > 0; k = (k + 1) % n, left--) out[order[k]] += 1;
  return out;
}
