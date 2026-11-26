import { describe, expect, it } from "vitest";
import { PASSPORTS_LINK, missingSentence, missingTitle } from "./HomePassportCard";

describe("Home passport card wording", () => {
  it("writes the first number out, as the design does", () => {
    expect(missingTitle(1)).toEqual({ lead: "One passport", italic: "still needed" });
    expect(missingTitle(3)).toEqual({ lead: "3 passports", italic: "still needed" });
  });

  it("names the traveller when exactly one passport is missing", () => {
    const passengers = [
      { hasPassport: true, isLead: true, firstName: "JIMMY" },
      { hasPassport: false, isLead: false, firstName: "EMMA" },
    ];
    expect(missingSentence(passengers)).toBe("Add Emma's passport. Just take a photo and we'll do the rest.");
    expect(missingSentence([{ hasPassport: false, isLead: true, firstName: "Jimmy" }, passengers[0]])).toBe("Add your passport. Just take a photo and we'll do the rest.");
  });

  it("speaks of the missing passports when several are", () => {
    const missing = { hasPassport: false, isLead: false, firstName: "A" };
    expect(missingSentence([missing, missing])).toBe("Add the missing passports. Just take a photo of each and we'll do the rest.");
  });

  it("links to the Passports section of the bookings screen", () => {
    expect(PASSPORTS_LINK).toBe("/portal/bookings#passports");
  });
});
