import { db } from '../../../config/database';
import { cruise_voyage, cruise_itenary } from '@shared/schema';
import { sql, ilike, eq, asc } from 'drizzle-orm';

function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || '').trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

export const cruiseVoyageSettingsRepository = {
  async findAll(query: Record<string, unknown>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search ? ilike(cruise_voyage.description, `%${search}%`) : undefined;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(cruise_voyage)
      .leftJoin(cruise_itenary, eq(cruise_voyage.itinerary_id, cruise_itenary.id))
      .where(where);
    const rows = await db
      .select({
        id: cruise_voyage.id,
        day_number: cruise_voyage.day_number,
        description: cruise_voyage.description,
        itinerary_id: cruise_voyage.itinerary_id,
        itinerary_name: cruise_itenary.itenary,
      })
      .from(cruise_voyage)
      .leftJoin(cruise_itenary, eq(cruise_voyage.itinerary_id, cruise_itenary.id))
      .where(where)
      .orderBy(asc(cruise_voyage.day_number))
      .limit(limit)
      .offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findById(id: string) {
    const [row] = await db.select().from(cruise_voyage).where(eq(cruise_voyage.id, id));
    return row || null;
  },

  async create(data: Record<string, unknown>) {
    const { id: _id, ...rest } = data;
    const [row] = await db.insert(cruise_voyage).values(rest).returning();
    return row;
  },

  async update(id: string, data: Record<string, unknown>) {
    const { id: _id, ...rest } = data;
    const [row] = await db.update(cruise_voyage).set(rest).where(eq(cruise_voyage.id, id)).returning();
    return row || null;
  },

  async remove(id: string) {
    await db.delete(cruise_voyage).where(eq(cruise_voyage.id, id));
  },
};
