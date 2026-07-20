import { AppError } from "./error-handler";
import { getOpenAI } from "./ai-model";

// Shared OpenAI embeddings helper. All embeddings in the app go through here so
// the model + dimension are consistent (the pgvector column and HNSW index are
// fixed at 1536 dims — a wrong-length vector would corrupt the index).

export const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

function assertDims(vector: number[]): number[] {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new AppError(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${vector.length}`,
      500,
    );
  }
  return vector;
}

// Embed a single string → 1536-dim vector.
export async function embedText(text: string): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({ model: EMBEDDING_MODEL, input: text });
  const vector = res.data[0]?.embedding;
  if (!vector) throw new AppError("Embedding response was empty", 500);
  return assertDims(vector);
}

// Embed many strings in one call (order preserved), for batched backfill.
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await getOpenAI().embeddings.create({ model: EMBEDDING_MODEL, input: texts });
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => assertDims(d.embedding));
}
