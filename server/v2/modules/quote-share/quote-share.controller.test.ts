import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("./quote-share.service", () => ({ quoteShareService: {} }));
vi.mock("./quote-whatsapp.service", () => ({ quoteWhatsappService: { send: vi.fn() } }));

import { quoteShareController } from "./quote-share.controller";
import { quoteWhatsappService } from "./quote-whatsapp.service";
import { sendWhatsappValidator } from "./quote-share.validator";

const Q = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}
const req = (over: Record<string, unknown> = {}) =>
  ({ params: { id: Q }, body: { clientId: C }, query: {}, orgId: "o1", orgRole: "agent", orgRoles: ["agent"], user: { claims: { sub: "u1" } }, ...over }) as unknown as Request;

beforeEach(() => vi.clearAllMocks());

describe("POST /quote-share/:id/send-whatsapp", () => {
  it("returns the sent result in the standard envelope", async () => {
    vi.mocked(quoteWhatsappService.send).mockResolvedValue({ status: "sent", conversationId: "conv1" });
    const res = mockRes();
    await quoteShareController.sendWhatsapp(req(), res as unknown as Response, vi.fn());
    await vi.waitFor(() => expect(res.json).toHaveBeenCalled());
    expect(quoteWhatsappService.send).toHaveBeenCalledWith(Q, C, "u1", expect.objectContaining({ orgId: "o1" }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Quote sent via WhatsApp",
      data: { status: "sent", conversationId: "conv1" },
    });
  });

  it("returns a fallback with text and quoteUrl", async () => {
    const fb = { status: "fallback" as const, reason: "window_closed" as const, text: "t", quoteUrl: "u" };
    vi.mocked(quoteWhatsappService.send).mockResolvedValue(fb);
    const res = mockRes();
    await quoteShareController.sendWhatsapp(req(), res as unknown as Response, vi.fn());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: fb }));
  });

  it("401s without a session", async () => {
    const res = mockRes();
    await quoteShareController.sendWhatsapp(req({ user: undefined }), res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(quoteWhatsappService.send).not.toHaveBeenCalled();
  });

  it("forwards service errors to next()", async () => {
    const err = new Error("boom");
    vi.mocked(quoteWhatsappService.send).mockRejectedValue(err);
    const next = vi.fn();
    await quoteShareController.sendWhatsapp(req(), mockRes() as unknown as Response, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith(err));
  });
});

describe("sendWhatsappValidator", () => {
  it("accepts a quote id and client id", () => {
    expect(sendWhatsappValidator.safeParse({ params: { id: Q }, body: { clientId: C } }).success).toBe(true);
  });
  it("rejects a bad quote id, missing client id, and extra keys", () => {
    expect(sendWhatsappValidator.safeParse({ params: { id: "x" }, body: { clientId: C } }).success).toBe(false);
    expect(sendWhatsappValidator.safeParse({ params: { id: Q }, body: {} }).success).toBe(false);
    expect(sendWhatsappValidator.safeParse({ params: { id: Q }, body: { clientId: C, orgId: "x" } }).success).toBe(false);
  });
});
