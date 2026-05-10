import { db } from "../../config/database";
import { organization, type Organization, type InsertOrganization } from "@shared/schema";
import { eq } from "drizzle-orm";

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

  async update(id: string, data: Partial<InsertOrganization>): Promise<Organization | null> {
    const [row] = await db.update(organization).set(data).where(eq(organization.id, id)).returning();
    return row ?? null;
  },

  async remove(id: string): Promise<void> {
    await db.delete(organization).where(eq(organization.id, id));
  },
};
