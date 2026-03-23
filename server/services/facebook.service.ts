import { facebookRepository } from "../repositories/facebook.repository";
import { encrypt, decrypt } from "../utils/encryption";
import { AppError } from "../utils/error-handler";
import type { FacebookPagePublic, Conversation, Message, FbConversation, FbMessage, FbWebhookEvent } from "../types/facebook";

const FB_API = "https://graph.facebook.com/v19.0";

async function fbGet<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FB_API}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const json = await res.json() as { error?: { message: string } } & T;
  if (!res.ok || (json as { error?: { message: string } }).error) {
    throw new AppError(`Facebook API: ${(json as { error?: { message: string } }).error?.message ?? "Request failed"}`, 502);
  }
  return json;
}

async function fbPost<T>(path: string, token: string, body: unknown): Promise<T> {
  const url = new URL(`${FB_API}${path}`);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json() as { error?: { message: string } } & T;
  if (!res.ok || (json as { error?: { message: string } }).error) {
    throw new AppError(`Facebook API: ${(json as { error?: { message: string } }).error?.message ?? "Request failed"}`, 502);
  }
  return json;
}

function toPublic(page: { id: string; userId: string; pageId: string; pageName: string; pageCategory: string | null; pageAvatar: string | null; createdAt: Date }): FacebookPagePublic {
  return {
    id: page.id,
    userId: page.userId,
    pageId: page.pageId,
    pageName: page.pageName,
    pageCategory: page.pageCategory,
    pageAvatar: page.pageAvatar,
    createdAt: page.createdAt.toISOString(),
  };
}

export const facebookService = {
  // ─── OAuth ────────────────────────────────────────────────────────────────

  getAuthUrl(userId: string): string {
    const appId = process.env.FACEBOOK_APP_ID;
    const redirectUri = `${process.env.BASE_URL}/api/facebook/callback`;
    if (!appId) throw new AppError("FACEBOOK_APP_ID not configured", 500);
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: "pages_messaging,pages_read_engagement,pages_show_list,pages_manage_metadata",
      state: userId,
      response_type: "code",
    });
    return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
  },

  async handleCallback(code: string, userId: string): Promise<FacebookPagePublic[]> {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = `${process.env.BASE_URL}/api/facebook/callback`;
    if (!appId || !appSecret) throw new AppError("Facebook app credentials not configured", 500);

    // Exchange code for short-lived user token
    const tokenRes = await fbGet<{ access_token: string }>("/oauth/access_token", "", {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });

    // Extend to long-lived user token
    const longRes = await fbGet<{ access_token: string }>("/oauth/access_token", "", {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: tokenRes.access_token,
    });

    // Get pages (page tokens from long-lived user token are permanent)
    const pagesRes = await fbGet<{ data: { id: string; name: string; category: string; access_token: string; picture?: { data: { url: string } } }[] }>(
      "/me/accounts",
      longRes.access_token,
      { fields: "id,name,category,access_token,picture" },
    );

    const saved: FacebookPagePublic[] = [];
    for (const p of pagesRes.data) {
      const page = await facebookRepository.upsert({
        userId,
        pageId: p.id,
        pageName: p.name,
        pageCategory: p.category ?? null,
        pageAvatar: p.picture?.data?.url ?? null,
        encryptedAccessToken: encrypt(p.access_token),
      });

      // Subscribe app to page webhooks
      try {
        await fbPost(`/${p.id}/subscribed_apps`, p.access_token, {
          subscribed_fields: ["messages", "messaging_postbacks", "messaging_reads", "message_deliveries"],
        });
      } catch {
        // Non-fatal — webhook subscription may need app review
      }

      saved.push(toPublic(page));
    }
    return saved;
  },

  // ─── Pages ────────────────────────────────────────────────────────────────

  async getPages(userId: string): Promise<FacebookPagePublic[]> {
    const pages = await facebookRepository.findByUserId(userId);
    return pages.map(toPublic);
  },

  async disconnectPage(id: string, userId: string): Promise<void> {
    const pages = await facebookRepository.findByUserId(userId);
    const page = pages.find((p) => p.id === id);
    if (!page) throw new AppError("Page not found", 404);
    await facebookRepository.remove(id);
  },

  // ─── Webhook ─────────────────────────────────────────────────────────────

  verifyWebhook(mode: string, token: string, challenge: string): string {
    const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN;
    if (mode === "subscribe" && token === verifyToken) return challenge;
    throw new AppError("Webhook verification failed", 403);
  },

  async handleWebhookEvent(body: FbWebhookEvent): Promise<void> {
    if (body.object !== "page") return;
    // Webhook events are received — frontend will refetch on next poll
    // For now we just acknowledge receipt (real-time handled by polling)
  },

  // ─── Conversations ────────────────────────────────────────────────────────

  async getConversations(pageDbId: string, userId: string): Promise<Conversation[]> {
    const pages = await facebookRepository.findByUserId(userId);
    const page = pages.find((p) => p.id === pageDbId);
    if (!page) throw new AppError("Page not found", 404);

    const token = decrypt(page.encryptedAccessToken);
    const res = await fbGet<{ data: FbConversation[] }>(
      `/${page.pageId}/conversations`,
      token,
      { platform: "messenger", fields: "id,participants,updated_time,unread_count", limit: "30" },
    );

    return res.data.map((conv) => {
      const participant = conv.participants.data.find((p) => p.id !== page.pageId);
      const lastParticipantMsg = conv.participants.data[0];
      return {
        id: conv.id,
        participantId: participant?.id ?? lastParticipantMsg?.id ?? "",
        participantName: participant?.name ?? lastParticipantMsg?.name ?? "Unknown",
        lastMessage: "",
        updatedAt: conv.updated_time,
        unreadCount: conv.unread_count ?? 0,
      };
    });
  },

  // ─── Messages ────────────────────────────────────────────────────────────

  async getMessages(conversationId: string, pageDbId: string, userId: string): Promise<Message[]> {
    const pages = await facebookRepository.findByUserId(userId);
    const page = pages.find((p) => p.id === pageDbId);
    if (!page) throw new AppError("Page not found", 404);

    const token = decrypt(page.encryptedAccessToken);
    const res = await fbGet<{ data: FbMessage[] }>(
      `/${conversationId}/messages`,
      token,
      { fields: "id,message,from,created_time", limit: "50" },
    );

    return res.data
      .filter((m) => m.message)
      .map((m) => ({
        id: m.id,
        text: m.message,
        senderId: m.from.id,
        senderName: m.from.name,
        senderType: m.from.id === page.pageId ? "agent" : "customer",
        createdAt: m.created_time,
      }))
      .reverse();
  },

  // ─── Send ─────────────────────────────────────────────────────────────────

  async sendMessage(pageDbId: string, recipientId: string, text: string, userId: string): Promise<void> {
    const pages = await facebookRepository.findByUserId(userId);
    const page = pages.find((p) => p.id === pageDbId);
    if (!page) throw new AppError("Page not found", 404);

    const token = decrypt(page.encryptedAccessToken);
    await fbPost(`/${page.pageId}/messages`, token, {
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    });
  },
};
