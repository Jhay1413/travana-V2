import { and, eq, ilike, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '../../config/database';
import { org_tour_operator, tour_operator, type InsertTourOperatorLookup, type TourOperatorLookup } from '@shared/schema';
import { escapeLike } from '../../utils/escape-like';
import type { CatalogueRow } from './tour-operator.types';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const CATALOGUE_SEARCH_LIMIT = 50;
export const CATALOGUE_BROWSE_LIMIT = 200;

/** Catalogue only (one entity). Org settings live in org-tour-operator.repository. */
export const tourOperatorRepository = {
  async findById(id: string, tx?: Tx): Promise<TourOperatorLookup | null> {
    const runner = tx ?? db;
    const [row] = await runner.select().from(tour_operator).where(eq(tour_operator.id, id)).limit(1);
    return row ?? null;
  },

  async findByIds(ids: string[]): Promise<TourOperatorLookup[]> {
    if (ids.length === 0) return [];
    return db.select().from(tour_operator).where(inArray(tour_operator.id, ids));
  },

  /** Case-insensitive exact name match on lower(name), so the unique index serves it. Names are stored trimmed. */
  async findByLowerName(name: string, tx?: Tx): Promise<TourOperatorLookup | null> {
    const runner = tx ?? db;
    const key = name.trim().toLowerCase();
    const [row] = await runner
      .select()
      .from(tour_operator)
      .where(sql`lower(${tour_operator.name}) = ${key}`)
      .limit(1);
    return row ?? null;
  },

  /** Every catalogue row whose lower(btrim(name)) is one of `keys` (already lower-cased and trimmed). */
  async findByLowerNames(keys: string[], tx?: Tx): Promise<TourOperatorLookup[]> {
    if (keys.length === 0) return [];
    const runner = tx ?? db;
    return runner
      .select()
      .from(tour_operator)
      .where(inArray(sql<string>`lower(${tour_operator.name})`, keys));
  },

  /**
   * Catalogue search for the "Add tour operator" picker. `linked` says whether
   * `orgId` already has the operator; linked rows are left out unless includeLinked.
   */
  async searchCatalogue(orgId: string, q: string | undefined, includeLinked: boolean): Promise<CatalogueRow[]> {
    const linked = sql<boolean>`exists (
      select 1 from ${org_tour_operator}
      where ${org_tour_operator.tour_operator_id} = ${tour_operator.id}
        and ${org_tour_operator.org_id} = ${orgId}
    )`;
    const conds: SQL[] = [];
    const term = q?.trim();
    if (term) conds.push(ilike(tour_operator.name, `%${escapeLike(term)}%`));
    if (!includeLinked) conds.push(sql`not ${linked}`);

    const base = db
      .select({
        id: tour_operator.id,
        name: tour_operator.name,
        code: tour_operator.code,
        website: tour_operator.website,
        phone: tour_operator.phone,
        logo_url: tour_operator.logo_url,
        linked,
      })
      .from(tour_operator);
    const filtered = conds.length > 0 ? base.where(and(...conds)) : base;
    return filtered
      .orderBy(sql`lower(${tour_operator.name})`)
      .limit(term ? CATALOGUE_SEARCH_LIMIT : CATALOGUE_BROWSE_LIMIT);
  },

  /** Inserts a catalogue row; returns null when the name already exists (unique index race). */
  async insert(values: InsertTourOperatorLookup, tx?: Tx): Promise<TourOperatorLookup | null> {
    const runner = tx ?? db;
    const [row] = await runner.insert(tour_operator).values(values).onConflictDoNothing().returning();
    return row ?? null;
  },

  async update(id: string, values: Partial<InsertTourOperatorLookup>, tx?: Tx): Promise<TourOperatorLookup | null> {
    const runner = tx ?? db;
    const [row] = await runner
      .update(tour_operator)
      .set({ ...values, updated_at: new Date() })
      .where(eq(tour_operator.id, id))
      .returning();
    return row ?? null;
  },
};
