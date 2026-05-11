import { Router, Request, Response } from "express";
import { db } from "../config/database";
import { hubPostsTable, hubPostCommentsTable, hubPostLikesTable, user as userTable } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { isAuthenticated } from "../v2/middlewares/auth/session";
import { getUserId } from "../utils/get-user-id";

const router = Router();
router.use(isAuthenticated);

router.get("/", async (_req: Request, res: Response) => {
  try {
    const posts = await db
      .select({
        id: hubPostsTable.id,
        authorId: hubPostsTable.authorId,
        authorName: hubPostsTable.authorName,
        type: hubPostsTable.type,
        content: hubPostsTable.content,
        image: hubPostsTable.image,
        badge: hubPostsTable.badge,
        destination: hubPostsTable.destination,
        value: hubPostsTable.value,
        pinned: hubPostsTable.pinned,
        likes: hubPostsTable.likes,
        createdAt: hubPostsTable.createdAt,
        authorImage: userTable.image,
        authorRole: userTable.role,
      })
      .from(hubPostsTable)
      .leftJoin(userTable, eq(hubPostsTable.authorId, userTable.id))
      .orderBy(desc(hubPostsTable.createdAt));

    const postIds = posts.map((p) => p.id);

    let comments: any[] = [];
    if (postIds.length > 0) {
      comments = await db
        .select()
        .from(hubPostCommentsTable)
        .where(sql`${hubPostCommentsTable.postId} IN (${sql.join(postIds.map(id => sql`${id}`), sql`, `)})`);
    }

    const userId = getUserId(_req);
    let userLikes: Set<string> = new Set();
    if (userId && postIds.length > 0) {
      const likes = await db
        .select({ postId: hubPostLikesTable.postId })
        .from(hubPostLikesTable)
        .where(and(
          eq(hubPostLikesTable.userId, userId),
          sql`${hubPostLikesTable.postId} IN (${sql.join(postIds.map(id => sql`${id}`), sql`, `)})`
        ));
      userLikes = new Set(likes.map((l) => l.postId));
    }

    const likeCounts: Record<string, number> = {};
    if (postIds.length > 0) {
      const counts = await db
        .select({
          postId: hubPostLikesTable.postId,
          count: sql<number>`count(*)::int`,
        })
        .from(hubPostLikesTable)
        .where(sql`${hubPostLikesTable.postId} IN (${sql.join(postIds.map(id => sql`${id}`), sql`, `)})`)
        .groupBy(hubPostLikesTable.postId);
      for (const c of counts) likeCounts[c.postId] = c.count;
    }

    const result = posts.map((p) => ({
      ...p,
      likes: likeCounts[p.id] || 0,
      liked: userLikes.has(p.id),
      date: formatTimeAgo(p.createdAt),
      comments: comments
        .filter((c) => c.postId === p.id)
        .map((c) => ({
          author: c.authorName || "Agent",
          avatar: (c.authorName || "A").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
          text: c.text,
          date: formatTimeAgo(c.createdAt),
        })),
    }));

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const u = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
    const authorName = u[0]?.name || "Agent";

    const { type, content, image, badge, destination, value, pinned } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: "Content is required" });
    }

    const [post] = await db
      .insert(hubPostsTable)
      .values({
        authorId: userId,
        authorName,
        type: type || "deal",
        content: content.trim(),
        image: image || null,
        badge: badge || null,
        destination: destination || null,
        value: value || null,
        pinned: !!pinned,
      })
      .returning();

    res.status(201).json({ success: true, data: { ...post, likes: 0, liked: false, comments: [], authorImage: u[0]?.image || null, authorRole: u[0]?.role || null, date: "Just now" } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const [post] = await db.select().from(hubPostsTable).where(eq(hubPostsTable.id, req.params.id));
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });
    if (post.authorId !== userId) {
      const u = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
      const role = (u[0] as any)?.role?.toLowerCase();
      if (role !== "admin" && role !== "manager") {
        return res.status(403).json({ success: false, message: "Not authorized" });
      }
    }

    await db.delete(hubPostsTable).where(eq(hubPostsTable.id, req.params.id));
    res.json({ success: true, message: "Post deleted" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/:id/like", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const existing = await db
      .select()
      .from(hubPostLikesTable)
      .where(and(eq(hubPostLikesTable.postId, req.params.id), eq(hubPostLikesTable.userId, userId)));

    if (existing.length > 0) {
      await db
        .delete(hubPostLikesTable)
        .where(and(eq(hubPostLikesTable.postId, req.params.id), eq(hubPostLikesTable.userId, userId)));
      res.json({ success: true, data: { liked: false } });
    } else {
      await db.insert(hubPostLikesTable).values({ postId: req.params.id, userId });
      res.json({ success: true, data: { liked: true } });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/:id/comment", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const u = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
    const authorName = u[0]?.name || "Agent";

    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Comment text is required" });
    }

    const [comment] = await db
      .insert(hubPostCommentsTable)
      .values({
        postId: req.params.id,
        authorId: userId,
        authorName,
        text: text.trim(),
      })
      .returning();

    res.status(201).json({
      success: true,
      data: {
        author: authorName,
        avatar: authorName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
        text: comment.text,
        date: "Just now",
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function formatTimeAgo(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default router;
