import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../organization/organization.repository", () => ({
  organizationRepository: { findById: vi.fn(), update: vi.fn(), mergeSettingsSection: vi.fn() },
}));
vi.mock("../branch/branch.repository", () => ({
  branchRepository: { findAllByOrg: vi.fn(), update: vi.fn() },
}));
vi.mock("../branch/branch.service", () => ({ branchService: { create: vi.fn() } }));
vi.mock("../invite/invite.service", () => ({ inviteService: { send: vi.fn() } }));
const TX = vi.hoisted(() => ({ tx: true }));
vi.mock("./onboarding-setup.repository", () => ({
  onboardingSetupRepository: {
    withOrgLock: vi.fn(),
    readOnboarding: vi.fn(),
    claimPlaceholder: vi.fn(),
    saveBusiness: vi.fn(),
    findOwner: vi.fn(),
    countOtherUsers: vi.fn(),
    hasTargetForMonth: vi.fn(),
    hasTransaction: vi.fn(),
  },
}));

import { onboardingSetupService } from "./onboarding-setup.service";
import { organizationRepository } from "../organization/organization.repository";
import { branchRepository } from "../branch/branch.repository";
import { branchService } from "../branch/branch.service";
import { inviteService } from "../invite/invite.service";
import { onboardingSetupRepository } from "./onboarding-setup.repository";
import { AppError } from "../../utils/error-handler";

const actor = { orgId: "org1", userId: "someone-else", orgRole: "org_admin", branchId: null };

function org(settings: Record<string, unknown> | null, over: Record<string, unknown> = {}) {
  return { id: "org1", name: "Acme Travel", settings, homeworkerCommission: null, ...over } as never;
}

function branch(id: string, name: string, isDefault = false) {
  return { id, name, phone: "", address: "", email: "", isDefault } as never;
}

function shop(over: Record<string, unknown> = {}) {
  return { name: "Leeds", phone: "0113", address: "1 Briggate", email: "leeds@acme.com", managerEmail: "", ...over };
}

const pendingOnb = { status: "pending", version: 1, placeholderBranchId: "b0" };
const pending = { onboarding: pendingOnb };

/** Makes the locked per-row read return `onboarding` (the DB state under the lock). */
function lockedOnboarding(onboarding: unknown) {
  vi.mocked(onboardingSetupRepository.readOnboarding).mockResolvedValue(onboarding);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(organizationRepository.findById).mockResolvedValue(org(pending));
  vi.mocked(organizationRepository.update).mockResolvedValue(org(pending));
  vi.mocked(onboardingSetupRepository.findOwner).mockResolvedValue({
    id: "owner1", firstName: "Ada", lastName: "Lovelace", email: "Ada@acme.com",
  } as never);
  vi.mocked(onboardingSetupRepository.withOrgLock).mockImplementation(async (_o, fn) => fn(TX as never));
  vi.mocked(onboardingSetupRepository.claimPlaceholder).mockResolvedValue(true);
  lockedOnboarding(pendingOnb);
  vi.mocked(branchRepository.findAllByOrg).mockResolvedValue([branch("b0", "Acme Travel", true)]);
  vi.mocked(branchRepository.update).mockImplementation(async (id, data) => ({ id, ...data }) as never);
  vi.mocked(branchService.create).mockImplementation(async (data) => ({ id: "b-new", ...data }) as never);
  vi.mocked(inviteService.send).mockResolvedValue({} as never);
  vi.mocked(onboardingSetupRepository.countOtherUsers).mockResolvedValue(0);
  vi.mocked(onboardingSetupRepository.hasTargetForMonth).mockResolvedValue(false);
  vi.mocked(onboardingSetupRepository.hasTransaction).mockResolvedValue(false);
});

afterEach(() => vi.useRealTimers());

