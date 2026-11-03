import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '../../config/database';
import { org_tour_operator, tour_operator, type InsertOrgTourOperator, type OrgTourOperator } from '@shared/schema';
import { seedNameKey } from '@shared/tour-operator-seed';
import type { RawOrgOperator } from './tour-operator.types';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const joinedColumns = {
  linkId: org_tour_operator.id,
  operatorId: tour_operator.id,
  name: tour_operator.name,
  code: tour_operator.code,
  website: tour_operator.website,
  phone: tour_operator.phone,
  logo_url: tour_operator.logo_url,
  username: org_tour_operator.username,
  encrypted_password: org_tour_operator.encrypted_password,
  commission_percentage: org_tour_operator.commission_percentage,
  balance_due_weeks: org_tour_operator.balance_due_weeks,
  is_active: org_tour_operator.is_active,
  updated_at: org_tour_operator.updated_at,
};

/** Fields a link update may change. */
export type OrgOperatorUpdate = Partial<
  Pick<InsertOrgTourOperator, 'commission_percentage' | 'balance_due_weeks' | 'username' | 'encrypted_password' | 'is_active' | 'updated_by'>
>;

/**
 * Per-organisation operator settings. EVERY query leads with `org_id = $orgId`:
 * a link id from another organisation can never be read or changed.
 */
