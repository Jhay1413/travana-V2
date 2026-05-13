import { db } from '../../config/database';
import { tour_operator } from '@shared/schema';
import { eq, and, type SQL } from 'drizzle-orm';
import type { Scope } from '../../utils/scope';

function buildOrgScopeConds(scope?: Scope): SQL[] {
  // Platform admins manage the global catalog (org_id IS NULL rows are seeds copied on org signup).
  // Org users see ONLY their org's copies — see migration 0013.
  if (!scope || scope.orgRole === 'platform_admin') return [];
  return [eq(tour_operator.org_id, scope.orgId)];
}

export const tourOperatorRepository = {
  async findById(id: string, scope?: Scope) {
    const conds: SQL[] = [eq(tour_operator.id, id), ...buildOrgScopeConds(scope)];
    const [result] = await db.select().from(tour_operator).where(and(...conds)).limit(1);
    return result || undefined;
  },

  async findAll(scope?: Scope) {
    const conds = buildOrgScopeConds(scope);
    const query = db.select().from(tour_operator);
    return conds.length > 0
      ? await query.where(and(...conds)).orderBy(tour_operator.name)
      : await query.orderBy(tour_operator.name);
  },

  async create(data: any, scope?: Scope) {
    const values = scope ? { ...data, org_id: data.org_id ?? scope.orgId ?? null } : data;
    const [row] = await db.insert(tour_operator).values(values).returning();
    return row;
  },

  async update(id: string, data: any, scope?: Scope) {
    const conds: SQL[] = [eq(tour_operator.id, id), ...buildOrgScopeConds(scope)];
    const [row] = await db.update(tour_operator).set(data).where(and(...conds)).returning();
    return row || undefined;
  },

  async remove(id: string, scope?: Scope) {
    const conds: SQL[] = [eq(tour_operator.id, id), ...buildOrgScopeConds(scope)];
    const result = await db.delete(tour_operator).where(and(...conds)).returning({ id: tour_operator.id });
    return result.length > 0;
  },
};
