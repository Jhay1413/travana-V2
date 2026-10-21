import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { orgTourOperatorRepository } from "./org-tour-operator.repository";
import { renderOrderBy, renderWhere, resetCapture, setRows, valuesCalls, whereCalls } from "../../test/capture-db";

beforeEach(() => resetCapture());

describe("orgTourOperatorRepository.listForOrg", () => {
  it("leads with the org predicate and hides inactive links by default", async () => {
    setRows([{ linkId: "l1" }]);
    const rows = await orgTourOperatorRepository.listForOrg("o1", false);
    expect(rows).toEqual([{ linkId: "l1" }]);
    const { text, params } = renderWhere(0);
    expect(text.startsWith('("org_tour_operator"."org_id" = ')).toBe(true);
    expect(text).toContain('"org_tour_operator"."is_active" = ');
    expect(params[0]).toBe("o1");
  });

  it("includes inactive links when asked, still org first", async () => {
    await orgTourOperatorRepository.listForOrg("o1", true);
    const { text } = renderWhere(0);
    expect(text).toContain('"org_tour_operator"."org_id" = ');
    expect(text).not.toContain("is_active");
  });

  it("orders by lower(name)", async () => {
    await orgTourOperatorRepository.listForOrg("o1", true);
    expect(renderOrderBy(0)).toContain('lower("tour_operator_table"."name")');
  });
});

describe("orgTourOperatorRepository link lookups", () => {
  it("findLink scopes the link id to the org", async () => {
    setRows([]);
    expect(await orgTourOperatorRepository.findLink("o1", "l1")).toBeNull();
    const { text, params } = renderWhere(0);
    expect(text.startsWith('("org_tour_operator"."org_id" = ')).toBe(true);
    expect(text).toContain('"org_tour_operator"."id" = ');
    expect(params).toEqual(["o1", "l1"]);
  });

  it("findLinkByOperator scopes the operator id to the org", async () => {
    setRows([{ linkId: "l9" }]);
    expect(await orgTourOperatorRepository.findLinkByOperator("o1", "op1")).toEqual({ linkId: "l9" });
    const { text, params } = renderWhere(0);
    expect(text.startsWith('("org_tour_operator"."org_id" = ')).toBe(true);
    expect(params).toEqual(["o1", "op1"]);
  });

  it("findLinkedOperatorIds returns [] for no ids without querying", async () => {
    expect(await orgTourOperatorRepository.findLinkedOperatorIds("o1", [])).toEqual([]);
    expect(whereCalls).toHaveLength(0);
  });

  it("findLinkedOperatorIds is org first and maps to ids", async () => {
    setRows([{ id: "op1" }, { id: "op2" }]);
    expect(await orgTourOperatorRepository.findLinkedOperatorIds("o1", ["op1", "op2", "op3"])).toEqual(["op1", "op2"]);
    const { text } = renderWhere(0);
    expect(text.startsWith('("org_tour_operator"."org_id" = ')).toBe(true);
    expect(text).toContain('"org_tour_operator"."tour_operator_id" in (');
  });
});

describe("orgTourOperatorRepository writes", () => {
  it("updateLink and deleteLink are org scoped", async () => {
    setRows([{ id: "l1" }]);
    await orgTourOperatorRepository.updateLink("o1", "l1", { is_active: false });
    expect(renderWhere(0).text.startsWith('("org_tour_operator"."org_id" = ')).toBe(true);
    expect(await orgTourOperatorRepository.deleteLink("o1", "l1")).toBe(true);
    expect(renderWhere(1).params).toEqual(["o1", "l1"]);
    setRows([]);
    expect(await orgTourOperatorRepository.deleteLink("o1", "l2")).toBe(false);
  });

  it("insertLink returns null on a conflict", async () => {
    setRows([]);
    expect(await orgTourOperatorRepository.insertLink({ org_id: "o1", tour_operator_id: "op1" })).toBeNull();
  });

  it("ensureLink reports created when the insert returns a row", async () => {
    setRows([{ id: "l1" }]);
    expect(await orgTourOperatorRepository.ensureLink("o1", "op1", "u1")).toEqual({ created: true, linkId: "l1" });
  });
});

describe("orgTourOperatorRepository.ensureLink (existing)", () => {
  it("throws when neither an insert nor an existing link is found", async () => {
    setRows([]);
    await expect(orgTourOperatorRepository.ensureLink("o1", "op1", null)).rejects.toThrow();
  });
});

describe("orgTourOperatorRepository.linkSeedOperators", () => {
  const seed = [
    { name: "TUI", commission_percentage: "10.00" },
    { name: "Sandals", commission_percentage: "13.50" },
    { name: "tui", commission_percentage: "99.00" },
    { name: null, commission_percentage: "5.00" },
  ];

  it("inserts nothing for an empty seed", async () => {
    expect(await orgTourOperatorRepository.linkSeedOperators("o1", [], null)).toBe(0);
    expect(valuesCalls).toHaveLength(0);
  });

  it("creates only the missing catalogue rows, then links with the SEED percentage (never 0.00)", async () => {
    setRows([{ id: "t1", name: "TUI" }]);
    await orgTourOperatorRepository.linkSeedOperators("o1", seed, "u1");
    // first insert: the catalogue rows that were not found (Sandals); duplicates and blanks skipped
    expect(valuesCalls[0]).toEqual([{ name: "Sandals", created_by: "u1" }]);
    const links = valuesCalls[valuesCalls.length - 1] as Array<Record<string, unknown>>;
    expect(links.find((l) => l.tour_operator_id === "t1")).toMatchObject({ org_id: "o1", commission_percentage: "10.00" });
    expect(links.some((l) => l.commission_percentage === "0.00" || l.commission_percentage == null)).toBe(false);
  });
});

describe("orgTourOperatorRepository.ensureLink commission", () => {
  it("defaults to NULL and carries an explicit seed rate", async () => {
    setRows([{ id: "l1" }]);
    await orgTourOperatorRepository.ensureLink("o1", "op1", null);
    await orgTourOperatorRepository.ensureLink("o1", "op1", null, "12.50");
    expect(valuesCalls[0]).toMatchObject({ commission_percentage: null });
    expect(valuesCalls[1]).toMatchObject({ commission_percentage: "12.50" });
  });
});
