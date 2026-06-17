import { Request, Response } from 'express';
import { favoriteService } from './favorite.service';
import { asyncHandler } from '../../utils/async-handler';
import { getUserId } from '../../utils/get-user-id';

export const favoriteController = {
  getAll: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const data = await favoriteService.getUserFavorites(userId);
    res.json({ success: true, message: 'Favorites retrieved successfully', data });
  }),

  add: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { itemType, itemId, label, subtitle } = req.body;
    if (!itemType || !itemId || !label) {
      return res.status(400).json({ success: false, message: 'itemType, itemId, and label are required' });
    }
    const data = await favoriteService.addFavorite({ userId, itemType, itemId, label, subtitle: subtitle || null, displayOrder: 0 });
    res.status(201).json({ success: true, message: 'Favorite added successfully', data });
  }),

  toggle: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { itemType, itemId, label, subtitle } = req.body;
    if (!itemType || !itemId || !label) {
      return res.status(400).json({ success: false, message: 'itemType, itemId, and label are required' });
    }
    const data = await favoriteService.toggleFavorite(userId, itemType, itemId, label, subtitle);
    res.json({ success: true, message: data.favorited ? 'Added to favorites' : 'Removed from favorites', data });
  }),

  check: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const itemType = req.query.itemType as string | undefined;
    const itemId = req.query.itemId as string | undefined;
    if (!itemType || !itemId) {
      return res.status(400).json({ success: false, message: 'itemType and itemId query params required' });
    }
    const favorited = await favoriteService.isFavorited(userId, itemType, itemId);
    res.json({ success: true, data: { favorited } });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const existing = await favoriteService.getFavoriteById((req.params.id as string));
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, message: 'Favorite not found' });
    }
    await favoriteService.removeFavorite((req.params.id as string));
    res.json({ success: true, message: 'Favorite removed successfully' });
  }),
};
