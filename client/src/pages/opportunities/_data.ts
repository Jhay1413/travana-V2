export type TabId = "enquiries" | "quotes" | "bookings";

export type DateRange =
  | "this-month"
  | "last-month"
  | "this-week"
  | "last-7"
  | "last-30"
  | "last-90"
  | "this-year"
  | "all-time";

export type SortBy = "newest" | "oldest" | "price-high" | "price-low";

export const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "this-week",  label: "This Week" },
  { value: "last-7",     label: "Last 7 Days" },
  { value: "last-30",    label: "Last 30 Days" },
  { value: "last-90",    label: "Last 90 Days" },
  { value: "this-year",  label: "This Year" },
  { value: "all-time",   label: "All Time" },
];

export const sortByOptions: { value: SortBy; label: string }[] = [
  { value: "newest",     label: "Newest First" },
  { value: "oldest",     label: "Oldest First" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "price-low",  label: "Price: Low to High" },
];

export const enquiryStatuses = ["all", "NEW_LEAD", "ACTIVE", "LOST", "INACTIVE", "EXPIRED"];
export const quoteStatuses   = ["all", "NEW_LEAD", "QUOTE_IN_PROGRESS", "QUOTE_CALL", "QUOTE_READY", "AWAITING_DECISION", "REQUOTE", "WON", "ARCHIVED", "LOST", "INACTIVE", "EXPIRED"];
export const bookingStatuses = ["all", "BOOKED", "LOST"];
