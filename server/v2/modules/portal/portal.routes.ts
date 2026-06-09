import { Router, Request, Response, NextFunction } from 'express';
import { referralService } from '../referral/referral.service';
import { referralPayoutService } from '../referral/referral-payout.service';
import { referralWithdrawalService } from '../referral/referral-withdrawal.service';
import { walletService } from '../wallet/wallet.service';
import { tagService } from '../tag/tag.service';
import { pushNotificationService } from '../notification/push-notification.service';
import { quotePublicRepository } from '../quote/quote-public.repository';
import { portalRepository } from './portal.repository';
import { neonClientRepository } from '../neon-client/neon-client.repository';
import { fireAutoTriggerForClient } from '../sms/sms.service';
import { bridgePortalMessageToChat } from '../../../services/portal-chat-bridge';
import { getUserId } from '../../utils/get-user-id';
import { signPortalToken, verifyPortalToken, DEFAULT_PORTAL_PIN } from './portal-auth';
import { portalLoginTokenRepository } from './portal-login-token.repository';
import bcrypt from 'bcryptjs';

const portalRouter = Router();

function portalAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const payload = verifyPortalToken(auth.slice(7));
  if (!payload) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  (req as any).portalClient = payload;
  next();
}

function requireStaffAuth(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Staff authentication required' });
  }
  next();
}

// ── Authentication ──────────────────────────────────────────────────────────

portalRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, pin } = req.body;
    if (!email || !pin) {
      return res.status(400).json({ error: 'Email and PIN are required' });
    }

    const client = await portalRepository.findClientForLogin(email);

    if (!client) {
      return res.status(401).json({ error: 'No account found with that email' });
    }
    if (!client.portalPin) {
      return res.status(401).json({ error: 'Portal access not set up. Please contact your travel agent.' });
    }

    const valid = await bcrypt.compare(pin, client.portalPin);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect PIN' });
    }

    // Hardening: a freshly seeded default PIN is meant to be used once, via the
    // signed magic link in the client's SMS — not typed on this form. Blocking
    // it here closes the window where anyone knowing the email could log in with
    // the default before the real client sets their own PIN.
    if (client.mustChangePin && pin === DEFAULT_PORTAL_PIN) {
      return res.status(403).json({ error: 'Please open your portal using the link we texted you, then choose your own PIN.' });
    }

    const token = signPortalToken({ clientId: client.id, email: client.email || '' });
    const creds = await portalRepository.findWebauthnCredentialIdsForClient(client.id);

    res.json({
      token,
      clientId: client.id,
      firstName: client.firstName,
      hasBiometric: creds.length > 0,
      mustChangePin: client.mustChangePin,
    });
  } catch (err: any) {
    console.error('Portal login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Exchange a short single-use code (from an SMS quote link) for a portal
// session. Keeps the SMS URL short and the long-lived token out of the message.
portalRouter.post('/magic-login', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });

    const redeemed = await portalLoginTokenRepository.redeem(String(code));
    if (!redeemed) {
      return res.status(401).json({ error: 'This link has expired or was already used. Please ask your agent to resend.' });
    }

    const client = await portalRepository.findClientProfile(redeemed.clientId);
    if (!client) return res.status(401).json({ error: 'Account not found' });

    const token = signPortalToken({ clientId: redeemed.clientId, email: client.email || '' });
    res.json({
      token,
      clientId: redeemed.clientId,
      firstName: client.firstName,
      mustChangePin: client.mustChangePin,
    });
  } catch (err: any) {
    console.error('Portal magic-login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Change the logged-in client's PIN and clear the must-change flag. Used by the
// forced "set your PIN" gate after a magic-link auto-login.
portalRouter.post('/change-pin', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { newPin } = req.body;
    if (!newPin || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ error: 'Valid 4-digit PIN required' });
    }
    if (newPin === DEFAULT_PORTAL_PIN) {
      return res.status(400).json({ error: 'Please choose a PIN other than the default.' });
    }
    const hash = await bcrypt.hash(newPin, 10);
    await neonClientRepository.setPortalPin(clientId, hash, { mustChange: false });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Portal change-pin error:', err);
    res.status(500).json({ error: 'Failed to change PIN' });
  }
});

