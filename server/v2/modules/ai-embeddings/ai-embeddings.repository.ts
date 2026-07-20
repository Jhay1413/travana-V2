import { and, eq, sql, type SQL } from "drizzle-orm";
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

// Bot/audience a retrieval call is being made on behalf of. Mirrors
// BotAudience in ai-conversation.brain.ts plus "general" (a content
// audience, not a bot, but a valid filter value in its own right). Kept as a
// local type (rather than importing from ai-conversation.brain.ts) so this
// module has no dependency on the conversation-brain module.
export type RetrievalAudience = "sales" | "admin" | "internal" | "general";

// Cosine distance (via pgvector's `<=>`) beyond which a match is considered
// unrelated rather than "possibly relevant". Tuned for text-embedding-3-small:
// truly relevant KB/quote matches typically land well under this, while
// unrelated thin-KB filler tends to sit at/above it. Exported so callers with
// different precision/recall needs can override per-call.
export const DEFAULT_MAX_COSINE_DISTANCE = 0.45;

// pgvector accepts the text form `[1,2,3]` (identical to JSON.stringify of the
// array) as input to a ::vector cast.
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

// Lowercase `metadata->>'audience'` values eligible for a given retrieval
// audience. Deliberately mirrors retrievedAudienceAllows()'s FAIL-CLOSED
// semantics in ai-conversation.brain.ts (~lines 62-83):
//   - a row is eligible when its audience is exactly "general" ...
//   - ... OR, only for non-"internal" callers, exactly the requested audience.
//   - "internal" callers therefore only ever see "general"-audience rows.
//   - rows with missing/null audience are NEVER eligible (enforced by the
//     caller of this function via an explicit IS NOT NULL check, not by this
//     whitelist, since "missing" has no lowercase string form to whitelist).
// Exported as a pure, DB-free helper so its semantics can be unit tested
// directly against ai-conversation.brain.ts's retrievedAudienceAllows().
export function audienceAllowedValues(audience: RetrievalAudience): string[] {
  const normalized = audience.toLowerCase();
  if (normalized === "general" || normalized === "internal") return ["general"];
  return ["general", normalized];
}

// SQL predicate implementing the fail-closed audience filter above. NULL/missing
// `metadata->>'audience'` short-circuits to NULL (falsy) in the IN(...) check
// too, but the explicit IS NOT NULL keeps the fail-closed intent unambiguous.
function audienceCondition(audience: RetrievalAudience): SQL {
  const allowed = audienceAllowedValues(audience);
  return sql`(${aiEmbeddings.metadata} ->> 'audience') IS NOT NULL AND lower(${aiEmbeddings.metadata} ->> 'audience') IN (${sql.join(
    allowed.map((value) => sql`${value}`),
    sql`, `,
  )})`;
}

export interface SearchParams {
  orgId: string;
  sourceType: string;
  queryEmbedding: number[];
  limit: number;
  // Maximum cosine distance (`embedding <=> query`) a row may have to be
  // considered a match. Defaults to DEFAULT_MAX_COSINE_DISTANCE — pass a
  // higher value to widen recall, or a lower one to tighten precision.
  maxDistance?: number;
  // When provided, only rows whose metadata audience is visible to this bot
  // are returned (fail-closed on missing audience metadata). Omit to skip
  // audience filtering entirely (existing behaviour).
  audience?: RetrievalAudience;
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
  // Matches beyond maxDistance (default DEFAULT_MAX_COSINE_DISTANCE) are
  // excluded at the SQL level, and when `audience` is given the audience
  // predicate is applied before `limit`, so the top-k rows returned are
  // already both close enough AND eligible — no JS-side over-fetch/re-filter
  // needed on either dimension.
  async search(params: SearchParams): Promise<EmbeddingMatch[]> {
    const literal = toVectorLiteral(params.queryEmbedding);
    const distance = sql<number>`${aiEmbeddings.embedding} <=> ${literal}::vector`;
    const maxDistance = params.maxDistance ?? DEFAULT_MAX_COSINE_DISTANCE;

    const conditions: SQL[] = [
      eq(aiEmbeddings.orgId, params.orgId),
      eq(aiEmbeddings.sourceType, params.sourceType),
      sql`${distance} < ${maxDistance}`,
    ];
    if (params.audience) conditions.push(audienceCondition(params.audience));

    const rows = await db
      .select({
        sourceId: aiEmbeddings.sourceId,
        content: aiEmbeddings.content,
        metadata: aiEmbeddings.metadata,
        distance,
      })
      .from(aiEmbeddings)
      .where(and(...conditions))
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
