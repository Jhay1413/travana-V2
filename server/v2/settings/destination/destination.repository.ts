import { db } from '../../../config/database';
import { destination, country } from '@shared/schema';
import { sql, ilike, or, eq, asc } from 'drizzle-orm';

function parsePagination(query: Record<string, any>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || '').trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

export const destinationSettingsRepository = {
  parsePagination,

  async findAll(query: Record<string, any>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search
      ? or(ilike(destination.name, `%${search}%`), ilike(destination.type, `%${search}%`))
      : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(destination).where(where);
    const rows = await db
      .select({
        id: destination.id,
        name: destination.name,
        type: destination.type,
        country_id: destination.country_id,
        country_name: country.country_name,
      })
      .from(destination)
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(where)
      .orderBy(asc(destination.name))
      .limit(limit)
      .offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findById(id: string) {
    const [row] = await db.select().from(destination).where(eq(destination.id, id));
    return row || null;
  },

  async create(data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.insert(destination).values(rest).returning();
    return row;
  },

  async update(id: string, data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.update(destination).set(rest).where(eq(destination.id, id)).returning();
    return row || null;
  },

  async remove(id: string) {
    await db.delete(destination).where(eq(destination.id, id));
  },
};
