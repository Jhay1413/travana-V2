import { Router, Request, Response } from "express";
import multer from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { announcementRepository } from "../repositories/announcement.repository";
import { isAuthenticated } from "../v2/middlewares/auth/session";
import { getUserId } from "../utils/get-user-id";
import { db } from "../config/database";
import { user as userTable, hubAnnouncementLikesTable, hubAnnouncementTable, notifications } from "@shared/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { notificationRepository } from "../repositories/notification.repository";
import { s3Client, getS3Bucket } from "../config/s3";
import { randomUUID } from "crypto";

const router = Router();

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP and GIF images are allowed"));
    }
  },
});

async function ensureSchema() {
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
    await db.execute(sql`
      ALTER TABLE hub_announcements ADD COLUMN IF NOT EXISTS image_url TEXT
    `);
  } catch (e) {
    console.error("Failed to ensure announcement schema:", e);
  }
}
ensureSchema();

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
  const tiptapPattern = /data-type="mention"[^>]*data-id="([^"]+)"/g;
  const ids: string[] = [];
  let match;
  let hasStructuredMentions = false;
  while ((match = tiptapPattern.exec(content)) !== null) {
    hasStructuredMentions = true;
    const id = match[1];
    if (!ids.includes(id)) ids.push(id);
  }
  const legacyPattern = /data-mention-id="([^"]+)"/g;
  while ((match = legacyPattern.exec(content)) !== null) {
    hasStructuredMentions = true;
    const id = match[1];
    if (!ids.includes(id)) ids.push(id);
  }
  if (!hasStructuredMentions) {
    const stripped = content.replace(/<[^>]*>/g, "");
    const plainPattern = /@(\w+(?:\s+\w+)?)/g;
    while ((match = plainPattern.exec(stripped)) !== null) {
      const name = match[1].trim().toLowerCase();
      if (name === "everyone" && !ids.includes("__all__")) ids.push("__all__");
      else if (!ids.includes(name)) ids.push(name);
    }
  }
  return ids;
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

  if (mentions.includes("__all__")) {
    for (const u of allUsers) {
      if (u.id !== authorId) {
        await createHubNotification(
          u.id,
          "hub_mention",
          "You were mentioned in TheHub",
          `${authorName} mentioned @Everyone in a post`,
          "/hub/news"
        );
      }
    }
    return;
  }

  for (const mention of mentions) {
    const matchedById = allUsers.find(u => u.id === mention);
    if (matchedById && matchedById.id !== authorId) {
      await createHubNotification(
        matchedById.id,
        "hub_mention",
        "You were mentioned in TheHub",
        `${authorName} mentioned you in a post`,
        "/hub/news"
      );
      continue;
    }
    const matchedByName = allUsers.find(u => {
      if (!u.name) return false;
      return u.name.toLowerCase() === mention || 
             u.name.toLowerCase().split(" ")[0] === mention;
    });
    if (matchedByName && matchedByName.id !== authorId) {
      await createHubNotification(
        matchedByName.id,
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

    const { title, content, category, pinned, imageUrl } = req.body;
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
      imageUrl: imageUrl || null,
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

router.post("/upload-image", imageUpload.single("image"), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated" });

    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: "No image file provided" });

    const ext = file.originalname.split(".").pop() || "jpg";
    const key = `hub-images/${randomUUID()}.${ext}`;
    const bucket = getS3Bucket();

    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    const imageUrl = `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    res.json({ success: true, data: { imageUrl } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/mentionable-users", async (_req: Request, res: Response) => {
  try {
    const users = await db.select({
      id: userTable.id,
      name: userTable.name,
      role: userTable.role,
    }).from(userTable);

    const mentionables = [
      { id: "__all__", name: "Everyone", role: "all" },
      ...users.filter(u => u.name).map(u => ({
        id: u.id,
        name: u.name!,
        role: u.role || "Agent",
      })),
    ];

    res.json({ success: true, data: mentionables });
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

    const { title, content, category, pinned, imageUrl } = req.body;
    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title?.trim() || null;
    if (content !== undefined) updates.content = content.trim();
    if (category !== undefined && VALID_CATEGORIES.includes(category)) updates.category = category;
    if (pinned !== undefined) updates.pinned = !!pinned;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl || null;

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
