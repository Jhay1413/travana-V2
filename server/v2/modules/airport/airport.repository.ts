import { db } from '../../config/database';
import { airport } from '@shared/schema';
import { eq } from 'drizzle-orm';

export const airportRepository = {
  async findAll() {
    return db.select().from(airport).orderBy(airport.airport_name);
  },

  async findById(id: string) {
    const [row] = await db.select().from(airport).where(eq(airport.id, id)).limit(1);
    return row || null;
  },

  async create(data: any) {
    const [row] = await db.insert(airport).values(data).returning();
    return row;
  },

  async remove(id: string) {
    await db.delete(airport).where(eq(airport.id, id));
  },
};
