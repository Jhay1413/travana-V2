import { describe, expect, it } from "vitest";
import { balanceCounts, balanceEmpty, balanceStatusLine, filterBalances, paidPill } from "./balance-rows";
import { makeRow } from "./fixtures";
import { ALL_OPTION } from "./ticket-rows";

const TODAY = "2026-10-20";
const ROWS = [
  makeRow({ bookingId: "a", haysRef: "HAY1", leadPassenger: "Zed Z", clientName: "Zed Z", travelDate: "2026-10-22", destination: "Rhodes", operatorName: "TUI", supplierRef: "TUI-9" }),
  makeRow({ bookingId: "b", haysRef: "HAY2", leadPassenger: "Amy A", clientName: "Amy A", travelDate: "2026-10-29", operatorName: "Jet2holidays", checks: { fullyPaid: true } }),
  makeRow({ bookingId: "c", haysRef: "HAY3", leadPassenger: "Bob B", clientName: "Bob B", travelDate: "2026-11-09", operatorName: "TUI" }),
];
const ALL = { show: "all", query: "", supplier: ALL_OPTION } as const;

describe("filterBalances", () => {
  it("shows not paid, paid or all, sorted by date", () => {
    expect(filterBalances(ROWS, { ...ALL, show: "unpaid" }).map((r) => r.bookingId)).toEqual(["a", "c"]);
    expect(filterBalances(ROWS, { ...ALL, show: "paid" }).map((r) => r.bookingId)).toEqual(["b"]);
    expect(filterBalances(ROWS, ALL)).toHaveLength(3);
  });
  it("filters by supplier", () => {
    expect(filterBalances(ROWS, { ...ALL, supplier: "TUI" }).map((r) => r.bookingId)).toEqual(["a", "c"]);
  });
  it("searches HAY ref, passenger, destination, supplier and supplier ref", () => {
    expect(filterBalances(ROWS, { ...ALL, query: "hay2" }).map((r) => r.bookingId)).toEqual(["b"]);
    expect(filterBalances(ROWS, { ...ALL, query: "bob" }).map((r) => r.bookingId)).toEqual(["c"]);
    expect(filterBalances(ROWS, { ...ALL, query: "rhodes" }).map((r) => r.bookingId)).toEqual(["a"]);
    expect(filterBalances(ROWS, { ...ALL, query: "tui-9" }).map((r) => r.bookingId)).toEqual(["a"]);
  });
});

describe("counts and copy", () => {
  it("counts paid, unpaid and unpaid leaving within 7 days", () => {
    expect(balanceCounts(ROWS, TODAY)).toEqual({ total: 3, paid: 1, unpaid: 2, soon: 1 });
  });
  it("writes the status line", () => {
    expect(balanceStatusLine({ total: 10, paid: 3, unpaid: 7, soon: 4 })).toBe(
      "10 bookings · 3 fully paid · 7 still to pay, 4 of them departing in the next 7 days",
    );
  });
  it("picks the empty state", () => {
    expect(balanceEmpty({ ...ALL, show: "unpaid" }).title).toBe("Everything is paid");
    expect(balanceEmpty({ ...ALL, show: "unpaid", supplier: "TUI" }).title).toBe("No bookings match");
  });
});

describe("paidPill", () => {
  it("maps paid, soon and later", () => {
    expect(paidPill(true, 1)).toEqual({ label: "Paid", tone: "good" });
    expect(paidPill(false, 7)).toEqual({ label: "Not paid", tone: "warn" });
    expect(paidPill(false, 8)).toEqual({ label: "Not paid", tone: "plain" });
  });
});
