import { describe, it, expect } from "vitest";
import { derivePostStatus, countByStatus, STATUS_META } from "./post-status";

const now = new Date("2026-10-15T12:00:00.000Z");

describe("derivePostStatus", () => {
  it("is not_generated without a deal", () => {
    expect(derivePostStatus({}, now)).toBe("not_generated");
    expect(derivePostStatus({ dealId: null, onlySocialsId: "x", postSchedule: "2027-01-01T00:00:00Z" }, now)).toBe("not_generated");
  });
  it("is draft with a deal but no onlySocialsId", () => {
    expect(derivePostStatus({ dealId: "d" }, now)).toBe("draft");
  });
  it("is scheduled when the schedule is in the future", () => {
    expect(derivePostStatus({ dealId: "d", onlySocialsId: "o", postSchedule: "2026-10-15T12:00:01.000Z" }, now)).toBe("scheduled");
  });
  it("is posted at exactly now", () => {
    expect(derivePostStatus({ dealId: "d", onlySocialsId: "o", postSchedule: now.toISOString() }, now)).toBe("posted");
  });
  it("is posted when in the past, missing, or invalid", () => {
    expect(derivePostStatus({ dealId: "d", onlySocialsId: "o", postSchedule: "2026-10-14T12:00:00Z" }, now)).toBe("posted");
    expect(derivePostStatus({ dealId: "d", onlySocialsId: "o" }, now)).toBe("posted");
    expect(derivePostStatus({ dealId: "d", onlySocialsId: "o", postSchedule: "garbage" }, now)).toBe("posted");
  });
});

describe("countByStatus", () => {
  it("tallies each status", () => {
    const counts = countByStatus(
      [
        {},
        { dealId: "a" },
        { dealId: "b" },
        { dealId: "c", onlySocialsId: "o", postSchedule: "2027-01-01T00:00:00Z" },
        { dealId: "d", onlySocialsId: "o", postSchedule: "2020-01-01T00:00:00Z" },
      ],
      now,
    );
    expect(counts).toEqual({ not_generated: 1, draft: 2, scheduled: 1, posted: 1 });
  });
});

describe("STATUS_META", () => {
  it("uses the status tokens", () => {
    expect(STATUS_META.scheduled.badgeClass).toBe("bg-status-scheduled-bg text-status-scheduled-fg");
  });
});

describe("STATUS_META not_generated", () => {
  it("reads Not scheduled", () => {
    expect(STATUS_META.not_generated.label).toBe("Not scheduled");
    expect(STATUS_META.not_generated.plural).toBe("Not scheduled");
  });
});
