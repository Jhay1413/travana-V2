import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { REFERENCING, tourOperatorSettingsRepository as repo } from "./tour-operator-settings.repository";
import { renderWhere, resetCapture, setRows, whereCalls } from "../../test/capture-db";

beforeEach(() => resetCapture());

describe("tourOperatorSettingsRepository", () => {
  it("lists the catalogue with no organisation predicate and escapes the search", async () => {
    setRows([{ count: 0 }]);
    await repo.findAll(1, 25, "100%");
    const { text, params } = renderWhere(0);
    expect(text).not.toContain("org_id");
    expect(text).toContain('"tour_operator_table"."name" ilike ');
    expect(params).toContain("%100\\%%");
  });

  it("has no filter at all without a search term", async () => {
    setRows([{ count: 0 }]);
    await repo.findAll(1, 25, "");
    expect(whereCalls.every((w) => w === undefined)).toBe(true);
  });

  it("findByLowerName compares lower(name)", async () => {
    setRows([]);
    expect(await repo.findByLowerName(" TUI ")).toBeNull();
    const { text, params } = renderWhere(0);
    expect(text).toContain('lower("tour_operator_table"."name") = ');
    expect(params).toEqual(["tui"]);
  });

  it("create returns null on a name conflict", async () => {
    setRows([]);
    expect(await repo.create({ name: "TUI" })).toBeNull();
  });

  it("countReferences returns numbers for the links and the records", async () => {
    setRows([{ links: "2", records: "5" }]);
    expect(await repo.countReferences("op1")).toEqual({ links: 2, records: 5 });
  });

  it("checks all 20 columns that hold a tour operator id", () => {
    expect(REFERENCING).toHaveLength(20);
    expect(new Set(REFERENCING.map(([, column]) => column)).size).toBe(20);
  });
});
