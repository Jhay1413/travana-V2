import { and, eq, sql } from "drizzle-orm";
import { db } from "../../config/database";
import { aiEmbeddings, type InsertAiEmbedding } from "@shared/schema";

// Repository: the pgvector store (ai_embeddings). Drizzle only — no embedding
// calls or business logic here. Every read/write is scoped by org_id.

export interface EmbeddingMatch {
  sourceId: string;
  content: string;
  metadata: unknown;
  distance: number;
}

// pgvector accepts the text form `[1,2,3]` (identical to JSON.stringify of the
// array) as input to a ::vector cast.
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export const aiEmbeddingsRepository = {
  // Idempotent write keyed on (org_id, source_type, source_id) — re-embedding an
  // existing source overwrites its row rather than duplicating it.
  async upsert(row: InsertAiEmbedding): Promise<void> {
    await db
      .insert(aiEmbeddings)
      .values(row)
      .onConflictDoUpdate({
        target: [aiEmbeddings.orgId, aiEmbeddings.sourceType, aiEmbeddings.sourceId],
        set: {
          content: row.content,
          metadata: row.metadata,
          embedding: row.embedding,
          updatedAt: new Date(),
        },
      });
  },

  async deleteBySource(orgId: string, sourceType: string, sourceId: string): Promise<void> {
    await db
      .delete(aiEmbeddings)
      .where(
        and(
          eq(aiEmbeddings.orgId, orgId),
          eq(aiEmbeddings.sourceType, sourceType),
          eq(aiEmbeddings.sourceId, sourceId),
        ),
      );
  },

  // Delete without an org filter, keyed on (source_type, source_id). Safe only
  // because source_id is a globally-unique id (e.g. a quote UUID), so it can
  // match at most one source's rows. Used when the caller can't resolve the org
  // (e.g. a free-quote copy whose transaction has no org) but must still clean
  // up the embedding on delete to avoid orphans.
  async deleteBySourceId(sourceType: string, sourceId: string): Promise<void> {
    await db
      .delete(aiEmbeddings)
      .where(and(eq(aiEmbeddings.sourceType, sourceType), eq(aiEmbeddings.sourceId, sourceId)));
  },

  // Cosine-distance nearest-neighbour search within one org + source type.
  // org_id is a MANDATORY filter — this is the tenant-isolation boundary.
  async search(params: {
    orgId: string;
    sourceType: string;
    queryEmbedding: number[];
    limit: number;
  }): Promise<EmbeddingMatch[]> {
    const literal = toVectorLiteral(params.queryEmbedding);
    const distance = sql<number>`${aiEmbeddings.embedding} <=> ${literal}::vector`;
    const rows = await db
      .select({
        sourceId: aiEmbeddings.sourceId,
        content: aiEmbeddings.content,
        metadata: aiEmbeddings.metadata,
        distance,
      })
      .from(aiEmbeddings)
      .where(and(eq(aiEmbeddings.orgId, params.orgId), eq(aiEmbeddings.sourceType, params.sourceType)))
      .orderBy(distance)
      .limit(params.limit);
    return rows.map((r) => ({
      sourceId: r.sourceId,
      content: r.content,
      metadata: r.metadata,
      distance: Number(r.distance),
    }));
  },
};
