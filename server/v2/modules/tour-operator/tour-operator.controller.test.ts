import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./tour-operator.service", () => ({
  tourOperatorService: {
    listOptions: vi.fn(),
    listManage: vi.fn(),
    searchCatalogue: vi.fn(),
    exportCsv: vi.fn(),
    createLink: vi.fn(),
    updateLink: vi.fn(),
    removeLink: vi.fn(),
    revealPassword: vi.fn(),
  },
}));
vi.mock("./tour-operator-import.service", () => ({
  tourOperatorImportService: { preview: vi.fn(), apply: vi.fn() },
}));

import { tourOperatorController } from "./tour-operator.controller";
import { tourOperatorService } from "./tour-operator.service";
import { tourOperatorImportService } from "./tour-operator-import.service";

function req(over: { query?: Record<string, unknown>; params?: Record<string, unknown>; body?: unknown } = {}) {
  return {
    query: over.query ?? {},
    params: over.params ?? {},
    body: over.body ?? {},
    orgId: "o1",
    branchId: "b1",
    orgRole: "org_admin",
    orgRoles: ["org_admin"],
    ip: "9.9.9.9",
    headers: { "user-agent": "ua" },
    user: { authType: "password", userId: "u1" },
  } as never;
}

function mockRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}

const scopeMatcher = expect.objectContaining({ orgId: "o1", orgRole: "org_admin", userId: "u1" });

beforeEach(() => vi.clearAllMocks());

describe("tourOperatorController", () => {
  it("GET / returns the bare option array inside the envelope", async () => {
    const data = [{ id: "op1" }];
    vi.mocked(tourOperatorService.listOptions).mockResolvedValue(data as never);
    const res = mockRes();
    await tourOperatorController.listOptions(req({ query: { includeInactive: "1" } }), res as never, vi.fn());
    expect(tourOperatorService.listOptions).toHaveBeenCalledWith(scopeMatcher, true);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: expect.any(String), data });
  });

  it("GET /manage defaults includeInactive to false", async () => {
    vi.mocked(tourOperatorService.listManage).mockResolvedValue({ rows: [], canWrite: true, canSeePasswords: true });
    await tourOperatorController.listManage(req(), mockRes() as never, vi.fn());
    expect(tourOperatorService.listManage).toHaveBeenCalledWith(scopeMatcher, false);
  });

  it("GET /catalogue passes q and all", async () => {
    vi.mocked(tourOperatorService.searchCatalogue).mockResolvedValue({ rows: [] });
    await tourOperatorController.searchCatalogue(req({ query: { q: "tui", all: "1" } }), mockRes() as never, vi.fn());
    expect(tourOperatorService.searchCatalogue).toHaveBeenCalledWith(scopeMatcher, "tui", true);
  });

  it("POST / applies the Zod default (14 weeks) and answers 201", async () => {
    vi.mocked(tourOperatorService.createLink).mockResolvedValue({ linkId: "l1" } as never);
    const res = mockRes();
    await tourOperatorController.create(req({ body: { name: "Sandals", commissionPercentage: 12 } }), res as never, vi.fn());
    expect(tourOperatorService.createLink).toHaveBeenCalledWith(scopeMatcher, expect.objectContaining({ name: "Sandals", balanceDueWeeks: 14 }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("an invalid body reaches next() as an error instead of the service", async () => {
    const next = vi.fn();
    await tourOperatorController.create(req({ body: { commissionPercentage: 12 } }), mockRes() as never, next);
    expect(next).toHaveBeenCalled();
    expect(tourOperatorService.createLink).not.toHaveBeenCalled();
  });

  it("PATCH forwards the link id and parsed body", async () => {
    vi.mocked(tourOperatorService.updateLink).mockResolvedValue({ linkId: "l1" } as never);
    await tourOperatorController.update(req({ params: { linkId: "l1" }, body: { isActive: false } }), mockRes() as never, vi.fn());
    expect(tourOperatorService.updateLink).toHaveBeenCalledWith(scopeMatcher, "l1", { isActive: false });
  });

  it("DELETE answers { ok: true }", async () => {
    vi.mocked(tourOperatorService.removeLink).mockResolvedValue(undefined);
    const res = mockRes();
    await tourOperatorController.remove(req({ params: { linkId: "l1" } }), res as never, vi.fn());
    expect(tourOperatorService.removeLink).toHaveBeenCalledWith(scopeMatcher, "l1");
    expect(res.json).toHaveBeenCalledWith({ success: true, message: expect.any(String), data: { ok: true } });
  });

  it("GET /:linkId/password builds the audit actor from the request", async () => {
    vi.mocked(tourOperatorService.revealPassword).mockResolvedValue({ password: "x" });
    await tourOperatorController.revealPassword(req({ params: { linkId: "l1" } }), mockRes() as never, vi.fn());
    expect(tourOperatorService.revealPassword).toHaveBeenCalledWith(
      scopeMatcher,
      "l1",
      expect.objectContaining({ userId: "u1", ipAddress: "9.9.9.9", userAgent: "ua" }),
    );
  });

  it("GET /export sends a csv attachment", async () => {
    vi.mocked(tourOperatorService.exportCsv).mockResolvedValue("a,b\r\n");
    const res = mockRes();
    await tourOperatorController.exportCsv(req(), res as never, vi.fn());
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", expect.stringContaining("text/csv"));
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", 'attachment; filename="tour-operators.csv"');
    expect(res.send).toHaveBeenCalledWith("a,b\r\n");
  });

  it("import preview and apply forward the rows", async () => {
    const rows = [{ line: 2, name: "TUI" }];
    vi.mocked(tourOperatorImportService.preview).mockResolvedValue({ rows: [], counts: { new: 0, update: 0, same: 0, error: 0 } });
    vi.mocked(tourOperatorImportService.apply).mockResolvedValue({ added: 0, updated: 0, unchanged: 0, errors: [] });
    await tourOperatorController.previewImport(req({ body: { rows } }), mockRes() as never, vi.fn());
    await tourOperatorController.applyImport(req({ body: { rows } }), mockRes() as never, vi.fn());
    expect(tourOperatorImportService.preview).toHaveBeenCalledWith(scopeMatcher, rows);
    expect(tourOperatorImportService.apply).toHaveBeenCalledWith(scopeMatcher, rows);
  });
});
