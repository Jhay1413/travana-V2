import { db } from '../../../config/database';
import { package_type } from '@shared/schema';
import { sql, ilike, eq, asc } from 'drizzle-orm';

function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || '').trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

export const packageTypeSettingsRepository = {
  async findAll(query: Record<string, unknown>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search
      ? ilike(package_type.name, `%${search}%`)
      : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(package_type).where(where);
    const rows = await db.select().from(package_type).where(where).orderBy(asc(package_type.name)).limit(limit).offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findById(id: string) {
    const [row] = await db.select().from(package_type).where(eq(package_type.id, id));
    return row || null;
  },

  async create(data: unknown) {
    const { id: _id, ...rest } = data as Record<string, unknown>;
    const [row] = await db.insert(package_type).values(rest as typeof package_type.$inferInsert).returning();
    return row;
  },

  async update(id: string, data: unknown) {
    const { id: _id, ...rest } = data as Record<string, unknown>;
    const [row] = await db.update(package_type).set(rest as Partial<typeof package_type.$inferInsert>).where(eq(package_type.id, id)).returning();
    return row || null;
  },

  async remove(id: string) {
    await db.delete(package_type).where(eq(package_type.id, id));
  },
};
