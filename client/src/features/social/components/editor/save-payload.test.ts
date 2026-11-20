import { describe, expect, it } from "vitest";
import { buildSaveTextPayload, shouldPreSaveText } from "./save-payload";
import { scheduleToLocal } from "@/features/social/lib/schedule-time";

// Built from local parts so the expectation holds in any timezone the test runs in.
const stored = new Date(2026, 11, 1, 9, 30).toISOString();

describe("scheduleToLocal", () => {
  it("renders the stored instant as the browser's wall clock", () => {
    expect(scheduleToLocal(stored)).toBe("2026-12-01T09:30");
  });
  it("is empty for a missing or invalid schedule", () => {
    expect(scheduleToLocal(null)).toBe("");
    expect(scheduleToLocal(undefined)).toBe("");
    expect(scheduleToLocal("nonsense")).toBe("");
  });
});

describe("buildSaveTextPayload", () => {
  it("a pending post carries the wall clock of its stored schedule", () => {
    expect(buildSaveTextPayload({ post: "hi", postSchedule: stored, isPending: true, isScheduled: true, accountIds: [1] })).toEqual({
      post: "hi",
      postScheduleLocal: "2026-12-01T09:30",
    });
  });

  it("a draft sends the text and the ticked accounts, never a schedule", () => {
    expect(buildSaveTextPayload({ post: "hi", postSchedule: null, isPending: false, isScheduled: false, accountIds: [1, 2] })).toEqual({
      post: "hi",
      accountIds: [1, 2],
    });
  });

  it("a draft with no ticked accounts sends only the text", () => {
    expect(buildSaveTextPayload({ post: "hi", postSchedule: null, isPending: false, isScheduled: false, accountIds: [] })).toEqual({ post: "hi" });
  });

  it("an already posted post sends only the text", () => {
    expect(buildSaveTextPayload({ post: "hi", postSchedule: stored, isPending: false, isScheduled: true, accountIds: [1] })).toEqual({ post: "hi" });
  });

  it("omits postScheduleLocal when the stored schedule cannot be read", () => {
    expect(buildSaveTextPayload({ post: "hi", postSchedule: "nonsense", isPending: true, isScheduled: true })).toEqual({ post: "hi" });
  });
});

describe("shouldPreSaveText", () => {
  it("skips the pre-save for a pending post only", () => {
    expect(shouldPreSaveText(true)).toBe(false);
    expect(shouldPreSaveText(false)).toBe(true);
  });
});
