import { notificationRepository } from '../notification/notification.repository';
import { pushNotificationService } from '../notification/push-notification.service';
import { portalRepository } from './portal.repository';

const PORTAL_SENDER_PREFIX = 'portal-client:';

export function portalSenderId(clientId: string): string {
  return `${PORTAL_SENDER_PREFIX}${clientId}`;
}

export function isPortalSender(senderId: string): boolean {
  return senderId.startsWith(PORTAL_SENDER_PREFIX);
}

export function extractClientIdFromSender(senderId: string): string | null {
  if (!isPortalSender(senderId)) return null;
  return senderId.replace(PORTAL_SENDER_PREFIX, '');
}

async function reconcileParticipants(
  conversationId: string,
  agentIds: string[],
  clientId: string,
): Promise<void> {
  const existing = await portalRepository.listParticipantUserIds(conversationId);
  const existingUserIds = new Set(existing.map((e) => e.userId));
  const portalId = portalSenderId(clientId);
  const desiredIds = new Set([portalId, ...agentIds]);

  for (const agentId of agentIds) {
    if (!existingUserIds.has(agentId)) {
      await portalRepository.addParticipant(conversationId, agentId);
    }
  }

  for (const existingId of existingUserIds) {
    if (existingId && !desiredIds.has(existingId)) {
      await portalRepository.removeParticipant(conversationId, existingId);
    }
  }
}

async function findOrCreatePortalConversation(
  clientId: string,
  clientName: string,
  agentIds: string[],
  isGroupChat: boolean,
): Promise<string> {
  const existing = await portalRepository.findConversationByPortalClient(clientId);
  if (existing) {
    await reconcileParticipants(existing.id, agentIds, clientId);
    return existing.id;
  }

  const convType = isGroupChat ? 'group' : 'portal';
  const convName = `Portal: ${clientName}`;

  try {
    const conv = await portalRepository.createConversation({
      type: convType,
      name: convName,
      createdBy: portalSenderId(clientId),
      portalClientId: clientId,
      portalClientName: clientName,
    });

    if (!conv) {
      const retry = await portalRepository.findConversationByPortalClient(clientId);
      if (retry) {
        await reconcileParticipants(retry.id, agentIds, clientId);
        return retry.id;
      }
      throw new Error('Failed to create or find portal conversation');
    }

    await portalRepository.addParticipant(conv.id, portalSenderId(clientId));
    for (const agentId of agentIds) {
      await portalRepository.addParticipant(conv.id, agentId);
    }

    return conv.id;
  } catch (err: any) {
    if (err.code === '23505') {
      const retry = await portalRepository.findConversationByPortalClient(clientId);
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
    const clientName = await portalRepository.getClientName(clientId);
    let agentIds: string[] = [];
    let isGroupChat = false;

    if (isFromDeal) {
      agentIds = await portalRepository.findAllNonBannedAgentIds();
      isGroupChat = agentIds.length > 1;
    } else {
      const agentId = await portalRepository.findActiveAgentIdForClient(clientId);
      if (agentId) {
        agentIds = [agentId];
      } else {
        agentIds = await portalRepository.findAllNonBannedAgentIds();
        isGroupChat = agentIds.length > 1;
      }
    }

    if (agentIds.length === 0) return;

    const conversationId = await findOrCreatePortalConversation(
      clientId,
      clientName,
      agentIds,
      isGroupChat,
    );

    await portalRepository.insertChatMessage({
      conversationId,
      senderId: portalSenderId(clientId),
      content: messageText,
    });

    await portalRepository.touchConversation(conversationId);

    const preview = messageText.length > 80 ? messageText.slice(0, 80) + '…' : messageText;

    for (const agentId of agentIds) {
      try {
        await notificationRepository.create({
          userId: agentId,
          type: 'chat_message',
          title: `Portal Message from ${clientName}`,
          message: preview,
          link: '/command-center?view=connect-internal-chat',
          read: false,
        });
      } catch {}
    }
  } catch (err) {
    console.error('Portal-chat bridge error:', err);
  }
}

export async function bridgeAgentReplyToPortal(
  conversationId: string,
  agentId: string,
  agentName: string,
  messageText: string,
): Promise<void> {
  try {
    const portalClientId = await portalRepository.findPortalClientIdForConversation(conversationId);
    if (!portalClientId) return;

    const plainText = messageText.replace(/<[^>]*>/g, '').trim();
    if (!plainText) return;

    await portalRepository.insertPortalMessageFromAgent({
      clientId: portalClientId,
      agentId,
      agentName,
      text: plainText,
    });

    try {
      await pushNotificationService.sendToClient(portalClientId, {
        title: `Message from ${agentName || 'Your Travel Agent'}`,
        body: plainText.length > 120 ? plainText.slice(0, 117) + '...' : plainText,
        url: '/portal/messages',
      });
    } catch (pushErr) {
      console.error('Push notification error (non-blocking):', pushErr);
    }
  } catch (err) {
    console.error('Agent-to-portal bridge error:', err);
  }
}
