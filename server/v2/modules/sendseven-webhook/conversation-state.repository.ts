import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../config/database";
import { sendsevenConversationState, type SendsevenConversationState } from "@shared/schema";
import type { HandoffReason } from "./sendseven-webhook.types";

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
    // The AI owns the initial conversation type: every time the brain commits
    // an intent, derive Sales (enquiry) / Admin (other) from it. COALESCE keeps
    // any value already on the row, so an agent's manual choice in the inbox
    // header (or an earlier AI classification) is never overwritten.
    const derivedType = data.intent === "enquiry" ? "sales" : data.intent === "other" ? "admin" : null;
    await db
      .update(sendsevenConversationState)
      .set({
        ...data,
        ...(derivedType && data.conversationType === undefined
          ? { conversationType: sql`COALESCE(${sendsevenConversationState.conversationType}, ${derivedType})` }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(sendsevenConversationState.conversationId, conversationId));
  },

  // Clears the rolling `context` too (lastReply + any transient AI-flow flags
  // like groupedAskSent/availabilityTaskId) — a human owns the thread now, so
  // stale flags must not leak into a later AI turn (e.g. after a manual
  // hand-back before the idle-resume would have cleared them itself). The only
  // context that survives is `handoffReason` (why the hand-off happened),
  // which the reply worker's resume gate reads to decide between a sticky
  // hand-off (human-owned) and the idle auto-resume (AI-caused) — omitting
  // `reason` leaves context null, which the gate treats as "human_reply"
  // (fail safe: stay silent).
  // `orgId` is optional to preserve existing conversationId-only callers
  // (the webhook's own human-takeover detection, which only ever knows the
  // conversation's own org) — pass it whenever the caller has it (e.g. a
  // manual API toggle) so the write can never cross into another org's row.
  async setNeedsHuman(conversationId: string, orgId?: string, reason?: HandoffReason): Promise<void> {
    const conds = [eq(sendsevenConversationState.conversationId, conversationId)];
    if (orgId) conds.push(eq(sendsevenConversationState.orgId, orgId));
    await db
      .update(sendsevenConversationState)
      .set({
        needsHuman: true,
        handledByHumanAt: new Date(),
        context: reason ? { handoffReason: reason } : null,
        updatedAt: new Date(),
      })
      .where(and(...conds));
  },

  // Manual re-enable (staff toggles AI back on from the inbox) — SAME
  // clean-slate semantics as the 1h idle auto-resume in reply-worker
  // (needsHuman/handledByHumanAt/enquiryStatus/enquirySlots/enquiryId/context
  // all reset) so a fresh AI turn never inherits a stale enquiry-in-progress.
  // Scoped by conversationId AND orgId so a manual toggle can never reach
  // another org's row.
  async clearNeedsHuman(conversationId: string, orgId: string): Promise<void> {
    await db
      .update(sendsevenConversationState)
      .set({
        needsHuman: false,
        handledByHumanAt: null,
        enquiryStatus: null,
        enquirySlots: {},
        enquiryId: null,
        context: null,
        updatedAt: new Date(),
      })
      .where(and(eq(sendsevenConversationState.conversationId, conversationId), eq(sendsevenConversationState.orgId, orgId)));
  },

  // Sets the per-conversation AI override ("enabled" | "disabled" | null =
  // follow the linked client's aiReplyEnabled). Org-scoped: a manual toggle
  // can never reach another org's row.
  async setAiOverride(conversationId: string, orgId: string, override: "enabled" | "disabled" | null): Promise<void> {
    await db
      .update(sendsevenConversationState)
      .set({ aiOverride: override, updatedAt: new Date() })
      .where(and(eq(sendsevenConversationState.conversationId, conversationId), eq(sendsevenConversationState.orgId, orgId)));
  },

  // Org-scoped read for the AI-state API — a manual toggle/status check must
  // never leak or touch another org's conversation state.
  async getState(conversationId: string, orgId: string): Promise<SendsevenConversationState | null> {
    const [row] = await db
      .select()
      .from(sendsevenConversationState)
      .where(and(eq(sendsevenConversationState.conversationId, conversationId), eq(sendsevenConversationState.orgId, orgId)));
    return row ?? null;
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
