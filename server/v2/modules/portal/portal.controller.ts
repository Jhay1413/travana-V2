import type { Request } from 'express';
import { AppError } from '../../utils/error-handler';
import { portalAuthService } from './portal-auth.service';
import { portalBookingsService } from './portal-bookings.service';
import { portalWebauthnService, BIOMETRIC_LOGIN_FAILED, REGISTRATION_FAILED } from './portal-webauthn.service';
import { resolveWebauthnRp, type WebauthnRp } from './portal-webauthn-rp';
import { getPublicBaseUrl } from '../../utils/public-url';
import { getPortalBaseUrl, getStaffOrigin } from '../../utils/hosts';
import { isProductionRuntime, requestOrigin } from '../../utils/link-base';
import { portalDealsService } from './portal-deals.service';
import { portalService } from './portal.service';
import { portalHostCheckService } from './portal-host-check.service';
import { handle, handleAuthed } from './portal-handlers';
import type {
  ListPortalDealsQuery,
  PortalChangePinBody,
  PortalDealFiltersQuery,
  PortalForYouQuery,
  PortalInterestBody,
  PortalLoginBody,
  PortalMagicLoginBody,
  PortalPushRetireBody,
  PortalPushSubscribeBody,
  PortalPushUnsubscribeBody,
  PortalQuoteRequestBody,
  PortalSendMessageBody,
  PortalSetTagsBody,
  PortalWebauthnLoginBody,
  PortalWebauthnRegisterBody,
  PortalWithdrawBody,
} from './portal.validator';

let loggedRpFailure = false;

/**
 * RP ID + expected origin for this request (see resolveWebauthnRp). When the
 * configured public URL is unusable (e.g. no scheme) it logs once and throws the
 * endpoint's own generic failure instead of crashing.
 */
function webauthnRp(req: Request, failure: () => AppError): WebauthnRp {
  const rp = resolveWebauthnRp({
    configured: getPublicBaseUrl(),
    requestOrigin: requestOrigin(req),
    isProduction: isProductionRuntime(),
    portalOrigin: getPortalBaseUrl(),
    staffOrigin: getStaffOrigin(),
  });
  if (rp) return rp;
  if (!loggedRpFailure) {
    loggedRpFailure = true;
    console.error('[portal-webauthn] could not derive an RP ID/origin from the configured public URL (is BASE_URL missing its https:// scheme?)');
  }
  throw failure();
}

const loginRp = (req: Request) => webauthnRp(req, () => new AppError(BIOMETRIC_LOGIN_FAILED, 401));
const registerRp = (req: Request) => webauthnRp(req, () => new AppError(REGISTRATION_FAILED, 400));

/** Caller IP via Express (trust-proxy aware) — never the raw, spoofable X-Forwarded-For header. */
function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? '';
}

