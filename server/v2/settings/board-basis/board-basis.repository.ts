import { db } from '../../../config/database';
import { board_basis } from '@shared/schema';
import { sql, ilike, eq, asc } from 'drizzle-orm';

function parsePagination(query: Record<string, any>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || '').trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

export const boardBasisSettingsRepository = {
  async findAll(query: Record<string, any>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search ? ilike(board_basis.type, `%${search}%`) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(board_basis).where(where);
    const rows = await db.select().from(board_basis).where(where).orderBy(asc(board_basis.type)).limit(limit).offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findById(id: string) {
    const [row] = await db.select().from(board_basis).where(eq(board_basis.id, id));
    return row || null;
  },

  async create(data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.insert(board_basis).values(rest).returning();
    return row;
  },

  async update(id: string, data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.update(board_basis).set(rest).where(eq(board_basis.id, id)).returning();
    return row || null;
  },

  async remove(id: string) {
    await db.delete(board_basis).where(eq(board_basis.id, id));
  },
};