// ── WebAuthn ────────────────────────────────────────────────────────────────

portalRouter.post('/webauthn/register', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { credentialId, publicKey, deviceName } = req.body;
    if (!credentialId || !publicKey) {
      return res.status(400).json({ error: 'Missing credential data' });
    }

    await portalRepository.insertWebauthnCredential({
      clientId,
      credentialId,
      publicKey,
      deviceName: deviceName || 'Unknown device',
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('WebAuthn register error:', err);
    res.status(500).json({ error: 'Failed to register biometric' });
  }
});

portalRouter.post('/webauthn/login', async (req: Request, res: Response) => {
  try {
    const { credentialId, clientId } = req.body;
    if (!credentialId || !clientId) {
      return res.status(400).json({ error: 'Missing credential data' });
    }

    const cred = await portalRepository.findWebauthnByCredential(clientId, credentialId);
    if (!cred) {
      return res.status(401).json({ error: 'Biometric not recognized' });
    }

    const client = await portalRepository.findClientBasicById(clientId);
    if (!client) {
      return res.status(401).json({ error: 'Client not found' });
    }

    await portalRepository.incrementWebauthnCounter(cred.id);

    const token = signPortalToken({ clientId: client.id, email: client.email || '' });
    res.json({ token, clientId: client.id, firstName: client.firstName });
  } catch (err: any) {
    console.error('WebAuthn login error:', err);
    res.status(500).json({ error: 'Biometric login failed' });
  }
});

portalRouter.post('/webauthn/check', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.body;
    if (!clientId) return res.json({ hasBiometric: false });

    const creds = await portalRepository.findWebauthnDevicesForClient(clientId);
    res.json({ hasBiometric: creds.length > 0, devices: creds });
  } catch {
    res.json({ hasBiometric: false });
  }
});

// ── Deals ───────────────────────────────────────────────────────────────────

portalRouter.get('/deals/filters', async (_req: Request, res: Response) => {
  try {
    const filters = await portalRepository.findDealFilters();
    res.json(filters);
  } catch (err: any) {
    console.error('Error fetching deal filters:', err);
    res.status(500).json({ error: 'Failed to load filters' });
  }
});

function buildImageMap(
  primaryImages: Array<{ quoteId: string | null; url: string; isPrimary: boolean | null }>,
  fallbackImages: Array<{ quoteId: string | null; url: string }>,
): Record<string, string> {
  const imageMap: Record<string, string> = {};
  for (const img of primaryImages) {
    if (img.quoteId && (!imageMap[img.quoteId] || img.isPrimary)) {
      imageMap[img.quoteId] = img.url;
    }
  }
  for (const img of fallbackImages) {
    if (img.quoteId && !imageMap[img.quoteId]) {
      imageMap[img.quoteId] = img.url;
    }
  }
  return imageMap;
}

function buildTagMap(rows: Array<{ quoteId: string; tagName: string }>): Record<string, string[]> {
  const tagMap: Record<string, string[]> = {};
  for (const row of rows) {
    if (!tagMap[row.quoteId]) tagMap[row.quoteId] = [];
    tagMap[row.quoteId].push(row.tagName);
  }
  return tagMap;
}

