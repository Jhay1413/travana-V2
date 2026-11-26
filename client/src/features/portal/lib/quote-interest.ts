/** The id of the "Let <agent> know." section and of its optional note field. */
export const INTEREST_SECTION_ID = "interest";
export const INTEREST_NOTE_ID = "interest-note";

/** Smooth scrolling, unless the customer asked their device for reduced motion. */
export function interestScrollBehavior(prefersReducedMotion: boolean): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth";
}

interface InterestDocument {
  getElementById(id: string): HTMLElement | null;
}

/**
 * The upper "I'm interested" buttons do not send anything: they take the customer to the bottom section so they
 * can add an optional note, and put the cursor in the note field. Only the bottom button submits.
 * Returns false when the section is not on the page.
 */
export function goToInterest(doc: InterestDocument = document, prefersReducedMotion?: boolean): boolean {
  const section = doc.getElementById(INTEREST_SECTION_ID);
  if (!section) return false;
  const reduced = prefersReducedMotion ?? (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  section.scrollIntoView({ behavior: interestScrollBehavior(reduced), block: "start" });
  // preventScroll: the smooth scroll above is already under way; focusing must not jump the page.
  doc.getElementById(INTEREST_NOTE_ID)?.focus({ preventScroll: true });
  return true;
}

/** "N days left" for the decision bar; null when there is no real future expiry (the right-hand text is then left out). */
export function daysLeftText(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return "Last day";
  return days === 1 ? "1 day left" : `${days} days left`;
}