export const orgTourOperatorRepository = {
  /** Runs `fn` in one database transaction (used by the bulk import). */
  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return db.transaction(fn);
  },

  async listForOrg(orgId: string, includeInactive: boolean, tx?: Tx): Promise<RawOrgOperator[]> {
    const runner = tx ?? db;
    const conds: SQL[] = [eq(org_tour_operator.org_id, orgId)];
    if (!includeInactive) conds.push(eq(org_tour_operator.is_active, true));
    return runner
      .select(joinedColumns)
      .from(org_tour_operator)
      .innerJoin(tour_operator, eq(tour_operator.id, org_tour_operator.tour_operator_id))
      .where(and(...conds))
      .orderBy(sql`lower(${tour_operator.name})`);
  },

  async findLink(orgId: string, linkId: string, tx?: Tx): Promise<RawOrgOperator | null> {
    const runner = tx ?? db;
    const [row] = await runner
      .select(joinedColumns)
      .from(org_tour_operator)
      .innerJoin(tour_operator, eq(tour_operator.id, org_tour_operator.tour_operator_id))
      .where(and(eq(org_tour_operator.org_id, orgId), eq(org_tour_operator.id, linkId)))
      .limit(1);
    return row ?? null;
  },

  async findLinkByOperator(orgId: string, operatorId: string, tx?: Tx): Promise<RawOrgOperator | null> {
    const runner = tx ?? db;
    const [row] = await runner
      .select(joinedColumns)
      .from(org_tour_operator)
      .innerJoin(tour_operator, eq(tour_operator.id, org_tour_operator.tour_operator_id))
      .where(and(eq(org_tour_operator.org_id, orgId), eq(org_tour_operator.tour_operator_id, operatorId)))
      .limit(1);
    return row ?? null;
  },

  /** Inserts a link; returns null when this org already has the operator. */
  async insertLink(values: InsertOrgTourOperator, tx?: Tx): Promise<OrgTourOperator | null> {
    const runner = tx ?? db;
    const [row] = await runner
      .insert(org_tour_operator)
      .values(values)
      .onConflictDoNothing({ target: [org_tour_operator.org_id, org_tour_operator.tour_operator_id] })
      .returning();
    return row ?? null;
  },

  /**
   * Links a (new) org to the given SEED operators at their seed commission.
   * Catalogue rows are matched by lower(name); seed names missing from the
   * catalogue are created. Existing links are left alone. A rate is never
   * defaulted: only an explicit seed percentage is written. Returns the number
   * of links created.
   */
  async linkSeedOperators(
    orgId: string,
    seed: ReadonlyArray<{ name: string | null; commission_percentage: string }>,
    userId: string | null,
    tx?: Tx,
  ): Promise<number> {
    const runner = tx ?? db;
    const wanted = new Map<string, { name: string; commission: string }>();
    for (const op of seed) {
      const key = seedNameKey(op.name);
      if (key && !wanted.has(key)) wanted.set(key, { name: op.name!.trim(), commission: op.commission_percentage });
    }
    if (wanted.size === 0) return 0;
    const keys = Array.from(wanted.keys());

    const idByKey = new Map<string, string>();
    const remember = (rows: Array<{ id: string; name: string }>) => {
      for (const r of rows) idByKey.set(seedNameKey(r.name), r.id);
    };
    remember(await runner.select({ id: tour_operator.id, name: tour_operator.name }).from(tour_operator).where(inArray(sql<string>`lower(${tour_operator.name})`, keys)));

    const missing = keys.filter((k) => !idByKey.has(k));
    if (missing.length > 0) {
      remember(
        await runner
          .insert(tour_operator)
          .values(missing.map((k) => ({ name: wanted.get(k)!.name, created_by: userId })))
          .onConflictDoNothing()
          .returning({ id: tour_operator.id, name: tour_operator.name }),
      );
      // A concurrent request may have created some of them first: pick those up.
      const stillMissing = keys.filter((k) => !idByKey.has(k));
      if (stillMissing.length > 0) {
        remember(await runner.select({ id: tour_operator.id, name: tour_operator.name }).from(tour_operator).where(inArray(sql<string>`lower(${tour_operator.name})`, stillMissing)));
      }
    }

    const links = keys.flatMap((k) => {
      const operatorId = idByKey.get(k);
      if (!operatorId) return [];
      return [{
        org_id: orgId,
        tour_operator_id: operatorId,
        commission_percentage: wanted.get(k)!.commission,
        created_by: userId,
        updated_by: userId,
      }];
    });
    if (links.length === 0) return 0;
    const inserted = await runner
      .insert(org_tour_operator)
      .values(links)
      .onConflictDoNothing({ target: [org_tour_operator.org_id, org_tour_operator.tour_operator_id] })
      .returning({ id: org_tour_operator.id });
    return inserted.length;
  },

  async updateLink(orgId: string, linkId: string, values: OrgOperatorUpdate, tx?: Tx): Promise<OrgTourOperator | null> {
    const runner = tx ?? db;
    const [row] = await runner
      .update(org_tour_operator)
      .set({ ...values, updated_at: new Date() })
      .where(and(eq(org_tour_operator.org_id, orgId), eq(org_tour_operator.id, linkId)))
      .returning();
    return row ?? null;
  },

  async deleteLink(orgId: string, linkId: string): Promise<boolean> {
    const rows = await db
      .delete(org_tour_operator)
      .where(and(eq(org_tour_operator.org_id, orgId), eq(org_tour_operator.id, linkId)))
      .returning({ id: org_tour_operator.id });
    return rows.length > 0;
  },

  /** Which of `ids` (catalogue ids) this org has linked, active or not. */
  async findLinkedOperatorIds(orgId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await db
      .select({ id: org_tour_operator.tour_operator_id })
      .from(org_tour_operator)
      .where(and(eq(org_tour_operator.org_id, orgId), inArray(org_tour_operator.tour_operator_id, ids)));
    return rows.map((r) => r.id);
  },

  /**
   * Makes sure the org has a link; never changes an existing one. The commission is
   * NULL ("not set") unless an explicit one (a seed rate) is passed.
   */
  async ensureLink(
    orgId: string,
    operatorId: string,
    userId: string | null,
    commissionPercentage: string | null = null,
  ): Promise<{ created: boolean; linkId: string }> {
    const inserted = await orgTourOperatorRepository.insertLink({
      org_id: orgId,
      tour_operator_id: operatorId,
      commission_percentage: commissionPercentage,
      created_by: userId,
      updated_by: userId,
    });
    if (inserted) return { created: true, linkId: inserted.id };
    const existing = await orgTourOperatorRepository.findLinkByOperator(orgId, operatorId);
    if (!existing) throw new Error('Tour operator link vanished during ensureLink');
    return { created: false, linkId: existing.linkId };
  },
};