async function enrichDealRows(
  results: Array<{
    id: string;
    token: string | null;
    title: string | null;
    salesPrice: string | null;
    travelDate: string | Date | null;
    numNights: number | null;
    accommodationName: string | null;
    destinationName: string | null;
    countryName: string | null;
  }>,
) {
  const quoteIds = results.map((r) => r.id);
  const tagRows = await portalRepository.findTagsForQuotes(quoteIds);
  const tagMap = buildTagMap(tagRows);

  const primary = await portalRepository.findImagesForQuotes(quoteIds);
  const initialMap: Record<string, string> = {};
  for (const img of primary) {
    if (img.quoteId && (!initialMap[img.quoteId] || img.isPrimary)) {
      initialMap[img.quoteId] = img.url;
    }
  }
  const missingImageIds = quoteIds.filter((id) => !initialMap[id]);
  const accomImages = await portalRepository.findAccommodationImagesForQuotes(missingImageIds);
  const imageMap = buildImageMap(primary, accomImages);

  return results.map((r) => ({
    id: r.id,
    token: r.token,
    title: r.title || `${r.destinationName || r.countryName || 'Holiday'} Getaway`,
    destination: r.destinationName && r.countryName
      ? `${r.destinationName}, ${r.countryName}`
      : r.countryName || r.destinationName || 'TBC',
    country: r.countryName || null,
    hotel: r.accommodationName || '',
    price: parseFloat(r.salesPrice || '0'),
    travel_date: r.travelDate,
    num_nights: r.numNights,
    image_url: imageMap[r.id] || '',
    quote_url: r.token ? `/portal/quote/${r.token}` : null,
    tags: tagMap[r.id] ?? [],
  }));
}

portalRouter.get('/deals/for-you', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const clientTagIds = await portalRepository.findClientTagIds(clientId);
    if (clientTagIds.length === 0) return res.json([]);

    const results = await portalRepository.findForYouDeals(clientTagIds, 20);
    res.json(await enrichDealRows(results));
  } catch (err: any) {
    console.error('Error fetching for-you deals:', err);
    res.status(500).json({ error: 'Failed to load personalised deals' });
  }
});

portalRouter.get('/deals', async (req: Request, res: Response) => {
  try {
    const filterCountry = ((req.query.country as string) || '').trim();
    const filterTag = ((req.query.tag as string) || '').trim();

    const results = await portalRepository.findDeals({
      country: filterCountry || undefined,
      tag: filterTag || undefined,
      limit: 50,
    });
    res.json(await enrichDealRows(results));
  } catch (err: any) {
    console.error('Error fetching portal deals:', err);
    res.status(500).json({ error: 'Failed to load deals' });
  }
});

// ── User & Quotes & Bookings ─────────────────────────────────────────────────

portalRouter.get('/user', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const client = await portalRepository.findClientProfile(clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (err: any) {
    console.error('Portal user error:', err);
    res.status(500).json({ error: 'Failed to load user' });
  }
});

portalRouter.get('/quotes', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const results = await portalRepository.findClientQuotes(clientId);

    const quoteIds = results.map((r) => r.quoteId);
    const primary = await portalRepository.findImagesForQuotes(quoteIds);
    const imageMap: Record<string, string> = {};
    for (const img of primary) {
      if (img.quoteId && (!imageMap[img.quoteId] || img.isPrimary)) {
        imageMap[img.quoteId] = img.url;
      }
    }

    const mapped = await Promise.all(results.map(async (r) => {
      const dest = r.destinationName && r.countryName
        ? `${r.destinationName}, ${r.countryName}`
        : r.countryName || r.destinationName || 'TBC';
      const nights = r.numNights || 7;
      const travelMs = new Date(r.travelDate).getTime();
      const returnDate = new Date(travelMs + nights * 86400000).toISOString().split('T')[0];

      let token = r.quoteToken;
      if (!token) {
        token = await quotePublicRepository.setToken(r.quoteId);
      }

      // Customer-facing total = sales price − discount + service charge; per person splits that total.
      const totalPrice = (parseFloat(r.salesPrice || '0') || 0)
        - (parseFloat(r.discounts || '0') || 0)
        + (parseFloat(r.serviceCharge || '0') || 0);
      const pax = (r.adult || 0) + (r.child || 0);

      return {
        id: r.quoteId,
        title: r.title || `${dest} Getaway`,
        destination: dest,
        hotel: r.accommodationName || '',
        price: totalPrice,
        price_per_person: pax > 0 ? parseFloat((totalPrice / pax).toFixed(2)) : 0,
        travel_date: r.travelDate,
        return_date: returnDate,
        expiry_date: r.dateExpiry
          ? new Date(r.dateExpiry).toISOString()
          : new Date(Date.now() + 30 * 86400000).toISOString(),
        image_url: imageMap[r.quoteId] || '',
        quote_url: `/portal/quote/${token}`,
      };
    }));

    res.json(mapped);
  } catch (err: any) {
    console.error('Portal quotes error:', err);
    res.status(500).json({ error: 'Failed to load quotes' });
  }
});

