import { db } from '../../../config/database';
import { lodges, park } from '@shared/schema';
import { sql, ilike, or, eq, asc } from 'drizzle-orm';

function parsePagination(query: Record<string, any>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || '').trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

export const lodgeSettingsRepository = {
  async findAll(query: Record<string, any>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search
      ? or(ilike(lodges.lodge_name, `%${search}%`), ilike(lodges.lodge_code, `%${search}%`))
      : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(lodges).where(where);
    const rows = await db
      .select({
        id: lodges.id,
        lodge_name: lodges.lodge_name,
        lodge_code: lodges.lodge_code,
        park_id: lodges.park_id,
        park_name: park.name,
        adults: lodges.adults,
        children: lodges.children,
        infants: lodges.infants,
        bedrooms: lodges.bedrooms,
        bathrooms: lodges.bathrooms,
        sleeps: lodges.sleeps,
        pets: lodges.pets,
        image: lodges.image,
      })
      .from(lodges)
      .leftJoin(park, eq(lodges.park_id, park.id))
      .where(where)
      .orderBy(asc(lodges.lodge_name))
      .limit(limit)
      .offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findById(id: string) {
    const [row] = await db.select().from(lodges).where(eq(lodges.id, id));
    return row || null;
  },

  async create(data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.insert(lodges).values(rest).returning();
    return row;
  },

  async update(id: string, data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.update(lodges).set(rest).where(eq(lodges.id, id)).returning();
    return row || null;
  },

  async remove(id: string) {
    await db.delete(lodges).where(eq(lodges.id, id));
  },
};
