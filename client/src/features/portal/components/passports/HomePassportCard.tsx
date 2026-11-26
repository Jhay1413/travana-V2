import { useLocation } from "wouter";
import type { PortalPassenger } from "@shared/portal-passengers";
import { usePortalPassengers } from "../../api/use-portal-passengers";
import { passportCountText, titleCaseName } from "../../lib/passport-form";
import { PortalButton } from "../brand";

/** Where the card's link goes: the bookings screen, scrolled to its Passports section. */
export const PASSPORTS_LINK = "/portal/bookings#passports";

/** "One passport" / "3 passports" for the card's title; the design writes the first number out. */
export function missingTitle(missing: number): { lead: string; italic: string } {
  return { lead: missing === 1 ? "One passport" : `${missing} passports`, italic: "still needed" };
}

/** The card's sentence: names the traveller when exactly one passport is missing, as the design does. */
export function missingSentence(passengers: ReadonlyArray<Pick<PortalPassenger, "hasPassport" | "isLead" | "firstName">>): string {
  const missing = passengers.filter((p) => !p.hasPassport);
  if (missing.length === 1) {
    const only = missing[0];
    const who = only.isLead || !only.firstName.trim() ? "your" : `${titleCaseName(only.firstName.trim())}'s`;
    return `Add ${who} passport. Just take a photo and we'll do the rest.`;
  }
  return "Add the missing passports. Just take a photo of each and we'll do the rest.";
}

/**
 * Home's "Coming up" passport reminder, as the design's card. Self-contained: it reads the passengers itself and renders
 * nothing while loading, on error, or when every traveller has a passport.
 */
export function HomePassportCard() {
  const { data } = usePortalPassengers();
  const [, setLocation] = useLocation();
  const passengers = data ?? [];
  const missing = passengers.filter((p) => !p.hasPassport).length;
  if (passengers.length === 0 || missing === 0) return null;
  const title = missingTitle(missing);

  return (
    <div className="flex flex-col gap-2.5 border border-border bg-white px-5 py-[22px]" data-testid="home-passport-card">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.24em] portal-text-amber-ink">Passports</span>
        <span className="portal-serif text-[15px] italic text-muted-foreground" data-testid="home-passport-count">
          {passportCountText(passengers)}
        </span>
      </div>
      <div className="portal-serif text-[25px] leading-[1.2] text-primary">
        {title.lead} <em className="italic">{title.italic}</em>
      </div>
      <p className="text-sm leading-[1.6] text-muted-foreground">{missingSentence(passengers)}</p>
      <PortalButton variant="link" className="self-start text-[11px] tracking-[0.28em]" onClick={() => setLocation(PASSPORTS_LINK)} data-testid="home-passport-link">
        Add passport →
      </PortalButton>
    </div>
  );
}
