import { db } from '../../config/database';
import { favorites } from '@shared/schema';
import { eq, and, asc } from 'drizzle-orm';

export const favoriteRepository = {
  async findByUserId(userId: string) {
    return db.select().from(favorites).where(eq(favorites.userId, userId)).orderBy(asc(favorites.displayOrder));
  },

  async findById(id: string) {
    const [row] = await db.select().from(favorites).where(eq(favorites.id, id)).limit(1);
    return row || undefined;
  },

  async findByUserAndItem(userId: string, itemType: string, itemId: string) {
    const [row] = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.itemType, itemType), eq(favorites.itemId, itemId)))
      .limit(1);
    return row || undefined;
  },

  async create(data: any) {
    const [row] = await db.insert(favorites).values(data).returning();
    return row;
  },

  async update(id: string, data: any) {
    const [row] = await db.update(favorites).set(data).where(eq(favorites.id, id)).returning();
    return row || undefined;
  },

  async remove(id: string) {
    await db.delete(favorites).where(eq(favorites.id, id));
  },
};
