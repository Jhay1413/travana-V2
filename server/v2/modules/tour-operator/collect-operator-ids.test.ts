import { describe, expect, it } from "vitest";
import { collectTourOperatorIds } from "./collect-operator-ids";

describe("collectTourOperatorIds", () => {
  it("finds the main operator and every line item operator in a quote payload", () => {
    const ids = collectTourOperatorIds({
      main_tour_operator_id: "a",
      flights: [{ tour_operator_id: "b" }, { tour_operator_id: "c" }],
      accommodation: [{ tour_operator_id: "a" }],
      transfers: [],
    });
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("reads the cruise camelCase key", () => {
    expect(collectTourOperatorIds({ cruises: [{ tourOperatorId: "x" }] })).toEqual(["x"]);
  });

  it("ignores null, empty and non-string values", () => {
    expect(
      collectTourOperatorIds({ main_tour_operator_id: null, flights: [{ tour_operator_id: "" }, { tour_operator_id: "  " }, { tour_operator_id: 5 }] }),
    ).toEqual([]);
  });

  it("handles non-objects and nested quoteData/bookingData wrappers", () => {
    expect(collectTourOperatorIds(null)).toEqual([]);
    expect(collectTourOperatorIds("x")).toEqual([]);
    expect(collectTourOperatorIds({ quoteData: { main_tour_operator_id: "q1" }, bookingData: { flights: [{ tour_operator_id: "b1" }] } })).toEqual(["q1", "b1"]);
  });

  it("stops descending past depth 6", () => {
    let deep: Record<string, unknown> = { tour_operator_id: "deep" };
    for (let i = 0; i < 8; i++) deep = { child: deep };
    expect(collectTourOperatorIds(deep)).toEqual([]);
  });
});
