import { describe, expect, it } from "vitest";
import { snoozeLabel, snoozeUntil } from "./snooze";

describe("snoozeUntil", () => {
  it("1h adds an hour", () => {
    const now = new Date(2026, 9, 15, 10, 0);
    expect(snoozeUntil("1h", now).getTime() - now.getTime()).toBe(3_600_000);
  });
  it("later today is 17:00 before 15:00", () => {
    const d = snoozeUntil("later_today", new Date(2026, 9, 15, 10, 0));
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([15, 17, 0]);
  });
  it("later today is +2h from 15:00", () => {
    const now = new Date(2026, 9, 15, 15, 30);
    expect(snoozeUntil("later_today", now).getTime() - now.getTime()).toBe(7_200_000);
  });
  it("later today clamps to 23:30 after 21:30", () => {
    const d = snoozeUntil("later_today", new Date(2026, 9, 15, 22, 30));
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([15, 23, 30]);
  });
  it("tomorrow is 09:00 next day", () => {
    const d = snoozeUntil("tomorrow", new Date(2026, 9, 15, 22, 0));
    expect([d.getDate(), d.getHours()]).toEqual([16, 9]);
  });
  it("next week is the coming Monday 09:00", () => {
    const d = snoozeUntil("next_week", new Date(2026, 9, 15, 10, 0)); // Thursday
    expect([d.getDay(), d.getDate(), d.getHours()]).toEqual([1, 19, 9]);
  });
  it("next week from a Monday goes seven days ahead", () => {
    expect(snoozeUntil("next_week", new Date(2026, 9, 19, 8, 0)).getDate()).toBe(26);
  });
});

describe("snoozeLabel", () => {
  const now = new Date(2026, 9, 15, 10, 0);
  it("formats today, tomorrow and weekday", () => {
    expect(snoozeLabel(new Date(2026, 9, 15, 15, 30), now)).toBe("Back today 15:30");
    expect(snoozeLabel(new Date(2026, 9, 16, 9, 0), now)).toBe("Back tomorrow 09:00");
    expect(snoozeLabel(new Date(2026, 9, 19, 9, 0), now)).toBe("Back Mon 09:00");
  });
  it("says Back now once the time has passed", () => {
    expect(snoozeLabel(new Date(2026, 9, 15, 9, 0), now)).toBe("Back now");
  });
});
