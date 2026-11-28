import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./sms.repository", () => ({
  smsRepository: { createTemplate: vi.fn(), updateTemplate: vi.fn(), deleteTemplate: vi.fn(), findTemplate: vi.fn() },
}));
vi.mock("./sms.service", () => ({
  pingSmsConnection: vi.fn(), sendSms: vi.fn(), mergeTemplate: vi.fn(), normalisePhone: vi.fn(), consumeSmsCredit: vi.fn(),
  attachChargeToMessage: vi.fn(), resolveQuoteToken: vi.fn(), buildPublicQuoteUrl: vi.fn(), buildPortalLink: vi.fn(), buildQuoteUrl: vi.fn(), buildMagicLoginQuoteUrl: vi.fn(), QUOTE_SHARE_COMPANY_NAME: "Co",
}));
vi.mock("../platform-admin/platform-admin-credits.repository", () => ({ platformAdminCreditsRepository: {}, startOfMonthUtc: vi.fn() }));
vi.mock("../portal/portal-auth", () => ({ DEFAULT_PORTAL_PIN: "0000", MAGIC_LINK_TTL_MS: 1 }));
vi.mock("../portal/portal-login-token.repository", () => ({ portalLoginTokenRepository: {} }));
vi.mock("../neon-client/neon-client.repository", () => ({ neonClientRepository: {} }));
vi.mock("../user/user.repository", () => ({ userRepository: { findById: vi.fn() } }));

import { smsController as c } from "./sms.controller";
import { smsRepository as repo } from "./sms.repository";
import { userRepository } from "../user/user.repository";

type Roles = string[];
function req(roles: Roles, over: { body?: unknown; params?: Record<string, string>; legacyRole?: string } = {}) {
  vi.mocked(userRepository.findById).mockResolvedValue({ id: "u1", role: over.legacyRole ?? "user" } as never);
  return {
    body: over.body ?? {},
    params: over.params ?? { id: "t1" },
    query: {},
    orgId: "o1",
    orgRole: roles[0],
    orgRoles: roles,
    user: { authType: "password", userId: "u1" },
  } as never;
}
function mockRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}
async function run(handler: typeof c.createTemplate, request: never): Promise<unknown> {
  const next = vi.fn();
  const res = mockRes();
  handler(request, res as never, next);
  await new Promise((r) => setImmediate(r));
  return next.mock.calls[0]?.[0];
}
const status = (err: unknown) => (err as { statusCode?: number } | undefined)?.statusCode;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.createTemplate).mockResolvedValue({ id: "t1" } as never);
  vi.mocked(repo.updateTemplate).mockResolvedValue({ id: "t1" } as never);
  vi.mocked(repo.deleteTemplate).mockResolvedValue(undefined as never);
});

const AUTO = ["on_booking_create", "on_pin_set", "days_before_departure"];
// (A platform admin has no agency of their own, so creating a template is refused for that reason, as before.)
const MANAGERS = [["org_admin"], ["branch_manager"]];
const NOT_MANAGERS = [["agent"], ["homeworker"], ["social_media_manager"], ["referral_agent"], ["org_admin", "homeworker"]];

