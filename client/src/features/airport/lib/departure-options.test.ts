import { describe, expect, it } from "vitest";
import type { Airport } from "../types";
import { buildDepartureAirportOptions } from "./departure-options";

const ap = (id: string, name: string, code: string): Airport => ({ id, airport_name: name, airport_code: code, country_id: "uk", createdAt: "" });

describe("buildDepartureAirportOptions", () => {
  it("labels, groups and orders: popular, agency most used, then A-Z", () => {
    const out = buildDepartureAirportOptions(
      [ap("z", "Zeta", "ZZZ"), ap("m", "Manchester", "MAN"), ap("b", "Bristol", "BRS"), ap("n", "Newcastle", "NCL"), ap("a", "Aberdeen", "ABZ")],
      ["b", "m"],
    );
    expect(out.map((o) => [o.value, o.group])).toEqual([
      ["n", "Popular"],
      ["m", "Popular"],
      ["b", "Most used by your agency"],
      ["a", "All airports"],
      ["z", "All airports"],
    ]);
    expect(out[0].label).toBe("Newcastle (NCL)");
  });

  it("keeps every airport exactly once so search and the selected label still resolve", () => {
    const airports = [ap("z", "Zeta", "ZZZ"), ap("m", "Manchester", "MAN"), ap("a", "Aberdeen", "ABZ")];
    const out = buildDepartureAirportOptions(airports, ["a"]);
    expect(out.map((o) => o.value).sort()).toEqual(["a", "m", "z"]);
    expect(out.find((o) => o.value === "z")?.label).toBe("Zeta (ZZZ)");
  });
});
