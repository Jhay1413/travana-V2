import { gbp, parseMoney } from "./money";
import { parseMonths, scaleMonths, sum } from "./months";

export type EditResult =
  | { ok: true; yearly: number; months: number[] }
  | { ok: false; yearlyError?: string; monthErrors?: Record<number, string>; message?: string };

/** A yearly box that must be a real, positive amount. */
export function parseYearly(raw: string, allowZero = false): { ok: true; value: number } | { ok: false; error: string } {
  const r = parseMoney(raw);
  if (!r.ok) return { ok: false, error: `${r.error}.` };
  if (r.value <= 0 && !allowZero) return { ok: false, error: "Enter a target above £0." };
  return r;
}

/** Plain-English gap between twelve months and the yearly target they must equal. Null when they match. */
export function monthsGapMessage(total: number, yearly: number): string | null {
  if (total === yearly) return null;
  const diff = Math.abs(total - yearly);
  return `Months add up to ${gbp(total)}, but the yearly target is ${gbp(yearly)}. ${total > yearly ? `Take off ${gbp(diff)}.` : `Add ${gbp(diff)}.`}`;
}

/**
 * Turns a yearly box plus twelve month boxes into what gets saved. Months nobody touched follow the
 * yearly target (same busy and quiet months, rescaled); months someone typed must add up to it.
 */
export function resolveEdit(input: { yearly: string; months: readonly string[]; monthsTouched: boolean; base: readonly number[]; allowZero?: boolean }): EditResult {
  const y = parseYearly(input.yearly, input.allowZero);
  if (!y.ok) return { ok: false, yearlyError: y.error };
  if (!input.monthsTouched) return { ok: true, yearly: y.value, months: scaleMonths(input.base, y.value) };
  const parsed = parseMonths(input.months);
  if (!parsed.ok) return { ok: false, monthErrors: parsed.errors, message: "Check the amounts marked red. Use whole pounds." };
  const gap = monthsGapMessage(sum(parsed.months), y.value);
  if (gap) return { ok: false, message: gap };
  return { ok: true, yearly: y.value, months: parsed.months };
}

/** Months for a new yearly total (untouched boxes follow it). */
export const followYearly = (base: readonly number[], yearly: number): number[] => scaleMonths(base, yearly);
