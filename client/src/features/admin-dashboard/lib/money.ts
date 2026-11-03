const WHOLE = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const PENCE = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Whole pounds, "£1,840". */
export function gbp(n: number): string {
  return WHOLE.format(n);
}

/** Pounds and pence, "£181.22". */
export function gbp2(n: number): string {
  return PENCE.format(n);
}

/** "1 booking" / "2 bookings". */
export function plural(n: number, one: string): string {
  return `${n} ${one}${n === 1 ? "" : "s"}`;
}

/** Profit divided by bookings; 0 when there are no bookings. */
export function perBooking(profit: number, bookings: number): number {
  return bookings > 0 ? profit / bookings : 0;
}
