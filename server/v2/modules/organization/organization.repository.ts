import { db } from "../../config/database";
import { organization, type Organization, type InsertOrganization } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const organizationRepository = {
  async findAll(): Promise<Organization[]> {
    return db.select().from(organization);
  },

  async findById(id: string): Promise<Organization | null> {
    const [row] = await db.select().from(organization).where(eq(organization.id, id)).limit(1);
    return row ?? null;
  },

  async findBySlug(slug: string): Promise<Organization | null> {
    const [row] = await db.select().from(organization).where(eq(organization.slug, slug)).limit(1);
    return row ?? null;
  },

  async create(data: InsertOrganization, tx?: Tx): Promise<Organization> {
    const runner = tx ?? db;
    const [row] = await runner.insert(organization).values(data).returning();
    return row;
  },

  /**
   * Updates the org in one statement. `data.settings` is treated as a patch and shallow-merged
   * into the stored jsonb in SQL (top-level keys), so a concurrent settings write is never lost.
   */
  async update(id: string, data: Partial<InsertOrganization>): Promise<Organization | null> {
    const { settings, ...rest } = data;
    const values: Partial<InsertOrganization> = { ...rest };
    if (settings !== undefined) {
      values.settings = sql`coalesce(${organization.settings}, '{}'::jsonb) || ${JSON.stringify(settings ?? {})}::jsonb`;
    }
    const [row] = await db.update(organization).set(values).where(eq(organization.id, id)).returning();
    return row ?? null;
  },

  /**
   * Atomically merges `patch` into one top-level section of `settings` (a single SQL
   * statement, so concurrent writers to other sections or other keys are never clobbered).
   */
  async mergeSettingsSection(id: string, section: string, patch: Record<string, unknown>, tx?: Tx): Promise<void> {
    const runner = tx ?? db;
    await runner
      .update(organization)
      .set({
        settings: sql`coalesce(${organization.settings}, '{}'::jsonb) || jsonb_build_object(${section}::text, (CASE WHEN jsonb_typeof(${organization.settings} -> ${section}::text) = 'object' THEN ${organization.settings} -> ${section}::text ELSE '{}'::jsonb END) || ${JSON.stringify(patch)}::jsonb)`,
      })
      .where(eq(organization.id, id));
  },

  async remove(id: string): Promise<void> {
    await db.delete(organization).where(eq(organization.id, id));
  },
};