describe("getState", () => {
  it("treats an org with no onboarding key as complete", async () => {
    vi.mocked(organizationRepository.findById).mockResolvedValue(org({}));
    expect((await onboardingSetupService.getState("org1")).status).toBe("complete");
    vi.mocked(organizationRepository.findById).mockResolvedValue(org(null));
    expect((await onboardingSetupService.getState("org1")).status).toBe("complete");
  });

  it("derives the checklist from the repositories and profile, counting others besides the org owner", async () => {
    vi.mocked(organizationRepository.findById).mockResolvedValue(
      org({ ...pending, profile: { phone: "0123", addressLine1: "1 High St" } }),
    );
    vi.mocked(onboardingSetupRepository.countOtherUsers).mockResolvedValue(2);
    vi.mocked(onboardingSetupRepository.hasTargetForMonth).mockResolvedValue(true);
    vi.mocked(onboardingSetupRepository.hasTransaction).mockResolvedValue(true);

    const state = await onboardingSetupService.getState("org1");

    expect(state.status).toBe("pending");
    expect(state.checklist).toEqual({ account: true, business: true, invites: true, targets: true, enquiry: true });
    // the owner is the org's admin, never the requester
    expect(onboardingSetupRepository.countOtherUsers).toHaveBeenCalledWith("org1", "owner1");
    expect(state.owner).toEqual({ firstName: "Ada", lastName: "Lovelace", email: "Ada@acme.com" });
  });

  it("business is false unless both phone and address are saved; everything else false by default", async () => {
    vi.mocked(organizationRepository.findById).mockResolvedValue(org({ ...pending, profile: { phone: "0123" } }));
    const state = await onboardingSetupService.getState("org1");
    expect(state.checklist).toEqual({ account: true, business: false, invites: false, targets: false, enquiry: false });
  });

  it("returns business, branches and commission", async () => {
    vi.mocked(organizationRepository.findById).mockResolvedValue(
      org({ ...pending, profile: { website: "https://a.com", email: "hi@a.com" } }, { homeworkerCommission: 40 }),
    );
    const state = await onboardingSetupService.getState("org1");
    expect(state.business).toMatchObject({ name: "Acme Travel", website: "https://a.com", email: "hi@a.com" });
    expect(state.branches).toEqual([{ id: "b0", name: "Acme Travel", phone: "", address: "", email: "", isDefault: true, isPlaceholder: true }]);
    expect(state.homeworkerCommission).toBe(40);
    expect(state.businessType).toBeNull();
  });

  it("uses the London month for the targets check at the BST boundary", async () => {
    // 23:30 UTC on 30 June is 00:30 on 1 July in London.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T23:30:00Z"));
    await onboardingSetupService.getState("org1");
    expect(onboardingSetupRepository.hasTargetForMonth).toHaveBeenLastCalledWith("org1", 2026, 7);

    // In winter London equals UTC, so 23:30 UTC on 31 Dec is still December.
    vi.setSystemTime(new Date("2026-12-31T23:30:00Z"));
    await onboardingSetupService.getState("org1");
    expect(onboardingSetupRepository.hasTargetForMonth).toHaveBeenLastCalledWith("org1", 2026, 12);

    vi.setSystemTime(new Date("2026-12-31T23:30:00Z").getTime() + 60 * 60 * 1000);
    await onboardingSetupService.getState("org1");
    expect(onboardingSetupRepository.hasTargetForMonth).toHaveBeenLastCalledWith("org1", 2027, 1);
  });
});

describe("non-pending orgs are never modified (409 ONBOARDING_NOT_PENDING)", () => {
  const input = { businessType: "single" as const, businessName: "X Ltd", phone: "1", address: "1 High St", website: "", email: "a@b.com" };

  for (const [label, settings] of [
    ["legacy org (no onboarding key)", {}],
    ["completed org", { onboarding: { status: "complete", version: 1, placeholderBranchId: "b0" } }],
  ] as const) {
    it(`${label}: every write is rejected and nothing is written`, async () => {
      vi.mocked(organizationRepository.findById).mockResolvedValue(org(settings));
      lockedOnboarding(settings.onboarding ?? null);

      const calls = [
        () => onboardingSetupService.saveBusiness(actor, input),
        () => onboardingSetupService.addShops(actor, [shop()] as never),
        () => onboardingSetupService.setHomeworkerCommission("org1", 10),
        () => onboardingSetupService.complete("org1"),
      ];
      for (const call of calls) {
        await expect(call()).rejects.toMatchObject({ statusCode: 409, code: "ONBOARDING_NOT_PENDING" });
      }

      expect(onboardingSetupRepository.saveBusiness).not.toHaveBeenCalled();
      expect(branchRepository.update).not.toHaveBeenCalled();
      expect(branchService.create).not.toHaveBeenCalled();
      expect(organizationRepository.update).not.toHaveBeenCalled();
      expect(organizationRepository.mergeSettingsSection).not.toHaveBeenCalled();
    });
  }

  it("re-checks the status under the lock (completed between the pre-check and the row)", async () => {
    lockedOnboarding({ status: "complete", version: 1, placeholderBranchId: "b0" });

    const out = await onboardingSetupService.addShops(actor, [shop()] as never);

    expect(out.results[0]).toMatchObject({ status: "error", code: "ONBOARDING_NOT_PENDING", managerInvite: "not_attempted" });
    expect(branchRepository.update).not.toHaveBeenCalled();
  });
});

