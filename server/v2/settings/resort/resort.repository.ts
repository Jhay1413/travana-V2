import { db } from '../../../config/database';
import { resorts, destination } from '@shared/schema';
import { sql, ilike, eq, asc } from 'drizzle-orm';

function parsePagination(query: Record<string, any>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || '').trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

export const resortSettingsRepository = {
  async findAll(query: Record<string, any>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search ? ilike(resorts.name, `%${search}%`) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(resorts).where(where);
    const rows = await db
      .select({
        id: resorts.id,
        name: resorts.name,
        destination_id: resorts.destination_id,
        destination_name: destination.name,
      })
      .from(resorts)
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .where(where)
      .orderBy(asc(resorts.name))
      .limit(limit)
      .offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findById(id: string) {
    const [row] = await db.select().from(resorts).where(eq(resorts.id, id));
    return row || null;
  },

  async create(data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.insert(resorts).values(rest).returning();
    return row;
  },

  async update(id: string, data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.update(resorts).set(rest).where(eq(resorts.id, id)).returning();
    return row || null;
  },

  async remove(id: string) {
    await db.delete(resorts).where(eq(resorts.id, id));
  },
};
