import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./channels.service", () => ({
  channelsService: {
    listChannels: vi.fn(),
    channelTypes: vi.fn(),
    createConnectToken: vi.fn(),
    channelHealth: vi.fn(),
    delegateConnect: vi.fn(),
    deleteChannel: vi.fn(),
    whatsappStatus: vi.fn(),
    workspaceStatus: vi.fn(),
  },
}));

import { channelsController } from "./channels.controller";
import { channelsService } from "./channels.service";

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

async function expectStatus(next: ReturnType<typeof vi.fn>, status: number) {
  await flush();
  expect(next).toHaveBeenCalledTimes(1);
  expect(next.mock.calls[0][0]).toMatchObject({ statusCode: status });
}

beforeEach(() => vi.clearAllMocks());

describe("channelsController", () => {
  it("list forwards for_compose and wraps the envelope", async () => {
    vi.mocked(channelsService.listChannels).mockResolvedValue([]);
    const res = mockRes();
    await channelsController.list(req({ query: { for_compose: "true" }, role: "agent" }), res as never, vi.fn());
    await flush();
    expect(channelsService.listChannels).toHaveBeenCalledWith(true);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: expect.any(String), data: [] });
  });

  it("health returns the health object in the envelope for any staff role", async () => {
    const h = { has_errors: false, error_count: 0, integrations: [] };
    vi.mocked(channelsService.channelHealth).mockResolvedValue(h);
    const res = mockRes();
    await channelsController.health(req({ role: "agent" }), res as never, vi.fn());
    await flush();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: expect.any(String), data: h });
  });

  it("status returns { provisioned } in the envelope for any staff role", async () => {
    vi.mocked(channelsService.workspaceStatus).mockResolvedValue({ provisioned: true });
    const res = mockRes();
    await channelsController.status(req({ role: "agent" }), res as never, vi.fn());
    await flush();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: expect.any(String), data: { provisioned: true } });
  });

  it("createConnectToken forwards the raw body fields to the service and returns 201", async () => {
    vi.mocked(channelsService.createConnectToken).mockResolvedValue({} as never);
    const res = mockRes();
    await channelsController.createConnectToken(
      req({
        body: { allowed_channel_types: ["WhatsApp", "sms"], name: "n", partner_name: "P", expires_in_hours: 12, max_uses: 2 },
      }),
      res as never,
      vi.fn(),
    );
    await flush();
    expect(channelsService.createConnectToken).toHaveBeenCalledWith({
      allowed_channel_types: ["WhatsApp", "sms"],
      partner_redirect_url: null,
      name: "n",
      partner_name: "P",
      expires_in_hours: 12,
      max_uses: 2,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("createConnectToken 403s for an agent", async () => {
    const next = vi.fn();
    await channelsController.createConnectToken(
      req({ role: "agent", body: { allowed_channel_types: ["whatsapp"] } }),
      mockRes() as never,
      next,
    );
    await expectStatus(next, 403);
    expect(channelsService.createConnectToken).not.toHaveBeenCalled();
  });

  it("delegateConnect forwards raw fields and returns 201", async () => {
    const r = { success: true, token_id: "t", connect_url: "u", expires_at: "e", email_sent: true, sent_to: "a@b.co" };
    vi.mocked(channelsService.delegateConnect).mockResolvedValue(r);
    const res = mockRes();
    await channelsController.delegateConnect(
      req({
        body: { email: "a@b.co", channel_types: ["Instagram"], recipient_name: "Ann", note: "hi", expires_in_hours: 72 },
      }),
      res as never,
      vi.fn(),
    );
    await flush();
    expect(channelsService.delegateConnect).toHaveBeenCalledWith({
      email: "a@b.co",
      channel_types: ["Instagram"],
      recipient_name: "Ann",
      note: "hi",
      expires_in_hours: 72,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: expect.any(String), data: r });
  });

  it("delegateConnect 403s for an agent", async () => {
    const next = vi.fn();
    await channelsController.delegateConnect(
      req({ role: "agent", body: { email: "a@b.co", channel_types: ["whatsapp"] } }),
      mockRes() as never,
      next,
    );
    await expectStatus(next, 403);
    expect(channelsService.delegateConnect).not.toHaveBeenCalled();
  });

  it("remove 403s for an agent and deletes for an admin", async () => {
    const next = vi.fn();
    await channelsController.remove(req({ role: "agent", params: { channelId: "c1" } }), mockRes() as never, next);
    await expectStatus(next, 403);
    vi.mocked(channelsService.deleteChannel).mockResolvedValue({});
    await channelsController.remove(req({ params: { channelId: "c1" } }), mockRes() as never, vi.fn());
    await flush();
    expect(channelsService.deleteChannel).toHaveBeenCalledWith("c1");
  });
});