portalRouter.get('/bookings', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const results = await portalRepository.findClientBookings(clientId);

    res.json(results.map((r) => {
      const dest = r.destinationName && r.countryName
        ? `${r.destinationName}, ${r.countryName}`
        : r.countryName || r.destinationName || 'TBC';
      const nights = r.numNights || 7;
      const travelMs = new Date(r.travelDate).getTime();
      const returnDate = new Date(travelMs + nights * 86400000).toISOString().split('T')[0];

      return {
        id: r.bookingId,
        destination: dest,
        hotel: r.accommodationName || r.title || '',
        travel_date: r.travelDate,
        return_date: returnDate,
        booking_reference: r.haysRef || r.supplierRef || '',
        image_url: '',
        documents_url: '#',
      };
    }));
  } catch (err: any) {
    console.error('Portal bookings error:', err);
    res.status(500).json({ error: 'Failed to load bookings' });
  }
});

// ── Messages ─────────────────────────────────────────────────────────────────

portalRouter.get('/messages', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const msgs = await portalRepository.findClientPortalMessages(clientId, 100);

    res.json(msgs.map((m) => ({
      id: m.id,
      sender: m.sender as 'agent' | 'client',
      agent_name: m.agentName || undefined,
      text: m.text,
      timestamp: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
    })));
  } catch (err: any) {
    console.error('Portal messages error:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

portalRouter.post('/message', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Message text required' });

    const trimmed = text.trim();
    await portalRepository.insertClientPortalMessage(clientId, trimmed);
    await bridgePortalMessageToChat(clientId, trimmed, false);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Portal send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

portalRouter.post('/quote-request', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { destination: dest, dates, travellers, notes } = req.body;

    const messageText = `Quote Request:\n• Destination: ${dest || 'Not specified'}\n• Dates: ${dates || 'Flexible'}\n• Travellers: ${travellers || 'Not specified'}\n• Notes: ${notes || 'None'}`;
    await portalRepository.insertClientPortalMessage(clientId, messageText);
    await bridgePortalMessageToChat(clientId, messageText, false);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Quote request error:', err);
    res.status(500).json({ error: 'Failed to submit quote request' });
  }
});

portalRouter.post('/interest', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { dealId } = req.body;

    const messageText = `Interested in deal: ${dealId}`;
    await portalRepository.insertClientPortalMessage(clientId, messageText);
    await bridgePortalMessageToChat(clientId, messageText, true);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to record interest' });
  }
});

// ── Tags ─────────────────────────────────────────────────────────────────────

portalRouter.get('/tags', async (_req: Request, res: Response) => {
  try {
    const allTags = await tagService.getAllTags();
    res.json(allTags);
  } catch (err: any) {
    console.error('Portal tags error:', err);
    res.status(500).json({ error: 'Failed to load tags' });
  }
});

portalRouter.get('/has-tags', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const hasTags = await tagService.clientHasTags(clientId);
    res.json({ hasTags });
  } catch (err: any) {
    console.error('Portal has-tags error:', err);
    res.status(500).json({ error: 'Failed to check tags' });
  }
});

portalRouter.get('/my-tags', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const myTags = await tagService.getClientTags(clientId);
    res.json(myTags);
  } catch (err: any) {
    console.error('Portal my-tags error:', err);
    res.status(500).json({ error: 'Failed to load your tags' });
  }
});

portalRouter.post('/my-tags', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { tagIds } = req.body;
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({ error: 'At least one tag is required' });
    }
    await tagService.setClientTags(clientId, tagIds);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Portal set tags error:', err);
    res.status(500).json({ error: 'Failed to save tags' });
  }
});

