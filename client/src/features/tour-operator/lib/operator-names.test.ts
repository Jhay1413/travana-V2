import { describe, expect, it } from "vitest";
import { collectOperatorNames } from "./operator-names";

describe("collectOperatorNames", () => {
  it("collects main and line-item operator names", () => {
    const record = {
      main_tour_operator_id: "a",
      main_tour_operator_name: "Jet2",
      flights: [{ tour_operator_id: "b", tour_operator_name: "TUI" }],
      upsells: [{ tour_operator_id: "c", tour_operator_name: null }, { tour_operator_id: null }],
    };
    expect(collectOperatorNames(record)).toEqual({ a: "Jet2", b: "TUI" });
  });
  it("handles non-objects", () => {
    expect(collectOperatorNames(null)).toEqual({});
    expect(collectOperatorNames("x")).toEqual({});
  });
});
