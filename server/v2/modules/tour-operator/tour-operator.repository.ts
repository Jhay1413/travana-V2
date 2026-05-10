import { db } from '../../config/database';
import { tour_operator, tour_package_commission } from '@shared/schema';
import { eq, and, isNull, or, type SQL } from 'drizzle-orm';
import type { Scope } from '../../utils/scope';

function buildOrgScopeConds(scope?: Scope): SQL[] {
  if (!scope || scope.orgRole === 'platform_admin') return [];
  // Tour operators may be global (org_id IS NULL) or org-specific.
  return [or(eq(tour_operator.org_id, scope.orgId), isNull(tour_operator.org_id))!];
}

export const tourOperatorRepository = {
  async findById(id: string, scope?: Scope) {
    const conds: SQL[] = [eq(tour_operator.id, id), ...buildOrgScopeConds(scope)];
    const [result] = await db.select().from(tour_operator).where(and(...conds)).limit(1);
    if (!result) return undefined;
    const commissions = await db.select().from(tour_package_commission).where(eq(tour_package_commission.tour_operator_id, id));
    return { ...result, commissions };
  },

  async findAll(scope?: Scope) {
    const conds = buildOrgScopeConds(scope);
    const query = db.select().from(tour_operator);
    const operators = conds.length > 0
      ? await query.where(and(...conds)).orderBy(tour_operator.name)
      : await query.orderBy(tour_operator.name);
    if (operators.length === 0) return [];
    const allCommissions = await db.select().from(tour_package_commission);
    return operators.map((op) => ({
      ...op,
      commissions: allCommissions.filter((c) => c.tour_operator_id === op.id),
    }));
  },

  async create(data: any, scope?: Scope) {
    const { commissions: _c, ...rest } = data;
    const values = scope ? { ...rest, org_id: rest.org_id ?? scope.orgId ?? null } : rest;
    const [row] = await db.insert(tour_operator).values(values).returning();
    return row;
  },

  async update(id: string, data: any, scope?: Scope) {
    const { commissions: _c, ...rest } = data;
    const conds: SQL[] = [eq(tour_operator.id, id), ...buildOrgScopeConds(scope)];
    const [row] = await db.update(tour_operator).set(rest).where(and(...conds)).returning();
    return row || undefined;
  },

  async remove(id: string, scope?: Scope) {
    const conds: SQL[] = [eq(tour_operator.id, id), ...buildOrgScopeConds(scope)];
    const result = await db.delete(tour_operator).where(and(...conds)).returning({ id: tour_operator.id });
    return result.length > 0;
  },
};
