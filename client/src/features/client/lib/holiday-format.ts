const gbpTwoDecimals = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Always two decimals: 3177.46 -> "£3,177.46", 3000 -> "£3,000.00". */
export function gbp2(value: number): string {
  return gbpTwoDecimals.format(value);
}
