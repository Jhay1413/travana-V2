// SAMPLE content for Luna's morning briefing. This is prototype copy, not live data: only the greeting's
// first name and the London weekday/date are real. The card is labelled "Sample" in the UI.
import { londonWeekday } from "./dashboard-date";

export const BRIEFING_TIMES = ["7:00am", "8:00am", "9:00am"] as const;
export type BriefingTime = (typeof BRIEFING_TIMES)[number];
export const DEFAULT_BRIEFING_TIME: BriefingTime = "8:00am";

export interface BriefingSegment {
  text: string;
  bold?: boolean;
}

export const BRIEFING_BULLETS: ReadonlyArray<ReadonlyArray<BriefingSegment>> = [
  [{ text: "£743", bold: true }, { text: " this week from " }, { text: "6 bookings", bold: true }, { text: ", and " }, { text: "£0", bold: true }, { text: " so far today." }],
  [{ text: "3 quotes", bold: true }, { text: " were opened and are still waiting for a reply." }],
  [{ text: "2 balances", bold: true }, { text: " fall due in the next 7 days, " }, { text: "£1,840", bold: true }, { text: " in total." }],
  [{ text: "1 passport", bold: true }, { text: " is still missing for a trip on Thursday." }],
  [{ text: "To reach £10,000 you need about " }, { text: "£657 a working day", bold: true }, { text: " for the next 11 working days." }],
];

/** "Good morning, James." in bold plus "Here is your Friday." (name omitted when unknown). */
export function briefingGreeting(firstName: string | null | undefined, now: Date): { bold: string; rest: string } {
  const name = (firstName ?? "").trim();
  return {
    bold: name ? `Good morning, ${name}.` : "Good morning.",
    rest: ` Here is your ${londonWeekday(now)}.`,
  };
}
