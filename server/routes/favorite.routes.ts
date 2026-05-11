import { Router, Request, Response } from "express";
import { favoriteService } from "../services/favorite.service";
import { isAuthenticated } from "../v2/middlewares/auth";
import { getUserId } from "../utils/get-user-id";

const router = Router();

router.get("/", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const data = await favoriteService.getUserFavorites(userId);
    res.json({ success: true, message: "Favorites retrieved successfully", data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { itemType, itemId, label, subtitle } = req.body;
    if (!itemType || !itemId || !label) {
      return res.status(400).json({ success: false, message: "itemType, itemId, and label are required" });
    }
    const data = await favoriteService.addFavorite({ userId, itemType, itemId, label, subtitle: subtitle || null, displayOrder: 0 });
    res.status(201).json({ success: true, message: "Favorite added successfully", data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/toggle", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { itemType, itemId, label, subtitle } = req.body;
    if (!itemType || !itemId || !label) {
      return res.status(400).json({ success: false, message: "itemType, itemId, and label are required" });
    }
    const data = await favoriteService.toggleFavorite(userId, itemType, itemId, label, subtitle);
    res.json({ success: true, message: data.favorited ? "Added to favorites" : "Removed from favorites", data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/check", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const itemType = req.query.itemType as string | undefined;
    const itemId = req.query.itemId as string | undefined;
    if (!itemType || !itemId) {
      return res.status(400).json({ success: false, message: "itemType and itemId query params required" });
    }
    const favorited = await favoriteService.isFavorited(userId, itemType, itemId);
    res.json({ success: true, data: { favorited } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const favId = req.params.id as string;
    const existing = await favoriteService.getFavoriteById(favId);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ success: false, message: "Favorite not found" });
    }
    await favoriteService.removeFavorite(favId);
    res.json({ success: true, message: "Favorite removed successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