export const portalController = {
  // ── Authentication ───────────────────────────────────────────────────────

  login: handle('Login failed', async (req, res) => {
    const { email, pin, org, preferOrg } = req.body as PortalLoginBody;
    res.json(await portalAuthService.login({ email, pin, orgSlug: org, preferOrgSlug: preferOrg }));
  }),

  magicLogin: handle('Login failed', async (req, res) => {
    const { code } = req.body as PortalMagicLoginBody;
    res.json(await portalAuthService.magicLogin(code));
  }),

  changePin: handleAuthed('Failed to change PIN', async (req, res) => {
    const { newPin } = req.body as PortalChangePinBody;
    const { token } = await portalAuthService.changePin(req.portalClient, newPin);
    res.json(token ? { success: true, token } : { success: true });
  }),

  webauthnRegisterOptions: handleAuthed('Failed to start Face ID set-up', async (req, res) => {
    res.json(await portalWebauthnService.registrationOptions(req.portalClient, registerRp(req)));
  }),

  webauthnRegister: handleAuthed('Failed to register biometric', async (req, res) => {
    const { challengeToken, response, deviceName } = req.body as PortalWebauthnRegisterBody;
    await portalWebauthnService.register(req.portalClient, { challengeToken, response, deviceName }, registerRp(req));
    res.json({ success: true });
  }),

  webauthnLoginOptions: handle('Biometric login failed', async (req, res) => {
    res.json(await portalWebauthnService.loginOptions(loginRp(req)));
  }),

  webauthnLogin: handle('Biometric login failed', async (req, res) => {
    const { challengeToken, response } = req.body as PortalWebauthnLoginBody;
    res.json(await portalWebauthnService.login({ challengeToken, response }, loginRp(req)));
  }),

  webauthnCheck: handleAuthed('Failed to check biometric', async (req, res) => {
    res.json(await portalWebauthnService.check(req.portalClient.clientId));
  }),

  webauthnCredentials: handleAuthed('Failed to load Face ID devices', async (req, res) => {
    res.json(await portalWebauthnService.listCredentials(req.portalClient.clientId));
  }),

  webauthnRemove: handleAuthed('Failed to remove Face ID', async (req, res) => {
    await portalWebauthnService.removeCredential(req.portalClient.clientId, String(req.params.id ?? ''));
    res.json({ success: true });
  }),

  // ── Deals ────────────────────────────────────────────────────────────────

  dealFilters: handle('Failed to load filters', async (req, res) => {
    const { org } = req.query as PortalDealFiltersQuery;
    res.json(await portalDealsService.getDealFilters({ authorizationHeader: req.headers.authorization, orgSlug: org }));
  }),

  forYouDeals: handleAuthed('Failed to load personalised deals', async (req, res) => {
    const { recent } = req.query as PortalForYouQuery;
    res.json(await portalDealsService.listForYouDeals(req.portalClient.clientId, recent === '1'));
  }),

  listDeals: handle('Failed to load deals', async (req, res) => {
    const { country, tag, recent, interests, org } = req.query as ListPortalDealsQuery;
    res.json(
      await portalDealsService.listDeals({
        country: country?.trim() || undefined,
        tag: tag?.trim() || undefined,
        // ?recent=1 limits results to deals still inside the portal window.
        recent: recent === '1',
        // ?interests=1 restricts to deals sharing a tag with the client's saved interests.
        interests: interests === '1',
        authorizationHeader: req.headers.authorization,
        orgSlug: org,
      }),
    );
  }),

  // ── Profile, bookings ────────────────────────────────────────────

  profile: handleAuthed('Failed to load user', async (req, res) => {
    res.json(await portalService.getProfile(req.portalClient.clientId));
  }),

  bookings: handleAuthed('Failed to load bookings', async (req, res) => {
    res.json(await portalBookingsService.listBookings(req.portalClient.clientId));
  }),

  // ── Messages ─────────────────────────────────────────────────────────────

  messages: handleAuthed('Failed to load messages', async (req, res) => {
    res.json(await portalService.listMessages(req.portalClient.clientId));
  }),

  sendMessage: handleAuthed('Failed to send message', async (req, res) => {
    const { text } = req.body as PortalSendMessageBody;
    await portalService.sendMessage(req.portalClient.clientId, text);
    res.json({ success: true });
  }),

  quoteRequest: handleAuthed('Failed to submit quote request', async (req, res) => {
    await portalService.submitQuoteRequest(req.portalClient.clientId, req.body as PortalQuoteRequestBody);
    res.json({ success: true });
  }),

  interest: handleAuthed('Failed to record interest', async (req, res) => {
    const { dealId } = req.body as PortalInterestBody;
    const { alreadyTold } = await portalService.recordInterest(req.portalClient.clientId, dealId);
    res.json({ success: true, alreadyTold });
  }),

  // ── Tags ─────────────────────────────────────────────────────────────────

  allTags: handle('Failed to load tags', async (_req, res) => {
    res.json(await portalService.getAllTags());
  }),

  hasTags: handleAuthed('Failed to check tags', async (req, res) => {
    res.json(await portalService.hasTags(req.portalClient.clientId));
  }),

  myTags: handleAuthed('Failed to load your tags', async (req, res) => {
    res.json(await portalService.getMyTags(req.portalClient.clientId));
  }),

  setMyTags: handleAuthed('Failed to save tags', async (req, res) => {
    const { tagIds } = req.body as PortalSetTagsBody;
    await portalService.setMyTags(req.portalClient.clientId, tagIds);
    res.json({ success: true });
  }),

  // ── Push notifications ───────────────────────────────────────────────────

  vapidKey: handle('Failed to load key', async (_req, res) => {
    res.json(portalService.getVapidKey());
  }),

  hostCheck: handle('Failed to check the host', async (req, res) => {
    res.json(portalHostCheckService.check(req.hostname));
  }),

  pushSubscribe: handleAuthed('Failed to subscribe', async (req, res) => {
    const { subscription } = req.body as PortalPushSubscribeBody;
    await portalService.subscribePush(req.portalClient.clientId, subscription);
    res.json({ success: true });
  }),

  pushRetire: handle('Failed to retire the subscription', async (req, res) => {
    const { subscription } = req.body as PortalPushRetireBody;
    await portalService.retirePush(subscription);
    // Always the same answer: nothing reveals whether a subscription was there.
    res.json({ success: true });
  }),

  pushUnsubscribe: handleAuthed('Failed to unsubscribe', async (req, res) => {
    const { endpoint } = req.body as PortalPushUnsubscribeBody;
    await portalService.unsubscribePush(req.portalClient.clientId, endpoint);
    res.json({ success: true });
  }),

  // ── VIP / referral / wallet ──────────────────────────────────────────────

  vip: handleAuthed('Failed to load VIP status', async (req, res) => {
    res.json(await portalService.getVipStatus(req.portalClient.clientId));
  }),

  vipReferrals: handleAuthed('Failed to load referrals', async (req, res) => {
    res.json(await portalService.getReferrals(req.portalClient.clientId));
  }),

  walletBalance: handleAuthed('Failed to load wallet balance', async (req, res) => {
    res.json(await portalService.getWalletBalance(req.portalClient.clientId));
  }),

  walletTransactions: handleAuthed('Failed to load wallet transactions', async (req, res) => {
    res.json(await portalService.getWalletTransactions(req.portalClient.clientId));
  }),

  requestPayout: handleAuthed('Failed to submit payout request.', async (req, res) => {
    const result = await portalService.requestPayout(req.portalClient.clientId);
    res.json({ success: true, ...result });
  }),

  vipPayoutRequests: handleAuthed('Failed to load payout requests', async (req, res) => {
    res.json(await portalService.getPayoutRequests(req.portalClient.clientId));
  }),

  vipWithdrawals: handleAuthed('Failed to load withdrawals', async (req, res) => {
    res.json(await portalService.getWithdrawals(req.portalClient.clientId));
  }),

  withdraw: handleAuthed('Failed to submit withdrawal request.', async (req, res) => {
    const body = req.body as PortalWithdrawBody;
    const transaction = await portalService.withdraw(req.portalClient.clientId, body);
    res.json({ success: true, transaction });
  }),

  // ── Quote view tracking (ownership and the quote screens live in portal-quotes.controller) ──────────────────────────────────────────────────

  quoteView: handleAuthed('Failed to log view', async (req, res) => {
    await portalService.logQuoteView(req.portalClient.clientId, String(req.params.token), {
      userAgent: req.headers['user-agent'] || '',
      ipAddress: clientIp(req),
    });
    res.json({ success: true });
  }),
};
