import { db } from "../config/database";
import { chatConversations, chatParticipants, chatMessages, user } from "@shared/schema";
import type { ChatConversation, InsertChatConversation, ChatParticipant, InsertChatParticipant, ChatMessage, InsertChatMessage } from "@shared/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

export const chatRepository = {
  async findConversationsByUserId(userId: string) {
    const participantRows = await db.select({ conversationId: chatParticipants.conversationId }).from(chatParticipants).where(eq(chatParticipants.userId, userId));
    if (participantRows.length === 0) return [];
    const convIds = participantRows.map(r => r.conversationId);
    return await db.select().from(chatConversations).where(inArray(chatConversations.id, convIds)).orderBy(desc(chatConversations.updatedAt));
  },

  async findConversationById(id: string) {
    const results = await db.select().from(chatConversations).where(eq(chatConversations.id, id)).limit(1);
    return results[0];
  },

  async createConversation(data: InsertChatConversation): Promise<ChatConversation> {
    const results = await db.insert(chatConversations).values(data).returning();
    return results[0];
  },

  async findDirectConversation(userId1: string, userId2: string) {
    const result = await db.execute(sql`
      SELECT cp1.conversation_id FROM chat_participants cp1
      JOIN chat_participants cp2 ON cp1.conversation_id = cp2.conversation_id
      JOIN chat_conversations cc ON cc.id = cp1.conversation_id
      WHERE cp1.user_id = ${userId1} AND cp2.user_id = ${userId2} AND cc.type = 'direct'
      LIMIT 1
    `);
    if (result.rows && result.rows.length > 0) {
      return result.rows[0].conversation_id as string;
    }
    return null;
  },

  async findParticipantsByConversation(conversationId: string) {
    return await db.select({
      id: chatParticipants.id,
      conversationId: chatParticipants.conversationId,
      userId: chatParticipants.userId,
      joinedAt: chatParticipants.joinedAt,
      lastReadAt: chatParticipants.lastReadAt,
      userName: user.name,
      userImage: user.image,
    }).from(chatParticipants).leftJoin(user, eq(chatParticipants.userId, user.id)).where(eq(chatParticipants.conversationId, conversationId));
  },

  async addParticipant(data: InsertChatParticipant): Promise<ChatParticipant> {
    const results = await db.insert(chatParticipants).values(data).returning();
    return results[0];
  },

  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const rows = await db.select({ id: chatParticipants.id }).from(chatParticipants).where(and(eq(chatParticipants.conversationId, conversationId), eq(chatParticipants.userId, userId))).limit(1);
    return rows.length > 0;
  },

  async updateLastRead(conversationId: string, userId: string) {
    await db.update(chatParticipants).set({ lastReadAt: new Date() }).where(and(eq(chatParticipants.conversationId, conversationId), eq(chatParticipants.userId, userId)));
  },

  async findMessagesByConversation(conversationId: string, limit = 50) {
    return await db.select({
      id: chatMessages.id,
      conversationId: chatMessages.conversationId,
      senderId: chatMessages.senderId,
      content: chatMessages.content,
      fileUrl: chatMessages.fileUrl,
      fileName: chatMessages.fileName,
      fileType: chatMessages.fileType,
      fileSize: chatMessages.fileSize,
      createdAt: chatMessages.createdAt,
      senderName: user.name,
      senderImage: user.image,
    }).from(chatMessages).leftJoin(user, eq(chatMessages.senderId, user.id)).where(eq(chatMessages.conversationId, conversationId)).orderBy(desc(chatMessages.createdAt)).limit(limit);
  },

  async createMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const results = await db.insert(chatMessages).values(data).returning();
    await db.update(chatConversations).set({ updatedAt: new Date() }).where(eq(chatConversations.id, data.conversationId));
    return results[0];
  },

  async getUnreadCounts(userId: string) {
    const result = await db.execute(sql`
      SELECT cp.conversation_id, COUNT(cm.id)::int as unread_count
      FROM chat_participants cp
      JOIN chat_messages cm ON cm.conversation_id = cp.conversation_id
      WHERE cp.user_id = ${userId}
        AND cm.sender_id != ${userId}
        AND (cp.last_read_at IS NULL OR cm.created_at > cp.last_read_at)
      GROUP BY cp.conversation_id
    `);
    return result.rows as Array<{ conversation_id: string; unread_count: number }>;
  },

  async getLastMessages(conversationIds: string[]) {
    if (conversationIds.length === 0) return [];
    const result = await db.execute(sql`
      SELECT DISTINCT ON (cm.conversation_id) cm.conversation_id, cm.content, cm.created_at, cm.sender_id, u.name as sender_name
      FROM chat_messages cm
      LEFT JOIN "user" u ON cm.sender_id = u.id
      WHERE cm.conversation_id IN (${sql.join(conversationIds.map(id => sql`${id}`), sql`, `)})
      ORDER BY cm.conversation_id, cm.created_at DESC
    `);
    return result.rows as Array<{ conversation_id: string; content: string; created_at: string; sender_id: string; sender_name: string }>;
  },
};
