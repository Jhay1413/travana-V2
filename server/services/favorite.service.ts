import { favoriteRepository } from "../repositories/favorite.repository";
import { InsertFavorite, Favorite } from "@shared/schema";

export const favoriteService = {
  async getUserFavorites(userId: string): Promise<Favorite[]> {
    return await favoriteRepository.findByUserId(userId);
  },

  async getFavoriteById(id: string): Promise<Favorite | undefined> {
    return await favoriteRepository.findById(id);
  },

  async addFavorite(data: InsertFavorite): Promise<Favorite> {
    const existing = await favoriteRepository.findByUserAndItem(data.userId, data.itemType, data.itemId);
    if (existing) return existing;
    return await favoriteRepository.create(data);
  },

  async removeFavorite(id: string): Promise<void> {
    await favoriteRepository.remove(id);
  },

  async toggleFavorite(userId: string, itemType: string, itemId: string, label: string, subtitle?: string): Promise<{ favorited: boolean; favorite?: Favorite }> {
    const existing = await favoriteRepository.findByUserAndItem(userId, itemType, itemId);
    if (existing) {
      await favoriteRepository.remove(existing.id);
      return { favorited: false };
    }
    const favorite = await favoriteRepository.create({ userId, itemType, itemId, label, subtitle: subtitle || null, displayOrder: 0 });
    return { favorited: true, favorite };
  },

  async updateOrder(id: string, displayOrder: number): Promise<Favorite | undefined> {
    return await favoriteRepository.update(id, { displayOrder });
  },

  async isFavorited(userId: string, itemType: string, itemId: string): Promise<boolean> {
    const existing = await favoriteRepository.findByUserAndItem(userId, itemType, itemId);
    return !!existing;
  },
};
