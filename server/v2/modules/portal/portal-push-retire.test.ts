import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../notification/push-subscription.repository", () => ({
  pushSubscriptionRepository: { removeByEndpointAndKeys: vi.fn(), removeById: vi.fn(), findByClientId: vi.fn(), findByOrgId: vi.fn(), upsert: vi.fn(), removeByClientAndEndpoint: vi.fn() },
}));

import { pushSubscriptionRepository } from "../notification/push-subscription.repository";
import { pushNotificationService } from "../notification/push-notification.service";
import { portalPushRetireValidator } from "./portal.validator";

beforeEach(() => vi.clearAllMocks());

describe("pushNotificationService.retire", () => {
  it("deletes by endpoint and both keys through the repository", async () => {
    await pushNotificationService.retire({ endpoint: "https://push.example/e", keys: { p256dh: "P", auth: "A" } });
    expect(pushSubscriptionRepository.removeByEndpointAndKeys).toHaveBeenCalledWith({ endpoint: "https://push.example/e", p256dh: "P", auth: "A" });
  });
});

describe("portalPushRetireValidator (no session: the endpoint and both keys are the proof)", () => {
  const ok = { body: { subscription: { endpoint: "https://push.example/e", keys: { p256dh: "P", auth: "A" } } } };
  it("accepts the full subscription", () => {
    expect(portalPushRetireValidator.safeParse(ok).success).toBe(true);
  });
  it("refuses an endpoint alone, a missing key, or a bare id (there is no delete-by-id)", () => {
    expect(portalPushRetireValidator.safeParse({ body: { endpoint: "https://push.example/e" } }).success).toBe(false);
    expect(portalPushRetireValidator.safeParse({ body: { subscription: { endpoint: "https://push.example/e", keys: { p256dh: "P" } } } }).success).toBe(false);
    expect(portalPushRetireValidator.safeParse({ body: { id: "1" } }).success).toBe(false);
  });
});
