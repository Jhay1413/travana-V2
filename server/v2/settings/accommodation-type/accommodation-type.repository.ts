import { db } from '../../../config/database';
import { accomodation_type } from '@shared/schema';
import { sql, ilike, eq, asc } from 'drizzle-orm';

function parsePagination(query: Record<string, any>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || '').trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

export const accommodationTypeSettingsRepository = {
  async findAll(query: Record<string, any>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search ? ilike(accomodation_type.type, `%${search}%`) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(accomodation_type).where(where);
    const rows = await db.select().from(accomodation_type).where(where).orderBy(asc(accomodation_type.type)).limit(limit).offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findById(id: string) {
    const [row] = await db.select().from(accomodation_type).where(eq(accomodation_type.id, id));
    return row || null;
  },

  async create(data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.insert(accomodation_type).values(rest).returning();
    return row;
  },

  async update(id: string, data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.update(accomodation_type).set(rest).where(eq(accomodation_type.id, id)).returning();
    return row || null;
  },

  async remove(id: string) {
    await db.delete(accomodation_type).where(eq(accomodation_type.id, id));
  },
};
