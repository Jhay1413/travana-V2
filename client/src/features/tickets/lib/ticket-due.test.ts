import { describe, expect, it } from "vitest";
import { deriveDuePill, dueDeadline, isLegacyDateOnly, isNeedsAttention, parseTicketDue } from "./ticket-due";

// 16 Oct 2026 is British Summer Time (UTC+1); 10 Dec 2026 is GMT.
const NOW = new Date("2026-10-16T10:00:00Z"); // 11:00 in London

const active = (dueDate: string | null) => ({ dueDate, status: "Open" });

describe("parseTicketDue", () => {
  it("reads zone-less values as UTC instants", () => {
    expect(parseTicketDue("2026-10-16 09:00:00")?.toISOString()).toBe("2026-10-16T09:00:00.000Z");
    expect(parseTicketDue("2026-10-16T09:00:00")?.toISOString()).toBe("2026-10-16T09:00:00.000Z");
  });
  it("keeps explicit zones", () => {
    expect(parseTicketDue("2026-10-16T09:00:00Z")?.toISOString()).toBe("2026-10-16T09:00:00.000Z");
    expect(parseTicketDue("2026-10-16T09:00:00+01:00")?.toISOString()).toBe("2026-10-16T08:00:00.000Z");
  });
  it("reads a date-only value as midnight UTC", () => {
    expect(parseTicketDue("2026-10-16")?.toISOString()).toBe("2026-10-16T00:00:00.000Z");
  });
  it("returns null for empty or invalid input", () => {
    expect(parseTicketDue(null)).toBeNull();
    expect(parseTicketDue("")).toBeNull();
    expect(parseTicketDue("not a date")).toBeNull();
  });
});

describe("legacy date-only values", () => {
  it("recognises London midnight in winter and summer, and UTC midnight", () => {
    expect(isLegacyDateOnly(new Date("2026-12-10T00:00:00Z"))).toBe(true);
    expect(isLegacyDateOnly(new Date("2026-10-15T23:00:00Z"))).toBe(true); // 00:00 BST
    expect(isLegacyDateOnly(new Date("2026-10-16T00:00:00Z"))).toBe(true);
    expect(isLegacyDateOnly(new Date("2026-10-16T09:30:00Z"))).toBe(false);
  });
  it("measures against the end of the London day", () => {
    expect(dueDeadline(new Date("2026-10-16T00:00:00Z")).toISOString()).toBe("2026-10-16T23:00:00.000Z");
    expect(dueDeadline(new Date("2026-12-10T00:00:00Z")).toISOString()).toBe("2026-12-11T00:00:00.000Z");
    expect(dueDeadline(new Date("2026-10-16T09:30:00Z")).toISOString()).toBe("2026-10-16T09:30:00.000Z");
  });
});

describe("deriveDuePill", () => {
  it("marks resolved and closed tickets as closed whatever the date", () => {
    expect(deriveDuePill({ dueDate: "2020-01-01T00:00:00Z", status: "Resolved" }, NOW)).toEqual({ tone: "closed", label: "Closed" });
    expect(deriveDuePill({ dueDate: null, status: "Closed" }, NOW).tone).toBe("closed");
  });
  it("handles a missing due date", () => {
    expect(deriveDuePill(active(null), NOW)).toEqual({ tone: "none", label: "No due date" });
  });
  it("flags overdue with how late", () => {
    expect(deriveDuePill(active("2026-10-16T07:00:00Z"), NOW)).toEqual({ tone: "over", label: "Overdue 3h" });
    expect(deriveDuePill(active("2026-10-14T10:00:00Z"), NOW)).toEqual({ tone: "over", label: "Overdue 2d" });
    expect(deriveDuePill(active("2026-10-16T09:40:00Z"), NOW)).toEqual({ tone: "over", label: "Overdue 20m" });
  });
  it("flags due within two hours as soon", () => {
    expect(deriveDuePill(active("2026-10-16T11:30:00Z"), NOW)).toEqual({ tone: "soon", label: "Due in 1h" });
    expect(deriveDuePill(active("2026-10-16T12:00:00Z"), NOW).tone).toBe("soon");
    expect(deriveDuePill(active("2026-10-16T12:01:00Z"), NOW).tone).toBe("ok");
  });
  it("labels today, tomorrow and later days in London time", () => {
    expect(deriveDuePill(active("2026-10-16T15:30:00Z"), NOW)).toEqual({ tone: "ok", label: "Today 16:30" });
    expect(deriveDuePill(active("2026-10-17T08:00:00Z"), NOW)).toEqual({ tone: "ok", label: "Tomorrow 09:00" });
    expect(deriveDuePill(active("2026-10-23T08:00:00Z"), NOW)).toEqual({ tone: "ok", label: "Fri 23 Oct 09:00" });
  });
  it("uses London days across midnight", () => {
    // 23:30Z on the 16th is 00:30 BST on the 17th: tomorrow in London.
    expect(deriveDuePill(active("2026-10-16T23:30:00Z"), NOW).label).toBe("Tomorrow 00:30");
  });
  it("shows a legacy date-only value as a day with no time", () => {
    expect(deriveDuePill(active("2026-10-16T00:00:00Z"), NOW)).toEqual({ tone: "ok", label: "Today" });
    expect(deriveDuePill(active("2026-10-17T00:00:00Z"), NOW)).toEqual({ tone: "ok", label: "Tomorrow" });
    expect(deriveDuePill(active("2026-10-20T00:00:00Z"), NOW)).toEqual({ tone: "ok", label: "Tue 20 Oct" });
  });
  it("does not call a date-only value overdue until the London day has ended", () => {
    expect(deriveDuePill(active("2026-10-16T00:00:00Z"), new Date("2026-10-16T20:30:00Z")).tone).toBe("ok");
    expect(deriveDuePill(active("2026-10-16T00:00:00Z"), new Date("2026-10-16T22:30:00Z")).tone).toBe("soon");
    expect(deriveDuePill(active("2026-10-16T00:00:00Z"), new Date("2026-10-16T23:30:00Z")).tone).toBe("over");
    expect(deriveDuePill(active("2026-10-15T00:00:00Z"), NOW).tone).toBe("over");
  });
  it("uses GMT in winter", () => {
    const winter = new Date("2026-12-10T10:00:00Z");
    expect(deriveDuePill(active("2026-12-10T15:30:00Z"), winter).label).toBe("Today 15:30");
    expect(deriveDuePill(active("2026-12-10T00:00:00Z"), winter).label).toBe("Today");
  });
});

describe("isNeedsAttention", () => {
  it("is true for overdue and soon active tickets only", () => {
    expect(isNeedsAttention(active("2026-10-16T07:00:00Z"), NOW)).toBe(true);
    expect(isNeedsAttention(active("2026-10-16T11:00:00Z"), NOW)).toBe(true);
    expect(isNeedsAttention(active("2026-10-18T11:00:00Z"), NOW)).toBe(false);
    expect(isNeedsAttention(active(null), NOW)).toBe(false);
    expect(isNeedsAttention({ dueDate: "2026-10-16T07:00:00Z", status: "Resolved" }, NOW)).toBe(false);
  });
});
