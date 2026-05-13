import { db } from '../../../config/database';
import { tour_operator } from '@shared/schema';
import { sql, ilike, eq, and, asc, type SQL } from 'drizzle-orm';
import type { Scope } from '../../utils/scope';

function parsePagination(query: Record<string, any>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || '').trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

function buildScopeConds(scope?: Scope): SQL[] {
  if (!scope || scope.orgRole === 'platform_admin') return [];
  return [eq(tour_operator.org_id, scope.orgId)];
}

export const tourOperatorSettingsRepository = {
  async findAll(query: Record<string, any>, scope?: Scope) {
    const { page, limit, search, offset } = parsePagination(query);
    const conds: SQL[] = [...buildScopeConds(scope)];
    if (search) conds.push(ilike(tour_operator.name, `%${search}%`));
    const where = conds.length > 0 ? and(...conds) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(tour_operator).where(where);
    const rows = await db.select().from(tour_operator).where(where).orderBy(asc(tour_operator.name)).limit(limit).offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findById(id: string, scope?: Scope) {
    const conds: SQL[] = [eq(tour_operator.id, id), ...buildScopeConds(scope)];
    const [op] = await db.select().from(tour_operator).where(and(...conds));
    return op || null;
  },

  async create(data: any, scope?: Scope) {
    const { id: _id, ...rest } = data;
    const values = scope && scope.orgRole !== 'platform_admin'
      ? { ...rest, org_id: scope.orgId }
      : { ...rest, org_id: rest.org_id ?? null };
    const [row] = await db.insert(tour_operator).values(values).returning();
    return row;
  },

  async update(id: string, data: any, scope?: Scope) {
    const { id: _id, org_id: _orgId, ...rest } = data;
    const conds: SQL[] = [eq(tour_operator.id, id), ...buildScopeConds(scope)];
    const [row] = await db.update(tour_operator).set(rest).where(and(...conds)).returning();
    return row || null;
  },

  async remove(id: string, scope?: Scope) {
    const conds: SQL[] = [eq(tour_operator.id, id), ...buildScopeConds(scope)];
    await db.delete(tour_operator).where(and(...conds));
  },
};
