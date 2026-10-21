import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tourOperatorFields } from "./tour-operator-fields";

const operators = [
  { id: "op-1", name: "Jet2", logo_url: "https://cdn/jet2.png" },
  { id: "op-2", name: "TUI", logo_url: null },
];

describe("tourOperatorFields", () => {
  it("returns the name and logo of the matching operator", () => {
    expect(tourOperatorFields("op-1", operators)).toEqual({ main_tour_operator_name: "Jet2", main_tour_operator_logo_url: "https://cdn/jet2.png" });
  });

  it("keeps a missing logo null", () => {
    expect(tourOperatorFields("op-2", operators)).toEqual({ main_tour_operator_name: "TUI", main_tour_operator_logo_url: null });
  });

  it("returns nulls for no operator id or an unknown one", () => {
    const empty = { main_tour_operator_name: null, main_tour_operator_logo_url: null };
    expect(tourOperatorFields(null, operators)).toEqual(empty);
    expect(tourOperatorFields("nope", operators)).toEqual(empty);
  });
});

describe("transaction.repository findWithDetails", () => {
  it("attaches operator fields to the quotes and the booking", () => {
    const source = readFileSync(fileURLToPath(new URL("./transaction.repository.ts", import.meta.url)), "utf8");
    const body = source.slice(source.indexOf("async findWithDetails"));
    expect(body).toContain("tourOperatorFields(q.main_tour_operator_id, operators)");
    expect(body).toContain("tourOperatorFields(bookingResult.main_tour_operator_id, operators)");
  });
});
