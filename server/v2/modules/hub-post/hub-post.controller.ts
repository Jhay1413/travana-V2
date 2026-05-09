import { Request, Response } from 'express';
import { hubPostService } from './hub-post.service';
import { asyncHandler } from '../../utils/async-handler';
import { getUserId } from '../../utils/get-user-id';
import { db } from '../../config/database';
import { user as userTable } from '@shared/schema';
import { eq } from 'drizzle-orm';

export const hubPostController = {
  getAll: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const posts = await hubPostService.findAll(userId || undefined);
    res.json({ success: true, data: posts.map((p) => ({ ...p, date: 'Just now' })) });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const [u] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
    const authorName = u?.name || 'Agent';
    const { type, content, image, badge, destination, value, pinned } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Content is required' });
    const post = await hubPostService.create({ authorId: userId, authorName, type: type || 'deal', content: content.trim(), image: image || null, badge: badge || null, destination: destination || null, value: value || null, pinned: !!pinned });
    res.status(201).json({ success: true, data: { ...post, likes: 0, liked: false, comments: [], authorImage: u?.image || null, authorRole: u?.role || null, date: 'Just now' } });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const [u] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
    const role = (u as any)?.role?.toLowerCase() || '';
    await hubPostService.remove(req.params.id, userId, role);
    res.json({ success: true, message: 'Post deleted' });
  }),

  like: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const liked = await hubPostService.toggleLike(req.params.id, userId);
    res.json({ success: true, data: { liked } });
  }),

  comment: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const [u] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
    const authorName = u?.name || 'Agent';
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Comment text is required' });
    const comment = await hubPostService.addComment(req.params.id, userId, authorName, text.trim());
    res.status(201).json({ success: true, data: { author: authorName, avatar: authorName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(), text: comment.text, date: 'Just now' } });
  }),
};
