import { describe, expect, it } from "vitest";
import { TEMPLATE_HEADER, buildTemplateCsv } from "./csv-template";
import { csvTextToInviteRows } from "./parse-sheet";

describe("csv-template", () => {
  it("starts with a BOM and the five headers", () => {
    const csv = buildTemplateCsv([{ id: "b1", name: "Leeds" }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.split("\r\n")[0].replace("﻿", "")).toBe(TEMPLATE_HEADER.join(","));
  });

  it("uses the first real branch name and quotes awkward names", () => {
    expect(buildTemplateCsv([{ id: "b1", name: "Smith, Jones & Co" }])).toContain('"Smith, Jones & Co"');
    expect(buildTemplateCsv([])).toContain("Your branch name");
  });

  it("round-trips through the parser into valid rows", () => {
    const branches = [{ id: "b1", name: "Leeds" }];
    const rows = csvTextToInviteRows(buildTemplateCsv(branches), branches);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ role: "agent", branchId: "b1" });
    expect(rows[1]).toMatchObject({ role: "homeworker", branchId: "" });
  });
});
