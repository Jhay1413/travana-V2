import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../sendseven-webhook/sendseven-webhook.service", () => ({ sendsevenWebhookService: {} }));
vi.mock("../sendseven-webhook/suggest-reply.service", () => ({ suggestAiReply: vi.fn() }));
vi.mock("./conversations.repository", () => ({ conversationsRepository: { getWhatsappWindow: vi.fn() } }));
vi.mock("../user/user.repository", () => ({ userRepository: {} }));
vi.mock("../../realtime/realtime.service", () => ({ realtimeService: { publish: vi.fn() } }));

import { conversationsService } from "./conversations.service";
import { conversationsRepository } from "./conversations.repository";

beforeEach(() => vi.resetAllMocks());

describe("conversationsService.getWhatsappWindow", () => {
  it("camelCases SendSeven's window status", async () => {
    vi.mocked(conversationsRepository.getWhatsappWindow).mockResolvedValue({
      in_window: true, requires_template: false, remaining_seconds: 3600,
      last_customer_message_at: "2026-10-29T09:00:00Z", window_end_at: "2026-10-30T09:00:00Z", window_type: "customer_service",
    });
    await expect(conversationsService.getWhatsappWindow("cv1")).resolves.toEqual({
      inWindow: true, requiresTemplate: false, remainingSeconds: 3600,
      lastCustomerMessageAt: "2026-10-29T09:00:00Z", windowEndAt: "2026-10-30T09:00:00Z", windowType: "customer_service",
    });
    expect(conversationsRepository.getWhatsappWindow).toHaveBeenCalledWith("cv1");
  });

  it("maps missing optional fields to null", async () => {
    vi.mocked(conversationsRepository.getWhatsappWindow).mockResolvedValue({ in_window: false, requires_template: true });
    await expect(conversationsService.getWhatsappWindow("cv1")).resolves.toEqual({
      inWindow: false, requiresTemplate: true, remainingSeconds: null, lastCustomerMessageAt: null, windowEndAt: null, windowType: null,
    });
  });

  it("lets upstream errors reach the caller", async () => {
    vi.mocked(conversationsRepository.getWhatsappWindow).mockRejectedValue(new Error("502"));
    await expect(conversationsService.getWhatsappWindow("cv1")).rejects.toThrow("502");
  });
});
