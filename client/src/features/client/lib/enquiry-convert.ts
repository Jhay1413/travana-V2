/**
 * Whether an enquiry can still be converted to a quote. Same rule as the "···"
 * menu item: not already converted, and not lost. Edit rights are decided by
 * the caller (the header only renders its actions when the page is editable).
 */
export function canConvertEnquiry(enquiry: { status?: string | null }): boolean {
  return enquiry.status !== "Converted" && enquiry.status !== "LOST";
}

/** Primary orange "Convert to Quote" button used in the enquiry headers. */
export const CONVERT_TO_QUOTE_BUTTON_CLASS =
  "inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] bg-social-orange px-4 text-[13px] font-semibold text-admin-on-accent transition hover:bg-social-orange/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-social-orange focus-visible:ring-offset-2";
