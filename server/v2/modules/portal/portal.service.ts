import { AppError } from '../../utils/error-handler';
import { referralService } from '../referral/referral.service';
import { referralPayoutService } from '../referral/referral-payout.service';
import { referralWithdrawalService } from '../referral/referral-withdrawal.service';
import { walletService } from '../wallet/wallet.service';
import { tagService } from '../tag/tag.service';
import { pushNotificationService } from '../notification/push-notification.service';
import { quotePublicRepository } from '../quote/quote-public.repository';
import { quotePublicService } from '../quote/quote-public.service';
import { bridgePortalMessageToChat } from '../../../services/portal-chat-bridge';
import { DEAL_INTEREST_PREFIX, portalRepository } from './portal.repository';
import { portalQuotesService } from './portal-quotes.service';
import type {
  PortalMessageDto,
  PushSubscriptionInput,
  QuoteViewMeta,
} from './portal.types';

// Portal clients are not staff, so wallet/referral reads run with no agency scope.
const TRUSTED_PORTAL_SCOPE = { orgId: null } as const;

/** Identical taps running at this moment (a double tap): the second takes the first's answer. */
const interestInFlight = new Map<string, Promise<{ alreadyTold: boolean }>>();

export const portalService = {
  // ── Profile ──────────────────────────────────────────────────────────────

  async getProfile(clientId: string) {
    const client = await portalRepository.findClientProfile(clientId);
    if (!client) throw new AppError('Client not found', 404);
    return client;
  },

  // ── Messages ─────────────────────────────────────────────────────────────

  async listMessages(clientId: string): Promise<PortalMessageDto[]> {
    const msgs = await portalRepository.findClientPortalMessages(clientId, 100);
    return msgs.map((m) => ({
      id: m.id,
      sender: m.sender as 'agent' | 'client',
      agent_name: m.agentName || undefined,
      text: m.text,
      timestamp: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
    }));
  },

  async sendMessage(clientId: string, text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) throw new AppError('Message text required', 400);
    await portalRepository.insertClientPortalMessage(clientId, trimmed);
    await bridgePortalMessageToChat(clientId, trimmed, false);
  },

  async submitQuoteRequest(
    clientId: string,
    input: { destination?: string | number; dates?: string | number; travellers?: string | number; notes?: string | number },
  ): Promise<void> {
    const messageText = `Quote Request:\n• Destination: ${input.destination || 'Not specified'}\n• Dates: ${input.dates || 'Flexible'}\n• Travellers: ${input.travellers || 'Not specified'}\n• Notes: ${input.notes || 'None'}`;
    await portalRepository.insertClientPortalMessage(clientId, messageText);
    await bridgePortalMessageToChat(clientId, messageText, false);
  },

  /**
   * "I'm interested" on a deal. Idempotent per customer and deal: the first tap messages the agent, any later one
   * (another tab, another device, a repeat) sends nothing and answers `alreadyTold: true`. "Already told" is read
   * from the customer's own stored message (its text ends with the deal id), so no schema is needed.
   */
  async recordInterest(clientId: string, dealId: string): Promise<{ alreadyTold: boolean }> {
    const key = `${clientId}:${dealId}`;
    const running = interestInFlight.get(key);
    if (running) return running;
    const work = (async () => {
      if (await portalRepository.hasClientInterestMessage(clientId, dealId)) return { alreadyTold: true };
      const messageText = `${DEAL_INTEREST_PREFIX}${dealId}`;
      await portalRepository.insertClientPortalMessage(clientId, messageText);
      await bridgePortalMessageToChat(clientId, messageText, true);
      return { alreadyTold: false };
    })();
    interestInFlight.set(key, work);
    try {
      return await work;
    } finally {
      interestInFlight.delete(key);
    }
  },

  // ── Tags ─────────────────────────────────────────────────────────────────

  getAllTags() {
    return tagService.getAllTags();
  },

  async hasTags(clientId: string): Promise<{ hasTags: boolean }> {
    return { hasTags: await tagService.clientHasTags(clientId) };
  },

  getMyTags(clientId: string) {
    return tagService.getClientTags(clientId);
  },

  async setMyTags(clientId: string, tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) throw new AppError('At least one tag is required', 400);
    await tagService.setClientTags(clientId, tagIds);
  },

  // ── Push notifications ───────────────────────────────────────────────────

  getVapidKey(): { publicKey: string } {
    return { publicKey: pushNotificationService.getPublicKey() };
  },

  async subscribePush(clientId: string, subscription: PushSubscriptionInput): Promise<void> {
    await pushNotificationService.subscribe(clientId, subscription);
  },

  async unsubscribePush(clientId: string, endpoint: string): Promise<void> {
    await pushNotificationService.unsubscribe(clientId, endpoint);
  },

  // ── VIP / referral / wallet ──────────────────────────────────────────────

  async getVipStatus(clientId: string) {
    const client = await portalRepository.findVipSummary(clientId);
    if (!client) throw new AppError('Client not found', 404);

    const balance = await walletService.getBalance(clientId, TRUSTED_PORTAL_SCOPE);
    return {
      vipTier: client.vipTier ?? 'not_enrolled',
      vipEnrolledAt: client.vipEnrolledAt,
      totalReferrals: client.totalReferrals,
      walletBalance: balance.toFixed(2),
    };
  },

  getReferrals(clientId: string) {
    return referralService.getReferralsByReferrer(clientId, TRUSTED_PORTAL_SCOPE);
  },

  async getWalletBalance(clientId: string): Promise<{ balance: string }> {
    const balance = await walletService.getBalance(clientId, TRUSTED_PORTAL_SCOPE);
    return { balance: balance.toFixed(2) };
  },

  getWalletTransactions(clientId: string) {
    return walletService.getTransactions(clientId, TRUSTED_PORTAL_SCOPE);
  },

  requestPayout(clientId: string) {
    return referralPayoutService.requestPayouts(clientId);
  },

  getPayoutRequests(clientId: string) {
    return referralPayoutService.getPayoutsByClient(clientId);
  },

  getWithdrawals(clientId: string) {
    return referralWithdrawalService.getWithdrawalsByClient(clientId);
  },

  async withdraw(
    clientId: string,
    input: { amount: string | number; account_name: string; account_number: string; sort_code: string },
  ) {
    const parsed = parseFloat(String(input.amount));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new AppError('amount must be a positive number', 400);
    }
    return walletService.requestBankTransfer(
      clientId,
      parsed,
      { account_name: input.account_name, account_number: input.account_number, sort_code: input.sort_code },
      TRUSTED_PORTAL_SCOPE,
    );
  },

  // ── Quote view tracking ──────────────────────────────────────────────────

  async logQuoteView(clientId: string, token: string, meta: QuoteViewMeta): Promise<void> {
    const client = await portalRepository.findClientNameById(clientId);
    const viewerName = [client?.firstName, client?.lastName].filter(Boolean).join(' ') || null;

    // The owning client, or a customer of the same agency reading one of its published deals (as before). Any
    // other quote is a 404, the same answer as for a token that does not exist.
    const { access } = await portalQuotesService.getReadable(clientId, token);
    const quoteId = access.quoteId;

    const ua = meta.userAgent;
    let deviceType = 'desktop';
    if (/mobile|android|iphone|ipad/i.test(ua)) {
      deviceType = /ipad|tablet/i.test(ua) ? 'tablet' : 'mobile';
    }
    let browser = 'Unknown';
    if (/edg/i.test(ua)) browser = 'Edge';
    else if (/chrome/i.test(ua)) browser = 'Chrome';
    else if (/firefox/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua)) browser = 'Safari';
    else if (/opera|opr/i.test(ua)) browser = 'Opera';

    await quotePublicRepository.logView(quoteId, {
      ipAddress: meta.ipAddress.substring(0, 45),
      deviceType,
      browser,
      userAgent: ua.substring(0, 500),
      viewerName,
    });

    await quotePublicService.notifyPortalView(token, quoteId, clientId, viewerName);
  },
};
