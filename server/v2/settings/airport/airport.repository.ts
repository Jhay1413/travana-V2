import { db } from '../../../config/database';
import { airport } from '@shared/schema';
import { sql, ilike, or, eq, asc } from 'drizzle-orm';

function parsePagination(query: Record<string, any>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || '').trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

export const airportSettingsRepository = {
  async findAll(query: Record<string, any>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search
      ? or(ilike(airport.airport_name, `%${search}%`), ilike(airport.airport_code, `%${search}%`))
      : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(airport).where(where);
    const rows = await db.select().from(airport).where(where).orderBy(asc(airport.airport_name)).limit(limit).offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findById(id: string) {
    const [row] = await db.select().from(airport).where(eq(airport.id, id));
    return row || null;
  },

  async create(data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.insert(airport).values(rest).returning();
    return row;
  },

  async update(id: string, data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.update(airport).set(rest).where(eq(airport.id, id)).returning();
    return row || null;
  },

  async remove(id: string) {
    await db.delete(airport).where(eq(airport.id, id));
  },
};
