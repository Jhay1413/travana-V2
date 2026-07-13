import { and, desc, eq } from "drizzle-orm";
import { db } from "../../config/database";
import { orgKnowledgeBase, type OrgKnowledgeBase } from "@shared/schema";

// Repository: org knowledge-base entries (org_knowledge_base), org-scoped.

export interface KbCreateInput {
  title: string;
  content: string;
  category?: string | null;
  isActive?: boolean;
}
export type KbUpdateInput = Partial<KbCreateInput>;

export const knowledgeBaseRepository = {
  async list(orgId: string): Promise<OrgKnowledgeBase[]> {
    return db
      .select()
      .from(orgKnowledgeBase)
      .where(eq(orgKnowledgeBase.orgId, orgId))
      .orderBy(desc(orgKnowledgeBase.updatedAt));
  },

  // All ACTIVE entries across every org — for the one-off embeddings backfill.
  // (Inactive entries are intentionally excluded, matching the sync hook which
  // removes an entry's embedding when it is deactivated.)
  async listAllActive(): Promise<OrgKnowledgeBase[]> {
    return db
      .select()
      .from(orgKnowledgeBase)
      .where(eq(orgKnowledgeBase.isActive, true))
      .orderBy(orgKnowledgeBase.orgId);
  },

  async create(orgId: string, data: KbCreateInput, userId: string | null): Promise<OrgKnowledgeBase> {
    const [row] = await db
      .insert(orgKnowledgeBase)
      .values({
        orgId,
        title: data.title,
        content: data.content,
        category: data.category ?? null,
        isActive: data.isActive ?? true,
        createdBy: userId,
      })
      .returning();
    return row;
  },

  async update(orgId: string, id: string, data: KbUpdateInput): Promise<OrgKnowledgeBase | null> {
    const [row] = await db
      .update(orgKnowledgeBase)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(orgKnowledgeBase.orgId, orgId), eq(orgKnowledgeBase.id, id)))
      .returning();
    return row ?? null;
  },

  async remove(orgId: string, id: string): Promise<boolean> {
    const rows = await db
      .delete(orgKnowledgeBase)
      .where(and(eq(orgKnowledgeBase.orgId, orgId), eq(orgKnowledgeBase.id, id)))
      .returning({ id: orgKnowledgeBase.id });
    return rows.length > 0;
  },
};
