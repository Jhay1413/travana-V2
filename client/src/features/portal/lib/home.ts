/** Pure rules for the portal Home screen: wording, plurals, which sections show for which data. */
import type { PortalQuoteListItem } from "@shared/portal-quotes";
import type { PortalSummary } from "@shared/portal-summary";
import { formatMoney } from "./quote-format";

const UK_HOUR = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false });

/** The hour (0 to 23) on a UK clock. */
export function ukHour(now: Date): number {
  const hour = Number(UK_HOUR.format(now));
  return hour === 24 ? 0 : hour;
}

/** "Good morning" until noon, "Good afternoon" until 6pm, "Good evening" after; always by UK time. */
export function greetingFor(now: Date): string {
  const h = ukHour(now);
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

/** The two lines of the greeting heading: first name, then surname in italics. No name yet reads "Welcome / back." */
export function splitName(first: string | null | undefined, last: string | null | undefined): { lead: string; italic: string } {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (!f && !l) return { lead: "Welcome", italic: "back." };
  if (!f) return { lead: l, italic: "" };
  return { lead: f, italic: l };
}

/** "Your next holiday is 12 days away." (today and tomorrow in words). */
export function nextHolidaySentence(daysToGo: number): string {
  if (daysToGo <= 0) return "Your next holiday starts today.";
  if (daysToGo === 1) return "Your next holiday starts tomorrow.";
  return `Your next holiday is ${daysToGo} days away.`;
}

/**
 * The same sentence as nextHolidaySentence, in three parts so the design can set the figure in white 400 weight:
 * "Your next holiday is " + "12 days" + " away."
 */
export function nextHolidayParts(daysToGo: number): { before: string; strong: string; after: string } {
  if (daysToGo <= 0) return { before: "Your next holiday starts ", strong: "today", after: "." };
  if (daysToGo === 1) return { before: "Your next holiday starts ", strong: "tomorrow", after: "." };
  return { before: "Your next holiday is ", strong: `${daysToGo} days`, after: " away." };
}

/** "7 nights, all inclusive": the italic line at the right of the next-journey card; "" when neither is known. */
export function nightsBoardLine(nights: number | null, board: string | null): string {
  const parts = [nights ? `${nights} ${nights === 1 ? "night" : "nights"}` : "", board ? board.toLowerCase() : ""].filter(Boolean);
  return parts.join(", ");
}

/** The heading's italic half under "Tenerife,": "in 12 days.", "tomorrow.", "today." */
export function journeyWhen(daysToGo: number): string {
  if (daysToGo <= 0) return "today.";
  if (daysToGo === 1) return "tomorrow.";
  return `in ${daysToGo} days.`;
}

/** "12 days left at £2,400.00", "1 day left at ...", or "Last day at ..." when it ends today. */
export function priceHeldLine(daysLeft: number, total: number): string {
  const price = formatMoney(total);
  if (daysLeft <= 0) return `Last day at ${price}`;
  return `${daysLeft} ${plural(daysLeft, "day")} left at ${price}`;
}

/** The title of the rewards card, from what is real. */
export function rewardsTitle(walletCredit: number, rewardWaiting: boolean): string {
  if (walletCredit > 0) return `${formatMoney(walletCredit)} in your wallet`;
  return rewardWaiting ? "A reward is waiting" : "";
}

export interface HomeInput {
  summary: PortalSummary;
  /** All of the customer's quotes (undefined while unknown or if the list could not load). */
  quotes: PortalQuoteListItem[] | undefined;
  /** Deal counts, and how many travel interests the customer has chosen. */
  forYouCount: number;
  latestCount: number;
  interestCount: number;
}

export interface HomeSections {
  comingUp: Array<"priceHeld" | "rewards">;
  quoteRow: boolean;
  bookingRow: boolean;
  journey: boolean;
  quotesRail: boolean;
  forYou: boolean;
  latest: boolean;
  interestsNudge: boolean;
  /** No quotes and no upcoming holidays: the friendly first-time version. */
  firstTime: boolean;
}

/** Which sections of Home are real for this customer. Nothing is shown for a thing that does not exist. */
export function homeSections(input: HomeInput): HomeSections {
  const { summary, quotes } = input;
  const comingUp: HomeSections["comingUp"] = [];
  if (summary.priceHeld) comingUp.push("priceHeld");
  if (summary.rewards.walletCredit > 0 || summary.rewards.rewardWaiting) comingUp.push("rewards");
  const railQuotes = (quotes ?? []).filter((q) => q.decision.state !== "declined");
  return {
    comingUp,
    quoteRow: summary.counts.quotesAwaiting > 0,
    bookingRow: summary.counts.upcomingBookings > 0,
    journey: summary.nextBooking !== null,
    quotesRail: railQuotes.length > 0,
    forYou: input.forYouCount > 0,
    latest: input.latestCount > 0,
    interestsNudge: input.interestCount === 0,
    firstTime: quotes !== undefined && quotes.length === 0 && summary.counts.upcomingBookings === 0,
  };
}

/** The photo behind the hero: the next holiday's, else the first quote that has one. */
export function heroPhoto(summary: PortalSummary, quotes: PortalQuoteListItem[]): string | undefined {
  return summary.nextBooking?.imageUrl || quotes.find((q) => q.image_url)?.image_url || undefined;
}

/** Latest deals age out of the portal after 6 days; flag those already 5 or more days old (about a day from dropping off). */
const LATEST_DEAL_WINDOW_DAYS = 6;
const EXPIRING_SOON_AFTER_DAYS = 5;

export function isDealExpiringSoon(portalAddedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!portalAddedAt) return false;
  const added = new Date(portalAddedAt).getTime();
  if (Number.isNaN(added)) return false;
  const ageDays = (now.getTime() - added) / 86_400_000;
  return ageDays >= EXPIRING_SOON_AFTER_DAYS && ageDays < LATEST_DEAL_WINDOW_DAYS;
}

/** "For you" deals first, then the latest ones that are not already in it. */
export function mergeDeals<T extends { id: string }>(forYou: T[], latest: T[]): { forYou: T[]; latest: T[] } {
  const seen = new Set(forYou.map((d) => d.id));
  return { forYou, latest: latest.filter((d) => !seen.has(d.id)) };
}

/** The tag on a deal card: one of the customer's interests when it has one, else the deal's first tag. */
export function dealTag(tags: readonly string[], interests: readonly string[]): string {
  return tags.find((t) => interests.includes(t)) ?? tags[0] ?? "";
}

/** The place to name in the "Your next journey" heading: the first part of "Resort, Country"; the title when the place is unknown. */
export function journeyPlace(destination: string, title: string): string {
  if (!destination || destination === "TBC") return title;
  return destination.split(",")[0].trim() || title;
}

/**
 * Font size (px) for a hero heading that prints customer or quote data: the base size while the longest word is
 * short, stepping down for long words so a long surname or hotel name fits a 360px screen. (The heading also
 * wraps anywhere as a last resort, see HERO_HEADING_WRAP.)
 */
export function fitHeroSize(base: number, text: string): number {
  const longest = text.split(/\s+/).reduce((max, w) => Math.max(max, w.length), 0);
  if (longest <= 9) return base;
  if (longest <= 12) return Math.round(base * 0.8);
  return Math.round(base * 0.62);
}

/** Classes that keep a centred hero heading inside the screen: full width, and a very long word wraps instead of widening it. */
export const HERO_HEADING_WRAP = "w-full max-w-full [overflow-wrap:anywhere]";
