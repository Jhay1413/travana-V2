import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./org-tour-operator.repository", () => ({
  orgTourOperatorRepository: {
    listForOrg: vi.fn(),
    insertLink: vi.fn(),
    updateLink: vi.fn(),
    transaction: vi.fn(async (fn: (tx: object) => Promise<unknown>) => fn({ tx: true })),
  },
}));
vi.mock("./tour-operator.repository", () => ({
  tourOperatorRepository: {
    findByLowerNames: vi.fn(),
    findByLowerName: vi.fn(),
    findById: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("../../utils/encryption", () => ({
  encrypt: vi.fn((s: string) => `enc:${s}`),
  decrypt: vi.fn((s: string) => {
    if (!s.startsWith("enc:")) throw new Error("bad");
    return s.slice(4);
  }),
}));

import { tourOperatorImportService } from "./tour-operator-import.service";
import { orgTourOperatorRepository as links } from "./org-tour-operator.repository";
import { tourOperatorRepository as catalogue } from "./tour-operator.repository";
import type { RawOrgOperator } from "./tour-operator.types";
import type { Scope } from "../../utils/scope";

const scopeFor = (role: Scope["orgRole"], orgId = "o1"): Scope => ({
  orgId,
  branchId: null,
  orgRole: role,
  orgRoles: [role],
  userId: "u1",
  branchType: null,
  ownsHomeworkerBranch: false,
});

const existing: RawOrgOperator = {
  linkId: "l1",
  operatorId: "op1",
  name: "TUI",
  code: null,
  website: null,
  phone: null,
  logo_url: null,
  username: "ann",
  encrypted_password: "enc:pw",
  commission_percentage: "10.00",
  balance_due_weeks: 14,
  is_active: true,
  updated_at: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(links.listForOrg).mockResolvedValue([existing]);
  vi.mocked(catalogue.findByLowerNames).mockResolvedValue([]);
  vi.mocked(links.insertLink).mockResolvedValue({ id: "new" } as never);
  vi.mocked(links.updateLink).mockResolvedValue({ id: "l1" } as never);
  vi.mocked(catalogue.insert).mockResolvedValue({ id: "opNew", name: "Foo Tours" } as never);
});

const rows = [
  { line: 2, name: "TUI", commission: "12", password: "newpw" },
  { line: 3, name: "Foo Tours", commission: "9", phone: "0203 451 2720", password: "p" },
  { line: 4, name: "" },
  { line: 5, name: "tui" },
];

describe("tourOperatorImportService.preview", () => {
  it("returns the plan and counts without writing or echoing passwords", async () => {
    const out = await tourOperatorImportService.preview(scopeFor("org_admin"), rows);
    expect(out.counts).toEqual({ new: 1, update: 1, same: 0, error: 2 });
    expect(out.rows.map((r) => r.status)).toEqual(["update", "new", "error", "error"]);
    expect(JSON.stringify(out)).not.toContain("newpw");
    expect(JSON.stringify(out)).not.toContain('"p"');
    expect(out.rows[0]).toEqual({ line: 2, name: "TUI", status: "update", commission: 12 });
    expect(links.insertLink).not.toHaveBeenCalled();
    expect(links.updateLink).not.toHaveBeenCalled();
    expect(catalogue.insert).not.toHaveBeenCalled();
  });

  it("is writers only and needs an org", async () => {
    await expect(tourOperatorImportService.preview(scopeFor("agent"), rows)).rejects.toMatchObject({ statusCode: 403 });
    await expect(tourOperatorImportService.preview(scopeFor("platform_admin", ""), rows)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("tourOperatorImportService.apply", () => {
  it("applies new and update rows in one transaction and reports the errors", async () => {
    const out = await tourOperatorImportService.apply(scopeFor("branch_manager"), rows);
    expect(out).toEqual({
      added: 1,
      updated: 1,
      unchanged: 0,
      errors: [
        { row: 4, message: "Enter the tour operator's name." },
        { row: 5, message: "tui appears more than once in the file." },
      ],
    });
    expect(links.transaction).toHaveBeenCalledOnce();
    expect(catalogue.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Foo Tours", phone: "0203 451 2720", created_by: "u1" }),
      { tx: true },
    );
    expect(links.insertLink).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: "o1", tour_operator_id: "opNew", commission_percentage: "9", balance_due_weeks: 14, encrypted_password: "enc:p" }),
      { tx: true },
    );
    expect(links.updateLink).toHaveBeenCalledWith("o1", "l1", expect.objectContaining({ commission_percentage: "12", encrypted_password: "enc:newpw" }), { tx: true });
  });

  it("an update only writes the non-blank cells", async () => {
    await tourOperatorImportService.apply(scopeFor("org_admin"), [{ line: 2, name: "TUI", commission: "11" }]);
    const values = vi.mocked(links.updateLink).mock.calls[0][2];
    expect(values).toEqual({ updated_by: "u1", commission_percentage: "11" });
  });

  it("a new row with a blank commission is stored as NULL", async () => {
    await tourOperatorImportService.apply(scopeFor("org_admin"), [{ line: 2, name: "Foo Tours" }]);
    expect(vi.mocked(links.insertLink).mock.calls[0][0]).toMatchObject({ commission_percentage: null, encrypted_password: null });
  });

  it("an existing catalogue operator gets only its blanks filled", async () => {
    vi.mocked(catalogue.findByLowerNames).mockResolvedValue([{ id: "op5", name: "Sandals", phone: "0800 742 742", website: null } as never]);
    vi.mocked(catalogue.findById).mockResolvedValue({ id: "op5", phone: "0800 742 742", website: null } as never);
    const out = await tourOperatorImportService.apply(scopeFor("org_admin"), [
      { line: 2, name: "Sandals", phone: "0999 999 9999", website: "sandals.co.uk", commission: "12" },
    ]);
    expect(out.added).toBe(1);
    expect(catalogue.insert).not.toHaveBeenCalled();
    expect(catalogue.update).toHaveBeenCalledWith("op5", { website: "https://sandals.co.uk" }, { tx: true });
  });

  it("counts identical rows as unchanged and writes nothing for them", async () => {
    const out = await tourOperatorImportService.apply(scopeFor("org_admin"), [{ line: 2, name: "TUI", commission: "10" }]);
    expect(out).toEqual({ added: 0, updated: 0, unchanged: 1, errors: [] });
    expect(links.updateLink).not.toHaveBeenCalled();
  });

  it("a link inserted concurrently counts as unchanged", async () => {
    vi.mocked(links.insertLink).mockResolvedValue(null);
    const out = await tourOperatorImportService.apply(scopeFor("org_admin"), [{ line: 2, name: "Foo Tours", commission: "9" }]);
    expect(out).toMatchObject({ added: 0, unchanged: 1 });
  });

  it("agents cannot import", async () => {
    await expect(tourOperatorImportService.apply(scopeFor("agent"), rows)).rejects.toMatchObject({ statusCode: 403 });
    expect(links.transaction).not.toHaveBeenCalled();
  });
});
