import { describe, expect, it } from "vitest";
import { FUTURE_ERROR, validateSchedule } from "./schedule-form";

const now = new Date(2026, 9, 15, 12, 0);

describe("validateSchedule", () => {
  it("accepts a future date and time", () => {
    expect(validateSchedule("2026-10-21", "09:00", now)).toEqual({
      ok: true,
      local: "2026-10-21T09:00",
      utcIso: new Date("2026-10-21T09:00").toISOString(),
    });
  });

  it("rejects missing parts", () => {
    expect(validateSchedule("", "09:00", now)).toEqual({ ok: false, error: FUTURE_ERROR });
    expect(validateSchedule("2026-10-21", "", now)).toEqual({ ok: false, error: FUTURE_ERROR });
  });

  it("rejects a time in the past or equal to now", () => {
    expect(validateSchedule("2026-10-15", "11:59", now).ok).toBe(false);
    expect(validateSchedule("2026-10-15", "12:00", now).ok).toBe(false);
  });

  it("accepts later today", () => {
    expect(validateSchedule("2026-10-15", "18:00", now).ok).toBe(true);
  });

  it("rejects garbage without throwing", () => {
    expect(validateSchedule("not-a-date", "09:00", now).ok).toBe(false);
  });
});
