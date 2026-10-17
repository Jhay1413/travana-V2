import { describe, expect, it } from "vitest";
import { dayKey, ensureSevenDays } from "./branch-helpers";

describe("ensureSevenDays", () => {
  it("accepts short day names", () => {
    const out = ensureSevenDays([{ day: "Mon", open: true, openTime: "08:00", closeTime: "17:00" }]);
    expect(out[0]).toMatchObject({ day: "Mon", open: true, openTime: "08:00" });
    expect(out).toHaveLength(7);
  });

  it("accepts full day names and normalises them to short keys", () => {
    const out = ensureSevenDays([
      { day: "Monday", open: true, openTime: "08:00", closeTime: "17:00" },
      { day: "Sunday", open: true, openTime: "10:00", closeTime: "14:00" },
    ]);
    expect(out[0]).toEqual({ day: "Mon", open: true, openTime: "08:00", closeTime: "17:00" });
    expect(out[6]).toEqual({ day: "Sun", open: true, openTime: "10:00", closeTime: "14:00" });
    expect(out[1]?.openTime).toBe("09:00");
  });

  it("fills a missing list with defaults", () => {
    expect(ensureSevenDays(undefined).map((d) => d.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });
});

describe("dayKey", () => {
  it("maps names and leaves unknown text alone", () => {
    expect(dayKey("Wednesday")).toBe("Wed");
    expect(dayKey("thu")).toBe("Thu");
    expect(dayKey("Funday")).toBe("Funday");
  });
});
