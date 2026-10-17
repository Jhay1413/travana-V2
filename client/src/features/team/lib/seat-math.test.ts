import { describe, expect, it } from "vitest";
import { pendingNote, seatPercent, seatsAfter, seatsFree, seatsFull, seatsLabel, seatsOver } from "./seat-math";

describe("seat-math", () => {
  it("computes bar width with a visible minimum and a cap", () => {
    expect(seatPercent(0, 10)).toBe(2);
    expect(seatPercent(5, 10)).toBe(50);
    expect(seatPercent(20, 10)).toBe(100);
    expect(seatPercent(5, null)).toBe(2);
    expect(seatPercent(5, 0)).toBe(2);
  });

  it("labels used seats, with or without a limit", () => {
    expect(seatsLabel(12, 25)).toBe("12 / 25");
    expect(seatsLabel(12, null)).toBe("12");
  });

  it("reports free seats, never negative, null when unlimited", () => {
    expect(seatsFree({ limit: 10, used: 4 })).toBe(6);
    expect(seatsFree({ limit: 10, used: 12 })).toBe(0);
    expect(seatsFree({ limit: null, used: 12 })).toBeNull();
  });

  it("adds and over-counts new invites", () => {
    expect(seatsAfter(4, 3)).toBe(7);
    expect(seatsAfter(4, -2)).toBe(4);
    expect(seatsOver(8, 5, 10)).toBe(3);
    expect(seatsOver(8, 2, 10)).toBe(0);
    expect(seatsOver(8, 50, null)).toBe(0);
  });

  it("knows when every seat is taken", () => {
    expect(seatsFull({ limit: 10, used: 10 })).toBe(true);
    expect(seatsFull({ limit: 10, used: 9 })).toBe(false);
    expect(seatsFull({ limit: null, used: 999 })).toBe(false);
  });

  it("words the pending-invite note", () => {
    expect(pendingNote(0)).toBeNull();
    expect(pendingNote(1)).toBe("incl. 1 pending invite");
    expect(pendingNote(3)).toBe("incl. 3 pending invites");
  });
});
