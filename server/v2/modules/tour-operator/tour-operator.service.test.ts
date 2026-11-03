import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./org-tour-operator.repository", () => ({
  orgTourOperatorRepository: {
    listForOrg: vi.fn(),
    findLink: vi.fn(),
    findLinkByOperator: vi.fn(),
    insertLink: vi.fn(),
    updateLink: vi.fn(),
    deleteLink: vi.fn(),
  },
}));
vi.mock("./tour-operator.repository", () => ({
  tourOperatorRepository: {
    findById: vi.fn(),
    findByLowerName: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    searchCatalogue: vi.fn(),
  },
}));
vi.mock("../platform-admin/platform-admin-audit.repository", () => ({
  platformAdminAuditRepository: { create: vi.fn() },
}));
// Round trip stand-in for AES: enc:<plaintext>.
vi.mock("../../utils/encryption", () => ({
  encrypt: vi.fn((s: string) => `enc:${s}`),
  decrypt: vi.fn((s: string) => {
    if (!s.startsWith("enc:")) throw new Error("bad payload");
    return s.slice(4);
  }),
}));

import { tourOperatorService } from "./tour-operator.service";
import { orgTourOperatorRepository as links } from "./org-tour-operator.repository";
import { tourOperatorRepository as catalogue } from "./tour-operator.repository";
import { platformAdminAuditRepository as audit } from "../platform-admin/platform-admin-audit.repository";
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

const raw = (over: Partial<RawOrgOperator> = {}): RawOrgOperator => ({
  linkId: "l1",
  operatorId: "op1",
  name: "TUI",
  code: null,
  website: null,
  phone: null,
  logo_url: null,
  username: "ann",
  encrypted_password: "enc:secret",
  commission_percentage: "10.00",
  balance_due_weeks: 14,
  is_active: true,
  updated_at: new Date("2026-10-12T09:00:00Z"),
  ...over,
});

const operator = (over: Record<string, unknown> = {}) =>
  ({ id: "op1", name: "TUI", code: null, website: null, phone: null, logo_url: null, ...over }) as never;

const actor = { userId: "u1", ipAddress: "1.1.1.1", userAgent: "ua", impersonating: false };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("fail closed", () => {
  it("every operation returns 403 without an organisation", async () => {
    const noOrg = scopeFor("platform_admin", "");
    await expect(tourOperatorService.listOptions(noOrg, false)).rejects.toMatchObject({ statusCode: 403, message: "Select an organisation first" });
    await expect(tourOperatorService.listManage(noOrg, false)).rejects.toMatchObject({ statusCode: 403 });
    await expect(tourOperatorService.createLink(noOrg, { name: "X Y", commissionPercentage: 1, balanceDueWeeks: 14 })).rejects.toMatchObject({ statusCode: 403 });
    await expect(tourOperatorService.revealPassword(noOrg, "l1", actor)).rejects.toMatchObject({ statusCode: 403 });
    expect(links.listForOrg).not.toHaveBeenCalled();
  });

  it("social media managers get only the credential-free options; agents cannot write", async () => {
    vi.mocked(links.listForOrg).mockResolvedValue([raw()]);
    await expect(tourOperatorService.listOptions(scopeFor("social_media_manager"), false)).resolves.toHaveLength(1);
    await expect(tourOperatorService.listManage(scopeFor("social_media_manager"), false)).rejects.toMatchObject({ statusCode: 403 });
    await expect(tourOperatorService.exportCsv(scopeFor("social_media_manager"))).rejects.toMatchObject({ statusCode: 403 });
    await expect(tourOperatorService.listOptions(scopeFor("referral_agent"), false)).rejects.toMatchObject({ statusCode: 403 });
    await expect(tourOperatorService.removeLink(scopeFor("agent"), "l1")).rejects.toMatchObject({ statusCode: 403 });
    await expect(tourOperatorService.updateLink(scopeFor("homeworker"), "l1", { isActive: false })).rejects.toMatchObject({ statusCode: 403 });
    expect(links.deleteLink).not.toHaveBeenCalled();
  });
});

