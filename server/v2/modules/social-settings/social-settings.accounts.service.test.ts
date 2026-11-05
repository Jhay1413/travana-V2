import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({ listOnlySocialsAccounts: vi.fn() }));

vi.mock("./social-settings.repository", () => ({
  socialSettingsRepository: { findByOrg: vi.fn(), upsert: vi.fn(), orgExists: vi.fn(), setAllowedAccountIds: vi.fn(), findOrgIdForDeal: vi.fn() },
}));
vi.mock("../../utils/only-socials", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/only-socials")>()),
  listOnlySocialsAccounts: mocks.listOnlySocialsAccounts,
}));

import { socialSettingsService } from "./social-settings.service";
import { socialSettingsRepository } from "./social-settings.repository";
import { AppError } from "../../utils/error-handler";

const acct = (over: Record<string, unknown>) => ({
  id: 1, uuid: "u", name: "A", username: null, image: null, provider: "facebook_page", platform: "facebook", authorized: true, ...over,
});
const LEGACY = acct({ id: 81085, name: "Apple Travel" });
const PAGE2 = acct({ id: 5, name: "Second Page" });
const IG = acct({ id: 7, name: "Apple IG", provider: "instagram", platform: "instagram" });
const DEAD = acct({ id: 9, name: "Dead Page", authorized: false });
const PIN = acct({ id: 3, name: "Pin", provider: "pinterest", platform: "other" });
const LIVE = [LEGACY, PAGE2, IG, DEAD, PIN];

const settingsRow = (ids: number[] | null) =>
  ({ orgId: "o1", allowedAccountIds: ids }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ONLY_SOCIALS_WORKSPACE = "ws";
  process.env.ONLYSOCIAL_API_KEY = "key";
  delete process.env.SOCIAL_INSTAGRAM_ENABLED;
  mocks.listOnlySocialsAccounts.mockResolvedValue(LIVE);
  vi.mocked(socialSettingsRepository.orgExists).mockResolvedValue(true);
});

afterEach(() => {
  delete process.env.SOCIAL_INSTAGRAM_ENABLED;
});

describe("socialSettingsService.listAccounts", () => {
  it("shows only the legacy account when the agency has no allow-list (null or empty)", async () => {
    for (const row of [null, settingsRow(null), settingsRow([])]) {
      vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(row);
      const result = await socialSettingsService.listAccounts("o1");
      expect(result.configured).toBe(true);
      expect(result.accounts.map((a) => a.id)).toEqual([81085]);
    }
  });

  it("filters to the agency's allow-list so other agencies' accounts never appear", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(settingsRow([5, 81085]));
    const { accounts } = await socialSettingsService.listAccounts("o1");
    expect(accounts.map((a) => a.id)).toEqual([81085, 5]);
    expect(accounts.every((a) => a.selectable)).toBe(true);
  });

  it("marks Instagram not selectable while the server flag is off", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(settingsRow([7]));
    const { accounts } = await socialSettingsService.listAccounts("o1");
    expect(accounts[0]).toMatchObject({ id: 7, platform: "instagram", selectable: false, unavailableReason: "Instagram coming soon" });
  });

  it("makes Instagram selectable when SOCIAL_INSTAGRAM_ENABLED is true", async () => {
    process.env.SOCIAL_INSTAGRAM_ENABLED = "true";
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(settingsRow([7]));
    const { accounts } = await socialSettingsService.listAccounts("o1");
    expect(accounts[0]).toMatchObject({ id: 7, selectable: true });
    expect(accounts[0].unavailableReason).toBeUndefined();
  });

  it("marks an unauthorized account not selectable with a reconnect reason", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(settingsRow([9]));
    const { accounts } = await socialSettingsService.listAccounts("o1");
    expect(accounts[0]).toMatchObject({ id: 9, authorized: false, selectable: false, unavailableReason: "Reconnect in OnlySocials" });
  });

  it("marks other platforms not selectable", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(settingsRow([3]));
    const { accounts } = await socialSettingsService.listAccounts("o1");
    expect(accounts[0]).toMatchObject({ id: 3, platform: "other", selectable: false });
  });

  it("returns configured:false (not an error) when credentials are missing, without calling OnlySocials", async () => {
    delete process.env.ONLYSOCIAL_API_KEY;
    expect(await socialSettingsService.listAccounts("o1")).toEqual({ configured: false, accounts: [] });
    expect(mocks.listOnlySocialsAccounts).not.toHaveBeenCalled();

    process.env.ONLYSOCIAL_API_KEY = "key";
    delete process.env.ONLY_SOCIALS_WORKSPACE;
    expect(await socialSettingsService.listAccounts("o1")).toEqual({ configured: false, accounts: [] });
  });

  it("lets an OnlySocials outage propagate as the 502 AppError", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(null);
    mocks.listOnlySocialsAccounts.mockRejectedValue(new AppError("Couldn't load connected accounts", 502));
    await expect(socialSettingsService.listAccounts("o1")).rejects.toMatchObject({ statusCode: 502 });
  });

  it("passes force through for a fresh list", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(null);
    await socialSettingsService.listAccounts("o1", { force: true });
    expect(mocks.listOnlySocialsAccounts).toHaveBeenCalledWith({ force: true });
  });

  it("uses the legacy-only list for a trusted scope with no org", async () => {
    const { accounts } = await socialSettingsService.listAccounts(null);
    expect(accounts.map((a) => a.id)).toEqual([81085]);
    expect(socialSettingsRepository.findByOrg).not.toHaveBeenCalled();
  });
});

