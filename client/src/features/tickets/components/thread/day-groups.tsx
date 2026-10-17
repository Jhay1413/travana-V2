import { DayDivider, dayLabel } from "@/features/conversations";

/** "Today" / "Yesterday" / "12 Oct" label that groups notes under a divider. */
export const noteDayLabel = dayLabel;

/** The conversation's day divider in the redesigned (inbox) style. */
export function NoteDayDivider({ label }: { label: string }) {
  return <DayDivider label={label} variant="inbox" />;
}