// ── Push Notifications ───────────────────────────────────────────────────────

portalRouter.get('/push/vapid-key', (_req: Request, res: Response) => {
  res.json({ publicKey: pushNotificationService.getPublicKey() });
});

portalRouter.post('/push/subscribe', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    await pushNotificationService.subscribe(clientId, subscription);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

portalRouter.post('/push/unsubscribe', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });
    await pushNotificationService.unsubscribe(clientId, endpoint);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// ── VIP / Referral ───────────────────────────────────────────────────────────

portalRouter.get('/vip', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const client = await portalRepository.findVipSummary(clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const balance = await walletService.getBalance(clientId, { orgId: null });

    res.json({
      vipTier: client.vipTier ?? 'not_enrolled',
      vipEnrolledAt: client.vipEnrolledAt,
      totalReferrals: client.totalReferrals,
      walletBalance: balance.toFixed(2),
    });
  } catch (err: any) {
    console.error('Portal VIP status error:', err);
    res.status(500).json({ error: 'Failed to load VIP status' });
  }
});

portalRouter.get('/vip/referrals', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const referrals = await referralService.getReferralsByReferrer(clientId, { orgId: null });
    res.json(referrals);
  } catch (err: any) {
    console.error('Portal VIP referrals error:', err);
    res.status(500).json({ error: 'Failed to load referrals' });
  }
});

// ── Wallet ───────────────────────────────────────────────────────────────────

portalRouter.get('/wallet/balance', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const balance = await walletService.getBalance(clientId, { orgId: null });
    res.json({ balance: balance.toFixed(2) });
  } catch {
    res.status(500).json({ error: 'Failed to load wallet balance' });
  }
});

portalRouter.get('/wallet/transactions', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const txns = await walletService.getTransactions(clientId, { orgId: null });
    res.json(txns);
  } catch {
    res.status(500).json({ error: 'Failed to load wallet transactions' });
  }
});

portalRouter.post('/wallet/request-payout', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const result = await referralPayoutService.requestPayouts(clientId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    const status = err?.statusCode ?? 500;
    res.status(status).json({ error: err.message ?? 'Failed to submit payout request.' });
  }
});

portalRouter.get('/vip/payout-requests', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const payouts = await referralPayoutService.getPayoutsByClient(clientId);
    res.json(payouts);
  } catch (err: any) {
    console.error('Portal VIP payout requests error:', err);
    res.status(500).json({ error: 'Failed to load payout requests' });
  }
});

portalRouter.get('/vip/withdrawals', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const withdrawals = await referralWithdrawalService.getWithdrawalsByClient(clientId);
    res.json(withdrawals);
  } catch (err: any) {
    console.error('Portal withdrawals error:', err);
    res.status(500).json({ error: 'Failed to load withdrawals' });
  }
});

portalRouter.post('/wallet/withdraw', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { amount, account_name, account_number, sort_code } = req.body;

    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    if (!account_name || !account_number || !sort_code) {
      return res.status(400).json({ error: 'account_name, account_number and sort_code are required' });
    }

    const tx = await walletService.requestBankTransfer(
      clientId,
      parsed,
      { account_name, account_number, sort_code },
      { orgId: null },
    );

    res.json({ success: true, transaction: tx });
  } catch (err: any) {
    console.error('Portal wallet withdraw error:', err);
    const status = err?.statusCode ?? 500;
    res.status(status).json({ error: err.message ?? 'Failed to submit withdrawal request.' });
  }
});

// ── Quote View Tracking ──────────────────────────────────────────────────────

// Ownership guard: tells the portal whether the logged-in client owns the
// quote behind this share token, so the UI can show it or bounce them away.
portalRouter.get('/quote/:token/owns', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { token } = req.params;
    const ownership = await quotePublicRepository.findTokenOwnership(String(token));
    if (!ownership) return res.json({ found: false, owns: false });
    return res.json({ found: true, owns: ownership.clientId === clientId });
  } catch (err: any) {
    console.error('Portal quote ownership check error:', err);
    res.status(500).json({ error: 'Failed to check quote access' });
  }
});

