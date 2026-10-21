import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./admin-import.repository", () => ({
  tableMap: { tour_operator: {}, country: {} },
  tableConfig: {
    tour_operator: { label: "Tour Operators", columns: ["id", "name", "code", "website", "phone", "logo_url"], searchFields: ["name"], dependsOn: [] },
    country: { label: "Countries", columns: ["id", "country_name"], searchFields: ["country_name"], dependsOn: [] },
  },
  adminImportRepository: {
    createRow: vi.fn(),
    updateRow: vi.fn(),
    deleteRow: vi.fn(),
    importRows: vi.fn(),
    clearTable: vi.fn(),
  },
}));

import { adminImportService } from "./admin-import.service";
import { adminImportRepository as repo } from "./admin-import.repository";

beforeEach(() => vi.clearAllMocks());

describe("adminImportService - tour operator catalogue", () => {
  it("create keeps only the catalogue identity columns", async () => {
    await adminImportService.createRow("tour_operator", {
      name: "TUI",
      code: "TU",
      commission_percentage: "10",
      org_id: "org-1",
      username: "x",
    });
    expect(repo.createRow).toHaveBeenCalledWith("tour_operator", { name: "TUI", code: "TU" });
  });

  it("update keeps only the catalogue identity columns", async () => {
    await adminImportService.updateRow("tour_operator", "op1", { phone: "0203 451 2720", commission_percentage: "9", org_id: "o" });
    expect(repo.updateRow).toHaveBeenCalledWith("tour_operator", "op1", { phone: "0203 451 2720" });
  });

  it("import strips commission and org columns from every row", async () => {
    vi.mocked(repo.importRows).mockResolvedValue({ imported: 2, errors: [] });
    await adminImportService.importRows("tour_operator", [
      { name: "A", commission_percentage: "5", org_id: "o" },
      { name: "B", website: "https://b.com" },
    ]);
    expect(repo.importRows).toHaveBeenCalledWith("tour_operator", [{ name: "A" }, { name: "B", website: "https://b.com" }]);
  });

  it("warns when an old CSV carries commission_percentage / org_id instead of dropping them silently", async () => {
    vi.mocked(repo.importRows).mockResolvedValue({ imported: 1, errors: [] });
    const out = await adminImportService.importRows("tour_operator", [{ name: "A", commission_percentage: "5", org_id: "o" }]);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toContain("commission_percentage, org_id");
    const clean = await adminImportService.importRows("tour_operator", [{ name: "A" }]);
    expect(clean.warnings).toEqual([]);
  });

  it("refuses to delete a row or clear the table (the cascade would wipe every org's settings)", async () => {
    await expect(adminImportService.deleteRow("tour_operator", "op1")).rejects.toMatchObject({ statusCode: 400 });
    await expect(adminImportService.clearTable("tour_operator")).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.deleteRow).not.toHaveBeenCalled();
    expect(repo.clearTable).not.toHaveBeenCalled();
  });

  it("other tables are untouched", async () => {
    await adminImportService.createRow("country", { country_name: "Spain", extra: 1 });
    expect(repo.createRow).toHaveBeenCalledWith("country", { country_name: "Spain", extra: 1 });
    await adminImportService.deleteRow("country", "c1");
    await adminImportService.clearTable("country");
    expect(repo.deleteRow).toHaveBeenCalledWith("country", "c1");
    expect(repo.clearTable).toHaveBeenCalledWith("country");
  });
});
