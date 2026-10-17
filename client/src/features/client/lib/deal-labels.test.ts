import { describe, expect, it } from "vitest";
import { buildDealLabels, buildTaskHolidays } from "./deal-labels";

describe("buildDealLabels", () => {
  it("lets the later stage win: booking over quote over enquiry", () => {
    const labels = buildDealLabels(
      [{ id: "e1", transaction_id: "t1", title: "Enq" }],
      [{ id: "q1", transaction_id: "t1", title: "Quote" }],
      [{ id: "b1", transaction_id: "t1", title: null }],
    );
    expect(labels.get("t1")).toEqual({ kind: "booking", id: "b1", title: "Untitled booking" });
  });

  it("prefers the primary quote, else the newest copy", () => {
    const labels = buildDealLabels(
      [],
      [
        { id: "copy", transaction_id: "t", isQuoteCopy: true, date_created: "2026-05-01" },
        { id: "primary", transaction_id: "t", isQuoteCopy: false, date_created: "2026-01-01" },
        { id: "t2a", transaction_id: "t2", isQuoteCopy: true, date_created: "2026-01-01" },
        { id: "t2b", transaction_id: "t2", isQuoteCopy: true, date_created: "2026-02-01" },
      ],
      [],
    );
    expect(labels.get("t")?.id).toBe("primary");
    expect(labels.get("t2")?.id).toBe("t2b");
  });

  it("skips deals without a transaction id", () => {
    expect(buildDealLabels([{ id: "e" }], [{ id: "q" }], [{ id: "b" }]).size).toBe(0);
  });
});

describe("buildTaskHolidays", () => {
  it("maps every deal id to its title and travel date", () => {
    const map = buildTaskHolidays([{ id: "e", title: "Spain" }], [{ id: "q", travel_date: "2026-08-01" }], [{ id: "b", title: "Crete", travel_date: "2026-09-01" }]);
    expect(map.get("e")).toEqual({ title: "Spain", travelDate: null });
    expect(map.get("q")).toEqual({ title: null, travelDate: "2026-08-01" });
    expect(map.get("b")).toEqual({ title: "Crete", travelDate: "2026-09-01" });
  });
});
