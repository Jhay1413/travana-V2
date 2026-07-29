import { db } from "../config/database";
import {
  chatConversations, chatParticipants, chatMessages,
  transaction, clientTable, user, portalMessages,
} from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { notificationRepository } from "../repositories/notification.repository";
import { notSuspendedOrBanned } from "../v2/utils/user-conditions";
import { pushNotificationService } from "./push-notification.service";

const PORTAL_SENDER_PREFIX = "portal-client:";

export function portalSenderId(clientId: string): string {
  return `${PORTAL_SENDER_PREFIX}${clientId}`;
}

export function isPortalSender(senderId: string): boolean {
  return senderId.startsWith(PORTAL_SENDER_PREFIX);
}

export function extractClientIdFromSender(senderId: string): string | null {
  if (!isPortalSender(senderId)) return null;
  return senderId.replace(PORTAL_SENDER_PREFIX, "");
}

async function getClientName(clientId: string): Promise<string> {
  const [client] = await db
    .select({ firstName: clientTable.firstName, surename: clientTable.surename })
    .from(clientTable)
    .where(eq(clientTable.id, clientId))
    .limit(1);
  if (!client) return "Portal Client";
  return `${(client.firstName || "").trim()} ${(client.surename || "").trim()}`.trim() || "Portal Client";
}

async function findAgentForClient(clientId: string): Promise<string | null> {
  const [txn] = await db
    .select({ userId: transaction.user_id })
    .from(transaction)
    .where(and(eq(transaction.client_id, clientId), eq(transaction.is_active, true)))
    .orderBy(desc(transaction.created_at))
    .limit(1);
  return txn?.userId || null;
}

async function getClientOrgId(clientId: string): Promise<string | null> {
  const [row] = await db
    .select({ orgId: clientTable.orgId })
    .from(clientTable)
    .where(eq(clientTable.id, clientId))
    .limit(1);
  return row?.orgId ?? null;
}

/**
 * Every agent who should be pulled into a client's group chat: the client's own
 * organisation, excluding anyone suspended or banned.
 *
 * MUST stay org-scoped. This previously selected every non-banned user on the
 * platform, so a client with no active transaction had their message — and their
 * name — broadcast into the Live Chat of every agent in every organisation.
 */
async function getActiveOrgAgentIds(orgId: string | null): Promise<string[]> {
  if (!orgId) return [];
  const agents = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.orgId, orgId), notSuspendedOrBanned()));
  return agents.map(a => a.id);
}

async function reconcileParticipants(conversationId: string, agentIds: string[], clientId: string): Promise<void> {
  const existing = await db
    .select({ userId: chatParticipants.userId })
    .from(chatParticipants)
    .where(eq(chatParticipants.conversationId, conversationId));

  const existingUserIds = new Set(existing.map(e => e.userId));
  const portalId = portalSenderId(clientId);
  const desiredIds = new Set([portalId, ...agentIds]);

  for (const agentId of agentIds) {
    if (!existingUserIds.has(agentId)) {
      await db.insert(chatParticipants).values({
        conversationId,
        userId: agentId,
      });
    }
  }

  for (const existing of existingUserIds) {
    if (existing && !desiredIds.has(existing)) {
      await db.delete(chatParticipants)
        .where(and(
          eq(chatParticipants.conversationId, conversationId),
          eq(chatParticipants.userId, existing),
        ));
    }
  }
}

