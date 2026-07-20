import { AppError } from "./error-handler";
import { getOpenAI } from "./ai-model";
import { usageService } from "../modules/usage/usage.service";

// Shared OpenAI embeddings helper. All embeddings in the app go through here so
// the model + dimension are consistent (the pgvector column and HNSW index are
// fixed at 1536 dims — a wrong-length vector would corrupt the index).

export const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

// Usage-metering context — optional so existing callers keep working
// unchanged; only `ai-embeddings.service.ts` threads a real orgId through.
export interface EmbeddingUsageCtx {
  orgId?: string;
  site?: string;
}

function assertDims(vector: number[]): number[] {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new AppError(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${vector.length}`,
      500,
    );
  }
  return vector;
}

// Embeddings responses only carry prompt/total tokens (no completion tokens).
function recordEmbeddingUsage(usage: { prompt_tokens: number; total_tokens: number } | undefined, ctx?: EmbeddingUsageCtx): void {
  if (!ctx?.orgId || !usage) return;
  const totalTokens = usage.total_tokens ?? usage.prompt_tokens ?? 0;
  void usageService.recordAiUsage({
    orgId: ctx.orgId,
    feature: "embedding",
    site: ctx.site ?? "embeddings",
    model: EMBEDDING_MODEL,
    usage: {
      promptTokens: usage.prompt_tokens ?? totalTokens,
      completionTokens: 0,
      totalTokens,
    },
  });
}

// Embed a single string → 1536-dim vector.
export async function embedText(text: string, ctx?: EmbeddingUsageCtx): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({ model: EMBEDDING_MODEL, input: text });
  const vector = res.data[0]?.embedding;
  if (!vector) throw new AppError("Embedding response was empty", 500);
  recordEmbeddingUsage(res.usage, ctx);
  return assertDims(vector);
}

// Embed many strings in one call (order preserved), for batched backfill.
export async function embedBatch(texts: string[], ctx?: EmbeddingUsageCtx): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await getOpenAI().embeddings.create({ model: EMBEDDING_MODEL, input: texts });
  recordEmbeddingUsage(res.usage, ctx);
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => assertDims(d.embedding));
}
