import { describe, expect, it } from "vitest";
import { DEPARTURES, deriveRows, needsActionCount, owedTotal, passportsMissing, summaryLine } from "./sample-departures";

describe("sample-departures", () => {
  it("starts with 1,840 owed, 1 passport missing and 3 needing action", () => {
    expect(DEPARTURES).toHaveLength(5);
    expect(owedTotal({})).toBe(1840);
    expect(passportsMissing({})).toBe(1);
    expect(needsActionCount({})).toBe(3);
    expect(summaryLine({})).toBe("5 departures · £1,840 of balances still to collect · 1 passport missing");
  });

  it("words the starting rows", () => {
    const rows = deriveRows({});
    expect(rows.map((r) => r.status)).toEqual([
      "All set",
      "All set",
      "Balance of £1,200 due",
      "Passport details missing",
      "Balance of £640 due",
    ]);
    expect(rows.map((r) => r.hasAction)).toEqual([false, false, true, true, true]);
    expect(rows[2].actionLabel).toBe("Chase balance");
    expect(rows[3].actionLabel).toBe("Request details");
  });

  it("recalculates after chasing a balance", () => {
    const done = { d3: true };
    expect(owedTotal(done)).toBe(640);
    expect(needsActionCount(done)).toBe(2);
    const row = deriveRows(done)[2];
    expect(row.status).toBe("Chased today");
    expect(row.actionLabel).toBe("Undo");
    expect(summaryLine(done)).toBe("5 departures · £640 of balances still to collect · 1 passport missing");
  });

  it("says nothing is outstanding once everything is done", () => {
    const done = { d3: true, d4: true, d5: true };
    expect(needsActionCount(done)).toBe(0);
    expect(summaryLine(done)).toBe("5 departures, nothing outstanding.");
    expect(deriveRows(done)[3].status).toBe("Requested today");
  });

  it("restores the starting state on Undo", () => {
    const undone = { d3: false, d4: false, d5: false };
    expect(summaryLine(undone)).toBe(summaryLine({}));
    expect(needsActionCount(undone)).toBe(3);
  });
});
