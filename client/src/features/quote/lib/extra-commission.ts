/**
 * Auto commission for an extra (transfer, car hire, ...): cost × the commission % of the
 * extra's OWN tour operator, falling back to the deal's main operator %. Extras included in
 * the package earn nothing of their own (the package commission covers them). The main
 * package commission % is never touched by this.
 */

const round2 = (n: number) => parseFloat(n.toFixed(2));

export interface ExtraCommissionInput {
  cost: unknown;
  isIncludedInPackage: boolean | null | undefined;
  /** Commission % of the extra's own operator, or null when it has no operator / no rate. */
  extraOperatorPct: number | null;
  /** Commission % of the deal's main operator (fallback), or null. */
  mainOperatorPct: number | null;
}

/** The % used for this extra: its own operator's, else the main operator's, else null. */
export function extraCommissionPct(extraOperatorPct: number | null, mainOperatorPct: number | null): number | null {
  return extraOperatorPct ?? mainOperatorPct ?? null;
}

export function autoExtraCommission(input: ExtraCommissionInput): number {
  if (input.isIncludedInPackage !== false) return 0;
  const pct = extraCommissionPct(input.extraOperatorPct, input.mainOperatorPct);
  const cost = Number(input.cost) || 0;
  if (pct == null || cost <= 0) return 0;
  return round2((cost * pct) / 100);
}

/** The value to write into the extra's commission field, or null when the agent has set it by hand. */
export function nextExtraCommission(input: ExtraCommissionInput & { manual: boolean | null | undefined }): number | null {
  if (input.manual) return null;
  return autoExtraCommission(input);
}
