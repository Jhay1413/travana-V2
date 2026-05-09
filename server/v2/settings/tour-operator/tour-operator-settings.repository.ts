import { db } from '../../../config/database';
import { tour_operator, tour_package_commission } from '@shared/schema';
import { sql, ilike, eq, asc } from 'drizzle-orm';

function parsePagination(query: Record<string, any>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || '').trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

export const tourOperatorSettingsRepository = {
  async findAll(query: Record<string, any>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search ? ilike(tour_operator.name, `%${search}%`) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(tour_operator).where(where);
    const operators = await db.select().from(tour_operator).where(where).orderBy(asc(tour_operator.name)).limit(limit).offset(offset);
    const allCommissions = operators.length > 0
      ? await db.select().from(tour_package_commission)
      : [];
    const rows = operators.map((op) => ({
      ...op,
      commissions: allCommissions.filter((c) => c.tour_operator_id === op.id),
    }));
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findById(id: string) {
    const [op] = await db.select().from(tour_operator).where(eq(tour_operator.id, id));
    if (!op) return null;
    const commissions = await db.select().from(tour_package_commission).where(eq(tour_package_commission.tour_operator_id, id));
    return { ...op, commissions };
  },

  async create(data: any) {
    const { id: _id, commissions: _c, ...rest } = data;
    const [row] = await db.insert(tour_operator).values(rest).returning();
    return row;
  },

  async update(id: string, data: any) {
    const { id: _id, commissions: _c, ...rest } = data;
    const [row] = await db.update(tour_operator).set(rest).where(eq(tour_operator.id, id)).returning();
    return row || null;
  },

  async remove(id: string) {
    await db.delete(tour_operator).where(eq(tour_operator.id, id));
  },
};
