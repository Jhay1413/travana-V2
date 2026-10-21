import { describe, expect, it } from "vitest";
import { applyCheck, canComplete, completedDisabled, stepsDone } from "./checks";
import { makeRow } from "./fixtures";

const ACTOR = { id: "u1", name: "Tina" };
const NOW = new Date("2026-10-20T10:00:00Z");
const FOUR = { checkIn: true, ticketsInHouse: true, passportInfo: true, ticketsPickUp: true };

describe("completed unlock rule", () => {
  it("counts the four steps only", () => {
    expect(stepsDone(makeRow({ checks: { checkIn: true, passportInfo: true, fullyPaid: true } }).checks)).toBe(2);
  });

  it("unlocks at four of four", () => {
    expect(canComplete(makeRow({ checks: FOUR }).checks)).toBe(true);
    expect(canComplete(makeRow({ checks: { ...FOUR, ticketsPickUp: false } }).checks)).toBe(false);
  });

  it("disables Completed until unlocked, but never when already ticked", () => {
    expect(completedDisabled(makeRow().checks)).toBe(true);
    expect(completedDisabled(makeRow({ checks: FOUR }).checks)).toBe(false);
    expect(completedDisabled(makeRow({ checks: { completed: true } }).checks)).toBe(false);
  });
});

describe("applyCheck (optimistic)", () => {
  it("ticks a step and stamps who and what", () => {
    const next = applyCheck(makeRow(), "checkIn", true, ACTOR, NOW);
    expect(next.checks.checkIn).toBe(true);
    expect(next.lastChange).toEqual({ by: "u1", byName: "Tina", at: NOW.toISOString(), what: "Check in" });
  });

  it("refuses Completed before the four checks", () => {
    const row = makeRow();
    expect(applyCheck(row, "completed", true, ACTOR, NOW)).toBe(row);
  });

  it("completes once the four are ticked", () => {
    const next = applyCheck(makeRow({ checks: FOUR }), "completed", true, ACTOR, NOW);
    expect(next.checks.completed).toBe(true);
    expect(next.lastChange?.what).toBe("Completed");
  });

  it("unticking a step reopens a completed trip", () => {
    const next = applyCheck(makeRow({ checks: { ...FOUR, completed: true } }), "passportInfo", false, ACTOR, NOW);
    expect(next.checks.completed).toBe(false);
    expect(next.lastChange?.what).toBe("Passport info unticked");
  });

  it("paid does not touch completed", () => {
    const next = applyCheck(makeRow({ checks: { ...FOUR, completed: true, fullyPaid: true } }), "fullyPaid", false, ACTOR, NOW);
    expect(next.checks.completed).toBe(true);
    expect(next.lastChange?.what).toBe("Marked not paid");
  });
});
