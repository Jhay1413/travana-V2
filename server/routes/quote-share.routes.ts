import { Router, Request, Response } from "express";
import { quotePublicRepository } from "../repositories/quote-public.repository";
import { isAuthenticated } from "../replit_integrations/auth/replitAuth";
import { getUserId } from "../utils/get-user-id";
import { authStorage } from "../replit_integrations/auth/storage";

const shareRouter = Router();

shareRouter.use(isAuthenticated);

async function verifyQuoteAccess(req: Request, res: Response): Promise<boolean> {
  const quoteId = req.params.id;
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return false;
  }
  const agentId = await quotePublicRepository.getAgentUserIdByQuoteId(quoteId);
  if (!agentId) {
    res.status(404).json({ success: false, error: "Quote not found" });
    return false;
  }
  const dbUser = await authStorage.getUser(userId);
  const userRole = dbUser?.role;
  if (agentId !== userId && userRole !== "Admin" && userRole !== "Manager") {
    res.status(403).json({ success: false, error: "Access denied" });
    return false;
  }
  return true;
}

shareRouter.post("/:id/generate-token", async (req: Request, res: Response) => {
  try {
    if (!(await verifyQuoteAccess(req, res))) return;
    const token = await quotePublicRepository.setToken(req.params.id);
    res.json({ success: true, data: { token } });
  } catch (err: any) {
    console.error("Error generating token:", err);
    res.status(500).json({ success: false, error: "Failed to generate token" });
  }
});

shareRouter.get("/:id/views", async (req: Request, res: Response) => {
  try {
    if (!(await verifyQuoteAccess(req, res))) return;
    const stats = await quotePublicRepository.getViewStats(req.params.id);
    const sanitized = {
      totalViews: stats.totalViews,
      firstViewed: stats.firstViewed,
      lastViewed: stats.lastViewed,
      deviceBreakdown: stats.deviceBreakdown,
    };
    res.json({ success: true, data: sanitized });
  } catch (err: any) {
    console.error("Error fetching views:", err);
    res.status(500).json({ success: false, error: "Failed to fetch views" });
  }
});

shareRouter.get("/:id/customer-actions", async (req: Request, res: Response) => {
  try {
    if (!(await verifyQuoteAccess(req, res))) return;
    const actions = await quotePublicRepository.getCustomerActions(req.params.id);
    res.json({ success: true, data: actions });
  } catch (err: any) {
    console.error("Error fetching customer actions:", err);
    res.status(500).json({ success: false, error: "Failed to fetch actions" });
  }
});

shareRouter.patch("/:id/sent", async (req: Request, res: Response) => {
  try {
    if (!(await verifyQuoteAccess(req, res))) return;
    const { sentVia } = req.body;
    await quotePublicRepository.updateSentInfo(req.params.id, sentVia || "link");
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error updating sent info:", err);
    res.status(500).json({ success: false, error: "Failed to update sent info" });
  }
});

export default shareRouter;
