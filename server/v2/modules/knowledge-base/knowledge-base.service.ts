import { AppError } from "../../utils/error-handler";
import { knowledgeBaseRepository, type KbCreateInput, type KbUpdateInput } from "./knowledge-base.repository";
import { aiEmbeddingsService } from "../ai-embeddings/ai-embeddings.service";
import type { OrgKnowledgeBase } from "@shared/schema";

// Keep the vector store in step with a KB entry. Best-effort: syncSource/removeSource
// swallow their own errors, and we don't await, so embedding never blocks CRUD.
// An INACTIVE entry is removed from the store rather than embedded, so deactivated
// content can't resurface through vector retrieval (the static-KB path already
// filters on isActive; retrieval has no such gate).
function syncEmbedding(row: OrgKnowledgeBase): void {
  if (!row.isActive) {
    void aiEmbeddingsService.removeSource(row.orgId, "knowledge", row.id);
    return;
  }
  void aiEmbeddingsService.syncSource({
    orgId: row.orgId,
    sourceType: "knowledge",
    sourceId: row.id,
    content: `${row.title}\n${row.content}`,
    metadata: { category: row.category, audience: row.audience, isActive: row.isActive },
  });
}

export const knowledgeBaseService = {
  list: (orgId: string): Promise<OrgKnowledgeBase[]> => knowledgeBaseRepository.list(orgId),

  async create(orgId: string, data: KbCreateInput, userId: string | null): Promise<OrgKnowledgeBase> {
    const row = await knowledgeBaseRepository.create(orgId, data, userId);
    syncEmbedding(row);
    return row;
  },

  async update(orgId: string, id: string, data: KbUpdateInput): Promise<OrgKnowledgeBase> {
    const row = await knowledgeBaseRepository.update(orgId, id, data);
    if (!row) throw new AppError("Knowledge base entry not found", 404);
    syncEmbedding(row);
    return row;
  },

  async remove(orgId: string, id: string): Promise<void> {
    const ok = await knowledgeBaseRepository.remove(orgId, id);
    if (!ok) throw new AppError("Knowledge base entry not found", 404);
    void aiEmbeddingsService.removeSource(orgId, "knowledge", id);
  },
};
