import { Router, Request, Response, NextFunction } from "express";
import { db } from "../config/database";
import { clientTable, portalMessages } from "@shared/schema";
import { referralService } from "../services/referral.service";
import { referralPayoutService } from "../services/referralPayout.service";
import { referralWithdrawalService } from "../services/referralWithdrawal.service";
import { walletService } from "../services/wallet.service";
import { eq, and, isNull, asc } from "drizzle-orm";
import { verifyPortalToken } from "../v2/modules/portal/portal-auth";
import { portalCoreRouter } from "../v2/modules/portal/portal-core.routes";
import { portalQuotesRouter } from "../v2/modules/portal/portal-quotes.routes";
import { bridgePortalMessageToChat } from "../services/portal-chat-bridge";
import { pushNotificationService } from "../services/push-notification.service";
import { tagService } from "../services/tag.service";

const portalRouter = Router();

// Phase 0: authentication, deals and bookings now live ONLY in the v2 portal module
// (server/v2/modules/portal). These paths stay mounted here as aliases so cached
// PWA clients still pointing at /api/portal keep working — they run the v2 handlers.
// The JWT helpers are shared with v2 so a token minted on either path verifies on both.
// Phase 2 moved the customer's profile and quotes (user, quotes, quote detail/action, owns, view) the same way.
// Remaining endpoints below (messages, tags, vip/wallet, push) are legacy and move in a later phase.
portalRouter.use(portalCoreRouter);
// The customer's profile and quotes (/user, /quotes, /quotes/:token, /quote/:token/owns|view) are v2 handlers too.
portalRouter.use(portalQuotesRouter);

async function portalAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const payload = verifyPortalToken(auth.slice(7));
  if (!payload) {
    return res.status(401).json({ error: "Invalid token" });
  }
  // A soft-deleted client's existing sessions stop working immediately.
  try {
    const [live] = await db
      .select({ id: clientTable.id })
      .from(clientTable)
      .where(and(eq(clientTable.id, payload.clientId), isNull(clientTable.deletedAt)))
      .limit(1);
    if (!live) return res.status(401).json({ error: "Account not available" });
  } catch (err) {
    console.error("Portal auth check error:", err);
    return res.status(500).json({ error: "Authentication failed" });
  }
  (req as any).portalClient = payload;
  next();
}

portalRouter.get("/messages", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;

    const msgs = await db
      .select()
      .from(portalMessages)
      .where(eq(portalMessages.clientId, clientId))
      .orderBy(asc(portalMessages.createdAt))
      .limit(100);

    const mapped = msgs.map(m => ({
      id: m.id,
      sender: m.sender as "agent" | "client",
      agent_name: m.agentName || undefined,
      text: m.text,
      timestamp: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
    }));

    res.json(mapped);
  } catch (err: any) {
    console.error("Portal messages error:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

portalRouter.post("/message", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Message text required" });

    const trimmed = text.trim();
    await db.insert(portalMessages).values({
      clientId,
      sender: "client",
      text: trimmed,
    });

    await bridgePortalMessageToChat(clientId, trimmed, false);

    res.json({ success: true });
  } catch (err: any) {
    console.error("Portal send message error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

portalRouter.post("/quote-request", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { destination, dates, travellers, notes } = req.body;

    const messageText = `📋 Quote Request:\n• Destination: ${destination || "Not specified"}\n• Dates: ${dates || "Flexible"}\n• Travellers: ${travellers || "Not specified"}\n• Notes: ${notes || "None"}`;
    await db.insert(portalMessages).values({
      clientId,
      sender: "client",
      text: messageText,
    });

    await bridgePortalMessageToChat(clientId, messageText, false);

    res.json({ success: true });
  } catch (err: any) {
    console.error("Quote request error:", err);
    res.status(500).json({ error: "Failed to submit quote request" });
  }
});

portalRouter.post("/interest", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { dealId } = req.body;

    const messageText = `❤️ Interested in deal: ${dealId}`;
    await db.insert(portalMessages).values({
      clientId,
      sender: "client",
      text: messageText,
    });

    await bridgePortalMessageToChat(clientId, messageText, true);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to record interest" });
  }
});

portalRouter.get("/tags", async (_req: Request, res: Response) => {
  try {
    const allTags = await tagService.getAllTags();
    res.json(allTags);
  } catch (err: any) {
    console.error("Portal tags error:", err);
    res.status(500).json({ error: "Failed to load tags" });
  }
});

portalRouter.get("/has-tags", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const hasTags = await tagService.clientHasTags(clientId);
    res.json({ hasTags });
  } catch (err: any) {
    console.error("Portal has-tags error:", err);
    res.status(500).json({ error: "Failed to check tags" });
  }
});

