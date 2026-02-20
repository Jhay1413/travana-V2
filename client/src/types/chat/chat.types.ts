export interface ChatConversation {
  id: string;
  type: "direct" | "group";
  name: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  participants: ChatParticipantWithUser[];
  unreadCount: number;
  lastMessage: ChatLastMessage | null;
}

export interface ChatParticipantWithUser {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadAt: string | null;
  userName: string | null;
  userImage: string | null;
}

export interface ChatLastMessage {
  conversation_id: string;
  content: string;
  created_at: string;
  sender_id: string;
  sender_name: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  senderName: string | null;
  senderImage: string | null;
}
