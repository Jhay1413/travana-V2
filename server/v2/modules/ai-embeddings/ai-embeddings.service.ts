import { embedText } from "../../utils/embeddings";
import { aiEmbeddingsRepository, type EmbeddingMatch } from "./ai-embeddings.repository";

// Service: embed + persist + retrieve. Embeddings are a BEST-EFFORT enrichment —
// a failure here must never break the caller (a KB save, a quote save, or a
// webhook reply). So sync/remove swallow errors and retrieve returns [].

export type EmbeddingSourceType = "knowledge" | "quote";

export interface SyncSourceInput {
  orgId: string;
  sourceType: EmbeddingSourceType;
  sourceId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface RetrieveInput {
  orgId: string;
  sourceType: EmbeddingSourceType;
  query: string;
  limit: number;
}

export const aiEmbeddingsService = {
  // Embed `content` and upsert the row. No-op (logged) on any failure.
  async syncSource(input: SyncSourceInput): Promise<void> {
    const content = input.content?.trim();
    if (!content) return;
    try {
      const embedding = await embedText(content);
      await aiEmbeddingsRepository.upsert({
        orgId: input.orgId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        content,
        metadata: input.metadata ?? null,
        embedding,
      });
    } catch (err) {
      console.warn(
        `[ai-embeddings] syncSource failed (org=${input.orgId} ${input.sourceType}/${input.sourceId}):`,
        err instanceof Error ? err.message : err,
      );
    }
  },

  async removeSource(orgId: string, sourceType: EmbeddingSourceType, sourceId: string): Promise<void> {
    try {
      await aiEmbeddingsRepository.deleteBySource(orgId, sourceType, sourceId);
    } catch (err) {
      console.warn(
        `[ai-embeddings] removeSource failed (org=${orgId} ${sourceType}/${sourceId}):`,
        err instanceof Error ? err.message : err,
      );
    }
  },

  // Remove by (sourceType, sourceId) without needing the org — for deletes where
  // the org can't be resolved. sourceId must be globally unique (see repository).
  async removeSourceById(sourceType: EmbeddingSourceType, sourceId: string): Promise<void> {
    try {
      await aiEmbeddingsRepository.deleteBySourceId(sourceType, sourceId);
    } catch (err) {
      console.warn(
        `[ai-embeddings] removeSourceById failed (${sourceType}/${sourceId}):`,
        err instanceof Error ? err.message : err,
      );
    }
  },

  // Embed the query and return nearest matches. Returns [] on any failure so the
  // reply flow can proceed with no retrieved context.
  async retrieve(input: RetrieveInput): Promise<EmbeddingMatch[]> {
    const query = input.query?.trim();
    if (!query) return [];
    try {
      const queryEmbedding = await embedText(query);
      return await aiEmbeddingsRepository.search({
        orgId: input.orgId,
        sourceType: input.sourceType,
        queryEmbedding,
        limit: input.limit,
      });
    } catch (err) {
      console.warn(
        `[ai-embeddings] retrieve failed (org=${input.orgId} ${input.sourceType}):`,
        err instanceof Error ? err.message : err,
      );
      return [];
    }
  },
};
