import { embedText } from "../../utils/embeddings";
import { aiEmbeddingsRepository, type EmbeddingMatch, type RetrievalAudience } from "./ai-embeddings.repository";

// Service: embed + persist + retrieve. Embeddings are a BEST-EFFORT enrichment —
// a failure here must never break the caller (a KB save, a quote save, or a
// webhook reply). So sync/remove swallow errors and retrieve returns [].

export type { RetrievalAudience } from "./ai-embeddings.repository";
export { DEFAULT_MAX_COSINE_DISTANCE } from "./ai-embeddings.repository";

// "deal" = a travel_deal posted to Facebook — customer-facing (price included),
// unlike "quote" embeddings which are internal-only reference material.
export type EmbeddingSourceType = "knowledge" | "quote" | "deal";

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
  // Maximum cosine distance a match may have to be returned. Defaults to
  // DEFAULT_MAX_COSINE_DISTANCE (applied by the repository) when omitted.
  maxDistance?: number;
  // When provided, restricts matches to rows whose metadata audience is
  // visible to this bot (fail-closed on missing audience metadata). Omit to
  // skip audience filtering (existing behaviour) — e.g. when the caller does
  // its own JS-side audience filtering downstream.
  audience?: RetrievalAudience;
}

export const aiEmbeddingsService = {
  // Embed `content` and upsert the row. No-op (logged) on any failure — but on
  // failure we also best-effort DELETE any existing vector row for this
  // source, rather than leaving it in place. Otherwise a re-embed that fails
  // right after a source edit (e.g. a KB entry's audience tightened from
  // general to admin) would leave the OLD content/metadata live and
  // retrievable under the OLD (now-wrong) audience indefinitely.
  async syncSource(input: SyncSourceInput): Promise<void> {
    const content = input.content?.trim();
    if (!content) return;
    try {
      const embedding = await embedText(content, { orgId: input.orgId, site: "ai-embeddings:syncSource" });
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
      try {
        await aiEmbeddingsRepository.deleteBySource(input.orgId, input.sourceType, input.sourceId);
      } catch (deleteErr) {
        console.warn(
          `[ai-embeddings] syncSource stale-row cleanup also failed (org=${input.orgId} ${input.sourceType}/${input.sourceId}):`,
          deleteErr instanceof Error ? deleteErr.message : deleteErr,
        );
      }
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
      const queryEmbedding = await embedText(query, { orgId: input.orgId, site: "ai-embeddings:retrieve" });
      return await aiEmbeddingsRepository.search({
        orgId: input.orgId,
        sourceType: input.sourceType,
        queryEmbedding,
        limit: input.limit,
        maxDistance: input.maxDistance,
        audience: input.audience,
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
