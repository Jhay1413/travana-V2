import { Router, Request, Response } from "express";
import { auditRepository } from "../repositories/audit.repository";
import { isAuthenticated } from "../v2/middlewares/auth/session";
import { getUserId } from "../utils/get-user-id";

const router = Router();

router.use(isAuthenticated);

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const userRecord = await auditRepository.findUserById(userId);
    if (!userRecord || userRecord.role?.toLowerCase() !== "admin") {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }
    const logs = await auditRepository.findAll();
    res.json({ success: true, data: logs });
  } catch (err: unknown) {
    console.error("Error fetching audit logs:", err);
    res.status(500).json({ success: false, error: "Failed to fetch audit logs" });
  }
});

router.post("/delete-quote/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const userRecord = await auditRepository.findUserById(userId);
    if (!userRecord || userRecord.role?.toLowerCase() !== "admin") {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ success: false, error: "Reason is required" });
    }

    const result = await auditRepository.softDeleteQuote({
      id,
      reason: reason.trim(),
      performedBy: userId,
      performedByName: userRecord.name || userRecord.email || "Unknown",
    });

    if (!result) {
      return res.status(404).json({ success: false, error: "Quote not found" });
    }

    res.json({ success: true, message: "Quote deleted successfully" });
  } catch (err: unknown) {
    console.error("Error deleting quote:", err);
    res.status(500).json({ success: false, error: "Failed to delete quote" });
  }
});

router.post("/delete-booking/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const userRecord = await auditRepository.findUserById(userId);
    if (!userRecord || userRecord.role?.toLowerCase() !== "admin") {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ success: false, error: "Reason is required" });
    }

    const result = await auditRepository.hardDeleteBooking({
      id,
      reason: reason.trim(),
      performedBy: userId,
      performedByName: userRecord.name || userRecord.email || "Unknown",
    });

    if (!result) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    res.json({ success: true, message: "Booking deleted successfully" });
  } catch (err: unknown) {
    console.error("Error deleting booking:", err);
    res.status(500).json({ success: false, error: "Failed to delete booking" });
  }
});

export default router;
