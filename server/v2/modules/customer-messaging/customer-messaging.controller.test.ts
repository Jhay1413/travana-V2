import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./customer-messaging.service", () => ({
  customerMessagingService: { getSettings: vi.fn(), setAutoChannel: vi.fn(), setSwitch: vi.fn() },
}));
vi.mock("./customer-messaging-readiness.service", () => ({ customerMessagingReadinessService: { getReadiness: vi.fn() } }));
vi.mock("../whatsapp-templates/whatsapp-settings.service", () => ({
  whatsappSettingsService: { getPurposeTemplate: vi.fn(), savePurposeTemplate: vi.fn() },
}));

import { customerMessagingController as c } from "./customer-messaging.controller";
import { customerMessagingService as svc } from "./customer-messaging.service";
import { customerMessagingReadinessService as readiness } from "./customer-messaging-readiness.service";
import { whatsappSettingsService as templates } from "../whatsapp-templates/whatsapp-settings.service";

function req(over: { params?: Record<string, unknown>; body?: unknown; orgId?: string | null } = {}) {
  return {
    params: over.params ?? {},
    body: over.body ?? {},
    query: {},
    orgId: over.orgId === undefined ? "o1" : over.orgId,
    orgRole: "org_admin",
    orgRoles: ["org_admin"],
    user: { authType: "password", userId: "u1" },
  } as never;
}
function mockRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}
const flush = () => new Promise((r) => setImmediate(r));
const envelope = (data: unknown) => ({ success: true, message: expect.any(String), data });

beforeEach(() => vi.clearAllMocks());

describe("customerMessagingController", () => {
  it("GET settings reads the caller's own org", async () => {
    vi.mocked(svc.getSettings).mockResolvedValue({ autoChannel: "whatsapp" });
    const res = mockRes();
    await c.getSettings(req(), res as never, vi.fn());
    await flush();
    expect(svc.getSettings).toHaveBeenCalledWith("o1");
    expect(res.json).toHaveBeenCalledWith(envelope({ autoChannel: "whatsapp" }));
  });

  it("PUT settings saves the channel for the caller's org", async () => {
    vi.mocked(svc.setAutoChannel).mockResolvedValue({ autoChannel: "sms" });
    const res = mockRes();
    await c.saveSettings(req({ body: { autoChannel: "sms" } }), res as never, vi.fn());
    await flush();
    expect(svc.setAutoChannel).toHaveBeenCalledWith("o1", "sms");
    expect(res.json).toHaveBeenCalledWith(envelope({ autoChannel: "sms" }));
  });

  it("PUT switch turns the type on or off for the caller's own org only", async () => {
    vi.mocked(svc.setSwitch).mockResolvedValue({ purpose: "portal_ready", active: false, rows: 1 });
    const res = mockRes();
    await c.setSwitch(req({ params: { purpose: "portal_ready" }, body: { active: false } }), res as never, vi.fn());
    await flush();
    expect(svc.setSwitch).toHaveBeenCalledWith("o1", "portal_ready", false);
    expect(res.json).toHaveBeenCalledWith(envelope({ purpose: "portal_ready", active: false, rows: 1 }));
  });

  it("GET readiness is scoped to the caller's org", async () => {
    const data = { autoChannel: "whatsapp" as const, purposes: [] };
    vi.mocked(readiness.getReadiness).mockResolvedValue(data);
    const res = mockRes();
    await c.getReadiness(req(), res as never, vi.fn());
    await flush();
    expect(readiness.getReadiness).toHaveBeenCalledWith("o1");
    expect(res.json).toHaveBeenCalledWith(envelope(data));
  });

  it("GET a purpose's template reads that purpose for the caller's org", async () => {
    const t = { templateName: "t", templateLanguage: "en", channelId: "ch", variables: {} };
    vi.mocked(templates.getPurposeTemplate).mockResolvedValue(t);
    const res = mockRes();
    await c.getPurposeTemplate(req({ params: { purpose: "portal_ready" } }), res as never, vi.fn());
    await flush();
    expect(templates.getPurposeTemplate).toHaveBeenCalledWith("o1", "portal_ready");
    expect(res.json).toHaveBeenCalledWith(envelope(t));
  });

  it("PUT saves the route's own purpose (not a client-supplied one) for the caller's org and user", async () => {
    const t = { templateName: "t", templateLanguage: "en", channelId: "ch", variables: { "1": { source: "portal_link" as const } } };
    vi.mocked(templates.savePurposeTemplate).mockResolvedValue(t);
    const res = mockRes();
    await c.savePurposeTemplate("balance_reminder")(req({ body: t, params: { purpose: "portal_ready" } }), res as never, vi.fn());
    await flush();
    expect(templates.savePurposeTemplate).toHaveBeenCalledWith("o1", "balance_reminder", t, "u1");
    expect(res.json).toHaveBeenCalledWith(envelope(t));
  });

  it("without an organisation in scope everything is a 400 and nothing is read or written", async () => {
    for (const call of [c.getSettings, c.saveSettings, c.getReadiness, c.setSwitch, c.getPurposeTemplate, c.savePurposeTemplate("portal_ready")]) {
      const next = vi.fn();
      await call(req({ orgId: null, params: { purpose: "portal_ready" }, body: { autoChannel: "sms" } }), mockRes() as never, next);
      await flush();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    }
    expect(svc.setAutoChannel).not.toHaveBeenCalled();
    expect(templates.savePurposeTemplate).not.toHaveBeenCalled();
  });
});
