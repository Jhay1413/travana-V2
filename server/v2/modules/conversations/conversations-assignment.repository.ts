import { db } from "../../config/database";
import { sendsevenConversationState, user } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";

// Local (platform-side) per-conversation state that SendSeven doesn't hold:
// who owns the conversation (assignment) and what kind it is (sales/admin).
// Travana agents are NOT SendSeven users, so both live in OUR
// sendseven_conversation_state table and are overlaid onto proxied SendSeven
// payloads by the conversations service — never written to SendSeven.

export interface AssignedUserInfo {
  id: string;
  name: string;
}

export type ConversationType = "sales" | "admin";

export interface LocalConversationState {
  assignee: AssignedUserInfo | null;
  conversationType: ConversationType | null;
}

function displayName(u: { firstName?: string | null; lastName?: string | null; name?: string | null }): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.name || "Unknown";
}

function toType(v: string | null | undefined): ConversationType | null {
  return v === "sales" || v === "admin" ? v : null;
}

export const conversationsAssignmentRepository = {
  /** conversationId → local state (assignee + type), for the given org. */
  async getMany(orgId: string, conversationIds: string[]): Promise<Map<string, LocalConversationState>> {
    const result = new Map<string, LocalConversationState>();
    if (!orgId || conversationIds.length === 0) return result;
    const rows = await db
      .select({
        conversationId: sendsevenConversationState.conversationId,
        userId: sendsevenConversationState.assignedUserId,
        conversationType: sendsevenConversationState.conversationType,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
      })
      .from(sendsevenConversationState)
      .leftJoin(user, eq(user.id, sendsevenConversationState.assignedUserId))
      .where(
        and(
          eq(sendsevenConversationState.orgId, orgId),
          inArray(sendsevenConversationState.conversationId, conversationIds),
        ),
      );
    for (const row of rows) {
      result.set(row.conversationId, {
        assignee: row.userId ? { id: row.userId, name: displayName(row) } : null,
        conversationType: toType(row.conversationType),
      });
    }
    return result;
  },

  async get(orgId: string, conversationId: string): Promise<LocalConversationState | null> {
    const many = await this.getMany(orgId, [conversationId]);
    return many.get(conversationId) ?? null;
  },

  /** Conversation ids assigned to a given Travana user in this org. */
  async conversationIdsAssignedTo(orgId: string, userId: string): Promise<string[]> {
    if (!orgId || !userId) return [];
    const rows = await db
      .select({ conversationId: sendsevenConversationState.conversationId })
      .from(sendsevenConversationState)
      .where(
        and(
          eq(sendsevenConversationState.orgId, orgId),
          eq(sendsevenConversationState.assignedUserId, userId),
        ),
      );
    return rows.map((r) => r.conversationId);
  },

  /** Upsert the assignment (null clears it). The state row may not exist yet —
      it's normally created by the AI webhook flow — so insert-or-update. */
  async set(orgId: string, conversationId: string, userId: string | null): Promise<void> {
    const now = new Date();
    await db
      .insert(sendsevenConversationState)
      .values({
        conversationId,
        orgId,
        assignedUserId: userId,
        assignedAt: userId ? now : null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: sendsevenConversationState.conversationId,
        set: { assignedUserId: userId, assignedAt: userId ? now : null, updatedAt: now },
      });
  },

  /** Upsert the conversation type (null clears it). */
  async setType(orgId: string, conversationId: string, type: ConversationType | null): Promise<void> {
    const now = new Date();
    await db
      .insert(sendsevenConversationState)
      .values({ conversationId, orgId, conversationType: type, updatedAt: now })
      .onConflictDoUpdate({
        target: sendsevenConversationState.conversationId,
        set: { conversationType: type, updatedAt: now },
      });
  },
};
