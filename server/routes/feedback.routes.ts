import { Router, Request, Response } from "express";
import { feedbackRepository } from "../repositories/feedback.repository";
import { isAuthenticated } from "../replit_integrations/auth/replitAuth";
import { getUserId } from "../utils/get-user-id";
import { db } from "../config/database";
import { user as userTable } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.use(isAuthenticated);

const VALID_TYPES = ["suggestion", "bug", "general"];
const VALID_STATUSES = ["open", "in_review", "resolved", "closed"];

async function getUserName(userId: string): Promise<string | null> {
  const [u] = await db.select({ name: userTable.name }).from(userTable).where(eq(userTable.id, userId)).limit(1);
  return u?.name || null;
}

async function getUserRole(userId: string): Promise<string | null> {
  const [u] = await db.select({ role: userTable.role }).from(userTable).where(eq(userTable.id, userId)).limit(1);
  return u?.role || null;
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });
    const role = await getUserRole(userId);
    if (role === "Admin" || role === "Manager") {
      const items = await feedbackRepository.findAll();
      return res.json({ success: true, data: items });
    }
    const items = await feedbackRepository.findByUserId(userId);
    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/mine", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });
    const items = await feedbackRepository.findByUserId(userId);
    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    const { type, subject, message, page } = req.body;
    if (!subject || typeof subject !== "string" || !subject.trim()) {
      return res.status(400).json({ success: false, message: "Subject is required" });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }
    const feedbackType = VALID_TYPES.includes(type) ? type : "general";

    const userName = await getUserName(userId);

    const item = await feedbackRepository.create({
      userId,
      userName,
      type: feedbackType,
      subject: subject.trim(),
      message: message.trim(),
      page: page || null,
    });
    res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });
    const role = await getUserRole(userId);
    if (role !== "Admin" && role !== "Manager") {
      return res.status(403).json({ success: false, message: "Admin or Manager access required" });
    }

    const { status, adminNotes } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${VALID_STATUSES.join(", ")}` });
    }
    const item = await feedbackRepository.updateStatus(req.params.id, status, adminNotes);
    if (!item) return res.status(404).json({ success: false, message: "Feedback not found" });
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });
    const role = await getUserRole(userId);
    if (role !== "Admin" && role !== "Manager") {
      return res.status(403).json({ success: false, message: "Admin or Manager access required" });
    }

    await feedbackRepository.remove(req.params.id);
    res.json({ success: true, message: "Feedback deleted" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
