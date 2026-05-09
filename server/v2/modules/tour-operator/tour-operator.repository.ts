import { db } from '../../config/database';
import { tour_operator, tour_package_commission } from '@shared/schema';
import { eq } from 'drizzle-orm';

export const tourOperatorRepository = {
  async findById(id: string) {
    const [result] = await db.select().from(tour_operator).where(eq(tour_operator.id, id)).limit(1);
    if (!result) return undefined;
    const commissions = await db.select().from(tour_package_commission).where(eq(tour_package_commission.tour_operator_id, id));
    return { ...result, commissions };
  },

  async findAll() {
    const operators = await db.select().from(tour_operator).orderBy(tour_operator.name);
    if (operators.length === 0) return [];
    const allCommissions = await db.select().from(tour_package_commission);
    return operators.map((op) => ({
      ...op,
      commissions: allCommissions.filter((c) => c.tour_operator_id === op.id),
    }));
  },

  async create(data: any) {
    const { commissions: _c, ...rest } = data;
    const [row] = await db.insert(tour_operator).values(rest).returning();
    return row;
  },

  async update(id: string, data: any) {
    const { commissions: _c, ...rest } = data;
    const [row] = await db.update(tour_operator).set(rest).where(eq(tour_operator.id, id)).returning();
    return row || undefined;
  },

  async remove(id: string) {
    await db.delete(tour_operator).where(eq(tour_operator.id, id));
  },
};