describe("saveBusiness", () => {
  const input = {
    businessType: "single" as const,
    businessName: " Acme Ltd ",
    phone: "0123",
    address: "1 High St",
    website: "",
    email: "hi@acme.com",
  };

  it("saves name and profile fields atomically (SQL merge) and mirrors onto the placeholder for a single shop", async () => {
    await onboardingSetupService.saveBusiness(actor, input);

    expect(onboardingSetupRepository.saveBusiness).toHaveBeenCalledWith({
      orgId: "org1",
      name: "Acme Ltd",
      profile: { phone: "0123", addressLine1: "1 High St", website: "", email: "hi@acme.com" },
      businessType: "single",
      branchCopy: { id: "b0", fields: { name: "Acme Ltd", phone: "0123", address: "1 High St", email: "hi@acme.com" } },
    });
    // no read-copy-writeback of settings from the service
    expect(organizationRepository.update).not.toHaveBeenCalled();
  });

  it("does not touch a branch for multi, when the placeholder was already claimed, or when it moved/is unknown", async () => {
    await onboardingSetupService.saveBusiness(actor, { ...input, businessType: "multi" });
    expect(vi.mocked(onboardingSetupRepository.saveBusiness).mock.calls[0][0].branchCopy).toBeUndefined();

    vi.mocked(organizationRepository.findById).mockResolvedValue(
      org({ onboarding: { ...pendingOnb, defaultBranchClaimed: true } }),
    );
    await onboardingSetupService.saveBusiness(actor, input);
    expect(vi.mocked(onboardingSetupRepository.saveBusiness).mock.calls[1][0].branchCopy).toBeUndefined();

    // pending org without a placeholder id: no default-branch guessing
    vi.mocked(organizationRepository.findById).mockResolvedValue(org({ onboarding: { status: "pending", version: 1 } }));
    await onboardingSetupService.saveBusiness(actor, input);
    expect(vi.mocked(onboardingSetupRepository.saveBusiness).mock.calls[2][0].branchCopy).toBeUndefined();
  });
});

