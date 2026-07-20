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
  // resending the same webhook — under a DIFFERENT event_id, so recordEvent's
  // eventId dedupe above doesn't catch it) that would otherwise both reach the
  // admin path before either persists `ticketOpened` — this claim (namespaced
  // in the same idempotency table as markOurMessage, via onConflictDoNothing
  // on the unique event_id) guarantees at most one caller ever wins per
  // message. Returns true iff this call won the claim. See releaseAdminTurnClaim
  // for the failure-compensation counterpart.
  async claimAdminTurn(messageId: string, orgId: string | null): Promise<boolean> {
    const rows = await db
      .insert(sendsevenWebhookEvents)
      .values({ eventId: `admin-turn:${messageId}`, orgId, type: "admin-turn-claim" })
      .onConflictDoNothing({ target: sendsevenWebhookEvents.eventId })
      .returning({ id: sendsevenWebhookEvents.id });
    return rows.length > 0;
  },

  // Releases an admin-turn claim taken by claimAdminTurn. Call this when the
  // claimed turn fails to actually reach the customer (the reply send threw)
  // — otherwise the claim would persist forever and a genuine redelivery of
  // that same message would lose the claim and go permanently unanswered.
  // Safe to call even if no claim exists (no-op). No orgId param needed to
  // scope the delete — the eventId (namespaced on messageId) is already
  // globally unique.
  async releaseAdminTurnClaim(messageId: string): Promise<void> {
    await db.delete(sendsevenWebhookEvents).where(eq(sendsevenWebhookEvents.eventId, `admin-turn:${messageId}`));
  },

  // Same mechanism as claimAdminTurn, but for the general-reply and
  // enquiry-collecting reply branches (reply-worker's `route === "general"`
  // and the collecting-thin/collecting-continue branches), which previously
  // sent with no idempotency guard at all — a redelivery of the same inbound
  // message would otherwise produce a duplicate customer-facing reply.
  // Namespaced under a different eventId prefix ("reply-turn:") so it can
  // never collide with an admin-turn claim on the same message id. Returns
  // true iff this call won the claim.
  async claimReplyTurn(messageId: string, orgId: string | null): Promise<boolean> {
    const rows = await db
      .insert(sendsevenWebhookEvents)
      .values({ eventId: `reply-turn:${messageId}`, orgId, type: "reply-turn-claim" })
      .onConflictDoNothing({ target: sendsevenWebhookEvents.eventId })
      .returning({ id: sendsevenWebhookEvents.id });
    return rows.length > 0;
  },

  // Releases a reply-turn claim taken by claimReplyTurn — see
  // releaseAdminTurnClaim above for why this matters on a failed send.
  async releaseReplyTurnClaim(messageId: string): Promise<void> {
    await db.delete(sendsevenWebhookEvents).where(eq(sendsevenWebhookEvents.eventId, `reply-turn:${messageId}`));
  },
};
