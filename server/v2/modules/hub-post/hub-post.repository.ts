import { db } from '../../config/database';
import { hubPostsTable, hubPostCommentsTable, hubPostLikesTable, user as userTable } from '@shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

export const hubPostRepository = {
  async findAll(userId?: string) {
    const posts = await db
      .select({ id: hubPostsTable.id, authorId: hubPostsTable.authorId, authorName: hubPostsTable.authorName, type: hubPostsTable.type, content: hubPostsTable.content, image: hubPostsTable.image, badge: hubPostsTable.badge, destination: hubPostsTable.destination, value: hubPostsTable.value, pinned: hubPostsTable.pinned, likes: hubPostsTable.likes, createdAt: hubPostsTable.createdAt, authorImage: userTable.image, authorRole: userTable.role })
      .from(hubPostsTable)
      .leftJoin(userTable, eq(hubPostsTable.authorId, userTable.id))
      .orderBy(desc(hubPostsTable.createdAt));

    const postIds = posts.map((p) => p.id);
    if (postIds.length === 0) return [];

    const comments = await db.select().from(hubPostCommentsTable).where(sql`${hubPostCommentsTable.postId} IN (${sql.join(postIds.map((id) => sql`${id}`), sql`, `)})`);

    let userLikedSet: Set<string> = new Set();
    if (userId) {
      const likes = await db.select({ postId: hubPostLikesTable.postId }).from(hubPostLikesTable).where(and(eq(hubPostLikesTable.userId, userId), sql`${hubPostLikesTable.postId} IN (${sql.join(postIds.map((id) => sql`${id}`), sql`, `)})`));
      userLikedSet = new Set(likes.map((l) => l.postId));
    }

    const likeCounts = await db.select({ postId: hubPostLikesTable.postId, count: sql<number>`count(*)::int` }).from(hubPostLikesTable).where(sql`${hubPostLikesTable.postId} IN (${sql.join(postIds.map((id) => sql`${id}`), sql`, `)})`).groupBy(hubPostLikesTable.postId);
    const likeCountMap: Record<string, number> = {};
    for (const c of likeCounts) likeCountMap[c.postId] = c.count;

    return posts.map((p) => ({
      ...p,
      likes: likeCountMap[p.id] || 0,
      liked: userLikedSet.has(p.id),
      comments: comments.filter((c) => c.postId === p.id).map((c) => ({ author: c.authorName || 'Agent', avatar: (c.authorName || 'A').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(), text: c.text, date: formatTimeAgo(c.createdAt) })),
    }));
  },

  async create(data: any) {
    const [row] = await db.insert(hubPostsTable).values(data).returning();
    return row;
  },

  async findById(id: string) {
    const [row] = await db.select().from(hubPostsTable).where(eq(hubPostsTable.id, id)).limit(1);
    return row || undefined;
  },

  async remove(id: string) {
    await db.delete(hubPostsTable).where(eq(hubPostsTable.id, id));
  },

  async toggleLike(postId: string, userId: string) {
    const existing = await db.select().from(hubPostLikesTable).where(and(eq(hubPostLikesTable.postId, postId), eq(hubPostLikesTable.userId, userId)));
    if (existing.length > 0) {
      await db.delete(hubPostLikesTable).where(and(eq(hubPostLikesTable.postId, postId), eq(hubPostLikesTable.userId, userId)));
      return false;
    }
    await db.insert(hubPostLikesTable).values({ postId, userId });
    return true;
  },

  async addComment(postId: string, authorId: string, authorName: string, text: string) {
    const [row] = await db.insert(hubPostCommentsTable).values({ postId, authorId, authorName, text }).returning();
    return row;
  },
};

function formatTimeAgo(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
