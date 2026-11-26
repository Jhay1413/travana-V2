import { Router, Request, Response, NextFunction } from "express";
import { db } from "../config/database";
import { clientTable } from "@shared/schema";
import { referralService } from "../services/referral.service";
import { referralPayoutService } from "../services/referralPayout.service";
import { referralWithdrawalService } from "../services/referralWithdrawal.service";
import { walletService } from "../services/wallet.service";
import { eq, and, isNull } from "drizzle-orm";
import { verifyPortalToken } from "../v2/modules/portal/portal-auth";
import { noResponseLog } from "../v2/middlewares/no-response-log";
import { portalCoreRouter } from "../v2/modules/portal/portal-core.routes";
import { portalQuotesRouter } from "../v2/modules/portal/portal-quotes.routes";
import { portalWritesRouter } from "../v2/modules/portal/portal-writes.routes";
import { pushNotificationService } from "../services/push-notification.service";
import { tagService } from "../services/tag.service";

const portalRouter = Router();

// Nothing a portal route returns may be printed by the global request logger (tokens, wallet and bank details, chat).
// First in the chain, so the legacy handlers below and both aliased v2 routers are covered.
portalRouter.use(noResponseLog);

// Phase 0: authentication, deals and bookings now live ONLY in the v2 portal module
// (server/v2/modules/portal). These paths stay mounted here as aliases so cached
// PWA clients still pointing at /api/portal keep working — they run the v2 handlers.
// The JWT helpers are shared with v2 so a token minted on either path verifies on both.
// Phase 2 moved the customer's profile and quotes (user, quotes, quote detail/action, owns, view) the same way.
// Messages and every other WRITE (message, quote-request, interest, my-tags, push subscribe/unsubscribe, wallet request-payout/withdraw)
// are v2 too, through the same router the v2 module mounts: one validator set (message max 5000), one service.
// Remaining endpoints below are read-only legacy handlers (tags, vip, wallet reads, vapid key) and move in a later phase.
portalRouter.use(portalCoreRouter);
// The customer's profile and quotes (/user, /quotes, /quotes/:token, /quote/:token/owns|view) are v2 handlers too.
portalRouter.use(portalQuotesRouter);
// Messages and all writes: the v2 handlers, v2 validators and v2 error format.
portalRouter.use(portalWritesRouter);

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

portalRouter.get("/push/vapid-key", (req: Request, res: Response) => {
  res.json({ publicKey: pushNotificationService.getPublicKey() });
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

// ── End VIP Referral Portal Endpoints ──────────────────────────────────────

export default portalRouter;