describe("automatic-trigger templates are the on/off switch of customer messages: managers only", () => {
  it.each(AUTO)("creating a %s template is refused to non-managers, and a homeworker who is also a manager", async (autoTrigger) => {
    for (const roles of NOT_MANAGERS) {
      const err = await run(c.createTemplate, req(roles, { body: { name: "x", body: "y", autoTrigger } }));
      // Non-managers are stopped before (agent) or by the new rule (homeworker + manager): always a 403, never a write.
      expect(status(err), roles.join("+")).toBe(403);
    }
    expect(repo.createTemplate).not.toHaveBeenCalled();
  });

  it.each(AUTO)("managers can create a %s template", async (autoTrigger) => {
    for (const roles of MANAGERS) {
      expect(await run(c.createTemplate, req(roles, { body: { name: "x", body: "y", autoTrigger } }))).toBeUndefined();
    }
    expect(repo.createTemplate).toHaveBeenCalledTimes(MANAGERS.length);
  });

  it("the old legacy-role shortcut (user.role admin or manager, org role agent) no longer opens an automatic template", async () => {
    for (const legacyRole of ["admin", "manager"]) {
      const err = await run(c.createTemplate, req(["agent"], { legacyRole, body: { name: "x", body: "y", autoTrigger: "on_booking_create" } }));
      expect(status(err)).toBe(403);
    }
    expect(repo.createTemplate).not.toHaveBeenCalled();
  });

  it("a manual template keeps today's rules, including the legacy-role shortcut and homeworker + manager", async () => {
    expect(await run(c.createTemplate, req(["agent"], { legacyRole: "manager", body: { name: "x", body: "y", autoTrigger: "manual" } }))).toBeUndefined();
    expect(await run(c.createTemplate, req(["org_admin", "homeworker"], { body: { name: "x", body: "y", autoTrigger: "manual" } }))).toBeUndefined();
    expect(status(await run(c.createTemplate, req(["agent"], { body: { name: "x", body: "y", autoTrigger: "manual" } })))).toBe(403);
  });

  it("activating, deactivating or editing an automatic template needs a manager", async () => {
    vi.mocked(repo.findTemplate).mockResolvedValue({ id: "t1", autoTrigger: "on_booking_create", active: false } as never);
    for (const roles of NOT_MANAGERS) {
      expect(status(await run(c.updateTemplate, req(roles, { body: { active: true } }))), roles.join("+")).toBe(403);
    }
    expect(repo.updateTemplate).not.toHaveBeenCalled();
    expect(await run(c.updateTemplate, req(["branch_manager"], { body: { active: true } }))).toBeUndefined();
    expect(repo.updateTemplate).toHaveBeenCalledWith("t1", "o1", { active: true });
  });

  it("turning a manual template INTO an automatic one (re-trigger) needs a manager too", async () => {
    vi.mocked(repo.findTemplate).mockResolvedValue({ id: "t1", autoTrigger: "manual" } as never);
    expect(status(await run(c.updateTemplate, req(["org_admin", "homeworker"], { body: { autoTrigger: "on_pin_set" } })))).toBe(403);
    expect(repo.updateTemplate).not.toHaveBeenCalled();
    expect(await run(c.updateTemplate, req(["org_admin"], { body: { autoTrigger: "on_pin_set" } }))).toBeUndefined();
  });

  it("turning an automatic template into a manual one (taking it off a trigger) needs a manager as well", async () => {
    vi.mocked(repo.findTemplate).mockResolvedValue({ id: "t1", autoTrigger: "days_before_departure" } as never);
    expect(status(await run(c.updateTemplate, req(["agent"], { legacyRole: "manager", body: { autoTrigger: "manual" } })))).toBe(403);
  });

  it("editing a manual template is unchanged", async () => {
    vi.mocked(repo.findTemplate).mockResolvedValue({ id: "t1", autoTrigger: "manual" } as never);
    expect(await run(c.updateTemplate, req(["agent"], { legacyRole: "manager", body: { name: "renamed" } }))).toBeUndefined();
  });

  it("deleting an automatic template needs a manager; a manual one keeps today's rule", async () => {
    vi.mocked(repo.findTemplate).mockResolvedValue({ id: "t1", autoTrigger: "on_booking_create" } as never);
    expect(status(await run(c.deleteTemplate, req(["org_admin", "homeworker"])))).toBe(403);
    expect(repo.deleteTemplate).not.toHaveBeenCalled();
    expect(await run(c.deleteTemplate, req(["org_admin"]))).toBeUndefined();
    vi.mocked(repo.findTemplate).mockResolvedValue({ id: "t2", autoTrigger: "manual" } as never);
    expect(await run(c.deleteTemplate, req(["agent"], { legacyRole: "admin" }))).toBeUndefined();
  });

  it("the template is looked up in the caller's own agency, so another agency's template can never be probed", async () => {
    vi.mocked(repo.findTemplate).mockResolvedValue(undefined as never);
    await run(c.updateTemplate, req(["org_admin"], { body: { active: true } }));
    expect(repo.findTemplate).toHaveBeenCalledWith("t1", "o1");
  });
});
