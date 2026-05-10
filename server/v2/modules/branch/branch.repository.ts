import { db } from "../../config/database";
import { branches, type Branch, type InsertBranch } from "@shared/schema";
import { and, eq, ne, asc } from "drizzle-orm";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const branchRepository = {
  async findAllByOrg(orgId: string): Promise<Branch[]> {
    return db
      .select()
      .from(branches)
      .where(eq(branches.organizationId, orgId))
      .orderBy(asc(branches.name));
  },

  async findById(id: string, orgId: string): Promise<Branch | null> {
    const [row] = await db
      .select()
      .from(branches)
      .where(and(eq(branches.id, id), eq(branches.organizationId, orgId)))
      .limit(1);
    return row ?? null;
  },

  async findDefaultByOrg(orgId: string): Promise<Branch | null> {
    const [row] = await db
      .select()
      .from(branches)
      .where(and(eq(branches.organizationId, orgId), eq(branches.isDefault, true)))
      .limit(1);
    return row ?? null;
  },

  async countByOrg(orgId: string): Promise<number> {
    const rows = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.organizationId, orgId));
    return rows.length;
  },

  async create(data: InsertBranch, tx?: Tx): Promise<Branch> {
    const runner = tx ?? db;
    const [row] = await runner.insert(branches).values(data).returning();
    return row;
  },

  async update(id: string, data: Partial<InsertBranch>, orgId: string, tx?: Tx): Promise<Branch | null> {
    const runner = tx ?? db;
    const [row] = await runner
      .update(branches)
      .set(data)
      .where(and(eq(branches.id, id), eq(branches.organizationId, orgId)))
      .returning();
    return row ?? null;
  },

  async clearDefaultExcept(orgId: string, keepId: string, tx?: Tx): Promise<void> {
    const runner = tx ?? db;
    await runner
      .update(branches)
      .set({ isDefault: false })
      .where(and(eq(branches.organizationId, orgId), ne(branches.id, keepId)));
  },

  async remove(id: string, orgId: string): Promise<void> {
    await db.delete(branches).where(and(eq(branches.id, id), eq(branches.organizationId, orgId)));
  },
};