describe("addShops", () => {
  it("claims the placeholder for the first shop (conditionally), then creates the rest under the lock with default hours", async () => {
    // after the first row the placeholder is claimed in the DB
    vi.mocked(onboardingSetupRepository.readOnboarding)
      .mockResolvedValueOnce(pendingOnb)
      .mockResolvedValueOnce({ ...pendingOnb, defaultBranchClaimed: true });

    const out = await onboardingSetupService.addShops(actor, [
      shop(),
      shop({ name: "York", email: "york@acme.com" }),
    ] as never);

    expect(onboardingSetupRepository.withOrgLock).toHaveBeenCalledTimes(2);
    expect(branchRepository.update).toHaveBeenCalledWith(
      "b0", { name: "Leeds", phone: "0113", address: "1 Briggate", email: "leeds@acme.com" }, "org1", TX,
    );
    expect(onboardingSetupRepository.claimPlaceholder).toHaveBeenCalledWith("org1", "b0", TX);

    expect(branchService.create).toHaveBeenCalledTimes(1);
    const created = vi.mocked(branchService.create).mock.calls[0];
    expect(created[1]).toBe("org1");
    expect(created[2]).toBe(TX);
    expect(created[0]).toMatchObject({ name: "York", openingPattern: "mon-fri", bankHolidaysOpen: false });
    const hours = created[0].openingHours as Array<{ day: string; open: boolean; openTime: string; closeTime: string }>;
    expect(hours.map((h) => h.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(hours[0]).toMatchObject({ open: true, openTime: "08:00", closeTime: "17:00" });
    expect(hours[6].open).toBe(false);

    expect(out.results.map((r) => r.status)).toEqual(["updated", "created"]);
  });

  it("never claims the default branch when the placeholder was moved: a different default is left alone", async () => {
    // the placeholder b0 no longer exists; the org's default is now b9 (an established branch)
    vi.mocked(branchRepository.findAllByOrg).mockResolvedValue([branch("b9", "Real HQ", true)]);

    const out = await onboardingSetupService.addShops(actor, [shop()] as never);

    expect(branchRepository.update).not.toHaveBeenCalled();
    expect(onboardingSetupRepository.claimPlaceholder).not.toHaveBeenCalled();
    expect(out.results[0]).toMatchObject({ status: "created", branchId: "b-new" });
  });

  it("a pending org with no placeholder id claims nothing", async () => {
    lockedOnboarding({ status: "pending", version: 1 });

    const out = await onboardingSetupService.addShops(actor, [shop({ name: "York" })] as never);

    expect(branchRepository.update).not.toHaveBeenCalled();
    expect(branchService.create).toHaveBeenCalledTimes(1);
    expect(out.results[0].status).toBe("created");
  });

  it("does not reuse the placeholder again once it was claimed", async () => {
    lockedOnboarding({ ...pendingOnb, defaultBranchClaimed: true });

    const out = await onboardingSetupService.addShops(actor, [shop({ name: "York" })] as never);

    expect(branchRepository.update).not.toHaveBeenCalled();
    expect(onboardingSetupRepository.claimPlaceholder).not.toHaveBeenCalled();
    expect(out.results[0]).toMatchObject({ status: "created", branchId: "b-new" });
  });

  it("updates an existing shop with the same name instead of duplicating it", async () => {
    lockedOnboarding({ ...pendingOnb, defaultBranchClaimed: true });
    vi.mocked(branchRepository.findAllByOrg).mockResolvedValue([branch("b0", "Acme", true), branch("b1", "LEEDS")]);

    const out = await onboardingSetupService.addShops(actor, [shop()] as never);

    expect(branchService.create).not.toHaveBeenCalled();
    expect(branchRepository.update).toHaveBeenCalledWith("b1", expect.objectContaining({ name: "Leeds" }), "org1", TX);
    expect(out.results[0]).toMatchObject({ status: "updated", branchId: "b1" });
  });

  it("reports a plan-limit failure per row (message and code kept) without aborting the others", async () => {
    lockedOnboarding({ ...pendingOnb, defaultBranchClaimed: true });
    vi.mocked(branchService.create)
      .mockResolvedValueOnce({ id: "b-a", name: "A1" } as never)
      .mockRejectedValueOnce(new AppError('Plan "starter" allows 2 branch(es). Upgrade to add more.', 403, true, "BRANCH_LIMIT_REACHED"))
      .mockResolvedValueOnce({ id: "b-c", name: "C3" } as never);

    const out = await onboardingSetupService.addShops(actor, [
      shop({ name: "A1" }), shop({ name: "B2", managerEmail: "m@x.com" }), shop({ name: "C3" }),
    ] as never);

    expect(out.results.map((r) => r.status)).toEqual(["created", "error", "created"]);
    expect(out.results[1]).toEqual({
      index: 1,
      status: "error",
      error: 'Plan "starter" allows 2 branch(es). Upgrade to add more.',
      code: "BRANCH_LIMIT_REACHED",
      managerInvite: "not_attempted",
    });
    expect(inviteService.send).not.toHaveBeenCalled();
  });

  it("invites the manager as branch_manager of the shop with the acting context", async () => {
    const out = await onboardingSetupService.addShops(actor, [shop({ managerEmail: " Mgr@Acme.com " })] as never);

    expect(inviteService.send).toHaveBeenCalledWith(
      { email: "mgr@acme.com", branchId: "b0", orgRole: "branch_manager" },
      actor,
      undefined,
    );
    expect(out.results[0].managerInvite).toBe("sent");
  });

  it("skips the manager invite when blank or equal to the ORG OWNER's email (not the requester's), case-insensitive", async () => {
    const out = await onboardingSetupService.addShops(actor, [
      shop({ name: "A1", managerEmail: "" }),
      shop({ name: "B2", managerEmail: "ADA@acme.com" }),
    ] as never);

    expect(inviteService.send).not.toHaveBeenCalled();
    expect(out.results.map((r) => r.managerInvite)).toEqual(["skipped", "skipped"]);
    expect(onboardingSetupRepository.findOwner).toHaveBeenCalledWith("org1");
  });

  it("reports a failed manager invite on the row without failing the shop", async () => {
    vi.mocked(inviteService.send).mockRejectedValue(new AppError("No seats left", 403));

    const out = await onboardingSetupService.addShops(actor, [shop({ managerEmail: "m@x.com" })] as never);

    expect(out.results[0]).toMatchObject({ status: "updated", managerInvite: "error", managerInviteError: "No seats left" });
  });

  it("scopes everything to the actor's org", async () => {
    await onboardingSetupService.addShops({ ...actor, orgId: "orgZ" }, [shop({ name: "York" })] as never);
    expect(organizationRepository.findById).toHaveBeenCalledWith("orgZ");
    expect(onboardingSetupRepository.withOrgLock).toHaveBeenCalledWith("orgZ", expect.any(Function));
    expect(branchRepository.findAllByOrg).toHaveBeenCalledWith("orgZ", "shop", TX);
  });
});

describe("setHomeworkerCommission", () => {
  beforeEach(() => {
    vi.mocked(organizationRepository.update).mockImplementation(async (_id, data) => ({ ...data }) as never);
  });

  it.each([0, 50, 100, null])("stores %s", async (p) => {
    await expect(onboardingSetupService.setHomeworkerCommission("org1", p)).resolves.toEqual({ homeworkerCommission: p });
    expect(organizationRepository.update).toHaveBeenCalledWith("org1", { homeworkerCommission: p });
  });
});

describe("complete", () => {
  it("atomically merges status and an ISO completedAt into settings.onboarding", async () => {
    await expect(onboardingSetupService.complete("org1")).resolves.toEqual({ status: "complete" });

    expect(organizationRepository.mergeSettingsSection).toHaveBeenCalledTimes(1);
    const [orgId, section, patch] = vi.mocked(organizationRepository.mergeSettingsSection).mock.calls[0];
    expect(orgId).toBe("org1");
    expect(section).toBe("onboarding");
    expect(patch).toMatchObject({ status: "complete" });
    expect(new Date(patch.completedAt as string).toISOString()).toBe(patch.completedAt);
    expect(organizationRepository.update).not.toHaveBeenCalled();
  });
});

describe("getState branches[].isPlaceholder", () => {
  const two = () => vi.mocked(branchRepository.findAllByOrg).mockResolvedValue([branch("b0", "Acme", true), branch("b1", "Leeds")]);
  const flags = async () => (await onboardingSetupService.getState("org1")).branches.map((b) => b.isPlaceholder);

  it("is true only for the unclaimed signup placeholder", async () => {
    two();
    expect(await flags()).toEqual([true, false]);
  });

  it("is false once the placeholder was claimed (it is a real shop)", async () => {
    two();
    vi.mocked(organizationRepository.findById).mockResolvedValue(
      org({ onboarding: { ...pendingOnb, defaultBranchClaimed: true } }),
    );
    expect(await flags()).toEqual([false, false]);
  });

  it("is always false for legacy orgs and pending orgs without a placeholder id", async () => {
    two();
    vi.mocked(organizationRepository.findById).mockResolvedValue(org({}));
    expect(await flags()).toEqual([false, false]);
    vi.mocked(organizationRepository.findById).mockResolvedValue(org({ onboarding: { status: "pending", version: 1 } }));
    expect(await flags()).toEqual([false, false]);
  });
});
