import { Router, Request, Response } from "express";
import { announcementRepository } from "../repositories/announcement.repository";
import { isAuthenticated } from "../replit_integrations/auth/replitAuth";
import { getUserId } from "../utils/get-user-id";
import { db } from "../config/database";
import { user as userTable } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.use(isAuthenticated);

const VALID_CATEGORIES = ["general", "supplier", "target", "incentive", "training"];

async function getUserInfo(userId: string): Promise<{ name: string | null; role: string | null }> {
  const [u] = await db.select({ name: userTable.name, role: userTable.role }).from(userTable).where(eq(userTable.id, userId)).limit(1);
  return { name: u?.name || null, role: u?.role?.toLowerCase() || null };
}

router.get("/", async (_req: Request, res: Response) => {
  try {
    const items = await announcementRepository.findAll();
    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    const { name, role } = await getUserInfo(userId);
    if (role !== "admin" && role !== "manager") {
      return res.status(403).json({ success: false, message: "Only Admin or Manager can post announcements" });
    }

    const { title, content, category, pinned } = req.body;
    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ success: false, message: "Content is required" });
    }

    const cat = VALID_CATEGORIES.includes(category) ? category : "general";

    const item = await announcementRepository.create({
      authorId: userId,
      authorName: name,
      category: cat,
      title: title?.trim() || null,
      content: content.trim(),
      pinned: !!pinned,
    });
    res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    const { role } = await getUserInfo(userId);
    if (role !== "admin" && role !== "manager") {
      return res.status(403).json({ success: false, message: "Only Admin or Manager can edit announcements" });
    }

    const { title, content, category, pinned } = req.body;
    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title?.trim() || null;
    if (content !== undefined) updates.content = content.trim();
    if (category !== undefined && VALID_CATEGORIES.includes(category)) updates.category = category;
    if (pinned !== undefined) updates.pinned = !!pinned;

    const item = await announcementRepository.update(req.params.id, updates);
    if (!item) return res.status(404).json({ success: false, message: "Announcement not found" });
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch("/:id/pin", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    const { role } = await getUserInfo(userId);
    if (role !== "admin" && role !== "manager") {
      return res.status(403).json({ success: false, message: "Only Admin or Manager can pin announcements" });
    }

    const item = await announcementRepository.togglePin(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Announcement not found" });
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    const { role } = await getUserInfo(userId);
    if (role !== "admin" && role !== "manager") {
      return res.status(403).json({ success: false, message: "Only Admin or Manager can delete announcements" });
    }

    await announcementRepository.remove(req.params.id);
    res.json({ success: true, message: "Announcement deleted" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