describe("listings and the password role split", () => {
  it("admins get the plaintext password; agents only hasPassword", async () => {
    vi.mocked(links.listForOrg).mockResolvedValue([raw()]);
    const admin = await tourOperatorService.listManage(scopeFor("org_admin"), false);
    expect(admin).toMatchObject({ canWrite: true, canSeePasswords: true });
    expect(admin.rows[0].password).toBe("secret");

    const agent = await tourOperatorService.listManage(scopeFor("agent"), false);
    expect(agent).toMatchObject({ canWrite: false, canSeePasswords: false });
    expect(agent.rows[0]).not.toHaveProperty("password");
    expect(agent.rows[0].hasPassword).toBe(true);
    expect(JSON.stringify(agent)).not.toContain("secret");
    expect(JSON.stringify(agent)).not.toContain("enc:");
  });

  it("a password that cannot be decrypted becomes null, never the ciphertext", async () => {
    vi.mocked(links.listForOrg).mockResolvedValue([raw({ encrypted_password: "garbage" })]);
    const admin = await tourOperatorService.listManage(scopeFor("org_admin"), false);
    expect(admin.rows[0].password).toBeNull();
    expect(JSON.stringify(admin)).not.toContain("garbage");
  });

  it("options carry no credentials and pass includeInactive through", async () => {
    vi.mocked(links.listForOrg).mockResolvedValue([raw()]);
    const options = await tourOperatorService.listOptions(scopeFor("agent"), true);
    expect(links.listForOrg).toHaveBeenCalledWith("o1", true);
    expect(options[0]).toMatchObject({ id: "op1", linkId: "l1", commission_percentage: "10.00" });
    expect(options[0]).not.toHaveProperty("username");
  });

  it("searchCatalogue is scoped to the caller's org", async () => {
    vi.mocked(catalogue.searchCatalogue).mockResolvedValue([]);
    await tourOperatorService.searchCatalogue(scopeFor("agent"), "tui", false);
    expect(catalogue.searchCatalogue).toHaveBeenCalledWith("o1", "tui", false);
  });
});

