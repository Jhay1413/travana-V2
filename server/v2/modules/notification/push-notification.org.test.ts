import { describe, it, expect, vi, beforeEach } from "vitest";

const env = vi.hoisted(() => {
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  return true;
});
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));
vi.mock("./push-subscription.repository", () => ({
  pushSubscriptionRepository: { findByOrgId: vi.fn(), findByClientId: vi.fn(), removeById: vi.fn() },
}));

import webpush from "web-push";
import { pushNotificationService } from "./push-notification.service";
import { pushSubscriptionRepository as repo } from "./push-subscription.repository";

const sub = (id: string) => ({ id, clientId: `c-${id}`, endpoint: `https://push/${id}`, p256dh: "p", auth: "a" });
const AGENCIES: Record<string, ReturnType<typeof sub>[]> = { A: [sub("a1"), sub("a2")], B: [sub("b1")] };

beforeEach(() => {
  vi.clearAllMocks();
  expect(env).toBe(true);
  vi.mocked(repo.findByOrgId).mockImplementation((async (orgId: string) => AGENCIES[orgId] ?? []) as never);
  vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);
});

describe("sendToOrg: a deal reaches only its own agency's portal customers", () => {
  it("agency A's push goes to A's subscribers and never to B's", async () => {
    expect(await pushNotificationService.sendToOrg("A", { title: "t", body: "b" })).toBe(2);
    const endpoints = vi.mocked(webpush.sendNotification).mock.calls.map((c) => (c[0] as { endpoint: string }).endpoint);
    expect(endpoints).toEqual(["https://push/a1", "https://push/a2"]);
    expect(repo.findByOrgId).toHaveBeenCalledWith("A");
  });

  it("an agency with no subscribers, or no agency at all, sends nothing", async () => {
    expect(await pushNotificationService.sendToOrg("Z", { title: "t", body: "b" })).toBe(0);
    expect(await pushNotificationService.sendToOrg("", { title: "t", body: "b" })).toBe(0);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("an expired subscription is removed and not counted", async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce({ statusCode: 410 });
    expect(await pushNotificationService.sendToOrg("A", { title: "t", body: "b" })).toBe(1);
    expect(repo.removeById).toHaveBeenCalledWith("a1");
  });

  it("there is no platform-wide broadcast left", () => {
    expect((pushNotificationService as Record<string, unknown>).sendToAll).toBeUndefined();
  });
});
