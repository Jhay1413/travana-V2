import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("./whatsapp-updates.service", () => ({
  whatsappUpdatesService: {
    getSettings: vi.fn(), saveSettings: vi.fn(), getTemplateStatus: vi.fn(), getWindow: vi.fn(),
    sendToConversation: vi.fn(), sendToClient: vi.fn(),
  },
}));

import { whatsappUpdatesController } from "./whatsapp-updates.controller";
import { whatsappUpdatesService } from "./whatsapp-updates.service";

const C = "22222222-2222-4222-8222-222222222222";
const SETTINGS = { templateName: "gu", templateLanguage: "en_GB", channelId: "ch1", variables: { "1": { source: "message" as const } } };

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}
const req = (over: Record<string, unknown> = {}) =>
  ({ params: {}, body: {}, query: {}, orgId: "o1", orgRole: "agent", orgRoles: ["agent"], user: { claims: { sub: "u1" } }, ...over }) as unknown as Request;

beforeEach(() => vi.clearAllMocks());

describe("settings", () => {
  it("GET returns the settings in the envelope", async () => {
    vi.mocked(whatsappUpdatesService.getSettings).mockResolvedValue(SETTINGS);
    const res = mockRes();
    await whatsappUpdatesController.getSettings(req(), res as unknown as Response, vi.fn());
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    expect(whatsappUpdatesService.getSettings).toHaveBeenCalledWith("o1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: SETTINGS }));
  });

  it("PUT saves with the user id", async () => {
    vi.mocked(whatsappUpdatesService.saveSettings).mockResolvedValue(SETTINGS);
    const res = mockRes();
    await whatsappUpdatesController.saveSettings(req({ body: SETTINGS }), res as unknown as Response, vi.fn());
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    expect(whatsappUpdatesService.saveSettings).toHaveBeenCalledWith("o1", SETTINGS, "u1");
  });

  it("forwards a 400 to next() when there is no org in scope", async () => {
    const next = vi.fn();
    await whatsappUpdatesController.getSettings(req({ orgId: undefined }), mockRes() as unknown as Response, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
  });
});

describe("GET /template and /window", () => {
  it("returns the template status", async () => {
    vi.mocked(whatsappUpdatesService.getTemplateStatus).mockResolvedValue({ configured: true, templateName: "gu", channelId: null });
    const res = mockRes();
    await whatsappUpdatesController.getTemplate(req(), res as unknown as Response, vi.fn());
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { configured: true, templateName: "gu", channelId: null } }));
  });

  it("returns the window for the conversation id", async () => {
    vi.mocked(whatsappUpdatesService.getWindow).mockResolvedValue({ known: false });
    const res = mockRes();
    await whatsappUpdatesController.getWindow(req({ params: { conversationId: "conv1" } }), res as unknown as Response, vi.fn());
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    expect(whatsappUpdatesService.getWindow).toHaveBeenCalledWith("conv1");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { known: false } }));
  });
});

describe("send endpoints", () => {
  it("conversation send passes text, user and scope and returns 200", async () => {
    vi.mocked(whatsappUpdatesService.sendToConversation).mockResolvedValue({ conversationId: "conv1", viaTemplate: true });
    const res = mockRes();
    await whatsappUpdatesController.sendToConversation(req({ params: { conversationId: "conv1" }, body: { text: "hi" } }), res as unknown as Response, vi.fn());
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    expect(whatsappUpdatesService.sendToConversation).toHaveBeenCalledWith("conv1", "hi", "u1", expect.objectContaining({ orgId: "o1" }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { conversationId: "conv1", viaTemplate: true } }));
  });

  it("client send passes channel and text", async () => {
    vi.mocked(whatsappUpdatesService.sendToClient).mockResolvedValue({ conversationId: "conv2", viaTemplate: false });
    const res = mockRes();
    await whatsappUpdatesController.sendToClient(req({ params: { clientId: C }, body: { channelId: "ch1", text: "hi" } }), res as unknown as Response, vi.fn());
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    expect(whatsappUpdatesService.sendToClient).toHaveBeenCalledWith(C, "ch1", "hi", "u1", expect.objectContaining({ orgId: "o1" }));
  });

  it("401s without a session", async () => {
    const a = mockRes();
    await whatsappUpdatesController.sendToConversation(req({ user: undefined }), a as unknown as Response, vi.fn());
    const b = mockRes();
    await whatsappUpdatesController.sendToClient(req({ user: undefined }), b as unknown as Response, vi.fn());
    expect(a.status).toHaveBeenCalledWith(401);
    expect(b.status).toHaveBeenCalledWith(401);
    expect(whatsappUpdatesService.sendToConversation).not.toHaveBeenCalled();
  });

  it("forwards service errors to next()", async () => {
    const err = new Error("boom");
    vi.mocked(whatsappUpdatesService.sendToConversation).mockRejectedValue(err);
    const next = vi.fn();
    await whatsappUpdatesController.sendToConversation(req({ params: { conversationId: "c" }, body: { text: "hi" } }), mockRes() as unknown as Response, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith(err));
  });
});
