import { facebookRepository } from './facebook.repository';
import { encrypt, decrypt } from '../../utils/encryption';
import { AppError } from '../../utils/error-handler';

const FB_API = 'https://graph.facebook.com/v19.0';

async function fbGet<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FB_API}${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const json = (await res.json()) as { error?: { message: string } } & T;
  if (!res.ok || (json as any).error) {
    throw new AppError(`Facebook API: ${(json as any).error?.message ?? 'Request failed'}`, 502);
  }
  return json;
}

async function fbPost<T>(path: string, token: string, body: unknown): Promise<T> {
  const url = new URL(`${FB_API}${path}`);
  url.searchParams.set('access_token', token);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { error?: { message: string } } & T;
  if (!res.ok || (json as any).error) {
    throw new AppError(`Facebook API: ${(json as any).error?.message ?? 'Request failed'}`, 502);
  }
  return json;
}

function toPublic(page: any) {
  return {
    id: page.id,
    userId: page.userId,
    pageId: page.pageId,
    pageName: page.pageName,
    pageCategory: page.pageCategory,
    pageAvatar: page.pageAvatar,
    createdAt: page.createdAt instanceof Date ? page.createdAt.toISOString() : page.createdAt,
  };
}

export const facebookService = {
  getAuthUrl(userId: string): string {
    const appId = process.env.FACEBOOK_APP_ID;
    const redirectUri = `${process.env.BASE_URL}/api/facebook/callback`;
    if (!appId) throw new AppError('FACEBOOK_APP_ID not configured', 500);
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: 'pages_messaging,pages_read_engagement,pages_show_list,pages_manage_metadata',
      state: userId,
      response_type: 'code',
    });
    return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
  },

  async handleCallback(code: string, userId: string) {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = `${process.env.BASE_URL}/api/facebook/callback`;
    if (!appId || !appSecret) throw new AppError('Facebook app credentials not configured', 500);

    const tokenRes = await fbGet<{ access_token: string }>('/oauth/access_token', '', {
      client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code,
    });
    const longRes = await fbGet<{ access_token: string }>('/oauth/access_token', '', {
      grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: tokenRes.access_token,
    });
    const pagesRes = await fbGet<{ data: any[] }>('/me/accounts', longRes.access_token, {
      fields: 'id,name,category,access_token,picture',
    });

    const saved = [];
    for (const p of pagesRes.data) {
      const page = await facebookRepository.upsert({
        userId,
        pageId: p.id,
        pageName: p.name,
        pageCategory: p.category ?? null,
        pageAvatar: p.picture?.data?.url ?? null,
        encryptedAccessToken: encrypt(p.access_token),
      });
      try {
        await fbPost(`/${p.id}/subscribed_apps`, p.access_token, {
          subscribed_fields: ['messages', 'messaging_postbacks', 'messaging_reads', 'message_deliveries'],
        });
      } catch { /* non-fatal */ }
      saved.push(toPublic(page));
    }
    return saved;
  },

  async getPages(userId: string) {
    const pages = await facebookRepository.findByUserId(userId);
    return pages.map(toPublic);
  },

  async disconnectPage(id: string, userId: string) {
    const pages = await facebookRepository.findByUserId(userId);
    const page = pages.find((p) => p.id === id);
    if (!page) throw new AppError('Page not found', 404);
    await facebookRepository.remove(id);
  },

  async handleWebhookEvent(_body: any) {
    // Acknowledge receipt — real-time handled by polling
  },

  async getConversations(pageDbId: string, userId: string) {
    const pages = await facebookRepository.findByUserId(userId);
    const page = pages.find((p) => p.id === pageDbId);
    if (!page) throw new AppError('Page not found', 404);
    const token = decrypt(page.encryptedAccessToken);
    const res = await fbGet<{ data: any[] }>(`/${page.pageId}/conversations`, token, {
      platform: 'messenger',
      fields: 'id,participants,updated_time,unread_count',
      limit: '30',
    });
    return res.data.map((conv) => {
      const participant = conv.participants.data.find((p: any) => p.id !== page.pageId);
      const last = conv.participants.data[0];
      return {
        id: conv.id,
        participantId: participant?.id ?? last?.id ?? '',
        participantName: participant?.name ?? last?.name ?? 'Unknown',
        lastMessage: '',
        updatedAt: conv.updated_time,
        unreadCount: conv.unread_count ?? 0,
      };
    });
  },

  async getMessages(conversationId: string, pageDbId: string, userId: string) {
    const pages = await facebookRepository.findByUserId(userId);
    const page = pages.find((p) => p.id === pageDbId);
    if (!page) throw new AppError('Page not found', 404);
    const token = decrypt(page.encryptedAccessToken);
    const res = await fbGet<{ data: any[] }>(`/${conversationId}/messages`, token, {
      fields: 'id,message,from,created_time', limit: '50',
    });
    return res.data
      .filter((m) => m.message)
      .map((m) => ({
        id: m.id,
        text: m.message,
        senderId: m.from.id,
        senderName: m.from.name,
        senderType: m.from.id === page.pageId ? 'agent' : 'customer',
        createdAt: m.created_time,
      }))
      .reverse();
  },

  async sendMessage(pageDbId: string, recipientId: string, text: string, userId: string) {
    const pages = await facebookRepository.findByUserId(userId);
    const page = pages.find((p) => p.id === pageDbId);
    if (!page) throw new AppError('Page not found', 404);
    const token = decrypt(page.encryptedAccessToken);
    await fbPost(`/${page.pageId}/messages`, token, {
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
    });
  },
};
