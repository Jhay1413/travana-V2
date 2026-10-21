import { describe, expect, it } from "vitest";
import { OPERATOR_MESSAGES } from "@shared/tour-operator-rules";
import { countPlan, nameKey, planImport } from "./tour-operator-import.plan";
import type { CatalogueMatch, ExistingLink, ImportRowInput } from "./tour-operator.types";

const existing: ExistingLink = {
  linkId: "l1",
  operatorId: "op1",
  name: "TUI",
  phone: "0203 451 2720",
  website: "https://tui.co.uk",
  username: "ann",
  password: "pw",
  commission: 10,
  balanceWeeks: 14,
};

const catalogue = new Map<string, CatalogueMatch>([
  ["sandals", { id: "op2", name: "Sandals", phone: null, website: null }],
]);

const plan = (rows: ImportRowInput[], links: ExistingLink[] = [existing]) => planImport(rows, links, catalogue);

describe("planImport", () => {
  it("flags an identical row as same", () => {
    const [p] = plan([{ line: 2, name: "tui", phone: "0203 451 2720", username: "ann", password: "pw", commission: "10%", balanceWeeks: "14 weeks" }]);
    expect(p.status).toBe("same");
    expect(p.linkId).toBe("l1");
  });

  it("flags a changed commission as update and shows the new value", () => {
    const [p] = plan([{ line: 2, name: "TUI", commission: "11" }]);
    expect(p.status).toBe("update");
    expect(p.commission).toBe(11);
  });

  it("blank cells keep the existing values on update (so a name-only row is unchanged)", () => {
    const [p] = plan([{ line: 2, name: "TUI" }]);
    expect(p.status).toBe("same");
    expect(p.commission).toBe(10);
  });

  it("phone and website only count as a change when the catalogue is blank", () => {
    expect(plan([{ line: 2, name: "TUI", phone: "0800 111 2222" }])[0].status).toBe("same");
    expect(plan([{ line: 2, name: "TUI", phone: "0800 111 2222" }], [{ ...existing, phone: null }])[0].status).toBe("update");
    expect(plan([{ line: 2, name: "TUI", website: "other.com" }], [{ ...existing, website: null }])[0].status).toBe("update");
  });

  it("a changed password or weeks is an update", () => {
    expect(plan([{ line: 2, name: "TUI", password: "new" }])[0].status).toBe("update");
    expect(plan([{ line: 2, name: "TUI", balanceWeeks: "10" }])[0].status).toBe("update");
  });

  it("an operator in the catalogue but not linked is new and keeps the catalogue id", () => {
    const [p] = plan([{ line: 3, name: "SANDALS", commission: "12" }]);
    expect(p).toMatchObject({ status: "new", operatorId: "op2", createCatalogue: false, name: "Sandals" });
  });

  it("an unknown operator is new with a catalogue row to create", () => {
    const [p] = plan([{ line: 4, name: "Brand New Ltd", commission: "9" }]);
    expect(p).toMatchObject({ status: "new", createCatalogue: true });
    expect(p.operatorId).toBeUndefined();
  });

  it("a new row with a blank commission is NULL (not 0) and weeks default to 14", () => {
    const [p] = plan([{ line: 4, name: "Brand New Ltd" }]);
    expect(p.commission).toBeNull();
    expect(p.values?.commission).toBeUndefined();
    expect(p.values?.balanceWeeks).toBe(14);
  });

  it("reports a missing name as (no name)", () => {
    const [p] = plan([{ line: 5, name: "  " }]);
    expect(p).toMatchObject({ status: "error", name: "(no name)", message: OPERATOR_MESSAGES.nameMin });
  });

  it("reports a repeated name on the second occurrence only", () => {
    const out = plan([{ line: 2, name: "Foo Tours" }, { line: 3, name: "foo tours" }]);
    expect(out[0].status).toBe("new");
    expect(out[1]).toMatchObject({ status: "error", message: "foo tours appears more than once in the file." });
  });

  it("collects every validation message on one row", () => {
    const [p] = plan([{ line: 2, name: "Foo", phone: "abc", website: "not a url", commission: "x", balanceWeeks: "99" }]);
    expect(p.status).toBe("error");
    expect(p.message).toContain(OPERATOR_MESSAGES.phone);
    expect(p.message).toContain(OPERATOR_MESSAGES.web);
    expect(p.message).toContain(OPERATOR_MESSAGES.commissionNumber);
    expect(p.message).toContain(OPERATOR_MESSAGES.weeksMax);
  });

  it("normalises the website and strips % and weeks suffixes", () => {
    const [p] = plan([{ line: 2, name: "Foo Tours", website: "foo.com", commission: "8.5%", balanceWeeks: "12 weeks" }]);
    expect(p.values).toMatchObject({ website: "https://foo.com", commission: 8.5, balanceWeeks: 12 });
  });

  it("countPlan tallies each status", () => {
    const out = plan([{ line: 2, name: "TUI" }, { line: 3, name: "TUI", commission: "5" }, { line: 4, name: "X Y" }, { line: 5, name: "" }]);
    expect(countPlan(out)).toEqual({ new: 1, update: 0, same: 1, error: 2 });
  });

  it("nameKey lower-cases and trims", () => {
    expect(nameKey("  TUI ")).toBe("tui");
  });
});
