import { and, eq } from 'drizzle-orm';
import { db } from '../../config/database';
import { supplier_scraper, type InsertSupplierScraper, type SupplierScraper } from '@shared/schema';

// Org-scoped data access for supplier scraper configs. Credentials are stored
// already-encrypted by the service — this layer never encrypts/decrypts.
export const scraperRepository = {
  async findAllByOrg(orgId: string): Promise<SupplierScraper[]> {
    return db.select().from(supplier_scraper).where(eq(supplier_scraper.org_id, orgId));
  },

  async findActiveByOrg(orgId: string): Promise<SupplierScraper[]> {
    return db
      .select()
      .from(supplier_scraper)
      .where(and(eq(supplier_scraper.org_id, orgId), eq(supplier_scraper.is_active, true)));
  },

  async findById(id: string, orgId: string): Promise<SupplierScraper | null> {
    const [row] = await db
      .select()
      .from(supplier_scraper)
      .where(and(eq(supplier_scraper.id, id), eq(supplier_scraper.org_id, orgId)));
    return row || null;
  },

  async findBySupplierKey(orgId: string, supplierKey: string): Promise<SupplierScraper | null> {
    const [row] = await db
      .select()
      .from(supplier_scraper)
      .where(and(eq(supplier_scraper.org_id, orgId), eq(supplier_scraper.supplier_key, supplierKey)));
    return row || null;
  },

  async create(data: InsertSupplierScraper): Promise<SupplierScraper> {
    const [row] = await db.insert(supplier_scraper).values(data).returning();
    return row;
  },

  async update(
    id: string,
    orgId: string,
    data: Partial<InsertSupplierScraper>,
  ): Promise<SupplierScraper | null> {
    const [row] = await db
      .update(supplier_scraper)
      .set({ ...data, updated_at: new Date() })
      .where(and(eq(supplier_scraper.id, id), eq(supplier_scraper.org_id, orgId)))
      .returning();
    return row || null;
  },

  async remove(id: string, orgId: string): Promise<void> {
    await db
      .delete(supplier_scraper)
      .where(and(eq(supplier_scraper.id, id), eq(supplier_scraper.org_id, orgId)));
  },
};
