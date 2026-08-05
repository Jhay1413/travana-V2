import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../config/database";
import {
  internalChatMessage,
  internalChatSession,
  type InternalChatMessage,
  type InternalChatSession,
} from "@shared/schema";
import type { ChatMessageRole, ChatMode } from "./internal-chat.types";

// Repository: internal_chat_session / internal_chat_message. Every query is
// scoped by org_id (directly on the session, or via a join for messages,
// which carry no org_id column of their own).

export interface CreateSessionInput {
  orgId: string;
  userId: string | null;
  mode: ChatMode;
  isTest?: boolean;
}

export interface CreateMessageInput {
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  // Original timestamp override — used when seeding a session forked from a
  // live SendSeven conversation, so the copied transcript keeps its real
  // order/times. Defaults to now() for normal chat turns.
  createdAt?: Date;
}

export const internalChatRepository = {
  async createSession(input: CreateSessionInput): Promise<InternalChatSession> {
    const [row] = await db
      .insert(internalChatSession)
      .values({
        orgId: input.orgId,
        userId: input.userId,
        mode: input.mode,
        isTest: input.isTest ?? false,
      })
      .returning();
    return row;
  },

  async findByIdForOrg(id: string, orgId: string): Promise<InternalChatSession | null> {
    const [row] = await db
      .select()
      .from(internalChatSession)
      .where(and(eq(internalChatSession.id, id), eq(internalChatSession.orgId, orgId)));
    return row ?? null;
  },

  async updateSession(
    id: string,
    orgId: string,
    data: Partial<InternalChatSession>,
  ): Promise<InternalChatSession | null> {
    const [row] = await db
      .update(internalChatSession)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(internalChatSession.id, id), eq(internalChatSession.orgId, orgId)))
      .returning();
    return row ?? null;
  },

  // Atomically claims a status transition (mirrors
  // conversation-state.repository's claimStatusTransition): the write only
  // takes effect if the row's enquiry_status still matches `expectedStatus`
  // at the moment of the UPDATE. For the later test_flow driver, guarding
  // side-effecting steps (e.g. enquiry create) against duplicate/concurrent
  // processing of the same session turn.
  async claimStatusTransition(
    sessionId: string,
    orgId: string,
    expectedStatus: string | null,
    nextStatus: string,
  ): Promise<boolean> {
    const statusCond =
      expectedStatus === null
        ? isNull(internalChatSession.enquiryStatus)
        : eq(internalChatSession.enquiryStatus, expectedStatus);
    const result = await db
      .update(internalChatSession)
      .set({ enquiryStatus: nextStatus, updatedAt: new Date() })
      .where(and(eq(internalChatSession.id, sessionId), eq(internalChatSession.orgId, orgId), statusCond))
      .returning({ id: internalChatSession.id });
    return result.length > 0;
  },

  async createMessage(input: CreateMessageInput): Promise<InternalChatMessage> {
    const [row] = await db
      .insert(internalChatMessage)
      .values({
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      })
      .returning();
    return row;
  },

  // Full transcript for a session, ordered oldest-first. org-scoped via a join
  // against internal_chat_session (the message table itself has no org_id).
  async listBySession(sessionId: string, orgId: string): Promise<InternalChatMessage[]> {
    const rows = await db
      .select({
        id: internalChatMessage.id,
        sessionId: internalChatMessage.sessionId,
        role: internalChatMessage.role,
        content: internalChatMessage.content,
        createdAt: internalChatMessage.createdAt,
      })
      .from(internalChatMessage)
      .innerJoin(internalChatSession, eq(internalChatMessage.sessionId, internalChatSession.id))
      .where(and(eq(internalChatMessage.sessionId, sessionId), eq(internalChatSession.orgId, orgId)))
      .orderBy(asc(internalChatMessage.createdAt));
    return rows;
  },

  // Last `limit` messages (oldest-first) — short-term memory fed into the
  // assistant prompt. org-scoped via the same join as listBySession.
  async getRecentMessages(sessionId: string, orgId: string, limit: number): Promise<InternalChatMessage[]> {
    const rows = await db
      .select({
        id: internalChatMessage.id,
        sessionId: internalChatMessage.sessionId,
        role: internalChatMessage.role,
        content: internalChatMessage.content,
        createdAt: internalChatMessage.createdAt,
      })
      .from(internalChatMessage)
      .innerJoin(internalChatSession, eq(internalChatMessage.sessionId, internalChatSession.id))
      .where(and(eq(internalChatMessage.sessionId, sessionId), eq(internalChatSession.orgId, orgId)))
      .orderBy(desc(internalChatMessage.createdAt))
      .limit(limit);
    return rows.reverse();
  },
};
