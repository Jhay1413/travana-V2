import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { sendsevenWebhookEvents } from "@shared/schema";

// Repository: the webhook-events audit/idempotency table only.

export const sendsevenWebhookRepository = {
  // Records a delivery. Returns false when the event_id already exists (a retry),
  // so callers can process each delivery at most once.
  async recordEvent(data: {
    eventId: string;
    orgId: string | null;
    messageId: string | null;
    type: string | null;
    status?: string;
  }): Promise<boolean> {
    const rows = await db
      .insert(sendsevenWebhookEvents)
      .values({
        eventId: data.eventId,
        orgId: data.orgId,
        messageId: data.messageId,
        type: data.type,
        status: data.status ?? "received",
      })
      .onConflictDoNothing({ target: sendsevenWebhookEvents.eventId })
      .returning({ id: sendsevenWebhookEvents.id });
    return rows.length > 0;
  },

  // Records the id of a message WE sent (AI reply), so its later message.sent
  // webhook isn't mistaken for a human agent's reply (§8). Namespaced in the
  // events table to avoid a separate table.
  async markOurMessage(messageId: string, orgId: string | null): Promise<void> {
    await db
      .insert(sendsevenWebhookEvents)
      .values({ eventId: `aisent:${messageId}`, orgId, type: "ai-sent" })
      .onConflictDoNothing({ target: sendsevenWebhookEvents.eventId });
  },

  async isOurMessage(messageId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: sendsevenWebhookEvents.id })
      .from(sendsevenWebhookEvents)
      .where(eq(sendsevenWebhookEvents.eventId, `aisent:${messageId}`))
      .limit(1);
    return !!row;
  },

  // Atomically claims the right to run an admin-bot turn (which may open a
  // support ticket) for THIS inbound message. Keyed on message.id, this dedupes
  // redeliveries/duplicate webhook events for the SAME message (e.g. SendSeven
  // resending the same webhook) that would otherwise both reach the admin path
  // before either persists `ticketOpened` — this claim (namespaced in the same
  // idempotency table as markOurMessage, via onConflictDoNothing on the unique
  // event_id) guarantees at most one caller ever wins per message.
  // Returns true iff this call won the claim.
  async claimAdminTurn(messageId: string, orgId: string | null): Promise<boolean> {
    const rows = await db
      .insert(sendsevenWebhookEvents)
      .values({ eventId: `admin-turn:${messageId}`, orgId, type: "admin-turn-claim" })
      .onConflictDoNothing({ target: sendsevenWebhookEvents.eventId })
      .returning({ id: sendsevenWebhookEvents.id });
    return rows.length > 0;
  },
};
