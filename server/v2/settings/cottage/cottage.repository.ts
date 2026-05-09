import { db } from '../../../config/database';
import { cottages } from '@shared/schema';
import { sql, ilike, or, eq, asc } from 'drizzle-orm';

function parsePagination(query: Record<string, any>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || '').trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

export const cottageSettingsRepository = {
  async findAll(query: Record<string, any>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search
      ? or(
          ilike(cottages.cottage_name, `%${search}%`),
          ilike(cottages.cottage_code, `%${search}%`),
          ilike(cottages.location, `%${search}%`),
        )
      : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(cottages).where(where);
    const rows = await db.select().from(cottages).where(where).orderBy(asc(cottages.cottage_name)).limit(limit).offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findById(id: string) {
    const [row] = await db.select().from(cottages).where(eq(cottages.id, id));
    return row || null;
  },

  async create(data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.insert(cottages).values(rest).returning();
    return row;
  },

  async update(id: string, data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.update(cottages).set(rest).where(eq(cottages.id, id)).returning();
    return row || null;
  },

  async remove(id: string) {
    await db.delete(cottages).where(eq(cottages.id, id));
  },
};
