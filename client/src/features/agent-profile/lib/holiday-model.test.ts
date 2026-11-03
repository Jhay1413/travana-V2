import { describe, expect, it } from "vitest";
import type { LeaveEntry } from "@/features/hr";
import { buildHolidayModel, sicknessLine } from "./holiday-model";

let n = 0;
function leave(over: Partial<LeaveEntry>): LeaveEntry {
  n += 1;
  return { id: `h${n}`, type: "Annual", from: "2026-03-02", to: "2026-03-02", status: "Approved", createdAt: "2026-01-01", ...over };
}

const TODAY = "2026-10-19";

describe("buildHolidayModel", () => {
  it("counts working days, not calendar days, and splits taken from booked at today", () => {
    const m = buildHolidayModel({
      allowance: 28,
      todayKey: TODAY,
      pattern: "mon-fri",
      leaves: [
        leave({ from: "2026-03-02", to: "2026-03-13" }), // two working weeks, taken
        leave({ from: "2026-10-15", to: "2026-10-23" }), // Thu 15 to Fri 23: 15,16,19 taken; 20-23 booked
        leave({ from: "2026-12-21", to: "2026-12-31" }), // 21-25 and 28-31 working days, booked
      ],
    });
    expect(m.taken).toBe(10 + 3);
    expect(m.booked).toBe(4 + 9);
    expect(m.left).toBe(28 - 26);
    expect(m.ariaLabel).toBe("13 days taken, 13 booked and 2 left of 28");
  });

  it("follows the shop pattern", () => {
    const leaves = [leave({ from: "2026-03-02", to: "2026-03-08" })];
    expect(buildHolidayModel({ allowance: 28, todayKey: TODAY, pattern: "mon-fri", leaves }).taken).toBe(5);
    expect(buildHolidayModel({ allowance: 28, todayKey: TODAY, pattern: "mon-sat", leaves }).taken).toBe(6);
    expect(buildHolidayModel({ allowance: 28, todayKey: TODAY, pattern: "seven-days", leaves }).taken).toBe(7);
  });

  it("keeps pending, rejected, other types and other years out of taken and booked", () => {
    const m = buildHolidayModel({
      allowance: 28,
      todayKey: TODAY,
      pattern: "mon-fri",
      leaves: [
        leave({ status: "Pending", from: "2026-11-02", to: "2026-11-04" }),
        leave({ status: "Rejected", from: "2026-04-06", to: "2026-04-10" }),
        leave({ type: "Unpaid", from: "2026-05-04", to: "2026-05-08" }),
        leave({ from: "2025-12-29", to: "2026-01-02" }), // only 1 and 2 Jan fall in 2026
        leave({ from: "2025-06-02", to: "2025-06-06" }), // last year
      ],
    });
    expect(m.taken).toBe(2);
    expect(m.booked).toBe(0);
    expect(m.pending).toBe(3);
  });

  it("counts approved sickness separately and lists records newest first without cancelled ones", () => {
    const m = buildHolidayModel({
      allowance: 28,
      todayKey: TODAY,
      pattern: "mon-fri",
      leaves: [
        leave({ type: "Sick", from: "2026-02-09", to: "2026-02-10" }),
        leave({ from: "2026-03-02", to: "2026-03-02" }),
        leave({ status: "Cancelled", from: "2026-08-03", to: "2026-08-03" }),
        leave({ status: "Pending", from: "2026-11-02", to: "2026-11-02", reason: "Half term" }),
      ],
    });
    expect(m.sickDays).toBe(2);
    expect(m.rows.map((r) => r.statusLabel)).toEqual(["Pending", "Approved", "Approved"]);
    expect(m.rows[0]).toMatchObject({ note: "Annual leave · Half term", tone: "warn", days: 1 });
    expect(m.rows[2].note).toBe("Sick leave");
  });

  it("does not go negative when the allowance is overspent", () => {
    const m = buildHolidayModel({ allowance: 5, todayKey: TODAY, pattern: "mon-fri", leaves: [leave({ from: "2026-03-02", to: "2026-03-13" })] });
    expect(m.left).toBe(0);
    expect(m.overBy).toBe(5);
    expect(m.takenPct).toBe(100);
  });

  it("copes with no allowance", () => {
    const m = buildHolidayModel({ allowance: null, todayKey: TODAY, pattern: null, leaves: [] });
    expect(m).toMatchObject({ allowance: null, left: 0, takenPct: 0, rows: [] });
  });

  it("counts today as taken", () => {
    const m = buildHolidayModel({ allowance: 28, todayKey: TODAY, pattern: "mon-fri", leaves: [leave({ from: TODAY, to: TODAY })] });
    expect(m).toMatchObject({ taken: 1, booked: 0 });
  });
});

describe("sicknessLine", () => {
  it("words zero and some", () => {
    expect(sicknessLine(0, 2026)).toBe("No sickness recorded in 2026.");
    expect(sicknessLine(1, 2026)).toBe("Sickness in 2026: 1 day.");
    expect(sicknessLine(3, 2026)).toBe("Sickness in 2026: 3 days.");
  });
});
