import webpush from "web-push";
import { pushSubscriptionRepository } from "./push-subscription.repository";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:hello@tinastraveldeals.co.uk";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export const pushNotificationService = {
  getPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  },

  async subscribe(clientId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void> {
    await pushSubscriptionRepository.upsert({
      clientId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });
  },

  async unsubscribe(clientId: string, endpoint: string): Promise<void> {
    await pushSubscriptionRepository.removeByClientAndEndpoint(clientId, endpoint);
  },

  async sendToAll(payload: { title: string; body: string; icon?: string; url?: string }): Promise<number> {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.warn("VAPID keys not configured, skipping push notification");
      return 0;
    }

    const subs = await pushSubscriptionRepository.findAll();
    if (subs.length === 0) return 0;

    const jsonPayload = JSON.stringify(payload);
    let sent = 0;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          jsonPayload,
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pushSubscriptionRepository.removeById(sub.id);
        } else {
          console.error("Push broadcast failed:", err.statusCode || err.message);
        }
      }
    }
    return sent;
  },

  async sendToClient(clientId: string, payload: { title: string; body: string; icon?: string; url?: string }): Promise<void> {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.warn("VAPID keys not configured, skipping push notification");
      return;
    }

    const subs = await pushSubscriptionRepository.findByClientId(clientId);
    if (subs.length === 0) return;

    const jsonPayload = JSON.stringify(payload);

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          jsonPayload,
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pushSubscriptionRepository.removeById(sub.id);
        } else {
          console.error("Push notification failed:", err.statusCode || err.message);
        }
      }
    }
  },
};