async function findOrCreatePortalConversation(
  clientId: string,
  clientName: string,
  agentIds: string[],
  isGroupChat: boolean,
): Promise<string> {
  const [existing] = await db
    .select({ id: chatConversations.id })
    .from(chatConversations)
    .where(eq(chatConversations.portalClientId, clientId))
    .limit(1);

  if (existing) {
    await reconcileParticipants(existing.id, agentIds, clientId);
    return existing.id;
  }

  const convType = isGroupChat ? "group" : "portal";
  const convName = `Portal: ${clientName}`;

  try {
    const [conv] = await db
      .insert(chatConversations)
      .values({
        type: convType,
        name: convName,
        createdBy: portalSenderId(clientId),
        portalClientId: clientId,
        portalClientName: clientName,
      })
      .onConflictDoNothing()
      .returning();

    if (!conv) {
      const [retry] = await db
        .select({ id: chatConversations.id })
        .from(chatConversations)
        .where(eq(chatConversations.portalClientId, clientId))
        .limit(1);
      if (retry) {
        await reconcileParticipants(retry.id, agentIds, clientId);
        return retry.id;
      }
      throw new Error("Failed to create or find portal conversation");
    }

    await db.insert(chatParticipants).values({
      conversationId: conv.id,
      userId: portalSenderId(clientId),
    });

    for (const agentId of agentIds) {
      await db.insert(chatParticipants).values({
        conversationId: conv.id,
        userId: agentId,
      });
    }

    return conv.id;
  } catch (err: any) {
    if (err.code === "23505") {
      const [retry] = await db
        .select({ id: chatConversations.id })
        .from(chatConversations)
        .where(eq(chatConversations.portalClientId, clientId))
        .limit(1);
      if (retry) {
        await reconcileParticipants(retry.id, agentIds, clientId);
        return retry.id;
      }
    }
    throw err;
  }
}

export async function bridgePortalMessageToChat(
  clientId: string,
  messageText: string,
  isFromDeal: boolean = false,
): Promise<void> {
  try {
    const clientName = await getClientName(clientId);
    const orgId = await getClientOrgId(clientId);
    let agentIds: string[] = [];
    let isGroupChat = false;

    // With an active transaction the client has an owning agent, so the message
    // is a direct thread with them. Otherwise — and always for deal enquiries,
    // which aren't tied to anyone — it becomes a group chat with the client and
    // every active agent in their organisation, so nothing goes unanswered.
    if (isFromDeal) {
      agentIds = await getActiveOrgAgentIds(orgId);
      isGroupChat = true;
    } else {
      const agentId = await findAgentForClient(clientId);
      if (agentId) {
        agentIds = [agentId];
      } else {
        agentIds = await getActiveOrgAgentIds(orgId);
        isGroupChat = true;
      }
    }

    if (agentIds.length === 0) return;

    const conversationId = await findOrCreatePortalConversation(
      clientId,
      clientName,
      agentIds,
      isGroupChat,
    );

    await db.insert(chatMessages).values({
      conversationId,
      senderId: portalSenderId(clientId),
      content: messageText,
    });

    await db
      .update(chatConversations)
      .set({ updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId));

    const preview = messageText.length > 80
      ? messageText.slice(0, 80) + "…"
      : messageText;

    for (const agentId of agentIds) {
      try {
        await notificationRepository.create({
          userId: agentId,
          type: "chat_message",
          title: `Portal Message from ${clientName}`,
          message: preview,
          link: "/command-center?view=connect-internal-chat",
          read: false,
        });
      } catch {}
    }
  } catch (err) {
    console.error("Portal-chat bridge error:", err);
  }
}

export async function bridgeAgentReplyToPortal(
  conversationId: string,
  agentId: string,
  agentName: string,
  messageText: string,
): Promise<void> {
  try {
    const [conv] = await db
      .select({ portalClientId: chatConversations.portalClientId })
      .from(chatConversations)
      .where(eq(chatConversations.id, conversationId))
      .limit(1);

    if (!conv?.portalClientId) return;

    const plainText = messageText.replace(/<[^>]*>/g, "").trim();
    if (!plainText) return;

    await db.insert(portalMessages).values({
      clientId: conv.portalClientId,
      sender: "agent",
      agentId,
      agentName,
      text: plainText,
    });

    try {
      await pushNotificationService.sendToClient(conv.portalClientId, {
        title: `Message from ${agentName || "Your Travel Agent"}`,
        body: plainText.length > 120 ? plainText.slice(0, 117) + "..." : plainText,
        url: "/portal/messages",
      });
    } catch (pushErr) {
      console.error("Push notification error (non-blocking):", pushErr);
    }
  } catch (err) {
    console.error("Agent-to-portal bridge error:", err);
  }
}
