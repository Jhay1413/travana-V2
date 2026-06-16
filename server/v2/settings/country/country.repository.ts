import { db } from '../../../config/database';
import { country } from '@shared/schema';
import { sql, ilike, or, eq, asc } from 'drizzle-orm';

function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || '').trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

export const countrySettingsRepository = {
  async findAll(query: Record<string, unknown>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search
      ? or(ilike(country.country_name, `%${search}%`), ilike(country.country_code, `%${search}%`))
      : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(country).where(where);
    const rows = await db.select().from(country).where(where).orderBy(asc(country.country_name)).limit(limit).offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findById(id: string) {
    const [row] = await db.select().from(country).where(eq(country.id, id));
    return row || null;
  },

  async create(data: unknown) {
    const { id: _id, ...rest } = data as Record<string, unknown>;
    const [row] = await db.insert(country).values(rest).returning();
    return row;
  },

  async update(id: string, data: unknown) {
    const { id: _id, ...rest } = data as Record<string, unknown>;
    const [row] = await db.update(country).set(rest).where(eq(country.id, id)).returning();
    return row || null;
  },

  async remove(id: string) {
    await db.delete(country).where(eq(country.id, id));
  },
};
