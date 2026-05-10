import { Request, Response } from 'express';
import { feedbackService } from './feedback.service';
import { userRepository } from '../user/user.repository';
import { asyncHandler } from '../../utils/async-handler';
import { getUserId } from '../../utils/get-user-id';

const VALID_TYPES = ['suggestion', 'bug', 'general'];
const VALID_STATUSES = ['open', 'in_review', 'resolved', 'closed'];

async function getUserName(userId: string) {
  const u = await userRepository.findRoleAndNameById(userId);
  return u?.name || null;
}

async function getUserRole(userId: string) {
  const u = await userRepository.findRoleById(userId);
  return u?.role?.toLowerCase() || null;
}

export const feedbackController = {
  getAll: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const role = await getUserRole(userId);
    if (role === 'admin' || role === 'manager') {
      const items = await feedbackService.findAll();
      return res.json({ success: true, data: items });
    }
    const items = await feedbackService.findByUserId(userId);
    res.json({ success: true, data: items });
  }),

  getMine: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const items = await feedbackService.findByUserId(userId);
    res.json({ success: true, data: items });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const { type, subject, message, page } = req.body;
    if (!subject?.trim()) return res.status(400).json({ success: false, message: 'Subject is required' });
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message is required' });
    const feedbackType = VALID_TYPES.includes(type) ? type : 'general';
    const userName = await getUserName(userId);
    const item = await feedbackService.create({ userId, userName, type: feedbackType, subject: subject.trim(), message: message.trim(), page: page || null });
    res.status(201).json({ success: true, data: item });
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const role = await getUserRole(userId);
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ success: false, message: 'Admin or Manager access required' });
    const { status, adminNotes } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) return res.status(400).json({ success: false, message: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
    const item = await feedbackService.updateStatus(req.params.id as string, status, adminNotes);
    res.json({ success: true, data: item });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const role = await getUserRole(userId);
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ success: false, message: 'Admin or Manager access required' });
    await feedbackService.remove(req.params.id as string);
    res.json({ success: true, message: 'Feedback deleted' });
  }),
};
