import { Router, Request, Response } from "express";
import { auditRepository } from "../repositories/audit.repository";
import { isAuthenticated } from "../v2/middlewares/auth/session";
import { getUserId } from "../utils/get-user-id";
import { db } from "../config/database";
import { quote, transaction, clientTable, user as userTable, booking, auditLog } from "@shared/schema";
import { eq, isNull, and } from "drizzle-orm";

const router = Router();

router.use(isAuthenticated);

async function getUserRecord(userId: string) {
  const [u] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
  return u || null;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const userRecord = await getUserRecord(userId);
    if (!userRecord || userRecord.role?.toLowerCase() !== "admin") {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }
    const logs = await auditRepository.findAll();
    res.json({ success: true, data: logs });
  } catch (err: any) {
    console.error("Error fetching audit logs:", err);
    res.status(500).json({ success: false, error: "Failed to fetch audit logs" });
  }
});

router.post("/delete-quote/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const userRecord = await getUserRecord(userId);
    if (!userRecord || userRecord.role?.toLowerCase() !== "admin") {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ success: false, error: "Reason is required" });
    }

    const [quoteData] = await db.select().from(quote).where(and(eq(quote.id, id), isNull(quote.deleted_at))).limit(1);
    if (!quoteData) {
      return res.status(404).json({ success: false, error: "Quote not found" });
    }

    let clientName: string | null = null;
    let clientId: string | null = null;
    if (quoteData.transaction_id) {
      const [txn] = await db.select().from(transaction).where(eq(transaction.id, quoteData.transaction_id)).limit(1);
      if (txn?.client_id) {
        clientId = txn.client_id;
        const [client] = await db.select().from(clientTable).where(eq(clientTable.id, txn.client_id)).limit(1);
        if (client) {
          clientName = [client.title, client.firstName, client.surename].filter(Boolean).join(" ").trim();
        }
      }
    }

    await db.transaction(async (tx) => {
      await tx.insert(auditLog).values({
        action: "delete",
        entityType: "quote",
        entityId: id,
        entityTitle: quoteData.title || "Untitled Quote",
        entityData: quoteData as any,
        reason: reason.trim(),
        performedBy: userId,
        performedByName: userRecord.name || userRecord.email || "Unknown",
        clientId,
        clientName,
      });
      await tx.update(quote).set({ deleted_at: new Date(), deleted_by_v2: userId, is_active: false }).where(eq(quote.id, id));
    });

    res.json({ success: true, message: "Quote deleted successfully" });
  } catch (err: any) {
    console.error("Error deleting quote:", err);
    res.status(500).json({ success: false, error: "Failed to delete quote" });
  }
});

router.post("/delete-booking/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const userRecord = await getUserRecord(userId);
    if (!userRecord || userRecord.role?.toLowerCase() !== "admin") {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ success: false, error: "Reason is required" });
    }

    const [bookingData] = await db.select().from(booking).where(eq(booking.id, id)).limit(1);
    if (!bookingData) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    let clientName: string | null = null;
    let clientId: string | null = null;
    if (bookingData.transaction_id) {
      const [txn] = await db.select().from(transaction).where(eq(transaction.id, bookingData.transaction_id)).limit(1);
      if (txn?.client_id) {
        clientId = txn.client_id;
        const [client] = await db.select().from(clientTable).where(eq(clientTable.id, txn.client_id)).limit(1);
        if (client) {
          clientName = [client.title, client.firstName, client.surename].filter(Boolean).join(" ").trim();
        }
      }
    }

    await db.transaction(async (tx) => {
      await tx.insert(auditLog).values({
        action: "delete",
        entityType: "booking",
        entityId: id,
        entityTitle: bookingData.title || "Untitled Booking",
        entityData: bookingData as any,
        reason: reason.trim(),
        performedBy: userId,
        performedByName: userRecord.name || userRecord.email || "Unknown",
        clientId,
        clientName,
      });
      await tx.delete(booking).where(eq(booking.id, id));
    });

    res.json({ success: true, message: "Booking deleted successfully" });
  } catch (err: any) {
    console.error("Error deleting booking:", err);
    res.status(500).json({ success: false, error: "Failed to delete booking" });
  }
});

export default router;
