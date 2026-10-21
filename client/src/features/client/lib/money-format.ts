import { gbp2 } from "./holiday-format";

export { gbp2 };

/** "−£50.00" for a positive amount (true minus sign), "£0.00" for zero. */
export function minusGbp2(value: number): string {
  return value > 0 ? `−${gbp2(value)}` : gbp2(0);
}

/** "+£50.00" for a positive amount, "£0.00" for zero. */
export function plusGbp2(value: number): string {
  return value > 0 ? `+${gbp2(value)}` : gbp2(0);
}
