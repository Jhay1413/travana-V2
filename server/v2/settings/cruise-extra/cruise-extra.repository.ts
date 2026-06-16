import { db } from '../../../config/database';
import { cruise_extra_item } from '@shared/schema';
import { sql, ilike, eq, asc } from 'drizzle-orm';

function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || '').trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

export const cruiseExtraSettingsRepository = {
  async findAll(query: Record<string, unknown>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search
      ? ilike(cruise_extra_item.name, `%${search}%`)
      : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(cruise_extra_item).where(where);
    const rows = await db.select().from(cruise_extra_item).where(where).orderBy(asc(cruise_extra_item.name)).limit(limit).offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findById(id: string) {
    const [row] = await db.select().from(cruise_extra_item).where(eq(cruise_extra_item.id, id));
    return row || null;
  },

  async create(data: unknown) {
    const { id: _id, ...rest } = data as Record<string, unknown>;
    const [row] = await db.insert(cruise_extra_item).values(rest).returning();
    return row;
  },

  async update(id: string, data: unknown) {
    const { id: _id, ...rest } = data as Record<string, unknown>;
    const [row] = await db.update(cruise_extra_item).set(rest).where(eq(cruise_extra_item.id, id)).returning();
    return row || null;
  },

  async remove(id: string) {
    await db.delete(cruise_extra_item).where(eq(cruise_extra_item.id, id));
  },
};
