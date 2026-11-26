import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./whatsapp-templates.service", () => ({
  whatsappTemplatesService: {
    list: vi.fn(),
    sync: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock("./whatsapp-settings.service", () => ({
  whatsappSettingsService: { getPinReset: vi.fn(), savePinReset: vi.fn() },
}));

import { whatsappTemplatesController as c } from "./whatsapp-templates.controller";
import { whatsappTemplatesService as svc } from "./whatsapp-templates.service";
import { whatsappSettingsService as settingsSvc } from "./whatsapp-settings.service";

function req(over: { query?: Record<string, unknown>; params?: Record<string, unknown>; body?: unknown; role?: string } = {}) {
  const role = over.role ?? "org_admin";
  return {
    query: over.query ?? {},
    params: over.params ?? {},
    body: over.body ?? {},
    orgRole: role,
    orgRoles: [role],
  } as never;
}

function mockRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const flush = () => new Promise((r) => setImmediate(r));

const channelId = "6f1c2b0e-3b0a-4c55-9d53-2a5d8e3f7a11";

beforeEach(() => vi.clearAllMocks());

describe("whatsappTemplatesController", () => {
  it("list passes channel_id and status and wraps the envelope", async () => {
    vi.mocked(svc.list).mockResolvedValue({ templates: [], total: 0 });
    const res = mockRes();
    await c.list(req({ query: { channel_id: channelId, status: "APPROVED" } }), res as never, vi.fn());
    await flush();
    expect(svc.list).toHaveBeenCalledWith({ channel_id: channelId, status: "APPROVED" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: expect.any(String), data: { templates: [], total: 0 } });
  });

  it("sync forwards channel_id and returns the result", async () => {
    const r = { synced: 2, added: 1, updated: 1, removed: 0, errors: [] };
    vi.mocked(svc.sync).mockResolvedValue(r);
    const res = mockRes();
    await c.sync(req({ body: { channel_id: channelId } }), res as never, vi.fn());
    await flush();
    expect(svc.sync).toHaveBeenCalledWith(channelId);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: expect.any(String), data: r });
  });

  it("create applies the language default and returns 201", async () => {
    const out = { id: "i1", template_id: "t1", status: "PENDING" };
    vi.mocked(svc.create).mockResolvedValue(out);
    const res = mockRes();
    await c.create(
      req({
        body: { channel_id: channelId, name: "hello", category: "MARKETING", body_text: "Hi", body_examples: [] },
      }),
      res as never,
      vi.fn(),
    );
    await flush();
    expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ name: "hello", language: "en" }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: expect.any(String), data: out });
  });

  it("remove returns { removed: true }", async () => {
    vi.mocked(svc.remove).mockResolvedValue({ removed: true });
    const res = mockRes();
    await c.remove(req({ params: { id: "t1" } }), res as never, vi.fn());
    await flush();
    expect(svc.remove).toHaveBeenCalledWith("t1");
    expect(res.json).toHaveBeenCalledWith({ success: true, message: expect.any(String), data: { removed: true } });
  });
});

describe("portal sign-in link template settings", () => {
  const settings = { templateName: "portal_sign_in", templateLanguage: "en_GB", channelId: "ch1", variables: { "1": { source: "sign_in_link" as const } } };
  const scoped = (body?: unknown, orgId: string | null = "o1") =>
    ({ ...(req({ body }) as object), orgId, user: { authType: "password", userId: "u1" } }) as never;

  it("GET returns the caller's own org's settings", async () => {
    vi.mocked(settingsSvc.getPinReset).mockResolvedValue(settings);
    const res = mockRes();
    await c.getPortalSignInSettings(scoped(), res as never, vi.fn());
    await flush();
    expect(settingsSvc.getPinReset).toHaveBeenCalledWith("o1");
    expect(res.json).toHaveBeenCalledWith({ success: true, message: expect.any(String), data: settings });
  });

  it("PUT saves for the caller's org and user, and returns what was saved", async () => {
    vi.mocked(settingsSvc.savePinReset).mockResolvedValue(settings);
    const res = mockRes();
    await c.savePortalSignInSettings(scoped(settings), res as never, vi.fn());
    await flush();
    expect(settingsSvc.savePinReset).toHaveBeenCalledWith("o1", settings, "u1");
    expect(res.json).toHaveBeenCalledWith({ success: true, message: expect.any(String), data: settings });
  });

  it("without an organisation in scope it is a 400 and nothing is read or written", async () => {
    const next = vi.fn();
    await c.getPortalSignInSettings(scoped(undefined, null), mockRes() as never, next);
    await flush();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(settingsSvc.getPinReset).not.toHaveBeenCalled();
  });
});
