/**
 * Backfill ai_embeddings for existing ACTIVE knowledge-base entries.
 *
 * The KB sync hook only embeds an entry when it is created/edited, so entries
 * that pre-date the feature (or that were never re-saved) have no embedding and
 * are invisible to the assistant's retrieval. Run this once to embed them all.
 *
 * Requires the ai_embeddings migration to be applied first. Safe to re-run —
 * aiEmbeddingsRepository.upsert is idempotent on (org_id, source_type, source_id).
 *
 *   npm run db:backfill-kb-embeddings
 */
import { knowledgeBaseRepository } from "../server/v2/modules/knowledge-base/knowledge-base.repository";
import { aiEmbeddingsRepository } from "../server/v2/modules/ai-embeddings/ai-embeddings.repository";
import { embedBatch } from "../server/v2/utils/embeddings";

const BATCH_SIZE = 50;

async function main() {
  console.log("Backfilling knowledge-base embeddings...");

  const entries = await knowledgeBaseRepository.listAllActive();
  console.log(`  found ${entries.length} active entries`);

  let totalEmbedded = 0;
  let totalSkippedEmpty = 0;

  for (let start = 0; start < entries.length; start += BATCH_SIZE) {
    const batch = entries.slice(start, start + BATCH_SIZE);

    const embeddableRows: typeof batch = [];
    const embeddableTexts: string[] = [];
    for (const row of batch) {
      const text = `${row.title}\n${row.content}`.trim();
      if (text) {
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
          sourceType: "knowledge",
          sourceId: row.id,
          content: embeddableTexts[i],
          metadata: { category: row.category, isActive: row.isActive },
          embedding: vectors[i],
        });
        totalEmbedded++;
      }
    }

    console.log(`  processed ${Math.min(start + BATCH_SIZE, entries.length)}/${entries.length} (embedded ${totalEmbedded}, skipped ${totalSkippedEmpty})`);
  }

  console.log("\nDone.");
  console.log(`  entries seen:             ${entries.length}`);
  console.log(`  embedded:                 ${totalEmbedded}`);
  console.log(`  skipped (empty content):  ${totalSkippedEmpty}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
