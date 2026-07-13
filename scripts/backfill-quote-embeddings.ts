/**
 * Backfill ai_embeddings for existing FREE quotes (Phase 5c).
 *
 * Requires the ai_embeddings migration to be applied first (pgvector column +
 * HNSW index). Safe to re-run — aiEmbeddingsRepository.upsert is idempotent on
 * (org_id, source_type, source_id).
 *
 *   npm run db:backfill-quote-embeddings
 */
import { newQuoteRepository } from "../server/v2/modules/quote/quote.repository";
import { aiEmbeddingsRepository } from "../server/v2/modules/ai-embeddings/ai-embeddings.repository";
import { embedBatch } from "../server/v2/utils/embeddings";
import { buildQuoteEmbeddingText, buildQuoteEmbeddingMetadata } from "../server/v2/modules/quote/quote-embedding";

const BATCH_SIZE = 50;

async function main() {
  console.log("Backfilling quote embeddings for free quotes...");

  let offset = 0;
  let totalSeen = 0;
  let totalEmbedded = 0;
  let totalSkippedEmpty = 0;

  for (;;) {
    const rows = await newQuoteRepository.findFreeQuoteEmbeddingRows(offset, BATCH_SIZE);
    if (rows.length === 0) break;

    totalSeen += rows.length;

    const embeddableRows: typeof rows = [];
    const embeddableTexts: string[] = [];
    for (const row of rows) {
      const text = buildQuoteEmbeddingText(row);
      if (text.trim()) {
        embeddableRows.push(row);
        embeddableTexts.push(text);
      } else {
        totalSkippedEmpty++;
      }
    }

    if (embeddableTexts.length > 0) {
      const vectors = await embedBatch(embeddableTexts);
      for (let i = 0; i < embeddableRows.length; i++) {
        const row = embeddableRows[i];
        await aiEmbeddingsRepository.upsert({
          orgId: row.orgId,
          sourceType: "quote",
          sourceId: row.id,
          content: embeddableTexts[i],
          metadata: buildQuoteEmbeddingMetadata(row),
          embedding: vectors[i],
        });
        totalEmbedded++;
      }
    }

    console.log(`  processed ${totalSeen} quotes so far (embedded ${totalEmbedded}, skipped ${totalSkippedEmpty})`);
    offset += BATCH_SIZE;
  }

  console.log("\nDone.");
  console.log(`  quotes seen:              ${totalSeen}`);
  console.log(`  embedded:                 ${totalEmbedded}`);
  console.log(`  skipped (empty content):  ${totalSkippedEmpty}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
