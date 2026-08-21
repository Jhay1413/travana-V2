import { db } from "../../config/database";
import { sendsevenConversationState, user } from "@shared/schema";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

// Local (platform-side) conversation assignment. Travana agents are NOT
// SendSeven users, so who owns a conversation lives in OUR
// sendseven_conversation_state table and is overlaid onto proxied SendSeven
// payloads by the conversations service — never written to SendSeven.

export interface AssignedUserInfo {
  id: string;
  name: string;
}

function displayName(u: { firstName?: string | null; lastName?: string | null; name?: string | null }): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.name || "Unknown";
}

export const conversationsAssignmentRepository = {
  /** conversationId → assigned Travana user, for the given org. */
  async getMany(orgId: string, conversationIds: string[]): Promise<Map<string, AssignedUserInfo>> {
    const result = new Map<string, AssignedUserInfo>();
    if (!orgId || conversationIds.length === 0) return result;
    const rows = await db
      .select({
        conversationId: sendsevenConversationState.conversationId,
        userId: sendsevenConversationState.assignedUserId,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
      })
      .from(sendsevenConversationState)
      .innerJoin(user, eq(user.id, sendsevenConversationState.assignedUserId))
      .where(
        and(
          eq(sendsevenConversationState.orgId, orgId),
          inArray(sendsevenConversationState.conversationId, conversationIds),
          isNotNull(sendsevenConversationState.assignedUserId),
        ),
      );
    for (const row of rows) {
      if (row.userId) result.set(row.conversationId, { id: row.userId, name: displayName(row) });
    }
    return result;
  },

  async get(orgId: string, conversationId: string): Promise<AssignedUserInfo | null> {
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
};
