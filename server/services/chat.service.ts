import { chatRepository } from "../repositories/chat.repository";
import { AppError } from "../utils/error-handler";

export const chatService = {
  async getConversations(userId: string) {
    const conversations = await chatRepository.findConversationsByUserId(userId);
    const convIds = conversations.map(c => c.id);
    const [unreadCounts, lastMessages, allParticipants] = await Promise.all([
      chatRepository.getUnreadCounts(userId),
      chatRepository.getLastMessages(convIds),
      Promise.all(convIds.map(id => chatRepository.findParticipantsByConversation(id))),
    ]);
    const unreadMap = new Map(unreadCounts.map(u => [u.conversation_id, u.unread_count]));
    const lastMsgMap = new Map(lastMessages.map(m => [m.conversation_id, m]));
    return conversations.map((conv, i) => ({
      ...conv,
      participants: allParticipants[i] || [],
      unreadCount: unreadMap.get(conv.id) || 0,
      lastMessage: lastMsgMap.get(conv.id) || null,
    }));
  },

  async getOrCreateDirectConversation(userId1: string, userId2: string) {
    const existing = await chatRepository.findDirectConversation(userId1, userId2);
    if (existing) return existing;
    const conv = await chatRepository.createConversation({ type: "direct", createdBy: userId1 });
    await chatRepository.addParticipant({ conversationId: conv.id, userId: userId1 });
    await chatRepository.addParticipant({ conversationId: conv.id, userId: userId2 });
    return conv.id;
  },

  async createGroupConversation(name: string, createdBy: string, participantIds: string[]) {
    const conv = await chatRepository.createConversation({ type: "group", name, createdBy });
    for (const uid of participantIds) {
      await chatRepository.addParticipant({ conversationId: conv.id, userId: uid });
    }
    return conv;
  },

  async getMessages(conversationId: string, userId: string) {
    await chatRepository.updateLastRead(conversationId, userId);
    const messages = await chatRepository.findMessagesByConversation(conversationId);
    return messages.reverse();
  },

  async sendMessage(conversationId: string, senderId: string, content: string) {
    if (!content.trim()) throw new AppError("Message cannot be empty", 400);
    return await chatRepository.createMessage({ conversationId, senderId, content: content.trim() });
  },

  async markRead(conversationId: string, userId: string) {
    await chatRepository.updateLastRead(conversationId, userId);
  },
};
