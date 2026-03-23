export type { FacebookPage, InsertFacebookPage } from "@shared/schema";

export interface FbConversation {
  id: string;
  participants: {
    data: { id: string; name: string; email?: string }[];
  };
  updated_time: string;
  unread_count?: number;
}

export interface FbMessage {
  id: string;
  message: string;
  from: { id: string; name: string; email?: string };
  created_time: string;
}

export interface FbWebhookEvent {
  object: string;
  entry: {
    id: string;
    time: number;
    messaging?: {
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: { mid: string; text: string };
      delivery?: { mids: string[]; watermark: number };
      read?: { watermark: number };
    }[];
  }[];
}

export interface FacebookPagePublic {
  id: string;
  userId: string;
  pageId: string;
  pageName: string;
  pageCategory: string | null;
  pageAvatar: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  lastMessage: string;
  updatedAt: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderType: "customer" | "agent";
  createdAt: string;
}
