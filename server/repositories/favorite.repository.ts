import { db } from "../config/database";
import { favorites, InsertFavorite, Favorite } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";

export const favoriteRepository = {
  async findByUserId(userId: string): Promise<Favorite[]> {
    return await db.select().from(favorites).where(eq(favorites.userId, userId)).orderBy(asc(favorites.displayOrder));
  },

  async findById(id: string): Promise<Favorite | undefined> {
    const [result] = await db.select().from(favorites).where(eq(favorites.id, id)).limit(1);
    return result;
  },

  async findByUserAndItem(userId: string, itemType: string, itemId: string): Promise<Favorite | undefined> {
    const [result] = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.itemType, itemType), eq(favorites.itemId, itemId)))
      .limit(1);
    return result;
  },

  async create(favorite: InsertFavorite): Promise<Favorite> {
    const [result] = await db.insert(favorites).values(favorite).returning();
    return result;
  },

  async update(id: string, data: Partial<InsertFavorite>): Promise<Favorite | undefined> {
    const [result] = await db.update(favorites).set(data).where(eq(favorites.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(favorites).where(eq(favorites.id, id));
  },

  async removeByUserAndItem(userId: string, itemType: string, itemId: string): Promise<void> {
    await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.itemType, itemType), eq(favorites.itemId, itemId)));
  },
};
