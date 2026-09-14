import { describe, expect, it } from "vitest";
import { formatDueDateTime, formatNoActivityLabel, isValidDrop } from "./pipeline-helpers";

// Dates are built from local components (not ISO/UTC strings) so the
// expected output doesn't depend on the machine's timezone.
describe("formatDueDateTime", () => {
  const now = new Date(2026, 8, 12, 10, 0); // Sat 12 Sep 2026, 10:00

  it("returns 'No date' when there is no due date", () => {
    expect(formatDueDateTime(null, now)).toBe("No date");
    expect(formatDueDateTime(undefined, now)).toBe("No date");
  });

  it("labels a due date on the same day as Today", () => {
    expect(formatDueDateTime(new Date(2026, 8, 12, 15, 15).toISOString(), now)).toBe("Today 15:15");
  });

  it("labels a due date on the next calendar day as Tomorrow", () => {
    expect(formatDueDateTime(new Date(2026, 8, 13, 15, 15).toISOString(), now)).toBe("Tomorrow 15:15");
  });

  it("falls back to 'Weekday D Mon HH:mm' for other dates", () => {
    // 2026-09-14 is a Monday.
    expect(formatDueDateTime(new Date(2026, 8, 14, 9, 30).toISOString(), now)).toBe("Mon 14 Sep 09:30");
  });
});

describe("formatNoActivityLabel", () => {
  const now = new Date(2026, 8, 12, 10, 0);

  it("returns a generic label when there is no timestamp", () => {
    expect(formatNoActivityLabel(null, now)).toBe("No activity");
  });

  it("says 'today' for zero elapsed days", () => {
    expect(formatNoActivityLabel(new Date(2026, 8, 12, 2, 0).toISOString(), now)).toBe("No activity today");
  });

  it("uses singular wording for exactly one day", () => {
    expect(formatNoActivityLabel(new Date(2026, 8, 11, 9, 0).toISOString(), now)).toBe("No activity for 1 day");
  });

  it("uses plural wording for more than one day", () => {
    expect(formatNoActivityLabel(new Date(2026, 8, 5, 9, 0).toISOString(), now)).toBe("No activity for 7 days");
  });
});

describe("isValidDrop", () => {
  it("rejects dropping a card back onto its own column", () => {
    expect(isValidDrop("Enquiry", "Enquiry")).toBe(false);
    expect(isValidDrop("Lost", "Lost")).toBe(false);
  });

  it("rejects moving a booking straight to Lost", () => {
    expect(isValidDrop("Booked", "Lost")).toBe(false);
  });

  it("allows a lost deal to be restored into Enquiry, Quoted, In Play, or Future", () => {
    expect(isValidDrop("Lost", "Enquiry")).toBe(true);
    expect(isValidDrop("Lost", "Quoted")).toBe(true);
    expect(isValidDrop("Lost", "In Play")).toBe(true);
    expect(isValidDrop("Lost", "Future")).toBe(true);
  });

  it("rejects moving a lost deal straight to Booked", () => {
    expect(isValidDrop("Lost", "Booked")).toBe(false);
  });

  it("allows every other combination", () => {
    expect(isValidDrop("Enquiry", "Quoted")).toBe(true);
    expect(isValidDrop("Quoted", "In Play")).toBe(true);
    expect(isValidDrop("In Play", "Booked")).toBe(true);
    expect(isValidDrop("Future", "Booked")).toBe(true);
    expect(isValidDrop("Booked", "In Play")).toBe(true);
  });
});
