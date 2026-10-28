import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./whatsapp-templates.service", () => ({
  whatsappTemplatesService: {
    list: vi.fn(),
    sync: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
}));

import { whatsappTemplatesController as c } from "./whatsapp-templates.controller";
import { whatsappTemplatesService as svc } from "./whatsapp-templates.service";

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
