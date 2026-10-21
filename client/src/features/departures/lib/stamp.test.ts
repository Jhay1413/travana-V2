import { describe, expect, it } from "vitest";
import { lastChangeLine, stampText } from "./stamp";

describe("stampText", () => {
  it("names the four checks and their unticks", () => {
    expect(stampText("checkIn", true)).toBe("Check in");
    expect(stampText("ticketsInHouse", true)).toBe("Tickets in house");
    expect(stampText("passportInfo", false)).toBe("Passport info unticked");
    expect(stampText("ticketsPickUp", false)).toBe("Tickets pick up unticked");
  });

  it("names completed and paid", () => {
    expect(stampText("completed", true)).toBe("Completed");
    expect(stampText("completed", false)).toBe("Reopened");
    expect(stampText("fullyPaid", true)).toBe("Fully paid");
    expect(stampText("fullyPaid", false)).toBe("Marked not paid");
  });
});

describe("lastChangeLine", () => {
  const now = new Date("2026-10-20T15:00:00Z");
  it("says no changes yet", () => {
    expect(lastChangeLine(null, now)).toBe("No changes yet");
  });
  it("joins what, who and when", () => {
    expect(lastChangeLine({ by: "u1", byName: "Tina", at: "2026-10-20T13:05:00Z", what: "Check in" }, now)).toBe("Check in · Tina, Today, 14:05");
  });
  it("leaves out an unknown person", () => {
    expect(lastChangeLine({ by: null, byName: null, at: "2026-10-20T13:05:00Z", what: "Completed" }, now)).toBe("Completed · Today, 14:05");
  });
});
