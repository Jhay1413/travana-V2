import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { tourOperatorRepository } from "./tour-operator.repository";
import { renderWhere, resetCapture, setRows, whereCalls } from "../../test/capture-db";

beforeEach(() => resetCapture());

describe("tourOperatorRepository.findByLowerName", () => {
  it("matches on lower(name) against the lower-cased trimmed input", async () => {
    setRows([{ id: "op1" }]);
    expect(await tourOperatorRepository.findByLowerName("  Jet2Holidays ")).toEqual({ id: "op1" });
    const { text, params } = renderWhere(0);
    expect(text).toContain('lower("tour_operator_table"."name") = ');
    expect(params).toEqual(["jet2holidays"]);
  });

  it("returns null when nothing matches", async () => {
    setRows([]);
    expect(await tourOperatorRepository.findByLowerName("x")).toBeNull();
  });
});

describe("tourOperatorRepository.findByIds / findByLowerNames", () => {
  it("skip the query for an empty list", async () => {
    expect(await tourOperatorRepository.findByIds([])).toEqual([]);
    expect(await tourOperatorRepository.findByLowerNames([])).toEqual([]);
    expect(whereCalls).toHaveLength(0);
  });

  it("findByLowerNames compares lower(btrim(name)) to the keys", async () => {
    await tourOperatorRepository.findByLowerNames(["tui", "sandals"]);
    const { text, params } = renderWhere(0);
    expect(text).toContain('lower("tour_operator_table"."name") in (');
    expect(params).toEqual(["tui", "sandals"]);
  });
});

describe("tourOperatorRepository.searchCatalogue", () => {
  it("escapes the search term and hides operators the org already has", async () => {
    await tourOperatorRepository.searchCatalogue("o1", "100%_", false);
    const { text, params } = renderWhere(0);
    expect(text).toContain('"tour_operator_table"."name" ilike ');
    expect(params).toContain("%100\\%\\_%");
    expect(text).toContain("not exists (");
    expect(text).toContain('"org_tour_operator"."org_id" = ');
    expect(params).toContain("o1");
  });

  it("includes already-linked operators when asked and has no filter without a term", async () => {
    await tourOperatorRepository.searchCatalogue("o1", undefined, true);
    expect(whereCalls).toHaveLength(0);
  });

  it("returns the rows the database gave", async () => {
    setRows([{ id: "op1", linked: false }]);
    expect(await tourOperatorRepository.searchCatalogue("o1", "tui", false)).toEqual([{ id: "op1", linked: false }]);
  });
});

describe("tourOperatorRepository writes", () => {
  it("insert returns null on a name conflict", async () => {
    setRows([]);
    expect(await tourOperatorRepository.insert({ name: "TUI" })).toBeNull();
    setRows([{ id: "op1" }]);
    expect(await tourOperatorRepository.insert({ name: "TUI" })).toEqual({ id: "op1" });
  });

  it("update filters by id", async () => {
    setRows([{ id: "op1" }]);
    await tourOperatorRepository.update("op1", { phone: "0203 451 2720" });
    expect(renderWhere(0).params).toEqual(["op1"]);
  });
});
