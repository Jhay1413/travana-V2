import { eq } from 'drizzle-orm';
import { db } from '../../config/database';
import {
  supplier_scraper,
  supplier_spec_archive,
  type InsertSupplierScraper,
  type SupplierScraper,
  type SupplierSpecArchive,
} from '@shared/schema';

// Data access for supplier scraper configs. PLATFORM-WIDE: a spec describes how
// to read a portal's pages, which is the same for every agency, so nothing here
// is scoped by organisation. Credentials are stored already-encrypted by the
// service — this layer never encrypts/decrypts.
export const scraperRepository = {
  async findAll(): Promise<SupplierScraper[]> {
    return db.select().from(supplier_scraper);
  },

  async findAllActive(): Promise<SupplierScraper[]> {
    return db.select().from(supplier_scraper).where(eq(supplier_scraper.is_active, true));
  },

  async findById(id: string): Promise<SupplierScraper | null> {
    const [row] = await db.select().from(supplier_scraper).where(eq(supplier_scraper.id, id));
    return row || null;
  },

  async findBySupplierKey(supplierKey: string): Promise<SupplierScraper | null> {
    const [row] = await db
      .select()
      .from(supplier_scraper)
      .where(eq(supplier_scraper.supplier_key, supplierKey));
    return row || null;
  },

  async create(data: InsertSupplierScraper): Promise<SupplierScraper> {
    const [row] = await db.insert(supplier_scraper).values(data).returning();
    return row;
  },

  async update(id: string, data: Partial<InsertSupplierScraper>): Promise<SupplierScraper | null> {
    const [row] = await db
      .update(supplier_scraper)
      .set({ ...data, updated_at: new Date() })
      .where(eq(supplier_scraper.id, id))
      .returning();
    return row || null;
  },

  async remove(id: string): Promise<void> {
    await db.delete(supplier_scraper).where(eq(supplier_scraper.id, id));
  },

  // ── Spec archive ──────────────────────────────────────────────────────────
  // Reviewed specs live outside supplier_scraper so deleting a supplier can't
  // destroy them. Keyed by host so a portal recreated under a different
  // supplier_key still finds its spec.
  //
  // 42P01 = undefined_table: the archive migration hasn't been applied. The
  // archive is an enhancement, not a dependency — an un-migrated deployment
  // should still import and delete suppliers, just without spec protection.
  // Any other error is a real fault and propagates.

  async findArchivedSpec(hostIncludes: string): Promise<SupplierSpecArchive | null> {
    if (!hostIncludes) return null;
    try {
      const [row] = await db
        .select()
        .from(supplier_spec_archive)
        .where(eq(supplier_spec_archive.host_includes, hostIncludes));
      return row || null;
    } catch (err) {
      if ((err as { code?: string })?.code === '42P01') return null;
      throw err;
    }
  },

  async archiveSpec(data: {
    hostIncludes: string;
    supplierKey: string;
    extraction: unknown;
    approved: boolean;
  }): Promise<void> {
    if (!data.hostIncludes || !data.extraction) return;
    try {
      await db
        .insert(supplier_spec_archive)
        .values({
          host_includes: data.hostIncludes,
          supplier_key: data.supplierKey,
          extraction: data.extraction,
          approved: data.approved,
        })
        .onConflictDoUpdate({
          target: supplier_spec_archive.host_includes,
          set: {
            supplier_key: data.supplierKey,
            extraction: data.extraction,
            approved: data.approved,
            archived_at: new Date(),
          },
        });
    } catch (err) {
      if ((err as { code?: string })?.code !== '42P01') throw err;
    }
  },
};