portalRouter.post('/quote/:token/view', portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { token } = req.params;
    const ua = req.headers['user-agent'] || '';

    const client = await portalRepository.findClientNameById(clientId);
    const viewerName = [client?.firstName, client?.lastName].filter(Boolean).join(' ') || null;

    // Only the owning client may log a view — defence in depth behind the UI guard.
    const ownership = await quotePublicRepository.findTokenOwnership(String(token));
    if (!ownership) return res.status(404).json({ error: 'Quote not found' });
    if (ownership.clientId !== clientId) return res.status(403).json({ error: 'This quote is not associated with your account' });
    const quoteId = ownership.quoteId;

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

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';

    await quotePublicRepository.logView(quoteId, {
      ipAddress: ip.substring(0, 45),
      deviceType,
      browser,
      userAgent: ua.substring(0, 500),
      viewerName,
    });

    await quotePublicRepository.notifyAgent(
      quoteId,
      'Quote Viewed',
      `${viewerName || 'A client'} viewed their quote via the portal`,
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error('Portal view error:', err);
    res.status(500).json({ error: 'Failed to log view' });
  }
});

// ── Staff Portal Endpoints ───────────────────────────────────────────────────

portalRouter.get('/staff/has-pin/:clientId', requireStaffAuth, async (req: Request, res: Response) => {
  try {
    const client = await neonClientRepository.findPortalPin(String(req.params.clientId));
    res.json({ hasPin: !!client?.portalPin });
  } catch {
    res.status(500).json({ error: 'Failed to check PIN' });
  }
});

portalRouter.post('/staff/set-pin', requireStaffAuth, async (req: Request, res: Response) => {
  try {
    const { clientId, pin } = req.body;
    if (!clientId || !pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'Valid 4-digit PIN required' });
    }
    const hash = await bcrypt.hash(pin, 10);
    await neonClientRepository.setPortalPin(clientId, hash);
    void fireAutoTriggerForClient({
      clientId,
      autoTrigger: 'on_pin_set',
      triggerSource: 'portal.staff.set-pin',
      dedupeSince: new Date(Date.now() - 5 * 60 * 1000),
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Set PIN error:', err);
    res.status(500).json({ error: 'Failed to set PIN' });
  }
});

portalRouter.post('/staff/remove-pin', requireStaffAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    await neonClientRepository.setPortalPin(clientId, null);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Remove PIN error:', err);
    res.status(500).json({ error: 'Failed to remove PIN' });
  }
});

// Separate named export for staff routes — mounted after auth middleware in index.ts
export const portalStaffRouter = Router();

portalStaffRouter.get('/has-pin/:clientId', requireStaffAuth, async (req: Request, res: Response) => {
  try {
    const client = await neonClientRepository.findPortalPin(String(req.params.clientId));
    res.json({ hasPin: !!client?.portalPin });
  } catch {
    res.status(500).json({ error: 'Failed to check PIN' });
  }
});

portalStaffRouter.post('/set-pin', requireStaffAuth, async (req: Request, res: Response) => {
  try {
    const { clientId, pin } = req.body;
    if (!clientId || !pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'Valid 4-digit PIN required' });
    }
    const hash = await bcrypt.hash(pin, 10);
    await neonClientRepository.setPortalPin(clientId, hash);
    void fireAutoTriggerForClient({
      clientId,
      autoTrigger: 'on_pin_set',
      triggerSource: 'portal.staff.set-pin',
      dedupeSince: new Date(Date.now() - 5 * 60 * 1000),
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Set PIN error:', err);
    res.status(500).json({ error: 'Failed to set PIN' });
  }
});

portalStaffRouter.post('/remove-pin', requireStaffAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    await neonClientRepository.setPortalPin(clientId, null);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Remove PIN error:', err);
    res.status(500).json({ error: 'Failed to remove PIN' });
  }
});

export default portalRouter;
