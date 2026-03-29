import { Router, Request, Response } from "express";
import { announcementRepository } from "../repositories/announcement.repository";
import { isAuthenticated } from "../replit_integrations/auth/replitAuth";
import { getUserId } from "../utils/get-user-id";
import { db } from "../config/database";
import { user as userTable, hubAnnouncementLikesTable, hubAnnouncementTable, notifications } from "@shared/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { notificationRepository } from "../repositories/notification.repository";

const router = Router();

async function ensureLikesTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS hub_announcement_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        announcement_id UUID NOT NULL REFERENCES hub_announcements(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(announcement_id, user_id)
      )
    `);
  } catch (e) {
    console.error("Failed to ensure likes table:", e);
  }
}
ensureLikesTable();

router.use(isAuthenticated);

const VALID_CATEGORIES = ["general", "supplier", "target", "incentive", "training"];

async function getUserInfo(userId: string): Promise<{ name: string | null; role: string | null }> {
  const [u] = await db.select({ name: userTable.name, role: userTable.role }).from(userTable).where(eq(userTable.id, userId)).limit(1);
  return { name: u?.name || null, role: u?.role?.toLowerCase() || null };
}

async function getAllUserIds(): Promise<{ id: string; name: string | null }[]> {
  return db.select({ id: userTable.id, name: userTable.name }).from(userTable);
}

function extractMentions(content: string): string[] {
  const mentionPattern = /@(\w+(?:\s+\w+)?)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionPattern.exec(content)) !== null) {
    mentions.push(match[1].trim().toLowerCase());
  }
  return mentions;
}

async function createHubNotification(userId: string, type: string, title: string, message: string, link: string) {
  try {
    await notificationRepository.create({
      userId,
      type,
      title,
      message,
      link,
      read: false,
    });
  } catch (e) {
    console.error("Failed to create hub notification:", e);
  }
}

async function notifyAllUsersExcept(excludeUserId: string, type: string, title: string, message: string, link: string) {
  const allUsers = await getAllUserIds();
  for (const u of allUsers) {
    if (u.id !== excludeUserId) {
      await createHubNotification(u.id, type, title, message, link);
    }
  }
}

async function notifyMentionedUsers(content: string, authorId: string, authorName: string, announcementId: string) {
  const mentions = extractMentions(content);
  if (mentions.length === 0) return;

  const allUsers = await getAllUserIds();
  for (const mention of mentions) {
    const matchedUser = allUsers.find(u => {
      if (!u.name) return false;
      return u.name.toLowerCase() === mention || 
             u.name.toLowerCase().split(" ")[0] === mention;
    });
    if (matchedUser && matchedUser.id !== authorId) {
      await createHubNotification(
        matchedUser.id,
        "hub_mention",
        "You were mentioned in TheHub",
        `${authorName} mentioned you in a post`,
        "/hub/news"
      );
    }
  }
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

    const postTitle = title?.trim() || "New announcement";
    await notifyAllUsersExcept(
      userId,
      "hub_post",
      "New Post on TheHub",
      `${name || "Someone"} posted: ${postTitle}`,
      "/hub/news"
    );

    await notifyMentionedUsers(content, userId, name || "Someone", item.id);

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

router.post("/:id/like", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    const announcementId = req.params.id;

    const announcement = await announcementRepository.findById(announcementId);
    if (!announcement) return res.status(404).json({ success: false, message: "Announcement not found" });

    const existing = await db.select()
      .from(hubAnnouncementLikesTable)
      .where(and(
        eq(hubAnnouncementLikesTable.announcementId, announcementId),
        eq(hubAnnouncementLikesTable.userId, userId)
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(hubAnnouncementLikesTable).where(eq(hubAnnouncementLikesTable.id, existing[0].id));
      return res.json({ success: true, data: { liked: false } });
    }

    await db.insert(hubAnnouncementLikesTable).values({
      announcementId,
      userId,
    });

    if (announcement.authorId !== userId) {
      const { name } = await getUserInfo(userId);
      await createHubNotification(
        announcement.authorId,
        "hub_like",
        "Your post was liked",
        `${name || "Someone"} liked your post${announcement.title ? `: ${announcement.title}` : ""}`,
        "/hub/news"
      );
    }

    res.json({ success: true, data: { liked: true } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/likes/bulk", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    const allLikes = await db.select({
      announcementId: hubAnnouncementLikesTable.announcementId,
      count: count(),
    })
      .from(hubAnnouncementLikesTable)
      .groupBy(hubAnnouncementLikesTable.announcementId);

    let userLikes: string[] = [];
    if (userId) {
      const uLikes = await db.select({
        announcementId: hubAnnouncementLikesTable.announcementId,
      })
        .from(hubAnnouncementLikesTable)
        .where(eq(hubAnnouncementLikesTable.userId, userId));
      userLikes = uLikes.map(l => l.announcementId);
    }

    const likesMap: Record<string, { count: number; userLiked: boolean }> = {};
    for (const l of allLikes) {
      likesMap[l.announcementId] = {
        count: l.count,
        userLiked: userLikes.includes(l.announcementId),
      };
    }

    res.json({ success: true, data: likesMap });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id/likes", async (req: Request, res: Response) => {
  try {
    const announcementId = req.params.id;
    const likes = await db.select({
      count: count(),
    })
      .from(hubAnnouncementLikesTable)
      .where(eq(hubAnnouncementLikesTable.announcementId, announcementId));

    const userId = getUserId(req);
    let userLiked = false;
    if (userId) {
      const userLike = await db.select()
        .from(hubAnnouncementLikesTable)
        .where(and(
          eq(hubAnnouncementLikesTable.announcementId, announcementId),
          eq(hubAnnouncementLikesTable.userId, userId)
        ))
        .limit(1);
      userLiked = userLike.length > 0;
    }

    res.json({ success: true, data: { count: likes[0]?.count || 0, userLiked } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/:id/share", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    const announcementId = req.params.id;
    const announcement = await announcementRepository.findById(announcementId);
    if (!announcement) return res.status(404).json({ success: false, message: "Announcement not found" });

    if (announcement.authorId !== userId) {
      const { name } = await getUserInfo(userId);
      await createHubNotification(
        announcement.authorId,
        "hub_share",
        "Your post was shared",
        `${name || "Someone"} shared your post${announcement.title ? `: ${announcement.title}` : ""}`,
        "/hub/news"
      );
    }

    res.json({ success: true, message: "Share recorded" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
