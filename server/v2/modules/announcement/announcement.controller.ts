import { Request, Response } from 'express';
import { announcementService } from './announcement.service';
import { announcementRepository } from './announcement.repository';
import { userRepository } from '../user/user.repository';
import { notificationRepository } from '../notification/notification.repository';
import { asyncHandler } from '../../utils/async-handler';
import { getUserId } from '../../utils/get-user-id';
import { uploadImageToS3 } from '../../utils/image-storage';
import multer from 'multer';

const VALID_CATEGORIES = ['general', 'supplier', 'target', 'incentive', 'training'];

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP and GIF images are allowed'));
  },
});

async function getUserInfo(userId: string) {
  const u = await userRepository.findRoleAndNameById(userId);
  return { name: u?.name || null, role: u?.role?.toLowerCase() || null };
}

async function createHubNotification(userId: string, type: string, title: string, message: string, link: string) {
  try {
    await notificationRepository.create({ userId, type, title, message, link, read: false });
  } catch { /* non-fatal */ }
}

async function notifyAllUsersExcept(excludeUserId: string, type: string, title: string, message: string, link: string) {
  const allUsers = await userRepository.findAllIdsAndNames();
  for (const u of allUsers) {
    if (u.id !== excludeUserId) await createHubNotification(u.id, type, title, message, link);
  }
}

function extractMentions(content: string): string[] {
  const ids: string[] = [];
  const tiptapPattern = /data-type="mention"[^>]*data-id="([^"]+)"/g;
  let match;
  let hasStructured = false;
  while ((match = tiptapPattern.exec(content)) !== null) { hasStructured = true; if (!ids.includes(match[1])) ids.push(match[1]); }
  const legacyPattern = /data-mention-id="([^"]+)"/g;
  while ((match = legacyPattern.exec(content)) !== null) { hasStructured = true; if (!ids.includes(match[1])) ids.push(match[1]); }
  if (!hasStructured) {
    const stripped = content.replace(/<[^>]*>/g, '');
    const plainPattern = /@(\w+(?:\s+\w+)?)/g;
    while ((match = plainPattern.exec(stripped)) !== null) {
      const name = match[1].trim().toLowerCase();
      if (name === 'everyone' && !ids.includes('__all__')) ids.push('__all__');
      else if (!ids.includes(name)) ids.push(name);
    }
  }
  return ids;
}

async function notifyMentionedUsers(content: string, authorId: string, authorName: string) {
  const mentions = extractMentions(content);
  if (mentions.length === 0) return;
  const allUsers = await userRepository.findAllIdsAndNames();
  if (mentions.includes('__all__')) {
    for (const u of allUsers) {
      if (u.id !== authorId) await createHubNotification(u.id, 'hub_mention', 'You were mentioned in TheHub', `${authorName} mentioned @Everyone in a post`, '/hub/news');
    }
    return;
  }
  for (const mention of mentions) {
    const byId = allUsers.find((u) => u.id === mention);
    if (byId && byId.id !== authorId) { await createHubNotification(byId.id, 'hub_mention', 'You were mentioned in TheHub', `${authorName} mentioned you in a post`, '/hub/news'); continue; }
    const byName = allUsers.find((u) => u.name && (u.name.toLowerCase() === mention || u.name.toLowerCase().split(' ')[0] === mention));
    if (byName && byName.id !== authorId) await createHubNotification(byName.id, 'hub_mention', 'You were mentioned in TheHub', `${authorName} mentioned you in a post`, '/hub/news');
  }
}