portalRouter.get("/my-tags", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const myTags = await tagService.getClientTags(clientId);
    res.json(myTags);
  } catch (err: any) {
    console.error("Portal my-tags error:", err);
    res.status(500).json({ error: "Failed to load your tags" });
  }
});

portalRouter.post("/my-tags", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { tagIds } = req.body;
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({ error: "At least one tag is required" });
    }
    await tagService.setClientTags(clientId, tagIds);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Portal set tags error:", err);
    res.status(500).json({ error: "Failed to save tags" });
  }
});

portalRouter.get("/push/vapid-key", (req: Request, res: Response) => {
  res.json({ publicKey: pushNotificationService.getPublicKey() });
});

portalRouter.post("/push/subscribe", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: "Invalid subscription" });
    }
    await pushNotificationService.subscribe(clientId, subscription);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Push subscribe error:", err);
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

portalRouter.post("/push/unsubscribe", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: "Endpoint required" });
    await pushNotificationService.unsubscribe(clientId, endpoint);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

// ── VIP Referral Portal Endpoints ──────────────────────────────────────────

portalRouter.get("/vip", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const [client] = await db
      .select({
        vipTier: clientTable.vipTier,
        vipEnrolledAt: clientTable.vipEnrolledAt,
        totalReferrals: clientTable.totalReferrals,
      })
      .from(clientTable)
      .where(eq(clientTable.id, clientId))
      .limit(1);

    if (!client) return res.status(404).json({ error: "Client not found" });

    const balance = await walletService.getBalance(clientId);

    res.json({
      vipTier: client.vipTier ?? "not_enrolled",
      vipEnrolledAt: client.vipEnrolledAt,
      totalReferrals: client.totalReferrals,
      walletBalance: balance.toFixed(2),
    });
  } catch (err: any) {
    console.error("Portal VIP status error:", err);
    res.status(500).json({ error: "Failed to load VIP status" });
  }
});

portalRouter.get("/vip/referrals", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const referrals = await referralService.getReferralsByReferrer(clientId);
    res.json(referrals);
  } catch (err: any) {
    console.error("Portal VIP referrals error:", err);
    res.status(500).json({ error: "Failed to load referrals" });
  }
});

// Returns client's referral_payout records (payout request history)
portalRouter.get("/vip/payout-requests", portalAuth, async (req: Request, res: Response) => {                                             
  try {
    const { clientId } = (req as any).portalClient;
    const payouts = await referralPayoutService.getPayoutsByClient(clientId);
    res.json(payouts);
  } catch (err: any) {
    console.error("Portal VIP payout requests error:", err);
    res.status(500).json({ error: "Failed to load payout requests" });
  }
});

// Returns client's referral withdrawal records
portalRouter.get("/vip/withdrawals", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const withdrawals = await referralWithdrawalService.getWithdrawalsByClient(clientId);
    res.json(withdrawals);
  } catch (err: any) {
    console.error("Portal withdrawals error:", err);                                    
    res.status(500).json({ error: "Failed to load withdrawals" });
  } 
});
                      
// Returns client's current wallet balance
portalRouter.get("/wallet/balance", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const balance = await walletService.getBalance(clientId);
    res.json({ balance: balance.toFixed(2) });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load wallet balance" });
  }
});

// Returns client's wallet transaction history
portalRouter.get("/wallet/transactions", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const txns = await walletService.getTransactions(clientId);
    res.json(txns);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load wallet transactions" });
  }
});

// Client requests payout for all eligible (PENDING + isDue) referrals
// Creates referral_payout records (status: requested) for admin to approve
portalRouter.post("/wallet/request-payout", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const result = await referralPayoutService.requestPayouts(clientId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    const status = err?.statusCode ?? 500;
    res.status(status).json({ error: err.message ?? "Failed to submit payout request." });
  }
});

// Client requests a bank transfer withdrawal from their wallet
portalRouter.post("/wallet/withdraw", portalAuth, async (req: Request, res: Response) => {
  try {
    const { clientId } = (req as any).portalClient;
    const { amount, account_name, account_number, sort_code } = req.body;

    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }
    if (!account_name || !account_number || !sort_code) {
      return res.status(400).json({ error: "account_name, account_number and sort_code are required" });
    }

    const tx = await walletService.requestBankTransfer(clientId, parsed, {
      account_name,
      account_number,
      sort_code,
    });

    res.json({ success: true, transaction: tx });
  } catch (err: any) {
    console.error("Portal wallet withdraw error:", err);
    const status = err?.statusCode ?? 500;
    res.status(status).json({ error: err.message ?? "Failed to submit withdrawal request." });
  }
});

// ── End VIP Referral Portal Endpoints ──────────────────────────────────────

export default portalRouter;
