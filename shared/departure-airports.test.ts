import { describe, expect, it } from "vitest";
import { orderDepartureAirports, PINNED_DEPARTURE_AIRPORT_CODES } from "./departure-airports";

const ap = (id: string, name: string, code: string | null) => ({ id, airport_name: name, airport_code: code });

const all = [
  ap("zzz", "Zurich", "ZRH"),
  ap("gla", "Glasgow", "GLA"),
  ap("bhx", "Birmingham", "BHX"),
  ap("lhr", "London Heathrow", "LHR"),
  ap("lgw", "London Gatwick", "LGW"),
  ap("edi", "Edinburgh", "EDI"),
  ap("man", "Manchester", "MAN"),
  ap("mme", "Teesside", "MME"),
  ap("lba", "Leeds Bradford", "LBA"),
  ap("ncl", "Newcastle", "NCL"),
  ap("bfs", "Belfast", "BFS"),
  ap("brs", "Bristol", "BRS"),
];

describe("orderDepartureAirports", () => {
  it("pins the eight airports in the stakeholder order", () => {
    expect(PINNED_DEPARTURE_AIRPORT_CODES).toEqual(["NCL", "LBA", "MME", "MAN", "EDI", "LGW", "LHR", "GLA"]);
    const out = orderDepartureAirports(all);
    expect(out.slice(0, 8).map((o) => o.airport.id)).toEqual(["ncl", "lba", "mme", "man", "edi", "lgw", "lhr", "gla"]);
    expect(out.slice(0, 8).every((o) => o.group === "popular")).toBe(true);
  });

  it("puts most-used next (excluding pinned, capped) then A-Z", () => {
    const out = orderDepartureAirports(all, ["man", "brs", "bhx", "zzz"], 2);
    const tail = out.slice(8);
    expect(tail.map((o) => [o.airport.id, o.group])).toEqual([
      ["brs", "mostUsed"],
      ["bhx", "mostUsed"],
      ["bfs", "all"],
      ["zzz", "all"],
    ]);
  });

  it("lists every airport exactly once", () => {
    const out = orderDepartureAirports(all, ["brs", "brs", "ncl"]);
    expect(out).toHaveLength(all.length);
    expect(new Set(out.map((o) => o.airport.id)).size).toBe(all.length);
  });

  it("sorts the remainder A-Z case-insensitively and ignores unknown most-used ids", () => {
    const out = orderDepartureAirports([ap("b", "bristol", "BRS"), ap("a", "Aberdeen", "ABZ")], ["nope"]);
    expect(out.map((o) => o.airport.id)).toEqual(["a", "b"]);
  });

  it("falls back to name when the code is missing, skips absent pins", () => {
    const out = orderDepartureAirports([
      ap("t", "Durham Tees Valley", "MME2"),
      ap("g", "Glasgow Prestwick", "PIK"),
      ap("n", "Newcastle Airport", null),
    ]);
    expect(out.map((o) => o.airport.id)).toEqual(["n", "t", "g"]);
    expect(out[2].group).toBe("all");
  });
});
