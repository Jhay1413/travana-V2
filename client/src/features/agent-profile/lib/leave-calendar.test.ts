import { describe, expect, it } from "vitest";
import type { LeaveEntry } from "@/features/hr";
import type { AgentProfileBranch } from "../types";
import { buildLeaveCalendar, shiftMonth, statsRows } from "./leave-calendar";
import { countWorkingDays, isWorkingDay, patternForBranches } from "./working-days";

let n = 0;
function leave(over: Partial<LeaveEntry>): LeaveEntry {
  n += 1;
  return { id: `l${n}`, type: "Annual", from: "2026-10-05", to: "2026-10-05", status: "Approved", createdAt: "2026-09-01", ...over };
}

const cellOf = (cal: ReturnType<typeof buildLeaveCalendar>, day: number) => cal.cells[day - 1];
const base = { year: 2026, month: 10, todayKey: "2026-10-16", pattern: "mon-fri" as const };

describe("working days", () => {
  it("follows the opening pattern", () => {
    expect(isWorkingDay("2026-10-17", "mon-fri")).toBe(false); // Saturday
    expect(isWorkingDay("2026-10-17", "mon-sat")).toBe(true);
    expect(isWorkingDay("2026-10-18", "mon-sat")).toBe(false); // Sunday
    expect(isWorkingDay("2026-10-18", "seven-days")).toBe(true);
    expect(isWorkingDay("2026-10-18", null)).toBe(false);
    expect(countWorkingDays("2026-10-12", "2026-10-18", "mon-fri")).toBe(5);
    expect(countWorkingDays("2026-10-12", "2026-10-18", "mon-sat")).toBe(6);
    expect(countWorkingDays("2026-10-12", "2026-10-18", "seven-days")).toBe(7);
  });

  it("takes the pattern from an active shop, else any shop, else Mon-Fri", () => {
    const shop = (id: string, pattern: AgentProfileBranch["openingPattern"], isActive: boolean): AgentProfileBranch => ({
      id,
      name: id,
      branchType: "shop",
      openingPattern: pattern,
      orgRole: "agent",
      isActive,
      joinedAt: "2024-01-01",
    });
    expect(patternForBranches([shop("a", "mon-sat", false), shop("b", "seven-days", true)])).toBe("seven-days");
    expect(patternForBranches([shop("a", "mon-sat", false)])).toBe("mon-sat");
    expect(patternForBranches([])).toBe("mon-fri");
  });
});

describe("buildLeaveCalendar", () => {
  it("starts the grid on the right weekday and marks today", () => {
    const cal = buildLeaveCalendar({ ...base, leaves: [] });
    expect(cal.title).toBe("October 2026");
    expect(cal.leading).toBe(3); // 1 Oct 2026 is a Thursday
    expect(cal.cells).toHaveLength(31);
    expect(cal.cells.filter((c) => c.isToday).map((c) => c.day)).toEqual([16]);
    expect(cellOf(cal, 16).label).toBe("Friday 16 October: working day, today");
  });

  it("marks non-working days per opening pattern", () => {
    const fri = buildLeaveCalendar({ ...base, leaves: [] });
    expect(cellOf(fri, 17).state).toBe("off");
    expect(cellOf(fri, 18).state).toBe("off");
    const sat = buildLeaveCalendar({ ...base, pattern: "mon-sat", leaves: [] });
    expect(cellOf(sat, 17).state).toBe("working");
    expect(cellOf(sat, 18).state).toBe("off");
    const seven = buildLeaveCalendar({ ...base, pattern: "seven-days", leaves: [] });
    expect(cellOf(seven, 18).state).toBe("working");
  });

  it("colours approved leave by type and pending leave apart", () => {
    const cal = buildLeaveCalendar({
      ...base,
      leaves: [
        leave({ type: "Annual", from: "2026-10-05", to: "2026-10-06" }),
        leave({ type: "Sick", from: "2026-10-07", to: "2026-10-07" }),
        leave({ type: "Unpaid", from: "2026-10-08", to: "2026-10-08" }),
        leave({ type: "Other", from: "2026-10-09", to: "2026-10-09" }),
        leave({ type: "Annual", from: "2026-10-12", to: "2026-10-13", status: "Pending" }),
        leave({ type: "Annual", from: "2026-10-14", to: "2026-10-14", status: "Rejected" }),
        leave({ type: "Sick", from: "2026-10-15", to: "2026-10-15", status: "Cancelled" }),
      ],
    });
    expect([5, 6, 7, 8, 9].map((d) => cellOf(cal, d).state)).toEqual(["holiday", "holiday", "sick", "leave", "leave"]);
    expect([12, 13].map((d) => cellOf(cal, d).state)).toEqual(["pending", "pending"]);
    expect([14, 15].map((d) => cellOf(cal, d).state)).toEqual(["working", "working"]);
    expect(cellOf(cal, 7).label).toBe("Wednesday 7 October: sick");
  });

  it("lets non-working days win over leave and approved leave win over pending", () => {
    const cal = buildLeaveCalendar({
      ...base,
      leaves: [
        leave({ from: "2026-10-09", to: "2026-10-12" }), // Fri to Mon, spans the weekend
        leave({ from: "2026-10-12", to: "2026-10-12", status: "Pending" }),
      ],
    });
    expect([9, 10, 11, 12].map((d) => cellOf(cal, d).state)).toEqual(["holiday", "off", "off", "holiday"]);
  });

  it("clips leave that starts before or runs past the month", () => {
    const cal = buildLeaveCalendar({ ...base, leaves: [leave({ from: "2026-09-28", to: "2026-10-02" }), leave({ from: "2026-10-30", to: "2026-11-03" })] });
    expect(cal.stats.holidayDays).toBe(3); // 1, 2 and 30 Oct (31 is a Saturday)
    expect(cellOf(cal, 1).state).toBe("holiday");
  });

  it("counts the stats for the month", () => {
    const cal = buildLeaveCalendar({
      ...base,
      leaves: [
        leave({ from: "2026-10-05", to: "2026-10-06" }),
        leave({ type: "Sick", from: "2026-10-07", to: "2026-10-08" }),
        leave({ from: "2026-10-20", to: "2026-10-21", status: "Pending" }),
        leave({ from: "2026-11-02", to: "2026-11-03", status: "Pending" }),
      ],
    });
    // 1 to 16 October: 12 weekdays.
    expect(cal.stats).toEqual({ workingDaysSoFar: 12, holidayDays: 2, sickDays: 2, pendingRequests: 1 });
    expect(statsRows(cal.stats).map((r) => r.value)).toEqual(["12", "2 days", "2 days", "1"]);
    expect(statsRows({ ...cal.stats, holidayDays: 1 })[1].value).toBe("1 day");
  });

  it("counts working days so far differently for past and future months", () => {
    expect(buildLeaveCalendar({ ...base, month: 9, leaves: [] }).stats.workingDaysSoFar).toBe(22);
    expect(buildLeaveCalendar({ ...base, month: 11, leaves: [] }).stats.workingDaysSoFar).toBe(0);
    expect(buildLeaveCalendar({ ...base, pattern: "mon-sat", leaves: [] }).stats.workingDaysSoFar).toBe(14);
  });
});

describe("shiftMonth", () => {
  it("rolls the year both ways", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 10, 0)).toEqual({ year: 2026, month: 10 });
  });
});