export const announcementController = {
  getAll: asyncHandler(async (_req: Request, res: Response) => {
    const items = await announcementService.findAll();
    res.json({ success: true, data: items });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const { name, role } = await getUserInfo(userId);
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ success: false, message: 'Only Admin or Manager can post announcements' });
    const { title, content, category, pinned, imageUrl } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Content is required' });
    const cat = VALID_CATEGORIES.includes(category) ? category : 'general';
    const item = await announcementService.create({ authorId: userId, authorName: name, category: cat, title: title?.trim() || null, content: content.trim(), imageUrl: imageUrl || null, pinned: !!pinned });
    const postTitle = title?.trim() || 'New announcement';
    await notifyAllUsersExcept(userId, 'hub_post', 'New Post on TheHub', `${name || 'Someone'} posted: ${postTitle}`, '/hub/news');
    await notifyMentionedUsers(content, userId, name || 'Someone');
    res.status(201).json({ success: true, data: item });
  }),

  uploadImage: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, message: 'No image file provided' });
    // Store via the shared helper so the DB holds a stable proxy URL
    // (/api/v2/files/img?key=...) that 302-redirects to a short-lived presigned
    // URL — the same pattern quote/booking images use. A direct public S3 URL
    // would 403 against the private bucket and the image would never load.
    const imageUrl = await uploadImageToS3(file, 'hub-images');
    res.json({ success: true, data: { imageUrl } });
  }),

  getMentionableUsers: asyncHandler(async (_req: Request, res: Response) => {
    const users = await userRepository.findAllIdsNamesAndRoles();
    const mentionables = [{ id: '__all__', name: 'Everyone', role: 'all' }, ...users.filter((u) => u.name).map((u) => ({ id: u.id, name: u.name!, role: u.role || 'Agent' }))];
    res.json({ success: true, data: mentionables });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const { role } = await getUserInfo(userId);
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ success: false, message: 'Only Admin or Manager can edit announcements' });
    const { title, content, category, pinned, imageUrl } = req.body;
    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title?.trim() || null;
    if (content !== undefined) updates.content = content.trim();
    if (category !== undefined && VALID_CATEGORIES.includes(category)) updates.category = category;
    if (pinned !== undefined) updates.pinned = !!pinned;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl || null;
    const item = await announcementService.update(req.params.id as string, updates);
    res.json({ success: true, data: item });
  }),

  togglePin: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const { role } = await getUserInfo(userId);
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ success: false, message: 'Only Admin or Manager can pin announcements' });
    const item = await announcementService.togglePin(req.params.id as string);
    res.json({ success: true, data: item });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const { role } = await getUserInfo(userId);
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ success: false, message: 'Only Admin or Manager can delete announcements' });
    await announcementService.remove(req.params.id as string);
    res.json({ success: true, message: 'Announcement deleted' });
  }),

  like: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const announcementId = req.params.id as string;
    const announcement = await announcementService.findById(announcementId);
    const result = await announcementRepository.toggleLike(announcementId, userId);
    if (result.liked && announcement.authorId !== userId) {
      const { name } = await getUserInfo(userId);
      await createHubNotification(announcement.authorId, 'hub_like', 'Your post was liked', `${name || 'Someone'} liked your post${announcement.title ? `: ${announcement.title}` : ''}`, '/hub/news');
    }
    res.json({ success: true, data: result });
  }),

  getBulkLikes: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const allLikes = await announcementRepository.countLikesGroupedByAnnouncement();
    const userLikes: string[] = userId ? await announcementRepository.findAnnouncementIdsLikedByUser(userId) : [];
    const likesMap: Record<string, { count: number; userLiked: boolean }> = {};
    for (const l of allLikes) likesMap[l.announcementId] = { count: l.count, userLiked: userLikes.includes(l.announcementId) };
    res.json({ success: true, data: likesMap });
  }),

  getLikes: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const announcementId = req.params.id as string;
    const totalCount = await announcementRepository.countLikesFor(announcementId);
    const userLiked = userId ? await announcementRepository.hasUserLiked(announcementId, userId) : false;
    res.json({ success: true, data: { count: totalCount, userLiked } });
  }),

  share: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const announcement = await announcementService.findById(req.params.id as string);
    if (announcement.authorId !== userId) {
      const { name } = await getUserInfo(userId);
      await createHubNotification(announcement.authorId, 'hub_share', 'Your post was shared', `${name || 'Someone'} shared your post${announcement.title ? `: ${announcement.title}` : ''}`, '/hub/news');
    }
    res.json({ success: true, message: 'Share recorded' });
  }),
};