describe("createLink", () => {
  const body = { name: "Sandals", commissionPercentage: 12, balanceDueWeeks: 14 };

  it("creates the catalogue row and the link, encrypting the password", async () => {
    vi.mocked(catalogue.findByLowerName).mockResolvedValue(null);
    vi.mocked(catalogue.insert).mockResolvedValue(operator({ id: "op9", name: "Sandals" }));
    vi.mocked(links.findLinkByOperator).mockResolvedValue(null);
    vi.mocked(links.insertLink).mockResolvedValue({ id: "l9" } as never);
    vi.mocked(links.findLink).mockResolvedValue(raw({ linkId: "l9", operatorId: "op9", name: "Sandals" }));

    const row = await tourOperatorService.createLink(scopeFor("org_admin"), { ...body, password: "pw", username: "bob" });

    expect(catalogue.insert).toHaveBeenCalledWith(expect.objectContaining({ name: "Sandals", created_by: "u1" }));
    expect(links.insertLink).toHaveBeenCalledWith(
      expect.objectContaining({ org_id: "o1", tour_operator_id: "op9", commission_percentage: "12", encrypted_password: "enc:pw", username: "bob" }),
    );
    expect(row.linkId).toBe("l9");
  });

  it("links an existing catalogue operator found by name and only fills blanks", async () => {
    vi.mocked(catalogue.findByLowerName).mockResolvedValue(operator({ website: "https://x.com" }));
    vi.mocked(catalogue.update).mockResolvedValue(operator());
    vi.mocked(links.findLinkByOperator).mockResolvedValue(null);
    vi.mocked(links.insertLink).mockResolvedValue({ id: "l2" } as never);
    vi.mocked(links.findLink).mockResolvedValue(raw({ linkId: "l2" }));

    await tourOperatorService.createLink(scopeFor("org_admin"), { ...body, name: "tui", website: "https://other.com", phone: "0203 451 2720" });

    expect(catalogue.insert).not.toHaveBeenCalled();
    expect(catalogue.update).toHaveBeenCalledWith("op1", { phone: "0203 451 2720" });
  });

  it("picking a catalogue operator writes edited phone/website through", async () => {
    vi.mocked(catalogue.findById).mockResolvedValue(operator({ phone: "0111 111 1111" }));
    vi.mocked(catalogue.update).mockResolvedValue(operator());
    vi.mocked(links.findLinkByOperator).mockResolvedValue(null);
    vi.mocked(links.insertLink).mockResolvedValue({ id: "l2" } as never);
    vi.mocked(links.findLink).mockResolvedValue(raw());

    await tourOperatorService.createLink(scopeFor("branch_manager"), {
      tourOperatorId: "op1", commissionPercentage: 5, balanceDueWeeks: 14, phone: "0222 222 2222",
    });
    expect(catalogue.update).toHaveBeenCalledWith("op1", { phone: "0222 222 2222" });
  });

  it("404s for an unknown catalogue id", async () => {
    vi.mocked(catalogue.findById).mockResolvedValue(null);
    await expect(
      tourOperatorService.createLink(scopeFor("org_admin"), { tourOperatorId: "nope", commissionPercentage: 5, balanceDueWeeks: 14 }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("409s when the org already has the operator", async () => {
    vi.mocked(catalogue.findByLowerName).mockResolvedValue(operator());
    vi.mocked(links.findLinkByOperator).mockResolvedValue(raw());
    await expect(tourOperatorService.createLink(scopeFor("org_admin"), body)).rejects.toMatchObject({
      statusCode: 409,
      message: "TUI is already in your list",
    });
    expect(links.insertLink).not.toHaveBeenCalled();
  });

  it("409s when a concurrent request wins the link insert", async () => {
    vi.mocked(catalogue.findByLowerName).mockResolvedValue(operator());
    vi.mocked(links.findLinkByOperator).mockResolvedValue(null);
    vi.mocked(links.insertLink).mockResolvedValue(null);
    await expect(tourOperatorService.createLink(scopeFor("org_admin"), body)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("re-selects the catalogue row when it loses the unique-name race", async () => {
    vi.mocked(catalogue.findByLowerName).mockResolvedValueOnce(null).mockResolvedValueOnce(operator({ id: "op7", name: "Sandals" }));
    vi.mocked(catalogue.insert).mockResolvedValue(null);
    vi.mocked(links.findLinkByOperator).mockResolvedValue(null);
    vi.mocked(links.insertLink).mockResolvedValue({ id: "l7" } as never);
    vi.mocked(links.findLink).mockResolvedValue(raw({ linkId: "l7" }));
    await tourOperatorService.createLink(scopeFor("org_admin"), body);
    expect(links.insertLink).toHaveBeenCalledWith(expect.objectContaining({ tour_operator_id: "op7" }));
  });
});

describe("createLink catalogue write-through ordering", () => {
  it("a 409 leaves the shared catalogue row untouched", async () => {
    vi.mocked(catalogue.findById).mockResolvedValue(operator({ phone: "0111 111 1111" }));
    vi.mocked(links.findLinkByOperator).mockResolvedValue(raw());
    await expect(
      tourOperatorService.createLink(scopeFor("org_admin"), {
        tourOperatorId: "op1", commissionPercentage: 5, balanceDueWeeks: 14, phone: "0222 222 2222", website: "https://evil.example",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(catalogue.update).not.toHaveBeenCalled();
  });

  it("a lost link-insert race also leaves the catalogue untouched; success writes through afterwards", async () => {
    vi.mocked(catalogue.findByLowerName).mockResolvedValue(operator());
    vi.mocked(links.findLinkByOperator).mockResolvedValue(null);
    vi.mocked(links.insertLink).mockResolvedValue(null);
    await expect(
      tourOperatorService.createLink(scopeFor("org_admin"), { name: "tui", commissionPercentage: 5, balanceDueWeeks: 14, phone: "0222 222 2222" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(catalogue.update).not.toHaveBeenCalled();
  });
});

describe("updateLink rename race", () => {
  it("maps a unique violation on the catalogue rename to a 409", async () => {
    vi.mocked(links.findLink).mockResolvedValue(raw());
    vi.mocked(catalogue.findByLowerName).mockResolvedValue(null);
    vi.mocked(catalogue.update).mockRejectedValue({ code: "23505" });
    await expect(tourOperatorService.updateLink(scopeFor("org_admin"), "l1", { name: "Sandals" })).rejects.toMatchObject({
      statusCode: 409,
      message: "Sandals is already in the catalogue",
    });
    expect(links.updateLink).not.toHaveBeenCalled();
  });

  it("rethrows other database errors", async () => {
    vi.mocked(links.findLink).mockResolvedValue(raw());
    vi.mocked(catalogue.findByLowerName).mockResolvedValue(null);
    vi.mocked(catalogue.update).mockRejectedValue(new Error("boom"));
    await expect(tourOperatorService.updateLink(scopeFor("org_admin"), "l1", { name: "Sandals" })).rejects.toThrow("boom");
  });
});

describe("updateLink", () => {
  it("404s for another org's link (lookup is org scoped)", async () => {
    vi.mocked(links.findLink).mockResolvedValue(null);
    await expect(tourOperatorService.updateLink(scopeFor("org_admin"), "other", { isActive: false })).rejects.toMatchObject({ statusCode: 404 });
    expect(links.findLink).toHaveBeenCalledWith("o1", "other");
    expect(links.updateLink).not.toHaveBeenCalled();
  });

  it("an empty password clears the stored one; a new one is encrypted", async () => {
    vi.mocked(links.findLink).mockResolvedValue(raw());
    vi.mocked(links.updateLink).mockResolvedValue({ id: "l1" } as never);
    await tourOperatorService.updateLink(scopeFor("org_admin"), "l1", { password: "" });
    expect(links.updateLink).toHaveBeenLastCalledWith("o1", "l1", expect.objectContaining({ encrypted_password: null, updated_by: "u1" }));
    await tourOperatorService.updateLink(scopeFor("org_admin"), "l1", { password: "new" });
    expect(links.updateLink).toHaveBeenLastCalledWith("o1", "l1", expect.objectContaining({ encrypted_password: "enc:new" }));
  });

  it("commission null clears it; numbers become decimal strings", async () => {
    vi.mocked(links.findLink).mockResolvedValue(raw());
    vi.mocked(links.updateLink).mockResolvedValue({ id: "l1" } as never);
    await tourOperatorService.updateLink(scopeFor("org_admin"), "l1", { commissionPercentage: null });
    expect(links.updateLink).toHaveBeenLastCalledWith("o1", "l1", expect.objectContaining({ commission_percentage: null }));
    await tourOperatorService.updateLink(scopeFor("org_admin"), "l1", { commissionPercentage: 8.5, isActive: false });
    expect(links.updateLink).toHaveBeenLastCalledWith("o1", "l1", expect.objectContaining({ commission_percentage: "8.5", is_active: false }));
  });

  it("renaming to another operator's name is a 409; catalogue fields write through", async () => {
    vi.mocked(links.findLink).mockResolvedValue(raw());
    vi.mocked(catalogue.findByLowerName).mockResolvedValue(operator({ id: "other", name: "Sandals" }));
    await expect(tourOperatorService.updateLink(scopeFor("org_admin"), "l1", { name: "Sandals" })).rejects.toMatchObject({
      statusCode: 409,
      message: "Sandals is already in the catalogue",
    });
    expect(catalogue.update).not.toHaveBeenCalled();

    vi.mocked(catalogue.findByLowerName).mockResolvedValue(null);
    vi.mocked(links.updateLink).mockResolvedValue({ id: "l1" } as never);
    await tourOperatorService.updateLink(scopeFor("org_admin"), "l1", { name: "TUI UK", website: "", phone: "0203 451 2720" });
    expect(catalogue.update).toHaveBeenCalledWith("op1", { name: "TUI UK", website: null, phone: "0203 451 2720" });
  });
});

describe("removeLink", () => {
  it("deletes the link in the caller's org, 404 when nothing was removed", async () => {
    vi.mocked(links.deleteLink).mockResolvedValue(true);
    await tourOperatorService.removeLink(scopeFor("branch_manager"), "l1");
    expect(links.deleteLink).toHaveBeenCalledWith("o1", "l1");
    vi.mocked(links.deleteLink).mockResolvedValue(false);
    await expect(tourOperatorService.removeLink(scopeFor("branch_manager"), "l2")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("revealPassword", () => {
  it("returns the plaintext for an agent and audits who/when/linkId without the secret", async () => {
    vi.mocked(links.findLink).mockResolvedValue(raw());
    const out = await tourOperatorService.revealPassword(scopeFor("agent"), "l1", actor);
    expect(out).toEqual({ password: "secret" });
    const call = vi.mocked(audit.create).mock.calls[0][0];
    expect(call).toMatchObject({
      actorUserId: "u1",
      action: "tour_operator.password_reveal",
      targetOrgId: "o1",
      metadata: { linkId: "l1" },
      ipAddress: "1.1.1.1",
      userAgent: "ua",
    });
    expect(JSON.stringify(call)).not.toContain("secret");
  });

  it("fails closed: when the audit write fails the secret is not returned", async () => {
    vi.mocked(links.findLink).mockResolvedValue(raw());
    vi.mocked(audit.create).mockRejectedValue(new Error("db down"));
    await expect(tourOperatorService.revealPassword(scopeFor("agent"), "l1", actor)).rejects.toThrow("db down");
  });

  it("returns null when decryption fails, and 404s for another org's link", async () => {
    vi.mocked(links.findLink).mockResolvedValue(raw({ encrypted_password: "garbage" }));
    expect(await tourOperatorService.revealPassword(scopeFor("agent"), "l1", actor)).toEqual({ password: null });
    vi.mocked(links.findLink).mockResolvedValue(null);
    await expect(tourOperatorService.revealPassword(scopeFor("agent"), "zz", actor)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("exportCsv", () => {
  it("includes passwords for admins and blanks them for agents", async () => {
    vi.mocked(links.listForOrg).mockResolvedValue([raw()]);
    const admin = await tourOperatorService.exportCsv(scopeFor("org_admin"));
    expect(admin).toContain("ann,secret,10,14");
    const agent = await tourOperatorService.exportCsv(scopeFor("agent"));
    expect(agent).not.toContain("secret");
    expect(agent).toContain("ann,,10,14");
    expect(links.listForOrg).toHaveBeenCalledWith("o1", true);
  });
});
