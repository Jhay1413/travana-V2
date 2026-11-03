import { describe, expect, it } from "vitest";
import { makeRow } from "./fixtures";
import { ALL_OPTION, distinctSorted, filterTickets, matchesQuery, ticketCounts, ticketEmpty, ticketStatusLine } from "./ticket-rows";

const TODAY = "2026-10-20";
const ROWS = [
  makeRow({ bookingId: "a", clientName: "Zed", travelDate: "2026-10-22", operatorName: "TUI", destination: "Rhodes", checks: { passportInfo: true } }),
  makeRow({ bookingId: "b", clientName: "Amy", travelDate: "2026-10-22", operatorName: "Jet2holidays", destination: "Malaga" }),
  makeRow({ bookingId: "c", clientName: "Bob", travelDate: "2026-10-30", operatorName: "TUI", destination: "Dubai", checks: { completed: true, passportInfo: true } }),
  makeRow({ bookingId: "d", clientName: "Cat", travelDate: "2026-10-21", operatorName: null, destination: null, haysRef: "HAY200777" }),
];
const ALL = { show: "all", query: "", operator: ALL_OPTION } as const;

describe("filterTickets", () => {
  it("sorts by travel date then client name", () => {
    expect(filterTickets(ROWS, ALL).map((r) => r.bookingId)).toEqual(["d", "b", "a", "c"]);
  });
  it("splits to do and completed", () => {
    expect(filterTickets(ROWS, { ...ALL, show: "todo" }).map((r) => r.bookingId)).toEqual(["d", "b", "a"]);
    expect(filterTickets(ROWS, { ...ALL, show: "done" }).map((r) => r.bookingId)).toEqual(["c"]);
  });
  it("filters by operator", () => {
    expect(filterTickets(ROWS, { ...ALL, operator: "TUI" }).map((r) => r.bookingId)).toEqual(["a", "c"]);
  });
  it("searches Hays number, client, destination and operator, ignoring case", () => {
    expect(filterTickets(ROWS, { ...ALL, query: "200777" }).map((r) => r.bookingId)).toEqual(["d"]);
    expect(filterTickets(ROWS, { ...ALL, query: " rhodes " }).map((r) => r.bookingId)).toEqual(["a"]);
    expect(filterTickets(ROWS, { ...ALL, query: "jet2" }).map((r) => r.bookingId)).toEqual(["b"]);
    expect(filterTickets(ROWS, { ...ALL, query: "amy" }).map((r) => r.bookingId)).toEqual(["b"]);
  });
});

describe("counts and copy", () => {
  it("counts totals, passport gaps and trips leaving within 3 days", () => {
    expect(ticketCounts(ROWS, TODAY)).toEqual({ total: 4, done: 1, todo: 3, noPassport: 2, leavingSoon: 3 });
  });
  it("writes the status line with singular and plural verbs", () => {
    expect(ticketStatusLine({ total: 12, done: 1, todo: 11, noPassport: 6, leavingSoon: 2 })).toBe(
      "12 departures · 1 completed · 6 still need passport info · 2 leave in the next 3 days and are not complete",
    );
    expect(ticketStatusLine({ total: 1, done: 0, todo: 1, noPassport: 0, leavingSoon: 1 })).toBe(
      "1 departure · 0 completed · 0 still need passport info · 1 leaves in the next 3 days and is not complete",
    );
  });
  it("picks the empty state", () => {
    expect(ticketEmpty({ ...ALL, show: "todo" }).title).toBe("Everything is done");
    expect(ticketEmpty({ ...ALL, show: "todo", query: "x" }).title).toBe("No trips match");
    expect(ticketEmpty({ ...ALL, show: "done" }).title).toBe("No trips match");
  });
});

describe("helpers", () => {
  it("matchesQuery matches an empty query", () => {
    expect(matchesQuery("  ", "x")).toBe(true);
    expect(matchesQuery("q", null, undefined)).toBe(false);
  });
  it("distinctSorted drops blanks and duplicates", () => {
    expect(distinctSorted(["TUI", null, "Jet2", "TUI", " "])).toEqual(["Jet2", "TUI"]);
  });
});
