import { favoriteRepository } from './favorite.repository';

export const favoriteService = {
  async getUserFavorites(userId: string) {
    return favoriteRepository.findByUserId(userId);
  },

  async getFavoriteById(id: string) {
    return favoriteRepository.findById(id);
  },

  async addFavorite(data: any) {
    const existing = await favoriteRepository.findByUserAndItem(data.userId, data.itemType, data.itemId);
    if (existing) return existing;
    return favoriteRepository.create(data);
  },

  async removeFavorite(id: string) {
    await favoriteRepository.remove(id);
  },

  async toggleFavorite(userId: string, itemType: string, itemId: string, label: string, subtitle?: string) {
    const existing = await favoriteRepository.findByUserAndItem(userId, itemType, itemId);
    if (existing) {
      await favoriteRepository.remove(existing.id);
      return { favorited: false };
    }
    const favorite = await favoriteRepository.create({ userId, itemType, itemId, label, subtitle: subtitle || null, displayOrder: 0 });
    return { favorited: true, favorite };
  },

  async isFavorited(userId: string, itemType: string, itemId: string) {
    const existing = await favoriteRepository.findByUserAndItem(userId, itemType, itemId);
    return !!existing;
  },
};
