import webpush from "web-push";
import { db } from "../config/database";
import { pushSubscriptions } from "@shared/schema";
import { eq, and } from "drizzle-orm";

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
    console.log(`[Push] Subscribing client ${clientId}, endpoint: ${subscription.endpoint.substring(0, 60)}...`);
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

    await db
      .insert(pushSubscriptions)
      .values({
        clientId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      });
    console.log(`[Push] Subscription saved for client ${clientId}`);
  },

  async unsubscribe(clientId: string, endpoint: string): Promise<void> {
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.clientId, clientId), eq(pushSubscriptions.endpoint, endpoint)));
  },

  async sendToClient(clientId: string, payload: { title: string; body: string; icon?: string; url?: string }): Promise<void> {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.warn("VAPID keys not configured, skipping push notification");
      return;
    }

    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.clientId, clientId));

    console.log(`[Push] Sending to client ${clientId}, found ${subs.length} subscription(s)`);
    if (subs.length === 0) return;

    const jsonPayload = JSON.stringify(payload);

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          jsonPayload,
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        } else {
          console.error("Push notification failed:", err.statusCode || err.message);
        }
      }
    }
  },
};