describe("socialSettingsService platform-admin allow-list", () => {
  it("setAllowList rejects ids that are not in the live workspace list and writes nothing", async () => {
    await expect(socialSettingsService.setAllowList("o1", [5, 999], "admin")).rejects.toMatchObject({ statusCode: 400 });
    expect(socialSettingsRepository.setAllowedAccountIds).not.toHaveBeenCalled();
    expect(mocks.listOnlySocialsAccounts).toHaveBeenCalledWith({ force: true });
  });

  it("setAllowList de-duplicates and stores the ids", async () => {
    vi.mocked(socialSettingsRepository.setAllowedAccountIds).mockResolvedValue(settingsRow([5, 81085]));
    const view = await socialSettingsService.setAllowList("o1", [5, 81085, 5], "admin");
    expect(socialSettingsRepository.setAllowedAccountIds).toHaveBeenCalledWith("o1", [5, 81085], "admin");
    expect(view.allowedAccountIds).toEqual([5, 81085]);
    expect(view.accounts).toHaveLength(LIVE.length);
  });

  it("setAllowList with an empty list resets to null (legacy account only)", async () => {
    vi.mocked(socialSettingsRepository.setAllowedAccountIds).mockResolvedValue(settingsRow(null));
    await socialSettingsService.setAllowList("o1", [], null);
    expect(socialSettingsRepository.setAllowedAccountIds).toHaveBeenCalledWith("o1", null, null);
  });

  it("404s for an unknown organization", async () => {
    vi.mocked(socialSettingsRepository.orgExists).mockResolvedValue(false);
    await expect(socialSettingsService.setAllowList("nope", [5], "admin")).rejects.toMatchObject({ statusCode: 404 });
    await expect(socialSettingsService.getAllowList("nope")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("getAllowList lists every workspace account plus the explicit allow-list", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(settingsRow([5]));
    const view = await socialSettingsService.getAllowList("o1");
    expect(view.accounts.map((a) => a.id)).toEqual([81085, 5, 7, 9, 3]);
    expect(view.allowedAccountIds).toEqual([5]);
  });
});

describe("socialSettingsService.listAccountsFor", () => {
  const admin = { orgId: "org-A", orgRole: "platform_admin" };
  const agent = { orgId: "org-A", orgRole: "agent" };

  it("a platform admin with a deal id gets the DEAL's agency list, not the one they are acting in", async () => {
    vi.mocked(socialSettingsRepository.findOrgIdForDeal).mockResolvedValue("org-B");
    vi.mocked(socialSettingsRepository.findByOrg).mockImplementation(async (orgId: string) => settingsRow(orgId === "org-B" ? [5] : null));
    const { accounts } = await socialSettingsService.listAccountsFor(admin, "deal-1");
    expect(accounts.map((a) => a.id)).toEqual([5]);
    expect(socialSettingsRepository.findByOrg).toHaveBeenCalledWith("org-B");
  });

  it("an agency user cannot redirect the list with a deal id", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(null);
    const { accounts } = await socialSettingsService.listAccountsFor(agent, "deal-of-another-agency");
    expect(socialSettingsRepository.findOrgIdForDeal).not.toHaveBeenCalled();
    expect(socialSettingsRepository.findByOrg).toHaveBeenCalledWith("org-A");
    expect(accounts.map((a) => a.id)).toEqual([81085]);
  });

  it("a platform admin without a deal id gets their active agency", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(null);
    await socialSettingsService.listAccountsFor(admin, undefined);
    expect(socialSettingsRepository.findByOrg).toHaveBeenCalledWith("org-A");
  });
});

describe("socialSettingsService.resolveDraftTargets (draft save)", () => {
  it("checks the allow-list and reads platforms from the cached list, never forcing a refresh", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(settingsRow([81085, 7]));
    const result = await socialSettingsService.resolveDraftTargets("o1", [81085, 7]);
    expect(result).toEqual([{ accountId: 81085, platform: "facebook" }, { accountId: 7, platform: "instagram" }]);
    expect(mocks.listOnlySocialsAccounts).toHaveBeenCalledWith();
  });

  it("does not require the account to be connected or the Instagram flag to be on", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(settingsRow([9, 7]));
    await expect(socialSettingsService.resolveDraftTargets("o1", [9, 7])).resolves.toHaveLength(2);
  });

  it("refuses an id outside the agency allow-list (422) without any OnlySocials call", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(settingsRow([81085]));
    await expect(socialSettingsService.resolveDraftTargets("o1", [5])).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.listOnlySocialsAccounts).not.toHaveBeenCalled();
  });

  it("an agency with no allow-list can only save the legacy account", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(null);
    await expect(socialSettingsService.resolveDraftTargets("o1", [81085])).resolves.toHaveLength(1);
    await expect(socialSettingsService.resolveDraftTargets("o1", [7])).rejects.toMatchObject({ statusCode: 422 });
  });

  it("propagates an OnlySocials outage as the 502", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(settingsRow([81085]));
    mocks.listOnlySocialsAccounts.mockRejectedValue(new AppError("Couldn't load connected accounts", 502));
    await expect(socialSettingsService.resolveDraftTargets("o1", [81085])).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("setAllowList with an id that has left the workspace", () => {
  it("lets an already-stored orphan id be kept or removed", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(settingsRow([5, 555]));
    vi.mocked(socialSettingsRepository.setAllowedAccountIds).mockResolvedValue(settingsRow([5, 555]));
    await expect(socialSettingsService.setAllowList("o1", [5, 555], "admin")).resolves.toBeDefined();
    vi.mocked(socialSettingsRepository.setAllowedAccountIds).mockResolvedValue(settingsRow([5]));
    await expect(socialSettingsService.setAllowList("o1", [5], "admin")).resolves.toBeDefined();
  });

  it("still refuses to newly add an unknown id", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(settingsRow([5, 555]));
    await expect(socialSettingsService.setAllowList("o1", [5, 555, 777], "admin")).rejects.toMatchObject({ statusCode: 400 });
  });
});
