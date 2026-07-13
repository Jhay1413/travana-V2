import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../config/database";
import { sendsevenConversationState, type SendsevenConversationState } from "@shared/schema";

// Repository: our per-thread AI memory (sendseven_conversation_state), keyed by
// the SendSeven conversation id.

export const conversationStateRepository = {
  async find(conversationId: string): Promise<SendsevenConversationState | null> {
    const [row] = await db
      .select()
      .from(sendsevenConversationState)
      .where(eq(sendsevenConversationState.conversationId, conversationId));
    return row ?? null;
  },

  // Ensures a row exists for the conversation (first time we see it).
  async ensure(conversationId: string, orgId: string, contactId: string | null): Promise<SendsevenConversationState> {
    const [row] = await db
      .insert(sendsevenConversationState)
      .values({ conversationId, orgId, contactId })
      .onConflictDoUpdate({
        target: sendsevenConversationState.conversationId,
        set: { updatedAt: new Date() },
      })
      .returning();
    return row;
  },

  async update(conversationId: string, data: Partial<SendsevenConversationState>): Promise<void> {
    await db
      .update(sendsevenConversationState)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sendsevenConversationState.conversationId, conversationId));
  },

  // Clears the rolling `context` too (lastReply + any transient AI-flow flags
  // like groupedAskSent/availabilityTaskId) — a human owns the thread now, so
  // stale flags must not leak into a later AI turn (e.g. after a manual
  // hand-back before the 1h idle-resume would have cleared them itself).
  async setNeedsHuman(conversationId: string): Promise<void> {
    await db
      .update(sendsevenConversationState)
      .set({ needsHuman: true, handledByHumanAt: new Date(), context: null, updatedAt: new Date() })
      .where(eq(sendsevenConversationState.conversationId, conversationId));
  },

  // Atomically claims a status transition: the write only takes effect if the
  // row's enquiry_status still matches `expectedStatus` at the moment of the
  // UPDATE (Postgres serializes concurrent UPDATEs to the same row, so only one
  // concurrent caller can ever win this). Used to guard side-effecting steps
  // (enquiry create, callback-task create) against duplicate/concurrent
  // processing of the same inbound — the guard must be persisted BEFORE the
  // side effect runs, not after. Returns true iff this call won the claim.
  async claimStatusTransition(
    conversationId: string,
    expectedStatus: string | null,
    nextStatus: string,
  ): Promise<boolean> {
    const statusCond =
      expectedStatus === null
        ? isNull(sendsevenConversationState.enquiryStatus)
        : eq(sendsevenConversationState.enquiryStatus, expectedStatus);
    const result = await db
      .update(sendsevenConversationState)
      .set({ enquiryStatus: nextStatus, updatedAt: new Date() })
      .where(and(eq(sendsevenConversationState.conversationId, conversationId), statusCond))
      .returning({ conversationId: sendsevenConversationState.conversationId });
    return result.length > 0;
  },
};
