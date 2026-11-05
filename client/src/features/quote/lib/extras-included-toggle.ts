/**
 * Form changes applied when an extra is switched TO "Included in package".
 *
 * The cost the agent typed is deliberately NOT touched: it is ignored by the
 * customer total while the extra is included (see `extrasCustomerTotal`), and
 * must still be there when the agent switches back to "not included". Only the
 * operator (the package's operator) and the extra's own commission are reset.
 */
export interface IncludedReset {
  path: string;
  value: string | number | boolean;
}

export function includedPackageResets(prefix: string, mainTourOperatorId: string): IncludedReset[] {
  return [
    { path: `${prefix}.tourOperatorId`, value: mainTourOperatorId },
    { path: `${prefix}.commission`, value: 0 },
    // Back to automatic: the commission is calculated again if the extra is switched to not included.
    { path: `${prefix}.commissionManual`, value: false },
  ];
}
